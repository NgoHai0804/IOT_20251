import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Room, Device, Sensor, Actuator, Notification } from '@/types';
import { roomAPI, deviceAPI, newDeviceAPI, newSensorAPI, newActuatorAPI, sensorDataAPI, notificationAPI } from '@/services/api';

interface AppState {
  rooms: Room[];
  sensors: Sensor[];
  devices: Device[];
  actuators: Actuator[];
  notifications: Notification[];
  temperatureData: Array<{ time: string; value: number }>;
  energyData: Array<{ time: string; value: number }>;
  humidityData: Array<{ time: string; value: number }>;
}

interface AppActions {
  handleDevicePowerToggle: (deviceId: string, enabled: boolean) => Promise<void>;
  handleSensorEnableToggle: (sensorId: string, enabled: boolean) => Promise<void>;
  handleActuatorControl: (actuatorId: string, state: boolean) => Promise<void>;
  handleRoomControl: (roomId: string, action: 'on' | 'off') => Promise<void>;
  handleMarkAsRead: (id: string) => void;
  handleClearAllNotifications: () => void;
  refreshData: () => Promise<void>;
}

export interface AppContextType extends AppState, AppActions {
  unreadCount: number;
  loading: boolean;
  selectedDeviceId: string | null;
  selectedRoomId: string | null;
  setSelectedDeviceId: (deviceId: string | null) => void;
  setSelectedRoomId: (roomId: string | null) => void;
}

