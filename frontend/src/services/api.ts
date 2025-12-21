// Dịch vụ API để giao tiếp với backend
import { API_BASE_URL } from '@/config/env';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T | null;
}

// Lấy token xác thực từ localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Đặt token xác thực
function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Xóa token xác thực
function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
}

// Hàm helper cho request API
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
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
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
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
  
  login: async (email: string, password: string): Promise<{ token: string; user: any }> => {
    const response = await apiRequest<{ token: string; user: any }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.status && response.data) {
      setAuthToken(response.data.token);
      if (response.data.user) {
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    }
    
    throw new Error(response.message || 'Login failed');
  },
  
  logout: () => {
    clearAuthToken();
    localStorage.removeItem('user_info');
  },
  
  getToken: getAuthToken,
};

// API thiết bị
export const deviceAPI = {
  getAllDevices: async (): Promise<any[]> => {
    const response = await apiRequest<{ devices: any[] }>('/user-device/get-all-device');
    
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
  
  addDevice: async (deviceId: string, deviceName: string, location: string, note?: string): Promise<any> => {
    /**
     * Thêm thiết bị cho người dùng
     * - deviceId: ID thiết bị
     * - deviceName: Tên thiết bị
     * - location: Phòng/vị trí thiết bị
     * - note: Ghi chú (tùy chọn)
     */
    const response = await apiRequest<any>('/user-device/add', {
      method: 'POST',
      body: JSON.stringify({ 
        device_id: deviceId,
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

  getAllRooms: async (includeData: boolean = false): Promise<any[]> => {
    const endpoint = includeData ? '/rooms/?include_data=true' : '/rooms/';
    const response = await apiRequest<{ rooms: any[] }>(endpoint);
    
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

  getDevicesByRoom: async (roomId: string): Promise<any[]> => {
    const response = await apiRequest<{ devices: any[] }>(`/devices/room/${roomId}`);
    
    if (response.status && response.data) {
      return response.data.devices || [];
    }
    
    return [];
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

