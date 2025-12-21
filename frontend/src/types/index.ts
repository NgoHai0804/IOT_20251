// Common interfaces used across the application

// Cấu trúc mới: Room → Device → Sensor/Actuator

export interface Room {
  _id: string;
  name: string;
  description?: string;
  // device_ids đã bị bỏ - sử dụng bảng user_room_devices, query từ API /devices/room/{roomId}
  devices?: Device[];
  sensors?: Sensor[];
  actuators?: Actuator[];
  created_at?: string;
  updated_at?: string;
}

export interface Device {
  _id: string;
  name: string;
  type: string; // 'esp32', 'arduino', etc.
  status: 'online' | 'offline';
  ip?: string;
  enabled: boolean;
  sensors?: Sensor[];
  actuators?: Actuator[];
  created_at?: string;
  updated_at?: string;
  // room_id đã bị bỏ - thay vào đó Room chứa device_ids
}

export interface Sensor {
  _id: string;
  device_id: string;
  type: 'temperature' | 'humidity' | 'gas' | 'light' | 'motion';
  name: string;
  unit: string;
  pin: number;
  enabled: boolean;
  value?: number; // Giá trị mới nhất từ sensor_data
  lastUpdate?: Date;
  trend?: 'up' | 'down' | 'stable';
  min_threshold?: number; // Ngưỡng dưới
  max_threshold?: number; // Ngưỡng trên
  created_at?: string;
  updated_at?: string;
}

export interface Actuator {
  _id: string;
  device_id: string;
  type: 'relay' | 'motor' | 'led' | string;
  name: string;
  pin: number;
  state: boolean;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SensorData {
  sensor_data_id: string;
  sensor_id: string;
  value: number;
  timestamp: string;
  created_at?: string;
}

export interface Notification {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface ChartDataPoint {
  time: string;
  value: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role?: 'admin' | 'user';
  preferences?: {
    theme?: 'light' | 'dark';
    notifications?: boolean;
    autoUpdate?: boolean;
  };
}

// Legacy Room interface (giữ lại để tương thích)
export interface LegacyRoom {
  id: string;
  name: string;
  devices: LegacyDevice[];
  sensors: LegacySensor[];
  imageUrl?: string;
}

export interface LegacyDevice {
  id: string;
  name: string;
  type: 'light' | 'fan' | 'ac' | 'plug';
  status: 'on' | 'off';
  room: string;
  brightness?: number;
  speed?: number;
  temperature?: number;
  lastActive: Date;
}

export interface LegacySensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'light' | 'motion' | 'energy';
  value: number;
  unit: string;
  room: string;
  deviceId?: string;
  lastUpdate: Date;
  trend?: 'up' | 'down' | 'stable';
}

// Component Props Interfaces
export interface DashboardProps {
  sensors: Sensor[];
  devices: Device[];
  onDeviceToggle?: (id: string) => void;
  onBrightnessChange?: (id: string, value: number) => void;
  onSpeedChange?: (id: string, value: number) => void;
  onTemperatureChange?: (id: string, value: number) => void;
  selectedDeviceId?: string | null;
  selectedRoom?: string | null;
  onDeviceClick?: (deviceId: string) => void;
  onRoomClick?: (room: string) => void;
  onClearSelection?: () => void;
  rooms?: Room[] | string[];  // Support both Room objects and strings (backward compatible)
}

export interface DevicesProps {
  devices: Device[];
  rooms?: Room[] | string[];  // Support both Room objects and strings
  onDeviceToggle?: (id: string) => void;
  onBrightnessChange?: (id: string, value: number) => void;
  onSpeedChange?: (id: string, value: number) => void;
  onTemperatureChange?: (id: string, value: number) => void;
  onAddDevice?: (newDevice: Omit<Device, 'id' | 'lastActive'>) => void;
  onUpdateDevice?: () => void;
  selectedDeviceId?: string | null;
  onDeviceClick?: (deviceId: string) => void;
  onClearSelection?: () => void;
  sensors?: Sensor[];
  actuators?: Actuator[];
  temperatureData?: ChartDataPoint[];
  energyData?: ChartDataPoint[];
  humidityData?: ChartDataPoint[];
  onSensorEnableToggle?: (sensorId: string, enabled: boolean) => void;
  onActuatorControl?: (actuatorId: string, state: boolean) => void;
}

export interface RoomsProps {
  devices: Device[];
  rooms?: Room[];  // Room objects from API
  selectedRoom?: string | null;
  onRoomClick?: (room: string | Room) => void;
  onClearSelection?: () => void;
  sensors?: Sensor[];
  actuators?: Actuator[];
  onUpdateRoom?: () => Promise<void>;
  onDeviceToggle?: (id: string) => void;
  onActuatorControl?: (actuatorId: string, state: boolean) => void;
  onRoomControl?: (roomId: string, action: 'on' | 'off') => void;
}

export interface AnalyticsProps {
  sensors: Sensor[];
  temperatureData: ChartDataPoint[];
  energyData: ChartDataPoint[];
  humidityData: ChartDataPoint[];
}

export interface NotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export interface DeviceCardProps {
  id: string;
  name: string;
  type: 'light' | 'fan' | 'ac' | 'plug';
  status: 'on' | 'off';
  room: string;
  brightness?: number;
  speed?: number;
  temperature?: number;
  lastActive: Date;
  onToggle: (id: string) => void;
  onBrightnessChange?: (id: string, value: number) => void;
  onSpeedChange?: (id: string, value: number) => void;
  onTemperatureChange?: (id: string, value: number) => void;
  onEdit?: (device: Device) => void;
}

export interface ChartsPanelProps {
  temperatureData: ChartDataPoint[];
  energyData: ChartDataPoint[];
  humidityData: ChartDataPoint[];
}

export interface RoomPanelProps {
  devices: Device[];
  onRoomClick?: (room: string) => void;
  selectedRoom?: string | null;
  onEditRoom?: (room: string) => void;
  onDeleteRoom?: (room: string, deviceCount: number) => void;
}

export interface AddDeviceDialogProps {
  onAddDevice: (device: Omit<Device, 'id' | 'lastActive'>) => void;
  rooms: string[];
}

export interface EditDeviceDialogProps {
  device: Device;
  rooms?: Room[] | string[];
  onUpdateDevice: () => void;
}

export interface LoginProps {
  onLogin: (username: string) => void;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export interface PublicRouteProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export interface SharedLayoutProps {
  children: React.ReactNode;
  username: string;
  onLogout: () => void;
  unreadNotifications: number;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  username: string;
  unreadNotifications: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeviceControlRequest {
  deviceId: string;
  action: 'toggle' | 'setBrightness' | 'setSpeed' | 'setTemperature';
  value?: number;
}

export interface SensorReading {
  sensorId: string;
  value: number;
  timestamp: Date;
  quality?: 'good' | 'fair' | 'poor';
}

// Navigation Types
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Theme Types
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Utility Types
export type DeviceStatus = 'online' | 'offline' | 'error';
export type SensorType = Sensor['type'];
export type DeviceType = Device['type'];
export type NotificationType = Notification['type'];
export type TrendDirection = 'up' | 'down' | 'stable';