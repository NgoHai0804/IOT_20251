// API Service for backend communication

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T | null;
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Set auth token
function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Clear auth token
function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
}

// API request helper
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
      throw new Error('Cannot connect to server. Please make sure the backend is running on ' + API_BASE_URL);
    }
    
    throw error;
  }
}

// Auth API
export const authAPI = {
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

// Device API
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
  
  addDevice: async (deviceSerial: string, password?: string): Promise<any> => {
    /**
     * Thêm thiết bị cho người dùng
     * - deviceSerial: ID vật lý của thiết bị (serial number)
     * - password: Mật khẩu của thiết bị (nếu có)
     */
    const response = await apiRequest<any>('/user-device/add', {
      method: 'POST',
      body: JSON.stringify({ 
        device_serial: deviceSerial,
        password: password || null
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

// Room API
export const roomAPI = {
  updateRoomName: async (oldRoomName: string, newRoomName: string): Promise<any> => {
    /**
     * Cập nhật tên phòng
     * - oldRoomName: Tên phòng cũ
     * - newRoomName: Tên phòng mới
     */
    const response = await apiRequest<any>('/room/update-name', {
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
    /**
     * Xóa phòng
     * - roomName: Tên phòng cần xóa
     * Tất cả devices sẽ được chuyển sang phòng "Không xác định"
     */
    const response = await apiRequest<any>('/room/delete', {
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
};

// Sensor Data API
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
    hours?: number;
    limit_per_type?: number;
  }): Promise<{
    temperature: Array<{ time: string; value: number }>;
    humidity: Array<{ time: string; value: number }>;
    energy: Array<{ time: string; value: number }>;
  }> => {
    const queryParams = new URLSearchParams();
    
    if (params?.device_id) queryParams.append('device_id', params.device_id);
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

