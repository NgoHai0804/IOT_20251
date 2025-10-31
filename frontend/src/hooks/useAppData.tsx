import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Sensor, Device, Notification } from '@/types';

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
}

export interface AppContextType extends AppState, AppActions {
  rooms: string[];
  unreadCount: number;
}

export function useAppData(): AppContextType {
  // Sensors state
  const [sensors, setSensors] = useState<Sensor[]>([
    {
      id: 's1',
      name: 'Living Room Temperature',
      type: 'temperature',
      value: 22,
      unit: '°C',
      room: 'Living Room',
      lastUpdate: new Date(),
      trend: 'stable',
    },
    {
      id: 's2',
      name: 'Bedroom Humidity',
      type: 'humidity',
      value: 65,
      unit: '%',
      room: 'Bedroom',
      lastUpdate: new Date(),
      trend: 'up',
    },
    {
      id: 's3',
      name: 'Kitchen Light Level',
      type: 'light',
      value: 850,
      unit: 'lux',
      room: 'Kitchen',
      lastUpdate: new Date(),
      trend: 'stable',
    },
    {
      id: 's4',
      name: 'Hallway Motion',
      type: 'motion',
      value: 0,
      unit: '',
      room: 'Hallway',
      lastUpdate: new Date(),
      trend: 'stable',
    },
    {
      id: 's5',
      name: 'Total Energy Usage',
      type: 'energy',
      value: 3.2,
      unit: 'kWh',
      room: 'Home',
      lastUpdate: new Date(),
      trend: 'down',
    },
  ]);

  // Devices state
  const [devices, setDevices] = useState<Device[]>([
    {
      id: 'd1',
      name: 'Ceiling Light',
      type: 'light',
      status: 'on',
      room: 'Living Room',
      brightness: 75,
      lastActive: new Date(),
    },
    {
      id: 'd2',
      name: 'Table Lamp',
      type: 'light',
      status: 'off',
      room: 'Bedroom',
      brightness: 50,
      lastActive: new Date(Date.now() - 3600000),
    },
    {
      id: 'd3',
      name: 'Ceiling Fan',
      type: 'fan',
      status: 'on',
      room: 'Bedroom',
      speed: 60,
      lastActive: new Date(),
    },
    {
      id: 'd4',
      name: 'Air Conditioner',
      type: 'ac',
      status: 'on',
      room: 'Living Room',
      temperature: 24,
      lastActive: new Date(),
    },
    {
      id: 'd5',
      name: 'Coffee Maker',
      type: 'plug',
      status: 'off',
      room: 'Kitchen',
      lastActive: new Date(Date.now() - 7200000),
    },
    {
      id: 'd6',
      name: 'TV Stand Light',
      type: 'light',
      status: 'on',
      room: 'Living Room',
      brightness: 40,
      lastActive: new Date(),
    },
    {
      id: 'd7',
      name: 'Kitchen Fan',
      type: 'fan',
      status: 'off',
      room: 'Kitchen',
      speed: 30,
      lastActive: new Date(Date.now() - 1800000),
    },
    {
      id: 'd8',
      name: 'Office AC',
      type: 'ac',
      status: 'off',
      room: 'Office',
      temperature: 22,
      lastActive: new Date(Date.now() - 5400000),
    },
  ]);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'n1',
      type: 'warning',
      message: 'High humidity detected in Bedroom (65%)',
      timestamp: new Date(Date.now() - 300000),
      read: false,
    },
    {
      id: 'n2',
      type: 'info',
      message: 'Motion detected in Hallway',
      timestamp: new Date(Date.now() - 600000),
      read: false,
    },
  ]);

  // Chart data
  const [temperatureData, setTemperatureData] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      time: `${i * 2}:00`,
      value: 20 + Math.random() * 5,
    }))
  );

  const [energyData, setEnergyData] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      time: `${i * 2}:00`,
      value: 2 + Math.random() * 3,
    }))
  );

  const [humidityData, setHumidityData] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      time: `${i * 2}:00`,
      value: 50 + Math.random() * 20,
    }))
  );

  // Simulate real-time sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensors((prev) =>
        prev.map((sensor) => {
          let newValue = sensor.value;
          let newTrend: 'up' | 'down' | 'stable' = 'stable';

          switch (sensor.type) {
            case 'temperature': {
              const tempChange = (Math.random() - 0.5) * 0.5;
              newValue = Math.max(18, Math.min(28, sensor.value + tempChange));
              newTrend = tempChange > 0.1 ? 'up' : tempChange < -0.1 ? 'down' : 'stable';
              break;
            }
            case 'humidity': {
              const humChange = (Math.random() - 0.5) * 2;
              newValue = Math.max(40, Math.min(80, sensor.value + humChange));
              newTrend = humChange > 0.5 ? 'up' : humChange < -0.5 ? 'down' : 'stable';
              
              // Alert for high humidity
              if (newValue > 70 && sensor.value <= 70) {
                const notifId = `n${Date.now()}`;
                setNotifications((prev) => [
                  {
                    id: notifId,
                    type: 'warning',
                    message: `High humidity detected in ${sensor.room} (${Math.round(newValue)}%)`,
                    timestamp: new Date(),
                    read: false,
                  },
                  ...prev,
                ]);
                toast.warning(`High humidity in ${sensor.room}`);
              }
              break;
            }
            case 'light':
              newValue = Math.max(0, Math.min(1000, sensor.value + (Math.random() - 0.5) * 50));
              break;
            case 'motion':
              // Random motion detection
              if (Math.random() > 0.95) {
                newValue = 1;
                const notifId = `n${Date.now()}`;
                setNotifications((prev) => [
                  {
                    id: notifId,
                    type: 'info',
                    message: `Motion detected in ${sensor.room}`,
                    timestamp: new Date(),
                    read: false,
                  },
                  ...prev,
                ]);
                toast.info(`Motion detected in ${sensor.room}`);
              } else {
                newValue = 0;
              }
              break;
            case 'energy': {
              const energyChange = (Math.random() - 0.5) * 0.2;
              newValue = Math.max(0, Math.min(10, sensor.value + energyChange));
              newTrend = energyChange > 0.05 ? 'up' : energyChange < -0.05 ? 'down' : 'stable';
              break;
            }
          }

          return {
            ...sensor,
            value: parseFloat(newValue.toFixed(1)),
            lastUpdate: new Date(),
            trend: newTrend,
          };
        })
      );
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Update chart data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      setTemperatureData((prev) => {
        const newData = [...prev.slice(1), { time: currentTime, value: 20 + Math.random() * 5 }];
        return newData;
      });

      setEnergyData((prev) => {
        const newData = [...prev.slice(1), { time: currentTime, value: 2 + Math.random() * 3 }];
        return newData;
      });

      setHumidityData((prev) => {
        const newData = [...prev.slice(1), { time: currentTime, value: 50 + Math.random() * 20 }];
        return newData;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Event handlers
  const handleDeviceToggle = (id: string) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id
          ? {
              ...device,
              status: device.status === 'on' ? 'off' : 'on',
              lastActive: new Date(),
            }
          : device
      )
    );
    
    const device = devices.find(d => d.id === id);
    if (device) {
      toast.success(`${device.name} turned ${device.status === 'on' ? 'off' : 'on'}`);
    }
  };

  const handleBrightnessChange = (id: string, value: number) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, brightness: value, lastActive: new Date() } : device
      )
    );
  };

  const handleSpeedChange = (id: string, value: number) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, speed: value, lastActive: new Date() } : device
      )
    );
  };

  const handleTemperatureChange = (id: string, value: number) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, temperature: value, lastActive: new Date() } : device
      )
    );
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    toast.info('All notifications cleared');
  };

  const handleAddDevice = (newDevice: Omit<Device, 'id' | 'lastActive'>) => {
    const device: Device = {
      ...newDevice,
      id: `d${Date.now()}`,
      lastActive: new Date(),
    };
    
    setDevices((prev) => [...prev, device]);
    toast.success(`${device.name} added successfully!`);
  };

  // Get unique rooms from devices
  const rooms = Array.from(new Set(devices.map(d => d.room)));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    sensors,
    devices,
    notifications,
    temperatureData,
    energyData,
    humidityData,
    rooms,
    unreadCount,
    handleDeviceToggle,
    handleBrightnessChange,
    handleSpeedChange,
    handleTemperatureChange,
    handleMarkAsRead,
    handleClearAllNotifications,
    handleAddDevice,
  };
}