export function useAppData(): AppContextType {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [temperatureData, setTemperatureData] = useState<Array<{ time: string; value: number }>>([]);
  const [energyData, setEnergyData] = useState<Array<{ time: string; value: number }>>([]);
  const [humidityData, setHumidityData] = useState<Array<{ time: string; value: number }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const isTogglingRef = useRef(isToggling);

  // Lấy phòng từ backend
  const fetchRooms = async (includeData: boolean = false) => {
    try {
      const roomsData = await roomAPI.getAllRooms(includeData);
      
      // Chỉ cập nhật rooms state nếu không phải includeData
      // Nếu includeData=true, không cập nhật rooms (để Rooms component tự quản lý)
      if (!includeData) {
        setRooms(roomsData);
      } else {
        // Nếu includeData=true, chỉ cập nhật sensors và actuators, không cập nhật rooms
        updateSensorsAndActuatorsFromRooms(roomsData);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms', { duration: 1000 });
    }
  };

  // Cập nhật sensors và actuators từ rooms data (không cập nhật rooms state)
  const updateSensorsAndActuatorsFromRooms = (roomsData: any[]) => {
    const allSensors: Sensor[] = [];
    const allActuators: Actuator[] = [];
    
    roomsData.forEach((room: any) => {
      if (room.sensors) {
        allSensors.push(...room.sensors);
      }
      if (room.actuators) {
        allActuators.push(...room.actuators);
      }
    });
    
    // Merge sensors với state hiện tại để giữ values nếu có
    setSensors(prevSensors => {
      const sensorValueMap = new Map(prevSensors.map(s => [s._id || s.id, { value: s.value, lastUpdate: s.lastUpdate }]));
      return allSensors.map(sensor => {
        const existing = sensorValueMap.get(sensor._id || sensor.id);
        // Nếu sensor mới đã có value từ API, dùng nó, nếu không thì dùng từ state cũ
        return existing && !sensor.value ? { ...sensor, value: existing.value, lastUpdate: existing.lastUpdate } : sensor;
      });
    });
    
    setActuators(allActuators);
  };

  // Fetch rooms với data chỉ để cập nhật sensors/actuators (không cập nhật rooms state)
  const fetchRoomsDataForSensors = async () => {
    try {
      const roomsData = await roomAPI.getAllRooms(true);
      updateSensorsAndActuatorsFromRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms data for sensors:', error);
    }
  };

  // Lấy tất cả thiết bị (cấu trúc mới: lấy tất cả thiết bị của user, không phân biệt phòng)
  const fetchDevices = async () => {
    try {
      // Lấy tất cả devices của user (bao gồm cả devices không thuộc phòng nào)
      const allDevices = await deviceAPI.getAllDevices();
      setDevices(allDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to load devices', { duration: 1000 });
    }
  };

  // Lấy danh sách sensors (không gọi getLatestSensorData)
  const isFetchingSensorsListRef = useRef(false);
  const fetchSensors = async (devicesToFetch: Device[] = devices) => {
    // Tránh gọi trùng lặp
    if (isFetchingSensorsListRef.current) {
      return;
    }
    
    isFetchingSensorsListRef.current = true;
    try {
      const allSensors: Sensor[] = [];
      
      // Lấy sensors cho từng device (song song để tăng tốc)
      const sensorPromises = devicesToFetch.map(async (device) => {
        try {
          return await newSensorAPI.getSensorsByDevice(device._id);
        } catch (error) {
          console.error(`Error fetching sensors for device ${device._id}:`, error);
          return [];
        }
      });
      
      const sensorResults = await Promise.all(sensorPromises);
      sensorResults.forEach(sensors => {
        allSensors.push(...sensors);
      });
      
      // Merge với values từ state hiện tại (giữ nguyên values khi chỉ update list)
      setSensors(prevSensors => {
        const sensorValueMap = new Map(prevSensors.map(s => [s._id || s.id, { value: s.value, lastUpdate: s.lastUpdate }]));
        return allSensors.map(sensor => {
          const existing = sensorValueMap.get(sensor._id || sensor.id);
          return existing ? { ...sensor, value: existing.value, lastUpdate: existing.lastUpdate } : sensor;
        });
      });
    } catch (error) {
      console.error('Error fetching sensors:', error);
    } finally {
      isFetchingSensorsListRef.current = false;
    }
  };

  // Lấy giá trị sensor mới nhất riêng (gọi định kỳ, không gọi khi toggle)
  const isFetchingLatestSensorValuesRef = useRef(false);
  const fetchLatestSensorValues = async () => {
    // Tránh gọi trùng lặp
    if (isFetchingLatestSensorValuesRef.current) {
      return;
    }
    
    isFetchingLatestSensorValuesRef.current = true;
    try {
      const latestSensorData = await sensorDataAPI.getLatestSensorData();
      
      // Tạo map sensor_id -> value
      const sensorValueMap = new Map<string, { value: number; timestamp: string }>();
      latestSensorData.forEach((data: any) => {
        if (data.sensor_id && data.value !== undefined) {
          sensorValueMap.set(data.sensor_id, {
            value: data.value,
            timestamp: data.timestamp || data.created_at
          });
        }
      });
      
      // Cập nhật values cho sensors hiện tại và kiểm tra ngưỡng
      setSensors(prevSensors => {
        const updatedSensors = prevSensors.map(sensor => {
          const latestData = sensorValueMap.get(sensor._id || sensor.id);
          if (latestData) {
            return {
              ...sensor,
              value: latestData.value,
              lastUpdate: latestData.timestamp ? new Date(latestData.timestamp) : new Date()
            };
          }
          return sensor;
        });
        
        // Kiểm tra và thông báo nếu vượt quá ngưỡng (sau khi update state)
        // Chỉ thông báo khi giá trị mới vượt ngưỡng và sensor enabled
        updatedSensors.forEach(updatedSensor => {
          const latestData = sensorValueMap.get(updatedSensor._id || updatedSensor.id);
          if (latestData && updatedSensor.enabled !== false) {
            // Kiểm tra nếu vượt ngưỡng
            const isOverThreshold = 
              (updatedSensor.min_threshold !== undefined && latestData.value < updatedSensor.min_threshold) ||
              (updatedSensor.max_threshold !== undefined && latestData.value > updatedSensor.max_threshold);
            
            // Tìm sensor cũ để so sánh (từ prevSensors)
            const oldSensor = prevSensors.find(s => (s._id || s.id) === (updatedSensor._id || updatedSensor.id));
            const oldValue = oldSensor?.value;
            const oldWasOverThreshold = oldSensor && oldValue !== undefined && (
              (oldSensor.min_threshold !== undefined && oldValue < oldSensor.min_threshold) ||
              (oldSensor.max_threshold !== undefined && oldValue > oldSensor.max_threshold)
            );
            
            // Chỉ thông báo nếu:
            // 1. Giá trị mới vượt ngưỡng
            // 2. Giá trị cũ không vượt ngưỡng (hoặc chưa có giá trị cũ) - tránh thông báo trùng lặp
            if (isOverThreshold && !oldWasOverThreshold) {
              const thresholdMsg = 
                updatedSensor.min_threshold !== undefined && latestData.value < updatedSensor.min_threshold
                  ? `Giá trị ${latestData.value.toFixed(1)}${updatedSensor.unit || ''} thấp hơn ngưỡng dưới ${updatedSensor.min_threshold}${updatedSensor.unit || ''}`
                  : `Giá trị ${latestData.value.toFixed(1)}${updatedSensor.unit || ''} vượt quá ngưỡng trên ${updatedSensor.max_threshold}${updatedSensor.unit || ''}`;
              
              toast.warning(`${updatedSensor.name}: ${thresholdMsg}`, { 
                duration: 6000,
                important: true,
                position: 'top-right'
              });
            }
          }
        });
        
        return updatedSensors;
      });
    } catch (error) {
      console.error('Error fetching latest sensor data:', error);
    } finally {
      isFetchingLatestSensorValuesRef.current = false;
    }
  };

  // Lấy actuators theo thiết bị
  const isFetchingActuatorsRef = useRef(false);
  const fetchActuators = async (devicesToFetch: Device[] = devices) => {
    // Tránh gọi trùng lặp
    if (isFetchingActuatorsRef.current) {
      return;
    }
    
    isFetchingActuatorsRef.current = true;
    try {
      const allActuators: Actuator[] = [];
      
      // Lấy actuators cho từng device (song song để tăng tốc)
      const actuatorPromises = devicesToFetch.map(async (device) => {
        try {
          return await newActuatorAPI.getActuatorsByDevice(device._id);
        } catch (error) {
          console.error(`Error fetching actuators for device ${device._id}:`, error);
          return [];
        }
      });
      
      const actuatorResults = await Promise.all(actuatorPromises);
      actuatorResults.forEach(actuators => {
        allActuators.push(...actuators);
      });
      
      setActuators(allActuators);
    } catch (error) {
      console.error('Error fetching actuators:', error);
    } finally {
      isFetchingActuatorsRef.current = false;
    }
  };

  // Chart data chỉ được fetch ở trang /devices, không fetch ở đây nữa

  // Cập nhật ref khi isToggling thay đổi (để interval có thể access giá trị mới nhất)
  useEffect(() => {
    isTogglingRef.current = isToggling;
  }, [isToggling]);

  // Lấy thông báo
  const fetchNotifications = async () => {
    try {
      const notificationsData = await notificationAPI.getNotifications(100, false);
      // Map từ backend format sang frontend format
      const mappedNotifications: Notification[] = notificationsData.map((notif: any) => ({
        id: notif.id || notif.message_id || notif._id,
        type: notif.type || 'info',
        message: notif.message || '',
        timestamp: notif.created_at ? new Date(notif.created_at) : new Date(),
        read: notif.read || false,
      }));
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Lấy dữ liệu ban đầu
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRooms(false), // Fetch rooms không có data lúc đầu
        fetchDevices(),
        fetchNotifications(),
      ]);
      setLoading(false);
    };
    
    loadData();
    
    // Tăng khoảng thời gian để giảm tần suất polling
    // Chỉ fetch định kỳ, không fetch khi isToggling thay đổi
    // Sử dụng ref để access giá trị mới nhất của isToggling trong interval
    const interval = setInterval(() => {
      // Check giá trị mới nhất từ ref
      if (!isTogglingRef.current) {
        fetchRooms(false); // Fetch rooms không có data định kỳ
        fetchDevices();
        fetchNotifications(); // Fetch notifications định kỳ
      }
    }, 30000); // Changed from 10s to 30s to reduce load

    return () => clearInterval(interval);
  }, []); // Bỏ isToggling khỏi dependencies - chỉ chạy một lần khi mount

  // Lấy sensors và actuators khi thiết bị thay đổi (chỉ khi device IDs thay đổi, không phải khi enabled thay đổi)
  const deviceIdsRef = useRef<string>('');
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // Tính toán deviceIds string
    const currentDeviceIds = devices.map(d => d._id || d.id).filter(Boolean).sort().join(',');
    
    // Chỉ fetch lại nếu danh sách devices thay đổi (thêm/xóa device), không phải khi enabled thay đổi
    // Hoặc nếu chưa khởi tạo lần đầu
    const shouldFetch = currentDeviceIds !== deviceIdsRef.current || !hasInitializedRef.current;
    
    if (shouldFetch && !isFetchingSensorsListRef.current && !isFetchingActuatorsRef.current) {
      deviceIdsRef.current = currentDeviceIds;
      hasInitializedRef.current = true;
      
      if (devices.length > 0) {
        // Gọi fetchSensors và fetchActuators với devices hiện tại
        Promise.all([
          fetchSensors(devices), // Truyền devices hiện tại
          fetchActuators(devices)
        ]).catch(error => {
          console.error('Error fetching sensors/actuators:', error);
        });
      } else {
        // Nếu không có devices, clear sensors và actuators
        setSensors([]);
        setActuators([]);
      }
    }
  }, [devices]); // Trigger khi devices thay đổi, nhưng check deviceIds bên trong để tránh fetch không cần thiết

  // Fetch latest sensor values định kỳ (riêng biệt, không gọi khi toggle)
  useEffect(() => {
    if (sensors.length > 0 && !isToggling) {
      const interval = setInterval(() => {
        fetchLatestSensorValues();
      }, 30000); // 30 giây một lần
      
      return () => clearInterval(interval);
    }
  }, [sensors.length, isToggling]); // Chỉ chạy khi số lượng sensors thay đổi hoặc không đang toggle

  // Bỏ useEffect tự động fetch chart data
  // Chart data chỉ được fetch ở trang /devices

  // Event handlers
  const handleDevicePowerToggle = async (deviceId: string, enabled: boolean) => {
    // Optimistic update: update state ngay lập tức trước khi gọi API
    const previousDevices = devices;
    setDevices(prevDevices => 
      prevDevices.map(device => 
        (device._id || device.id) === deviceId 
          ? { ...device, enabled } 
          : device
      )
    );
    
    try {
      setIsToggling(true);
      await newDeviceAPI.controlDevicePower(deviceId, enabled);
      toast.success(`Device ${enabled ? 'enabled' : 'disabled'}`, { duration: 1000 });
      setIsToggling(false);
    } catch (error) {
      console.error('Error toggling device power:', error);
      // Rollback nếu API call thất bại
      setDevices(previousDevices);
      toast.error('Failed to control device', { duration: 1000 });
      setIsToggling(false);
    }
  };

  const handleSensorEnableToggle = async (sensorId: string, enabled: boolean) => {
    try {
      setIsToggling(true);
      await newSensorAPI.controlSensorEnable(sensorId, enabled);
      toast.success(`Sensor ${enabled ? 'enabled' : 'disabled'}`, { duration: 1000 });
      
      // Chỉ cập nhật state local, không reload API
      setSensors(prevSensors => 
        prevSensors.map(sensor => 
          (sensor._id || sensor.id) === sensorId 
            ? { ...sensor, enabled } 
            : sensor
        )
      );
      setIsToggling(false);
    } catch (error) {
      console.error('Error toggling sensor:', error);
      toast.error('Failed to control sensor', { duration: 1000 });
      setIsToggling(false);
    }
  };

  const handleActuatorControl = async (actuatorId: string, state: boolean) => {
    try {
      setIsToggling(true);
      await newActuatorAPI.controlActuator(actuatorId, state);
      toast.success(`Actuator ${state ? 'turned on' : 'turned off'}`, { duration: 1000 });
      
      // Chỉ cập nhật state local, không reload API
      setActuators(prevActuators => 
        prevActuators.map(actuator => 
          (actuator._id || actuator.id) === actuatorId 
            ? { ...actuator, state } 
            : actuator
        )
      );
      setIsToggling(false);
    } catch (error) {
      console.error('Error controlling actuator:', error);
      toast.error('Failed to control actuator', { duration: 1000 });
      setIsToggling(false);
    }
  };

  const handleRoomControl = async (roomId: string, action: 'on' | 'off') => {
    try {
      setIsToggling(true);
      await roomAPI.controlRoom(roomId, action);
      toast.success(`Room ${action === 'on' ? 'enabled' : 'disabled'}`, { duration: 1000 });
      
      // Cập nhật devices từ room details API thay vì getDevicesByRoom
      try {
        const { roomAPI } = await import('@/services/api');
        const roomData = await roomAPI.refreshRoomData(roomId);
        if (roomData.devices) {
          const deviceIds = roomData.devices.map((d: Device) => d._id || d.id);
          const enabled = action === 'on';
          setDevices(prevDevices => 
            prevDevices.map(device => {
              const deviceId = device._id || device.id;
              return deviceIds.includes(deviceId) 
                ? { ...device, enabled } 
                : device;
            })
          );
        }
      } catch (error) {
        console.error('Error fetching room devices:', error);
        // Fallback: reload all devices
        await fetchDevices();
      }
      setIsToggling(false);
    } catch (error) {
      console.error('Error controlling room:', error);
      toast.error('Failed to control room', { duration: 1000 });
      setIsToggling(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Fallback: update local state anyway
      setNotifications(prev =>
        prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
      );
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      toast.info('All notifications marked as read', { duration: 1000 });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Fallback: update local state anyway
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      toast.info('All notifications marked as read', { duration: 1000 });
    }
  };

  // Legacy handlers for backward compatibility
  const handleBrightnessChange = async (id: string, value: number) => {
    // For now, just log - can be implemented later
    console.log(`Brightness change for device ${id}: ${value}`);
  };

  const handleSpeedChange = async (id: string, value: number) => {
    // For now, just log - can be implemented later
    console.log(`Speed change for device ${id}: ${value}`);
  };

  const handleTemperatureChange = async (id: string, value: number) => {
    // For now, just log - can be implemented later
    console.log(`Temperature change for device ${id}: ${value}`);
  };

  const handleAddDevice = async (newDevice: Omit<Device, 'id' | 'lastActive'>) => {
    // For now, just refresh data
    await refreshData();
  };

  const handleUpdateDevice = async () => {
    // Refresh data after device update
    await refreshData();
  };

  const refreshData = async (includeRoomsData: boolean = false) => {
    await Promise.all([
      fetchRooms(includeRoomsData), // Có thể fetch rooms với data nếu cần
      fetchDevices(),
      fetchSensors(devices), // Truyền devices hiện tại
      fetchActuators(devices),
      // Bỏ fetchChartData - chỉ fetch ở trang /devices
      fetchNotifications(),
    ]);
    // Fetch latest values sau khi đã có sensors list (chỉ nếu không fetch rooms với data)
    if (!includeRoomsData) {
      await fetchLatestSensorValues();
    }
  };

  // Tính unread count từ notifications local (sẽ được cập nhật khi fetch notifications)
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    rooms,
    devices,
    sensors,
    actuators,
    notifications,
    temperatureData,
    energyData,
    humidityData,
    unreadCount,
    loading,
    selectedDeviceId,
    selectedRoomId,
    setSelectedDeviceId,
    setSelectedRoomId,
    handleDevicePowerToggle,
    handleSensorEnableToggle,
    handleActuatorControl,
    handleRoomControl,
    handleMarkAsRead,
    handleClearAllNotifications,
    refreshData,
    // Legacy handlers for backward compatibility
    handleBrightnessChange,
    handleSpeedChange,
    handleTemperatureChange,
    handleAddDevice,
    handleUpdateDevice,
  };
}
