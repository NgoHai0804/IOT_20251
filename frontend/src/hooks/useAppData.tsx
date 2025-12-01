import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Sensor, Device, Notification } from '@/types';
import { deviceAPI, sensorDataAPI } from '@/services/api';

interface AppState {
  sensors: Sensor[];
  devices: Device[];
  notifications: Notification[];
  temperatureData: Array<{ time: string; value: number }>;
  energyData: Array<{ time: string; value: number }>;
  humidityData: Array<{ time: string; value: number }>;
}

interface AppActions {
  handleDeviceToggle: (id: string) => void;
  handleBrightnessChange: (id: string, value: number) => void;
  handleSpeedChange: (id: string, value: number) => void;
  handleTemperatureChange: (id: string, value: number) => void;
  handleMarkAsRead: (id: string) => void;
  handleClearAllNotifications: () => void;
  handleAddDevice: (newDevice: Omit<Device, 'id' | 'lastActive'>) => void;
  handleUpdateDevice: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface AppContextType extends AppState, AppActions {
  rooms: string[];
  unreadCount: number;
  loading: boolean;
  selectedDeviceId: string | null;
  selectedRoom: string | null;
  setSelectedDeviceId: (deviceId: string | null) => void;
  setSelectedRoom: (room: string | null) => void;
}

// Helper function to map backend device to frontend device
function mapBackendDeviceToFrontend(backendDevice: any): Device {
  return {
    id: backendDevice.device_id || backendDevice._id,
    name: backendDevice.device_name || backendDevice.name || 'Unnamed Device',
    type: mapDeviceType(backendDevice.type || backendDevice.device_type),
    status: mapDeviceStatus(backendDevice.status),
    room: backendDevice.location || 'Unknown',
    brightness: backendDevice.brightness,
    speed: backendDevice.speed,
    temperature: backendDevice.temperature,
    lastActive: backendDevice.last_seen 
      ? new Date(backendDevice.last_seen) 
      : backendDevice.updated_at 
        ? new Date(backendDevice.updated_at) 
        : new Date(),
  };
}

function mapDeviceType(backendType: string): 'light' | 'fan' | 'ac' | 'plug' {
  const typeMap: Record<string, 'light' | 'fan' | 'ac' | 'plug'> = {
    'light': 'light',
    'fan': 'fan',
    'ac': 'ac',
    'air_conditioner': 'ac',
    'plug': 'plug',
    'socket': 'plug',
  };
  return typeMap[backendType?.toLowerCase()] || 'plug';
}

function mapDeviceStatus(backendStatus: string): 'on' | 'off' {
  return backendStatus === 'online' || backendStatus === 'on' ? 'on' : 'off';
}

export function useAppData(): AppContextType {
  const [loading, setLoading] = useState(true);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [temperatureData, setTemperatureData] = useState<Array<{ time: string; value: number }>>([]);
  const [energyData, setEnergyData] = useState<Array<{ time: string; value: number }>>([]);
  const [humidityData, setHumidityData] = useState<Array<{ time: string; value: number }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  // Fetch devices from backend
  const fetchDevices = async () => {
    try {
      const backendDevices = await deviceAPI.getAllDevices();
      const mappedDevices = backendDevices.map(mapBackendDeviceToFrontend);
      setDevices(mappedDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to load devices');
    }
  };

  // Fetch sensors and sensor data from backend
  const fetchSensors = async () => {
    try {
      // Lấy dữ liệu sensor mới nhất
      const latestSensorData = await sensorDataAPI.getLatestSensorData();
      
      // Lấy thông tin devices để map room
      const backendDevices = await deviceAPI.getAllDevices();
      const deviceMap = new Map(backendDevices.map((d: any) => {
        const deviceId = d.device_id || d._id || d.id;
        return [deviceId, d];
      }));
      
      // Map sensor data sang frontend format
      const mappedSensors: Sensor[] = latestSensorData.map((data: any) => {
        const deviceId = data.device_id;
        const device = deviceMap.get(deviceId);
        const room = device?.location || device?.device_name || 'Unknown';
        
        // Map sensor type
        const sensorType = mapSensorType(data.sensor_type);
        
        // Get unit based on sensor type
        const unit = getSensorUnit(sensorType);
        
        return {
          id: data.sensor_id,
          name: data.sensor_id || `Sensor ${data.sensor_id}`,
          type: sensorType,
          value: data.value || 0,
          unit: unit,
          room: room,
          deviceId: deviceId, // Thêm device_id vào sensor
          lastUpdate: new Date(data.timestamp || data.created_at),
          trend: 'stable', // Có thể tính toán từ dữ liệu lịch sử
        };
      });
      
      setSensors(mappedSensors);
    } catch (error) {
      console.error('Error fetching sensors:', error);
      // Không hiển thị toast để tránh spam nếu chưa có dữ liệu
    }
  };

  // Fetch chart data from backend using trends API
  const fetchChartData = async () => {
    try {
      // Sử dụng API trends mới để lấy dữ liệu đã được format sẵn
      const trendsData = await sensorDataAPI.getSensorTrends({
        hours: 24, // Lấy dữ liệu 24 giờ qua
        limit_per_type: 100, // Tối đa 100 điểm cho mỗi loại sensor
      });
      
      // Dữ liệu đã được format sẵn từ backend
      setTemperatureData(trendsData.temperature || []);
      setHumidityData(trendsData.humidity || []);
      setEnergyData(trendsData.energy || []);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Set empty arrays nếu có lỗi
      setTemperatureData([]);
      setHumidityData([]);
      setEnergyData([]);
    }
  };

  // Helper function to map sensor type
  function mapSensorType(backendType: string): 'temperature' | 'humidity' | 'light' | 'motion' | 'energy' {
    const type = (backendType || '').toLowerCase();
    if (type.includes('temperature') || type.includes('temp')) return 'temperature';
    if (type.includes('humidity') || type.includes('humid')) return 'humidity';
    if (type.includes('light') || type.includes('brightness')) return 'light';
    if (type.includes('motion') || type.includes('movement')) return 'motion';
    if (type.includes('energy') || type.includes('power')) return 'energy';
    return 'temperature'; // default
  }

  // Helper function to get sensor unit
  function getSensorUnit(type: 'temperature' | 'humidity' | 'light' | 'motion' | 'energy'): string {
    const units: Record<string, string> = {
      temperature: '°C',
      humidity: '%',
      light: 'lux',
      motion: 'detections',
      energy: 'W',
    };
    return units[type] || '';
  }

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDevices(),
        fetchSensors(),
        fetchChartData(),
      ]);
      setLoading(false);
    };
    
    loadData();
    
    // Set up polling to refresh data every 10 seconds
    const interval = setInterval(() => {
      fetchDevices();
      fetchSensors();
      fetchChartData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Event handlers
  const handleDeviceToggle = async (id: string) => {
    try {
      const device = devices.find(d => d.id === id);
      if (!device) return;
      
      const newStatus = device.status === 'on' ? 'off' : 'on';
      await deviceAPI.updateDevice(id, { status: newStatus });
      
      setDevices(prev =>
        prev.map(d =>
          d.id === id
            ? {
                ...d,
                status: newStatus,
              lastActive: new Date(),
            }
            : d
        )
      );
      toast.success(`${device.name} turned ${newStatus}`);
    } catch (error) {
      console.error('Error toggling device:', error);
      toast.error('Failed to control device');
    }
  };

  const handleBrightnessChange = async (id: string, value: number) => {
    // For now, just update local state
    // In future, can add API endpoint for brightness control
    setDevices(prev =>
      prev.map(device =>
        device.id === id ? { ...device, brightness: value, lastActive: new Date() } : device
      )
    );
  };

  const handleSpeedChange = async (id: string, value: number) => {
    setDevices(prev =>
      prev.map(device =>
        device.id === id ? { ...device, speed: value, lastActive: new Date() } : device
      )
    );
  };

  const handleTemperatureChange = async (id: string, value: number) => {
    setDevices(prev =>
      prev.map(device =>
        device.id === id ? { ...device, temperature: value, lastActive: new Date() } : device
      )
    );
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const handleClearAllNotifications = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    toast.info('All notifications marked as read');
  };

  const handleAddDevice = async (newDevice: Omit<Device, 'id' | 'lastActive'>) => {
    // This is handled by AddDeviceDialog
    await refreshData();
  };

  const handleUpdateDevice = async () => {
    // Refresh data after device update
    await refreshData();
  };

  const refreshData = async () => {
    await Promise.all([
      fetchDevices(),
      fetchSensors(),
      fetchChartData(),
    ]);
  };

  // Get unique rooms from devices
  const rooms = Array.from(new Set(devices.map(d => d.room)));
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filter sensors based on selected device or room
  const filteredSensors = sensors.filter(sensor => {
    if (selectedDeviceId) {
      return sensor.deviceId === selectedDeviceId;
    }
    if (selectedRoom) {
      return sensor.room === selectedRoom;
    }
    return true; // Show all if nothing selected
  });

  return {
    sensors: filteredSensors, // Return filtered sensors
    devices,
    notifications,
    temperatureData,
    energyData,
    humidityData,
    rooms,
    unreadCount,
    loading,
    selectedDeviceId,
    selectedRoom,
    setSelectedDeviceId,
    setSelectedRoom,
    handleDeviceToggle,
    handleBrightnessChange,
    handleSpeedChange,
    handleTemperatureChange,
    handleMarkAsRead,
    handleClearAllNotifications,
    handleAddDevice,
    handleUpdateDevice,
    refreshData,
  };
}
