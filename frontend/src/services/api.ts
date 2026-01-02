// Dịch vụ API để giao tiếp với backend
import { API_BASE_URL } from '@/config/env';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T | null;
}

// Lấy access token từ localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Đặt access token
function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Lấy refresh token từ localStorage
function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

// Đặt refresh token
function setRefreshToken(token: string): void {
  localStorage.setItem('refresh_token', token);
}

// Xóa tất cả tokens
function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
}

// Refresh access token sử dụng refresh token
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();
    const errorMessage = data.detail || data.message || '';

    // Nếu là lỗi "Invalid token", clear tokens và trigger logout
    if (errorMessage === 'Invalid token' || errorMessage.includes('Invalid token')) {
      clearAuthToken();
      localStorage.removeItem('user_info');
      window.dispatchEvent(new CustomEvent('auth:invalid-token'));
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
      return null;
    }

    if (response.ok && data.status && data.data) {
      // Lưu tokens mới
      setAuthToken(data.data.access_token);
      setRefreshToken(data.data.refresh_token);
      return data.data.access_token;
    } else {
      // Refresh token không hợp lệ, xóa tokens
      clearAuthToken();
      localStorage.removeItem('user_info');
      window.dispatchEvent(new CustomEvent('auth:invalid-token'));
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
      return null;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    clearAuthToken();
    localStorage.removeItem('user_info');
    window.dispatchEvent(new CustomEvent('auth:invalid-token'));
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
    return null;
  }
}

