import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AddDeviceDialog } from '@/components/AddDeviceDialog';
import { EditDeviceDialog } from '@/components/EditDeviceDialog';
import { DeleteDeviceDialog } from '@/components/DeleteDeviceDialog';
import { EditSensorThresholdDialog } from '@/components/EditSensorThresholdDialog';
import { EditSensorNameDialog } from '@/components/EditSensorNameDialog';
import { EditActuatorNameDialog } from '@/components/EditActuatorNameDialog';
import { ChartsPanel } from '@/components/ChartsPanel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Lightbulb, Fan, AirVent, Plug, Pencil, Trash2, Settings } from 'lucide-react';
import { newDeviceAPI, sensorDataAPI } from '@/services/api';
import { toast } from 'sonner';
import type { DevicesProps, Device, Sensor, Actuator, ChartDataPoint } from '@/types';

const iconMap: Record<string, typeof Lightbulb> = {
  light: Lightbulb,
  fan: Fan,
  ac: AirVent,
  plug: Plug,
};

const colorMap: Record<string, string> = {
  light: 'from-yellow-500 to-amber-500',
  fan: 'from-blue-500 to-cyan-500',
  ac: 'from-indigo-500 to-purple-500',
  plug: 'from-green-500 to-emerald-500',
};

export function Devices({
  devices,
  rooms,
  onDeviceToggle,
  onAddDevice,
  onUpdateDevice,
  selectedDeviceId,
  onDeviceClick,
  sensors,
  actuators,
  temperatureData,
  energyData,
  humidityData,
  onSensorEnableToggle,
  onActuatorControl,
}: DevicesProps) {
  const location = useLocation();
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<{ id: string; name: string } | null>(null);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [chartDefaultTab, setChartDefaultTab] = useState<string | undefined>(undefined);
  const [sensorChartData, setSensorChartData] = useState<{
    temperature: ChartDataPoint[];
    humidity: ChartDataPoint[];
    energy: ChartDataPoint[];
  }>({
    temperature: [],
    humidity: [],
    energy: [],
  });
  const [loadingSensorData, setLoadingSensorData] = useState(false);
  const [selectedDays, setSelectedDays] = useState<1 | 3 | 7>(1);
  const [selectedSensorName, setSelectedSensorName] = useState<string | null>(null);
  const isFetchingSensorDataRef = useRef(false);
  const [editingSensorThreshold, setEditingSensorThreshold] = useState<Sensor | null>(null);
  const [editingSensorName, setEditingSensorName] = useState<Sensor | null>(null);
  const [editingActuatorName, setEditingActuatorName] = useState<Actuator | null>(null);
  const [localDeviceSensors, setLocalDeviceSensors] = useState<Sensor[]>([]);
  const [localDeviceActuators, setLocalDeviceActuators] = useState<Actuator[]>([]);
  const isFetchingDeviceDetailsRef = useRef(false);
  
  const fetchDeviceDetails = useCallback(async () => {
    if (!selectedDeviceId) {
      return;
    }
    
    if (isFetchingDeviceDetailsRef.current) {
      return;
    }
    
    isFetchingDeviceDetailsRef.current = true;
    
    try {
      const deviceDetail = await newDeviceAPI.getDeviceDetail(selectedDeviceId);
      
      const sensors = deviceDetail.sensors || [];
      const actuators = deviceDetail.actuators || [];
      
      if (sensors.length > 0) {
        try {
          const latestSensorData = await sensorDataAPI.getLatestSensorData({
            device_id: selectedDeviceId,
          });
          
          const sensorValueMap = new Map<string, { value: number; timestamp: string }>();
          latestSensorData.forEach((data: any) => {
            if (data.sensor_id && data.value !== undefined) {
              sensorValueMap.set(data.sensor_id, {
                value: data.value,
                timestamp: data.timestamp || data.created_at || new Date().toISOString()
              });
            }
          });
          
          const sensorsWithValues = sensors.map(sensor => {
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
          
          setLocalDeviceSensors(sensorsWithValues);
        } catch (error) {
          console.error('Lỗi khi lấy giá trị sensor mới nhất:', error);
          setLocalDeviceSensors(sensors);
        }
      } else {
        setLocalDeviceSensors([]);
      }
      
      setLocalDeviceActuators(actuators);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin thiết bị:', error);
      if (!isFetchingDeviceDetailsRef.current) {
        toast.error('Không thể tải thông tin thiết bị', { duration: 1000 });
      }
      setLocalDeviceSensors([]);
      setLocalDeviceActuators([]);
    } finally {
      isFetchingDeviceDetailsRef.current = false;
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setLocalDeviceSensors([]);
      setLocalDeviceActuators([]);
      setSensorChartData({
        temperature: [],
        humidity: [],
        energy: [],
      });
      return;
    }
    
    setLoadingSensorData(true);
    fetchDeviceDetails().finally(() => {
      setLoadingSensorData(false);
    });
    
    const interval = setInterval(() => {
      fetchDeviceDetails();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedDeviceId, fetchDeviceDetails]);
  
  useEffect(() => {
    const state = location.state as { selectedDeviceId?: string } | null;
    if (state?.selectedDeviceId && onDeviceClick) {
      onDeviceClick(state.selectedDeviceId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, onDeviceClick]);
  
  const editingDevice = editingDeviceId 
    ? devices.find(d => d._id === editingDeviceId) || null
    : null;

  const selectedDevice = selectedDeviceId 
    ? devices.find(d => d._id === selectedDeviceId) || null
    : null;

  const deviceSensorsList = localDeviceSensors;
  const deviceActuatorsList = localDeviceActuators;

  const handleSensorToggle = async (sensorId: string, enabled: boolean) => {
    if (!onSensorEnableToggle) return;
    
    setLocalDeviceSensors(prevSensors =>
      prevSensors.map(sensor =>
        sensor._id === sensorId
          ? { ...sensor, enabled }
          : sensor
      )
    );
    
    try {
      await onSensorEnableToggle(sensorId, enabled);
    } catch (error) {
      setLocalDeviceSensors(prevSensors =>
        prevSensors.map(sensor =>
          sensor._id === sensorId
            ? { ...sensor, enabled: !enabled }
            : sensor
        )
      );
      throw error;
    }
  };

  const handleActuatorToggle = async (actuatorId: string, state: boolean) => {
    if (!onActuatorControl) return;
    
    setLocalDeviceActuators(prevActuators =>
      prevActuators.map(actuator =>
        actuator._id === actuatorId
          ? { ...actuator, state }
          : actuator
      )
    );
    
    try {
      await onActuatorControl(actuatorId, state);
    } catch (error) {
      setLocalDeviceActuators(prevActuators =>
        prevActuators.map(actuator =>
          actuator._id === actuatorId
            ? { ...actuator, state: !state }
            : actuator
        )
      );
      throw error;
    }
  };

  const deviceMetadata = useMemo(() => {
    const metadata = new Map<string, {
      sensorsCount: number;
      actuatorsCount: number;
      roomName: string;
    }>();
    
    devices.forEach((device) => {
      const deviceId = device._id;
      const deviceSensorsCount = sensors?.filter(s => s.device_id === deviceId).length || 0;
      const deviceActuatorsCount = actuators?.filter(a => a.device_id === deviceId).length || 0;
      
      let roomName = 'Chưa có phòng';
      
      if (device.room && typeof device.room === 'string' && device.room.trim()) {
        roomName = device.room;
      } else if (Array.isArray(rooms)) {
        const foundRoom = rooms.find((r: any) => {
          if (typeof r === 'string') return false;
          if (device.room_id && r._id === device.room_id) {
            return true;
          }
          if (r.devices && Array.isArray(r.devices)) {
            return r.devices.some((d: Device) => d._id === deviceId);
          }
          return false;
        });
        if (foundRoom && typeof foundRoom === 'object') {
          roomName = foundRoom.name;
        }
      }
      
      metadata.set(deviceId, {
        sensorsCount: deviceSensorsCount,
        actuatorsCount: deviceActuatorsCount,
        roomName,
      });
    });
    
    return metadata;
  }, [devices, sensors, actuators, rooms]);

  const calculateAveragedData = (rawData: Array<{ timestamp: string | Date; value: number }>, maxPoints: number = 20): ChartDataPoint[] => {
    if (rawData.length === 0) return [];
    
    if (rawData.length <= maxPoints) {
      return rawData.map((item) => {
        const timestamp = new Date(item.timestamp);
        return {
          time: timestamp.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit',
          }),
          value: item.value,
        };
      });
    }

    const groupSize = Math.ceil(rawData.length / maxPoints);
    const averagedData: ChartDataPoint[] = [];

    for (let i = 0; i < rawData.length; i += groupSize) {
      const group = rawData.slice(i, i + groupSize);
      
      const avgValue = group.reduce((sum, item) => sum + item.value, 0) / group.length;
      
      const middleIndex = Math.floor(group.length / 2);
      const timestamp = new Date(group[middleIndex].timestamp);
      
      averagedData.push({
        time: timestamp.toLocaleTimeString('vi-VN', { 
          hour: '2-digit', 
          minute: '2-digit',
        }),
        value: parseFloat(avgValue.toFixed(2)),
      });
    }

    return averagedData;
  };

  const handleSensorClick = async (sensorId: string, skipSetSelectedId: boolean = false) => {
    if (isFetchingSensorDataRef.current) {
      return;
    }
    
    if (!skipSetSelectedId) {
      setSelectedSensorId(sensorId);
    }
    
    isFetchingSensorDataRef.current = true;
    setLoadingSensorData(true);
    
    try {
      const sensor = sensors?.find(s => s._id === sensorId);
      if (!sensor) {
        toast.error('Không tìm thấy sensor', { duration: 1000 });
        return;
      }

      setSelectedSensorName(sensor.name);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDays);

      const sensorData = await sensorDataAPI.getSensorData({
        sensor_id: sensorId,
        limit: 1000,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      if (!sensorData || sensorData.length === 0) {
        setSensorChartData({
          temperature: [],
          humidity: [],
          energy: [],
        });
        setSelectedSensorName(null);
        toast.info(`${sensor.name} chưa có dữ liệu trong ${selectedDays} ngày gần đây`, { duration: 1000 });
        setLoadingSensorData(false);
        isFetchingSensorDataRef.current = false;
        return;
      }

      const sortedData = [...sensorData].sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp || a.created_at).getTime();
        const timeB = new Date(b.timestamp || b.created_at).getTime();
        return timeA - timeB;
      });

      const rawDataForAveraging = sortedData.map((item: any) => ({
        timestamp: item.timestamp || item.created_at,
        value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0,
      }));

      const averagedData = calculateAveragedData(rawDataForAveraging, 20);

      const newChartData = {
        temperature: sensor.type === 'temperature' ? averagedData : [],
        humidity: sensor.type === 'humidity' ? averagedData : [],
        energy: (sensor.type === 'gas' || sensor.type === 'light') ? averagedData : [],
      };

      setSensorChartData(newChartData);
      
      let chartType: 'temperature' | 'humidity' | 'energy' = 'temperature';
      if (sensor.type === 'humidity') {
        chartType = 'humidity';
      } else if (sensor.type === 'gas' || sensor.type === 'light') {
        chartType = 'energy';
      }
      
      setChartDefaultTab(chartType);
      
      toast.success(`Đã tải ${averagedData.length} điểm dữ liệu (trung bình) cho ${sensor.name}`, { duration: 1000 });
    } catch (error: any) {
      console.error('Lỗi khi lấy dữ liệu sensor:', error);
      toast.error(error.message || 'Không thể tải dữ liệu sensor', { duration: 1000 });
    } finally {
      setLoadingSensorData(false);
      isFetchingSensorDataRef.current = false;
    }
  };

  const prevSelectedDaysRef = useRef<1 | 3 | 7>(selectedDays);
  const prevSelectedSensorIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (selectedSensorId && prevSelectedDaysRef.current !== selectedDays && prevSelectedSensorIdRef.current === selectedSensorId) {
      prevSelectedDaysRef.current = selectedDays;
      const timeoutId = setTimeout(() => {
        handleSensorClick(selectedSensorId, true);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
    
    if (prevSelectedSensorIdRef.current !== selectedSensorId) {
      prevSelectedSensorIdRef.current = selectedSensorId;
    }
  }, [selectedDays, selectedSensorId, handleSensorClick]);

  useEffect(() => {
    if (selectedDeviceId) {
      setSelectedSensorId(null);
      setSelectedSensorName(null);
      setChartDefaultTab(undefined);
      setSensorChartData({
        temperature: [],
        humidity: [],
        energy: [],
      });
    }
  }, [selectedDeviceId]);
  
  useEffect(() => {
    if (editingDeviceId && !devices.find(d => d._id === editingDeviceId)) {
      setEditingDeviceId(null);
    }
  }, [devices, editingDeviceId]);

  useEffect(() => {
    const checkMenuAndSetWidth = () => {
      const hasMenu = document.querySelector('#menu') !== null || document.querySelector('aside') !== null;
      const deviceListContainer = document.getElementById('device-list-scroll-container');
      
      const setWidth = (element: HTMLElement | null) => {
        if (!element) return;
        
        if (hasMenu) {
          const menu = document.querySelector('#menu') || document.querySelector('aside');
          if (menu) {
            const isMenuVisible = window.innerWidth >= 1024 || 
                                  (menu instanceof HTMLElement && 
                                   !menu.classList.contains('-translate-x-full') &&
                                   window.getComputedStyle(menu).display !== 'none');
            
            if (isMenuVisible && window.innerWidth >= 1024) {
              element.style.width = 'calc(100vw - 300px)';
            } else {
              element.style.width = 'calc(100vw - 50px)';
            }
          } else {
            element.style.width = 'calc(100vw - 50px)';
          }
        } else {
          element.style.width = 'calc(100vw - 50px)';
        }
      };

      setWidth(deviceListContainer);
    };

    const timer = setTimeout(checkMenuAndSetWidth, 100);
    window.addEventListener('resize', checkMenuAndSetWidth);
    
    const observer = new MutationObserver(checkMenuAndSetWidth);
    const menu = document.querySelector('#menu') || document.querySelector('aside');
    if (menu) {
      observer.observe(menu, { attributes: true, attributeFilter: ['class', 'data-open', 'style'] });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkMenuAndSetWidth);
      observer.disconnect();
    };
  }, []);

  const handleEditDevice = (deviceId: string) => {
    setEditingDeviceId(deviceId);
  };

  const handleDeleteDevice = (deviceId: string, deviceName: string) => {
    setDeletingDevice({ id: deviceId, name: deviceName });
  };

  const handleDeleteSuccess = () => {
    if (onUpdateDevice) {
      onUpdateDevice();
    }
    // Clear selection if deleted device was selected
    if (deletingDevice && selectedDeviceId === deletingDevice.id) {
      onDeviceClick?.('');
    }
    setDeletingDevice(null);
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden font-sans"
      style={{
        height: '100vh',
        overflowX: 'hidden',
        maxWidth: '100vw'
      }}
    >

      <div className="relative z-10 h-full flex flex-col overflow-hidden p-4 md:p-6" style={{ overflowX: 'hidden', maxWidth: '100%', width: '100%', height: '100%' }}>
        <div className="flex items-center justify-between flex-shrink-0 mb-4" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
          <div>
            <h2 className="text-white text-xl sm:text-2xl font-bold tracking-tight mb-1" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
              Quản Lý Thiết Bị
            </h2>
            <p className="text-cyan-200/70 text-sm">Quản lý và điều khiển tất cả thiết bị IoT của bạn</p>
          </div>
          <AddDeviceDialog onAddDevice={onAddDevice || (() => {})} rooms={Array.isArray(rooms) ? rooms.map(r => typeof r === 'string' ? r : r.name) : []} />
        </div>

        <div style={{ overflowX: 'hidden', maxWidth: '100%' }}>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-cyan-200/80 bg-slate-800/40 border border-cyan-500/30 rounded-2xl backdrop-blur-xl shadow-xl mx-4 md:mx-6 lg:mx-8">
              <Plug className="w-16 h-16 mx-auto mb-4 text-cyan-400/50" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
              <p className="font-semibold text-lg mb-2">Chưa có thiết bị nào</p>
              <p className="text-cyan-200/60 text-sm">Hãy thêm thiết bị mới để bắt đầu!</p>
            </div>
          ) : (
            <div
              id="device-list-scroll-container"
              className="box-border min-w-0 px-4 md:px-6 lg:px-8 mb-3 w-full backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-xl shadow-2xl p-2 sm:p-3 overflow-x-auto overflow-y-hidden"
              style={{ 
                maxWidth: '100%', 
                boxSizing: 'border-box', 
                minWidth: 0,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)',
                WebkitOverflowScrolling: 'touch',
              }}
              onWheel={(e) => {
                const container = e.currentTarget;
                if (e.deltaY !== 0) {
                  container.scrollLeft += e.deltaY;
                  e.preventDefault();
                }
              }}
            >
              <style>{`
                #device-list-scroll-container {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5);
                }
                #device-list-scroll-container::-webkit-scrollbar {
                  height: 8px;
                  display: block !important;
                }
                #device-list-scroll-container::-webkit-scrollbar-track {
                  background: rgba(15, 23, 42, 0.9);
                  border-radius: 10px;
                  margin: 0 4px;
                  border: 1px solid rgba(6, 182, 212, 0.4);
                  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4);
                }
                #device-list-scroll-container::-webkit-scrollbar-thumb {
                  background: linear-gradient(90deg, rgba(6, 182, 212, 0.95), rgba(59, 130, 246, 0.95));
                  border-radius: 10px;
                  border: 2px solid rgba(15, 23, 42, 0.9);
                  min-width: 80px;
                  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                  cursor: grab;
                }
                #device-list-scroll-container::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(90deg, rgba(6, 182, 212, 1), rgba(59, 130, 246, 1));
                  box-shadow: 0 2px 10px rgba(6, 182, 212, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25);
                }
                #device-list-scroll-container::-webkit-scrollbar-thumb:active {
                  background: linear-gradient(90deg, rgba(6, 182, 212, 0.85), rgba(59, 130, 246, 0.85));
                  cursor: grabbing;
                  box-shadow: 0 1px 4px rgba(6, 182, 212, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                }
                #device-list-scroll-container::-webkit-scrollbar-button {
                  display: none;
                }
              `}</style>
              <div className="inline-flex gap-2 sm:gap-3 touch-pan-x" style={{ width: 'max-content', paddingBottom: '8px' }}>
                  {devices.map((device) => {
                    const Icon = iconMap[device.type] || Plug;
                    const gradient = colorMap[device.type] || 'from-slate-500 to-slate-600';
                    const deviceId = device._id;
                    const isSelected = selectedDeviceId === deviceId;
                    const deviceEnabled = device.enabled !== undefined ? device.enabled : false;
                    
                    const metadata = deviceMetadata.get(deviceId) || {
                      sensorsCount: 0,
                      actuatorsCount: 0,
                      roomName: 'Unknown',
                    };
                    const { sensorsCount: deviceSensorsCount, actuatorsCount: deviceActuatorsCount, roomName } = metadata;
                    
                    return (
                      <div
                        key={deviceId}
                        className={`flex-shrink-0 flex-grow-0 rounded-2xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.02] ${
                          isSelected
                            ? 'border-cyan-400/60 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-cyan-500/40 ring-2 ring-cyan-400/40 scale-[1.02]'
                            : 'border-slate-700/80 bg-slate-800/60 hover:border-cyan-500/40 hover:bg-slate-800/80'
                        }`}
                        onClick={() => onDeviceClick?.(deviceId)}
                        style={{ 
                          width: '280px',
                          minWidth: '280px', 
                          maxWidth: '280px',
                          flexBasis: '280px',
                          flexShrink: 0,
                          flexGrow: 0,
                          boxShadow: isSelected 
                            ? '0 8px 32px rgba(34, 211, 238, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.3)' 
                            : '0 4px 16px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br ${gradient} shadow-lg`}
                                style={{
                                  boxShadow: deviceEnabled 
                                    ? '0 0 20px rgba(74, 222, 128, 0.5), inset 0 0 20px rgba(74, 222, 128, 0.15)'
                                    : '0 0 15px rgba(34, 211, 238, 0.3), inset 0 0 15px rgba(34, 211, 238, 0.1)',
                                  opacity: deviceEnabled ? 1 : 0.7
                                }}
                              >
                                <Icon className="w-6 h-6 text-white" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-bold text-base truncate mb-0.5" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                  {device.name}
                                </h4>
                                <p className="text-cyan-200/70 text-sm font-medium truncate capitalize">
                                  {device.type} • {roomName}
                                </p>
                              </div>
                            </div>
                            {onDeviceToggle && (
                              <Switch
                                checked={deviceEnabled}
                                onCheckedChange={() => {
                                  onDeviceToggle(deviceId);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 flex-shrink-0"
                              />
                            )}
                          </div>
                          
                          {/* Stats */}
                          <div className="flex items-center justify-between text-xs text-cyan-200/70 mb-3">
                            <div className="flex items-center gap-3">
                              {deviceSensorsCount > 0 && (
                                <span className="flex items-center gap-1 bg-slate-900/40 px-2 py-1 rounded-md">
                                  <span className="font-medium">{deviceSensorsCount} cảm biến</span>
                                </span>
                              )}
                              {deviceActuatorsCount > 0 && (
                                <span className="flex items-center gap-1 bg-slate-900/40 px-2 py-1 rounded-md">
                                  <span className="font-medium">{deviceActuatorsCount} điều khiển</span>
                                </span>
                              )}
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                              deviceEnabled 
                                ? 'bg-green-500/25 text-green-400 border border-green-500/30' 
                                : 'bg-slate-500/25 text-slate-400 border border-slate-500/30'
                            }`}>
                              {deviceEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 h-8 text-xs text-cyan-200/90 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-600/20 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-200 font-semibold rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDevice(deviceId);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-400/90 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30 hover:border-red-400/50 transition-all duration-200 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDevice(deviceId, device.name);
                              }}
                              title="Xóa thiết bị"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {selectedDevice && (
          <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0" style={{ maxWidth: '100%', overflowX: 'hidden', height: '100%' }}>
            <div className="flex-shrink-0 lg:w-72 flex flex-col gap-3 overflow-hidden min-h-0">
              {deviceSensorsList.length > 0 && (
                <div className="rounded-2xl backdrop-blur-xl border border-cyan-500/20 bg-white/5 p-2.5 flex flex-col min-h-0 flex-shrink">
                  <h4 className="text-white text-sm font-bold mb-2 flex-shrink-0">Cảm biến</h4>
                  <div className="space-y-1.5 overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: '300px', maxWidth: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)' }}>
                          {deviceSensorsList.map((sensor) => {
                            const sensorId = sensor._id;
                            const isSelected = selectedSensorId === sensorId;
                            
                            return (
                              <div 
                                key={sensorId} 
                                className={`rounded-lg border p-2.5 cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'border-cyan-400/60 bg-cyan-500/20 ring-2 ring-cyan-400/30'
                                    : 'border-cyan-500/10 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10'
                                }`}
                                onClick={() => handleSensorClick(sensorId)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className="text-white font-semibold text-xs">
                                        {sensor.name}
                                      </span>
                                      <span className="text-cyan-200/50 text-xs flex-shrink-0">
                                        ({sensor.type})
                                      </span>
                                      {isSelected && (
                                        <span className="text-cyan-400 text-xs flex-shrink-0">●</span>
                                      )}
                                    </div>
                                    
                                    {sensor.value !== undefined ? (
                                      <div className="flex items-baseline gap-1 mb-1">
                                        <span className={`font-bold text-lg ${
                                          (sensor.min_threshold !== undefined && sensor.value < sensor.min_threshold) ||
                                          (sensor.max_threshold !== undefined && sensor.value > sensor.max_threshold)
                                            ? 'text-red-400' 
                                            : 'text-white'
                                        }`}>
                                          {sensor.value.toFixed(1)}
                                        </span>
                                        <span className="text-cyan-200/70 text-xs">
                                          {sensor.unit || ''}
                                        </span>
                                        {((sensor.min_threshold !== undefined && sensor.value < sensor.min_threshold) ||
                                          (sensor.max_threshold !== undefined && sensor.value > sensor.max_threshold)) && (
                                          <span className="text-red-400 text-sm ml-1" title="Vượt quá ngưỡng nguy hiểm">
                                            !
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-slate-400 text-xs mb-1">Chưa có dữ liệu</div>
                                    )}
                                    
                                    {(sensor.min_threshold !== undefined || sensor.max_threshold !== undefined) && (
                                      <div className="text-xs text-cyan-200/60">
                                        Ngưỡng: {
                                          sensor.min_threshold !== undefined && sensor.max_threshold !== undefined
                                            ? `${sensor.min_threshold} - ${sensor.max_threshold} ${sensor.unit || ''}`
                                            : sensor.min_threshold !== undefined
                                            ? `≥ ${sensor.min_threshold} ${sensor.unit || ''}`
                                            : `≤ ${sensor.max_threshold} ${sensor.unit || ''}`
                                        }
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {onSensorEnableToggle && (
                                      <Switch
                                        checked={sensor.enabled}
                                        onCheckedChange={(checked) => {
                                          const sensorId = sensor._id;
                                          if (sensorId) {
                                            handleSensorToggle(sensorId, checked);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 h-5 w-9"
                                      />
                                    )}
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSensorName(sensor);
                                        }}
                                        className="h-7 px-2 text-xs text-cyan-200/70 hover:text-cyan-200 hover:bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-400/60 transition-all duration-200"
                                        title="Chỉnh sửa tên"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSensorThreshold(sensor);
                                        }}
                                        className="h-7 px-2 text-xs text-cyan-200/90 hover:text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/40 hover:border-cyan-400/60 transition-all duration-200"
                                        title="Cài đặt ngưỡng cảm biến"
                                      >
                                        <Settings className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                  </div>
                </div>
              )}

              {deviceActuatorsList.length > 0 && (
                <div className="rounded-2xl backdrop-blur-xl border border-cyan-500/20 bg-white/5 p-2.5 flex flex-col min-h-0 flex-shrink">
                  <h4 className="text-white text-sm font-bold mb-2 flex-shrink-0">Điều khiển</h4>
                  <div className="space-y-1.5 overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: '140px', maxWidth: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)' }}>
                          {deviceActuatorsList.map((actuator) => (
                            <div 
                              key={actuator._id} 
                              className="rounded-lg border border-cyan-500/10 bg-white/5 p-2.5 hover:border-cyan-400/30 hover:bg-white/10 transition-all duration-200"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-white font-semibold text-xs">
                                      {actuator.name}
                                    </span>
                                    <span className="text-cyan-200/50 text-xs">
                                      ({actuator.type})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingActuatorName(actuator);
                                    }}
                                    className="h-7 px-2 text-xs text-cyan-200/70 hover:text-cyan-200 hover:bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-400/60 transition-all duration-200"
                                    title="Chỉnh sửa tên"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {onActuatorControl && (
                                    <Switch
                                      checked={actuator.state}
                                      onCheckedChange={(checked) => {
                                        const actuatorId = actuator._id;
                                        if (actuatorId) {
                                          handleActuatorToggle(actuatorId, checked);
                                        }
                                      }}
                                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 h-5 w-9 flex-shrink-0"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden min-h-0">

              <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ height: '100%' }}>
                {loadingSensorData ? (
                  <div className="flex-1 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-white/5 border border-cyan-500/20" style={{ minHeight: 0 }}>
                    <div className="text-center text-cyan-200/60">
                      <p className="font-medium">Đang tải dữ liệu...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden rounded-2xl backdrop-blur-xl bg-white/5 border border-cyan-500/20 shadow-2xl" style={{ minHeight: 0, height: '100%' }}>
                    <ChartsPanel
                      temperatureData={sensorChartData.temperature}
                      energyData={sensorChartData.energy}
                      humidityData={sensorChartData.humidity}
                      sensorName={selectedSensorName || undefined}
                      chartType={chartDefaultTab as 'temperature' | 'humidity' | 'energy' | undefined}
                      selectedDays={selectedDays}
                      onSelectedDaysChange={setSelectedDays}
                      showDaySelector={!!selectedSensorId}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedDevice && (
          <div className="flex-1 flex items-center justify-center text-center min-h-0">
            <div className="backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
              <Plug className="w-16 h-16 mx-auto mb-4 text-cyan-400/50" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
              <p className="text-cyan-200/80 font-semibold text-lg mb-2">Chọn một thiết bị</p>
              <p className="text-cyan-200/60 text-sm">Chọn một thiết bị ở trên để xem chi tiết sensor và biểu đồ</p>
            </div>
          </div>
        )}

        {editingDevice && (
          <EditDeviceDialog
            key={editingDevice._id}
            device={editingDevice}
            rooms={rooms || []}
            onUpdateDevice={async () => {
              if (onUpdateDevice) {
                await onUpdateDevice();
              }
              setTimeout(() => {
                setEditingDeviceId(null);
              }, 200);
            }}
          />
        )}

        {editingSensorThreshold && (
          <EditSensorThresholdDialog
            sensor={editingSensorThreshold}
            open={!!editingSensorThreshold}
            onOpenChange={(open) => {
              if (!open) {
                setEditingSensorThreshold(null);
              }
            }}
            onSuccess={async () => {
              if (onUpdateDevice) {
                await onUpdateDevice();
              }
              if (selectedDeviceId) {
                fetchDeviceDetails();
              }
            }}
          />
        )}

        {editingSensorName && (
          <EditSensorNameDialog
            sensor={editingSensorName}
            open={!!editingSensorName}
            onOpenChange={(open) => {
              if (!open) {
                setEditingSensorName(null);
              }
            }}
            onSuccess={async () => {
              if (onUpdateDevice) {
                await onUpdateDevice();
              }
              if (selectedDeviceId) {
                fetchDeviceDetails();
              }
            }}
          />
        )}

        {editingActuatorName && (
          <EditActuatorNameDialog
            actuator={editingActuatorName}
            open={!!editingActuatorName}
            onOpenChange={(open) => {
              if (!open) {
                setEditingActuatorName(null);
              }
            }}
            onSuccess={async () => {
              if (onUpdateDevice) {
                await onUpdateDevice();
              }
              if (selectedDeviceId) {
                fetchDeviceDetails();
              }
            }}
          />
        )}

        {deletingDevice && (
          <DeleteDeviceDialog
            deviceId={deletingDevice.id}
            deviceName={deletingDevice.name}
            open={!!deletingDevice}
            onOpenChange={(open) => {
              if (!open) {
                setDeletingDevice(null);
              }
            }}
            onSuccess={handleDeleteSuccess}
          />
        )}
      </div>
    </div>
  );
}