// Hàm helper cho request API với tự động refresh token
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response: ${text}`);
    }
    
    // Kiểm tra lỗi "Invalid token" - tự động logout và redirect
    if (response.status === 401) {
      const errorMessage = data.detail || data.message || '';
      
      // Nếu là lỗi "Invalid token", tự động logout và redirect ngay (không thử refresh)
      if (errorMessage === 'Invalid token' || errorMessage.includes('Invalid token')) {
        clearAuthToken();
        localStorage.removeItem('user_info');
        // Dispatch event để App.tsx có thể xử lý
        window.dispatchEvent(new CustomEvent('auth:invalid-token'));
        // Redirect về trang đăng nhập
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
        throw new Error('Invalid token. Please login again.');
      }
      
      // Nếu access token hết hạn (401) nhưng không phải "Invalid token", thử refresh token
      if (retryCount === 0 && getRefreshToken()) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Retry request với token mới
          return apiRequest<T>(endpoint, options, retryCount + 1);
        } else {
          // Refresh thất bại, clear tokens và redirect
          clearAuthToken();
          localStorage.removeItem('user_info');
          window.dispatchEvent(new CustomEvent('auth:invalid-token'));
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
          throw new Error('Session expired. Please login again.');
        }
      }
    }
    
    if (!response.ok) {
      throw new Error(data.message || data.detail || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('API request error:', error);
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error(`Không thể kết nối đến server. Vui lòng đảm bảo backend đang chạy tại ${API_BASE_URL}`);
    }
    
    throw error;
  }
}

// API xác thực
export const authAPI = {
  register: async (fullName: string, email: string, password: string, phone?: string): Promise<{ user: any }> => {
    const response = await apiRequest<{ user: any }>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ 
        full_name: fullName,
        email, 
        password,
        phone: phone || ''
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Registration failed');
  },
  
  login: async (email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: any }> => {
    const response = await apiRequest<{ access_token: string; refresh_token: string; user: any }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.status && response.data) {
      setAuthToken(response.data.access_token);
      setRefreshToken(response.data.refresh_token);
      if (response.data.user) {
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    }
    
    throw new Error(response.message || 'Login failed');
  },
  
  refresh: async (): Promise<{ access_token: string; refresh_token: string } | null> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    
    try {
      const response = await apiRequest<{ access_token: string; refresh_token: string }>('/users/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (response.status && response.data) {
        setAuthToken(response.data.access_token);
        setRefreshToken(response.data.refresh_token);
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Refresh token error:', error);
      clearAuthToken();
      return null;
    }
  },
  
  logout: async () => {
    const refreshToken = getRefreshToken();
    
    // Nếu có refresh token, gọi backend để thu hồi
    if (refreshToken) {
      try {
        await apiRequest('/users/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (error) {
        // Ignore errors - vẫn xóa tokens ở client
        console.error('Logout error:', error);
      }
    }
    
    clearAuthToken();
    localStorage.removeItem('user_info');
  },
  
  getToken: getAuthToken,
  
  getUserInfo: async (): Promise<any> => {
    const response = await apiRequest<any>('/users/info');
    
    if (response.status && response.data) {
      // Cập nhật user_info trong localStorage
      localStorage.setItem('user_info', JSON.stringify(response.data));
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get user info');
  },
  
  updateUserInfo: async (fullName?: string, phone?: string): Promise<any> => {
    const response = await apiRequest<any>('/users/update', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName || undefined,
        phone: phone || undefined,
      }),
    });
    
    if (response.status && response.data) {
      // Cập nhật user_info trong localStorage
      localStorage.setItem('user_info', JSON.stringify(response.data));
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update user info');
  },
  
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    const response = await apiRequest<void>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
    
    if (!response.status) {
      throw new Error(response.message || 'Failed to change password');
    }
  },
};

// API thiết bị
export const deviceAPI = {
  getAllDevices: async (): Promise<any[]> => {
    const response = await apiRequest<{ devices: any[] }>('/devices');
    
    if (response.status && response.data) {
      return response.data.devices || [];
    }
    
    return [];
  },
  
  getDeviceInfo: async (deviceId: string): Promise<any> => {
    const response = await apiRequest<{ device: any }>('/user-device/get-device', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
    
    if (response.status && response.data) {
      return response.data.device;
    }
    
    throw new Error(response.message || 'Failed to get device info');
  },
  
  addDevice: async (deviceId: string, devicePassword: string | null | undefined, deviceName: string, location: string, note?: string): Promise<any> => {
    /**
     * Thêm thiết bị cho người dùng
     * - deviceId: ID của thiết bị (bắt buộc)
     * - devicePassword: Mật khẩu thiết bị (tùy chọn - để trống nếu thiết bị không có mật khẩu)
     * - deviceName: Tên thiết bị
     * - location: Phòng/vị trí thiết bị
     * - note: Ghi chú (tùy chọn)
     */
    const response = await apiRequest<any>('/user-device/add', {
      method: 'POST',
      body: JSON.stringify({ 
        device_id: deviceId,
        device_password: devicePassword && devicePassword.trim() ? devicePassword : null,
        device_name: deviceName,
        location: location,
        note: note || null
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to add device');
  },
  
  updateDevice: async (deviceId: string, updateData: {
    device_name?: string;
    device_password?: string;
    location?: string;
    note?: string;
    status?: string;
    cloud_status?: string;
  }): Promise<any> => {
    /**
     * Cập nhật thông tin thiết bị
     * - deviceId: ID của thiết bị (UUID)
     * - updateData: Dữ liệu cần cập nhật:
     *   - device_name: Tên thiết bị
     *   - device_password: Mật khẩu thiết bị
     *   - location: Vị trí/phòng
     *   - note: Ghi chú
     *   - status: Trạng thái
     */
    const response = await apiRequest<any>('/user-device/update', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        ...updateData,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update device');
  },
};

// API phòng
export const roomAPI = {
  // API mới
  createRoom: async (name: string, description?: string): Promise<any> => {
    const response = await apiRequest<any>('/rooms/', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: description || '',
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to create room');
  },

  getAllRooms: async (): Promise<any[]> => {
    const response = await apiRequest<{ rooms: any[] }>('/rooms/');
    
    if (response.status && response.data) {
      return response.data.rooms || [];
    }
    
    return [];
  },

  getRoom: async (roomId: string): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}`);
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get room');
  },

  getRoomDetails: async (roomId: string): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}/details`);
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get room details');
  },

  // Lấy dữ liệu mới nhất cho một room cụ thể (khi click vào room)
  refreshRoomData: async (roomId: string): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}/details`);
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to refresh room data');
  },

  controlRoom: async (roomId: string, action: 'on' | 'off'): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to control room');
  },

  // API cũ (giữ lại để tương thích)
  updateRoomName: async (oldRoomName: string, newRoomName: string): Promise<any> => {
    const response = await apiRequest<any>('/rooms/update-name', {
      method: 'POST',
      body: JSON.stringify({
        old_room_name: oldRoomName,
        new_room_name: newRoomName,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update room name');
  },

  deleteRoom: async (roomName: string): Promise<any> => {
    const response = await apiRequest<any>('/rooms/delete', {
      method: 'POST',
      body: JSON.stringify({
        room_name: roomName,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to delete room');
  },

  // Cấu trúc mới: Room chứa device_ids
  addDeviceToRoom: async (roomId: string, deviceId: string): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}/devices/${deviceId}`, {
      method: 'POST',
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to add device to room');
  },

  removeDeviceFromRoom: async (roomId: string, deviceId: string): Promise<any> => {
    const response = await apiRequest<any>(`/rooms/${roomId}/devices/${deviceId}`, {
      method: 'DELETE',
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to remove device from room');
  },

  // Tìm room chứa device cụ thể
  findDeviceRoom: async (deviceId: string): Promise<any | null> => {
    try {
      // Lấy tất cả rooms với details
      const rooms = await roomAPI.getAllRooms();
      
      // Kiểm tra từng room để tìm device
      for (const room of rooms) {
        try {
          const roomDetails = await roomAPI.getRoomDetails(room._id);
          if (roomDetails.devices && roomDetails.devices.some((d: any) => d._id === deviceId)) {
            return roomDetails;
          }
        } catch (error) {
          // Bỏ qua lỗi của room cụ thể và tiếp tục tìm
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding device room:', error);
      return null;
    }
  },
};

// API thiết bị mới
export const newDeviceAPI = {
  controlDevicePower: async (deviceId: string, enabled: boolean): Promise<any> => {
    const response = await apiRequest<any>(`/devices/${deviceId}/power`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to control device power');
  },

  getDevice: async (deviceId: string): Promise<any> => {
    const response = await apiRequest<any>(`/devices/${deviceId}`);
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get device');
  },

  getDeviceDetail: async (deviceId: string): Promise<{ device: any; sensors: any[]; actuators: any[] }> => {
    const response = await apiRequest<any>(`/devices/${deviceId}/detail`);
    
    if (response.status && response.data) {
      return {
        device: response.data,
        sensors: response.data.sensors || [],
        actuators: response.data.actuators || [],
      };
    }
    
    throw new Error(response.message || 'Failed to get device detail');
  },

  getDevicesByRoom: async (roomId: string): Promise<any[]> => {
    const response = await apiRequest<{ devices: any[] }>(`/devices/room/${roomId}`);
    
    if (response.status && response.data) {
      return response.data.devices || [];
    }
    
    return [];
  },

  deleteDevice: async (deviceId: string): Promise<any> => {
    const response = await apiRequest<any>(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to delete device');
  },
};

// API cảm biến mới
export const newSensorAPI = {
  controlSensorEnable: async (sensorId: string, enabled: boolean): Promise<any> => {
    const response = await apiRequest<any>(`/sensors/${sensorId}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to control sensor');
  },

  getSensorsByDevice: async (deviceId: string): Promise<any[]> => {
    const response = await apiRequest<{ sensors: any[] }>(`/sensors/device/${deviceId}`);
    
    if (response.status && response.data) {
      return response.data.sensors || [];
    }
    
    return [];
  },

  updateSensorThreshold: async (sensorId: string, minThreshold?: number | null, maxThreshold?: number | null): Promise<any> => {
    const response = await apiRequest<any>(`/sensors/${sensorId}/threshold`, {
      method: 'POST',
      body: JSON.stringify({
        min_threshold: minThreshold === null ? null : minThreshold,
        max_threshold: maxThreshold === null ? null : maxThreshold,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update sensor threshold');
  },

  updateSensor: async (sensorId: string, name?: string, type?: string, pin?: number): Promise<any> => {
    const response = await apiRequest<any>(`/sensors/${sensorId}/update`, {
      method: 'POST',
      body: JSON.stringify({
        name: name || undefined,
        type: type || undefined,
        pin: pin || undefined,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update sensor');
  },
};

// API điều khiển mới
export const newActuatorAPI = {
  controlActuator: async (actuatorId: string, state: boolean): Promise<any> => {
    const response = await apiRequest<any>(`/actuators/${actuatorId}/control`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to control actuator');
  },

  getActuatorsByDevice: async (deviceId: string): Promise<any[]> => {
    const response = await apiRequest<{ actuators: any[] }>(`/actuators/device/${deviceId}`);
    
    if (response.status && response.data) {
      return response.data.actuators || [];
    }
    
    return [];
  },

  updateActuator: async (actuatorId: string, name?: string, pin?: number, enabled?: boolean): Promise<any> => {
    const response = await apiRequest<any>(`/actuators/${actuatorId}/update`, {
      method: 'POST',
      body: JSON.stringify({
        name: name || undefined,
        pin: pin || undefined,
        enabled: enabled !== undefined ? enabled : undefined,
      }),
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update actuator');
  },
};

// API dữ liệu cảm biến
export const sensorDataAPI = {
  getSensorData: async (params?: {
    device_id?: string;
    sensor_id?: string;
    sensor_type?: string;
    limit?: number;
    start_time?: string;
    end_time?: string;
  }): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
    if (params?.sensor_id) queryParams.append('sensor_id', params.sensor_id);
    if (params?.sensor_type) queryParams.append('sensor_type', params.sensor_type);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.start_time) queryParams.append('start_time', params.start_time);
    if (params?.end_time) queryParams.append('end_time', params.end_time);
    
    const queryString = queryParams.toString();
    const endpoint = `/sensor-data/${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{ sensor_data: any[]; total: number; returned: number }>(endpoint);
    
    if (response.status && response.data) {
      return response.data.sensor_data || [];
    }
    
    return [];
  },

  getLatestSensorData: async (params?: {
    device_id?: string;
    sensor_id?: string;
  }): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
    if (params?.sensor_id) queryParams.append('sensor_id', params.sensor_id);
    
    const queryString = queryParams.toString();
    const endpoint = `/sensor-data/latest${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{ sensor_data: any[]; count: number }>(endpoint);
    
    if (response.status && response.data) {
      return response.data.sensor_data || [];
    }
    
    return [];
  },

  getSensorStatistics: async (params?: {
    device_id?: string;
    sensor_id?: string;
    sensor_type?: string;
    start_time?: string;
    end_time?: string;
  }): Promise<any[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
    if (params?.sensor_id) queryParams.append('sensor_id', params.sensor_id);
    if (params?.sensor_type) queryParams.append('sensor_type', params.sensor_type);
    if (params?.start_time) queryParams.append('start_time', params.start_time);
    if (params?.end_time) queryParams.append('end_time', params.end_time);
    
    const queryString = queryParams.toString();
    const endpoint = `/sensor-data/statistics${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{ statistics: any[]; count: number }>(endpoint);
    
    if (response.status && response.data) {
      return response.data.statistics || [];
    }
    
    return [];
  },

  getSensorTrends: async (params?: {
    device_id?: string;
    room?: string;
    hours?: number;
    limit_per_type?: number;
  }): Promise<{
    temperature: Array<{ time: string; value: number }>;
    humidity: Array<{ time: string; value: number }>;
    energy: Array<{ time: string; value: number }>;
  }> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
    if (params?.room) queryParams.append('room', params.room);
    if (params?.hours) queryParams.append('hours', params.hours.toString());
    if (params?.limit_per_type) queryParams.append('limit_per_type', params.limit_per_type.toString());
    
    const queryString = queryParams.toString();
    const endpoint = `/sensor-data/trends${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{
      temperature: Array<{ time: string; value: number }>;
      humidity: Array<{ time: string; value: number }>;
      energy: Array<{ time: string; value: number }>;
    }>(endpoint);
    
    if (response.status && response.data) {
      return {
        temperature: response.data.temperature || [],
        humidity: response.data.humidity || [],
        energy: response.data.energy || [],
      };
    }
    
    return {
      temperature: [],
      humidity: [],
      energy: [],
    };
  },

  getTemperatureStatisticsTable: async (params?: {
    device_id?: string;
    days?: 1 | 3 | 7;
  }): Promise<{
    table_data: Array<{
      time: string;
      time_display: string;
      min: number;
      max: number;
      avg: number;
      count: number;
    }>;
    days: number;
    start_time: string;
    end_time: string;
  }> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
    if (params?.days) queryParams.append('days', params.days.toString());
    
    const queryString = queryParams.toString();
    const endpoint = `/sensor-data/temperature/table${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<{
      table_data: Array<{
        time: string;
        time_display: string;
        min: number;
        max: number;
        avg: number;
        count: number;
      }>;
      days: number;
      start_time: string;
      end_time: string;
    }>(endpoint);
    
    if (response.status && response.data) {
      return {
        table_data: response.data.table_data || [],
        days: response.data.days || 1,
        start_time: response.data.start_time || '',
        end_time: response.data.end_time || '',
      };
    }
    
    return {
      table_data: [],
      days: params?.days || 1,
      start_time: '',
      end_time: '',
    };
  },
};

// API thông báo
export const notificationAPI = {
  getNotifications: async (limit: number = 100, unreadOnly: boolean = false): Promise<any[]> => {
    const response = await apiRequest<{ notifications: any[] }>(`/notifications?limit=${limit}&unread_only=${unreadOnly}`);
    
    if (response.status && response.data) {
      return response.data.notifications || [];
    }
    
    return [];
  },

  markAsRead: async (notificationId: string): Promise<any> => {
    const response = await apiRequest<any>(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to mark notification as read');
  },

  markAllAsRead: async (): Promise<any> => {
    const response = await apiRequest<any>('/notifications/read-all', {
      method: 'POST',
    });
    
    if (response.status && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to mark all notifications as read');
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiRequest<{ count: number }>('/notifications/unread-count');
    
    if (response.status && response.data) {
      return response.data.count || 0;
    }
    
    return 0;
  },
};

