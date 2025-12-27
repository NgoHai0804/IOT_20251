import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AddDeviceDialog } from '@/components/AddDeviceDialog';
import { EditDeviceDialog } from '@/components/EditDeviceDialog';
import { EditSensorThresholdDialog } from '@/components/EditSensorThresholdDialog';
import { ChartsPanel } from '@/components/ChartsPanel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Lightbulb, Fan, AirVent, Plug, Pencil } from 'lucide-react';
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
  const isFetchingSensorDataRef = useRef(false); // Flag để tránh gọi trùng lặp
  const [editingSensorThreshold, setEditingSensorThreshold] = useState<Sensor | null>(null);
  const [localDeviceSensors, setLocalDeviceSensors] = useState<Sensor[]>([]);
  const [localDeviceActuators, setLocalDeviceActuators] = useState<Actuator[]>([]);
  const isFetchingDeviceDetailsRef = useRef(false);
  
  // Function để fetch device details (tách ra để dùng lại)
  const fetchDeviceDetails = useCallback(async () => {
    if (!selectedDeviceId) {
      return;
    }
    
    // Tránh gọi trùng lặp
    if (isFetchingDeviceDetailsRef.current) {
      return;
    }
    
    isFetchingDeviceDetailsRef.current = true;
    
    try {
      // Gọi API detail để lấy device kèm sensors và actuators
      const deviceDetail = await newDeviceAPI.getDeviceDetail(selectedDeviceId);
      
      const sensors = deviceDetail.sensors || [];
      const actuators = deviceDetail.actuators || [];
      
      // Lấy giá trị mới nhất cho sensors nếu có sensors
      if (sensors.length > 0) {
        try {
          const latestSensorData = await sensorDataAPI.getLatestSensorData({
            device_id: selectedDeviceId,
          });
          
          // Tạo map sensor_id -> value và timestamp
          const sensorValueMap = new Map<string, { value: number; timestamp: string }>();
          latestSensorData.forEach((data: any) => {
            if (data.sensor_id && data.value !== undefined) {
              sensorValueMap.set(data.sensor_id, {
                value: data.value,
                timestamp: data.timestamp || data.created_at || new Date().toISOString()
              });
            }
          });
          
          // Merge giá trị vào sensors
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
          console.error('Error fetching latest sensor values:', error);
          // Nếu lỗi khi lấy latest values, vẫn set sensors nhưng không có value
          setLocalDeviceSensors(sensors);
        }
      } else {
        setLocalDeviceSensors([]);
      }
      
      setLocalDeviceActuators(actuators);
      
      // Không clear chart data để giữ lại bảng thống kê
    } catch (error) {
      console.error('Error fetching device details:', error);
      // Không hiển thị toast khi refresh định kỳ để tránh spam
      if (!isFetchingDeviceDetailsRef.current) {
        toast.error('Không thể tải thông tin thiết bị', { duration: 1000 });
      }
      setLocalDeviceSensors([]);
      setLocalDeviceActuators([]);
    } finally {
      isFetchingDeviceDetailsRef.current = false;
    }
  }, [selectedDeviceId]);

  // Fetch device details khi selectedDeviceId thay đổi
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
    
    // Fetch ngay lập tức
    setLoadingSensorData(true);
    fetchDeviceDetails().finally(() => {
      setLoadingSensorData(false);
    });
    
    // Fetch định kỳ mỗi 10 giây
    const interval = setInterval(() => {
      fetchDeviceDetails();
    }, 10000); // 10 giây
    
    return () => clearInterval(interval);
  }, [selectedDeviceId, fetchDeviceDetails]);
  
  // Tự động chọn thiết bị khi điều hướng từ trang Rooms
  useEffect(() => {
    const state = location.state as { selectedDeviceId?: string } | null;
    if (state?.selectedDeviceId && onDeviceClick) {
      onDeviceClick(state.selectedDeviceId);
      // Xóa state sau khi chọn
      window.history.replaceState({}, document.title);
    }
  }, [location.state, onDeviceClick]);
  
  // Tìm device đang edit từ devices array
  const editingDevice = editingDeviceId 
    ? devices.find(d => (d._id || d.id) === editingDeviceId) || null
    : null;

  // Tìm device được chọn
  const selectedDevice = selectedDeviceId 
    ? devices.find(d => (d._id || d.id) === selectedDeviceId) || null
    : null;

  // Sử dụng local sensors và actuators từ device detail API
  const deviceSensorsList = useMemo(() => {
    return localDeviceSensors;
  }, [localDeviceSensors]);

  const deviceActuatorsList = useMemo(() => {
    return localDeviceActuators;
  }, [localDeviceActuators]);

  // Wrapper để cập nhật local state sau khi toggle sensor
  const handleSensorToggle = useCallback(async (sensorId: string, enabled: boolean) => {
    if (!onSensorEnableToggle) return;
    
    // Optimistic update: cập nhật ngay lập tức
    setLocalDeviceSensors(prevSensors =>
      prevSensors.map(sensor =>
        (sensor._id || sensor.id) === sensorId
          ? { ...sensor, enabled }
          : sensor
      )
    );
    
    try {
      await onSensorEnableToggle(sensorId, enabled);
      // API đã thành công, state đã được cập nhật ở trên
    } catch (error) {
      // Rollback nếu API thất bại
      setLocalDeviceSensors(prevSensors =>
        prevSensors.map(sensor =>
          (sensor._id || sensor.id) === sensorId
            ? { ...sensor, enabled: !enabled }
            : sensor
        )
      );
      throw error;
    }
  }, [onSensorEnableToggle]);

  // Wrapper để cập nhật local state sau khi control actuator
  const handleActuatorToggle = useCallback(async (actuatorId: string, state: boolean) => {
    if (!onActuatorControl) return;
    
    // Optimistic update: cập nhật ngay lập tức
    setLocalDeviceActuators(prevActuators =>
      prevActuators.map(actuator =>
        (actuator._id || actuator.id) === actuatorId
          ? { ...actuator, state }
          : actuator
      )
    );
    
    try {
      await onActuatorControl(actuatorId, state);
      // API đã thành công, state đã được cập nhật ở trên
    } catch (error) {
      // Rollback nếu API thất bại
      setLocalDeviceActuators(prevActuators =>
        prevActuators.map(actuator =>
          (actuator._id || actuator.id) === actuatorId
            ? { ...actuator, state: !state }
            : actuator
        )
      );
      throw error;
    }
  }, [onActuatorControl]);

  // Ghi nhớ metadata thiết bị để tránh tính toán lại trong map
  const deviceMetadata = useMemo(() => {
    const metadata = new Map<string, {
      sensorsCount: number;
      actuatorsCount: number;
      roomName: string;
    }>();
    
    devices.forEach((device) => {
      const deviceId = device._id || device.id;
      const deviceSensorsCount = sensors?.filter(s => (s.device_id || s.deviceId) === deviceId).length || 0;
      const deviceActuatorsCount = actuators?.filter(a => (a.device_id || a.deviceId) === deviceId).length || 0;
      // Tìm room chứa device này bằng cách query từ API (không dùng room.device_ids)
      // Tạm thời dùng fallback: tìm trong room.devices hoặc device.room
      let roomName = device.room || 'Chưa có phòng';
      if (Array.isArray(rooms)) {
        const foundRoom = rooms.find((r: any) => {
          if (typeof r === 'string') return false;
          // Kiểm tra nếu room có devices và device này có trong đó
          if (r.devices && Array.isArray(r.devices)) {
            return r.devices.some((d: Device) => (d._id || d.id) === deviceId);
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

  // Tính toán dữ liệu trung bình bằng cách nhóm thành tối đa 20 điểm - đã ghi nhớ
  const calculateAveragedData = useCallback((rawData: Array<{ timestamp: string | Date; value: number }>, maxPoints: number = 20): ChartDataPoint[] => {
    if (rawData.length === 0) return [];
    
    // Nếu dữ liệu ít hơn hoặc bằng maxPoints, trả về như cũ
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

    // Chia dữ liệu thành maxPoints nhóm
    const groupSize = Math.ceil(rawData.length / maxPoints);
    const averagedData: ChartDataPoint[] = [];

    for (let i = 0; i < rawData.length; i += groupSize) {
      const group = rawData.slice(i, i + groupSize);
      
      // Tính giá trị trung bình cho nhóm này
      const avgValue = group.reduce((sum, item) => sum + item.value, 0) / group.length;
      
      // Sử dụng timestamp đầu tiên trong nhóm để hiển thị (hoặc timestamp giữa)
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
  }, []);

  // Lấy dữ liệu sensor khi sensor được click - đã ghi nhớ với useCallback
  const handleSensorClick = useCallback(async (sensorId: string, skipSetSelectedId: boolean = false) => {
    // Tránh gọi trùng lặp
    if (isFetchingSensorDataRef.current) {
      return;
    }
    
    if (!skipSetSelectedId) {
      setSelectedSensorId(sensorId);
    }
    
    isFetchingSensorDataRef.current = true;
    setLoadingSensorData(true);
    
    try {
      const sensor = sensors?.find(s => (s._id || s.id) === sensorId);
      if (!sensor) {
        toast.error('Không tìm thấy sensor', { duration: 1000 });
        return;
      }

      setSelectedSensorName(sensor.name);

      // Tính khoảng thời gian dựa trên số ngày được chọn
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDays);

      // Lấy dữ liệu sensor theo sensor_id và khoảng thời gian
      const sensorData = await sensorDataAPI.getSensorData({
        sensor_id: sensorId,
        limit: 1000, // Lấy nhiều hơn để tính trung bình
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      if (!sensorData || sensorData.length === 0) {
        toast.info(`${sensor.name} chưa có dữ liệu trong ${selectedDays} ngày gần đây`, { duration: 1000 });
        setLoadingSensorData(false);
        return;
      }

      // Sắp xếp theo timestamp (cũ nhất trước cho biểu đồ)
      const sortedData = [...sensorData].sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp || a.created_at).getTime();
        const timeB = new Date(b.timestamp || b.created_at).getTime();
        return timeA - timeB;
      });

      // Chuẩn bị dữ liệu thô để tính trung bình
      const rawDataForAveraging = sortedData.map((item: any) => ({
        timestamp: item.timestamp || item.created_at,
        value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0,
      }));

      // Tính dữ liệu trung bình (tối đa 20 điểm)
      const averagedData = calculateAveragedData(rawDataForAveraging, 20);

      // Cập nhật chart data dựa trên sensor type
      const newChartData = {
        temperature: sensor.type === 'temperature' ? averagedData : [],
        humidity: sensor.type === 'humidity' ? averagedData : [],
        energy: (sensor.type === 'energy' || sensor.type === 'gas' || sensor.type === 'light') ? averagedData : [],
      };

      setSensorChartData(newChartData);
      
      // Xác định loại biểu đồ dựa trên loại sensor
      let chartType: 'temperature' | 'humidity' | 'energy' = 'temperature';
      if (sensor.type === 'humidity') {
        chartType = 'humidity';
      } else if (sensor.type === 'energy' || sensor.type === 'gas' || sensor.type === 'light') {
        chartType = 'energy';
      }
      
      setChartDefaultTab(chartType);
      
      toast.success(`Đã tải ${averagedData.length} điểm dữ liệu (trung bình) cho ${sensor.name}`, { duration: 1000 });
    } catch (error: any) {
      console.error('Error fetching sensor data:', error);
      toast.error(error.message || 'Không thể tải dữ liệu sensor', { duration: 1000 });
    } finally {
      setLoadingSensorData(false);
      isFetchingSensorDataRef.current = false;
    }
  }, [sensors, selectedDays, calculateAveragedData]);

  // Lấy lại dữ liệu khi lựa chọn số ngày thay đổi - đã debounce
  // Chỉ refetch khi selectedDays thay đổi, không refetch khi selectedSensorId thay đổi (đã được xử lý trong handleSensorClick)
  const prevSelectedDaysRef = useRef<1 | 3 | 7>(selectedDays);
  const prevSelectedSensorIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Chỉ refetch khi selectedDays thay đổi và đã có sensor được chọn
    // Không refetch khi selectedSensorId thay đổi lần đầu (đã được xử lý trong handleSensorClick khi click)
    if (selectedSensorId && prevSelectedDaysRef.current !== selectedDays && prevSelectedSensorIdRef.current === selectedSensorId) {
      prevSelectedDaysRef.current = selectedDays;
      const timeoutId = setTimeout(() => {
        // Gọi với skipSetSelectedId=true để tránh trigger lại useEffect
        handleSensorClick(selectedSensorId, true);
      }, 300); // Debounce 300ms

      return () => clearTimeout(timeoutId);
    }
    
    // Cập nhật ref khi selectedSensorId thay đổi
    if (prevSelectedSensorIdRef.current !== selectedSensorId) {
      prevSelectedSensorIdRef.current = selectedSensorId;
    }
  }, [selectedDays, selectedSensorId, handleSensorClick]);

  // Đặt lại dữ liệu biểu đồ khi thiết bị thay đổi
  // Đặt lại sensor được chọn khi thiết bị thay đổi
  useEffect(() => {
    if (selectedDeviceId) {
      setSelectedSensorId(null);
      setSelectedSensorName(null);
      setChartDefaultTab(undefined);
      // Chart data sẽ được fetch tự động trong useEffect fetchChartData
    }
  }, [selectedDeviceId]);
  
  // Clear editing state nếu device không còn tồn tại
  useEffect(() => {
    if (editingDeviceId && !devices.find(d => (d._id || d.id) === editingDeviceId)) {
      setEditingDeviceId(null);
    }
  }, [devices, editingDeviceId]);

  // Kiểm tra menu và điều chỉnh width cho device-list-scroll-container
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
        {/* Header - Compact */}
        <div className="flex items-center justify-between flex-shrink-0 mb-6" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
          <div>
            <h2 className="text-white text-3xl font-bold tracking-tight mb-2" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
              Quản Lý Thiết Bị
            </h2>
            <p className="text-cyan-200/70 text-base">Quản lý và điều khiển tất cả thiết bị IoT của bạn</p>
          </div>
          <AddDeviceDialog onAddDevice={onAddDevice} rooms={rooms} />
        </div>

        {/* Device List Container - Horizontal Scrollable */}
        <div style={{ overflowX: 'hidden', maxWidth: '100%' }}>
          {devices.length === 0 ? (
            <div className="text-center py-16 text-cyan-200/80 bg-slate-800/40 border border-cyan-500/30 rounded-2xl backdrop-blur-xl shadow-xl mx-4 md:mx-6 lg:mx-8">
              <Plug className="w-20 h-20 mx-auto mb-6 text-cyan-400/50" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
              <p className="font-semibold text-lg mb-2">Chưa có thiết bị nào</p>
              <p className="text-cyan-200/60 text-sm">Hãy thêm thiết bị mới để bắt đầu!</p>
            </div>
          ) : (
            <div
              id="device-list-scroll-container"
              className="box-border min-w-0 px-4 md:px-6 lg:px-8 mb-4 w-full backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-xl shadow-2xl p-3 sm:p-4 overflow-x-auto overflow-y-hidden"
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
              <div className="inline-flex gap-3 sm:gap-4 touch-pan-x" style={{ width: 'max-content', paddingBottom: '12px' }}>
                  {devices.map((device) => {
                    const Icon = iconMap[device.type] || Plug;
                    const gradient = colorMap[device.type] || 'from-slate-500 to-slate-600';
                    const deviceId = device._id || device.id;
                    const isSelected = selectedDeviceId === deviceId;
                    const deviceEnabled = device.enabled !== undefined ? device.enabled : (device.status === 'on');
                    
                    // Sử dụng metadata đã ghi nhớ
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
                            : deviceEnabled
                            ? 'border-green-400/50 bg-gradient-to-br from-green-500/15 to-emerald-500/15 hover:border-green-400/70'
                            : 'border-slate-700/80 bg-slate-800/60 hover:border-cyan-500/40 hover:bg-slate-800/80'
                        }`}
                        onClick={() => onDeviceClick?.(deviceId)}
                        style={{ 
                          width: '320px',
                          minWidth: '320px', 
                          maxWidth: '320px',
                          flexBasis: '320px',
                          flexShrink: 0,
                          flexGrow: 0,
                          boxShadow: isSelected 
                            ? '0 10px 40px rgba(34, 211, 238, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.3)' 
                            : deviceEnabled
                            ? '0 8px 32px rgba(74, 222, 128, 0.25), 0 0 0 1px rgba(74, 222, 128, 0.15)'
                            : '0 4px 20px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        <div className="p-5">
                          {/* Header: Icon, Name, Status */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br ${gradient} shadow-lg`}
                                style={{
                                  boxShadow: deviceEnabled 
                                    ? '0 0 25px rgba(74, 222, 128, 0.6), inset 0 0 25px rgba(74, 222, 128, 0.2)'
                                    : '0 0 20px rgba(34, 211, 238, 0.4), inset 0 0 20px rgba(34, 211, 238, 0.15)',
                                  opacity: deviceEnabled ? 1 : 0.6
                                }}
                              >
                                <Icon className="w-7 h-7 text-white" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6))' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-bold text-lg truncate mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                  {device.name}
                                </h4>
                                <p className="text-cyan-200/70 text-xs font-medium truncate capitalize">
                                  {device.type}
                                </p>
                              </div>
                            </div>
                            {onDeviceToggle && (
                              <Switch
                                checked={deviceEnabled}
                                onCheckedChange={(checked) => {
                                  onDeviceToggle(deviceId);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 flex-shrink-0"
                              />
                            )}
                          </div>
                          
                          {/* Info: Room, Status, Counts */}
                          <div className="space-y-2.5 mb-4">
                            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/40">
                              <span className="text-cyan-200/80 truncate flex-1 min-w-0 font-medium">{roomName}</span>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-md flex-shrink-0 ml-2 ${
                                deviceEnabled 
                                  ? 'bg-green-500/25 text-green-400 border border-green-500/30' 
                                  : 'bg-slate-500/25 text-slate-400 border border-slate-500/30'
                              }`}>
                                {deviceEnabled ? 'ON' : 'OFF'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-cyan-200/70">
                              {deviceSensorsCount > 0 && (
                                <span className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1 rounded-md">
                                  <span className="font-medium">{deviceSensorsCount} cảm biến</span>
                                </span>
                              )}
                              {deviceActuatorsCount > 0 && (
                                <span className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1 rounded-md">
                                  <span className="font-medium">{deviceActuatorsCount} điều khiển</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-9 text-xs text-cyan-200/90 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-600/20 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-200 font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDevice(deviceId);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            Sửa thiết bị
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Device Details - Split Layout */}
        {selectedDevice && (
          <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0" style={{ maxWidth: '100%', overflowX: 'hidden', height: '100%' }}>
            {/* Left Panel: Sensors & Actuators */}
            <div className="flex-shrink-0 lg:w-80 flex flex-col gap-4 overflow-hidden min-h-0">
              {/* Sensors */}
              {deviceSensorsList.length > 0 && (
                <div className="rounded-2xl backdrop-blur-xl border border-cyan-500/20 bg-white/5 p-3 flex flex-col min-h-0 flex-shrink">
                  <h4 className="text-white text-sm font-bold mb-2 flex-shrink-0">Cảm biến</h4>
                  <div className="space-y-2 overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: '240px', maxWidth: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)' }}>
                          {deviceSensorsList.map((sensor) => {
                            const sensorId = sensor._id || sensor.id;
                            const isSelected = selectedSensorId === sensorId;
                            
                            return (
                              <div 
                                key={sensorId} 
                                className={`rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'border-cyan-400/60 bg-cyan-500/20 ring-2 ring-cyan-400/30'
                                    : 'border-cyan-500/10 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10'
                                }`}
                                onClick={() => handleSensorClick(sensorId)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    {/* Sensor Name and Type */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-white font-semibold text-sm">
                                        {sensor.name}
                                      </span>
                                      <span className="text-cyan-200/50 text-xs flex-shrink-0">
                                        ({sensor.type})
                                      </span>
                                      {isSelected && (
                                        <span className="text-cyan-400 text-xs flex-shrink-0">●</span>
                                      )}
                                    </div>
                                    
                                    {/* Sensor Value */}
                                    {sensor.value !== undefined ? (
                                      <div className="flex items-baseline gap-1.5 mb-1.5">
                                        <span className={`font-bold text-xl ${
                                          (sensor.min_threshold !== undefined && sensor.value < sensor.min_threshold) ||
                                          (sensor.max_threshold !== undefined && sensor.value > sensor.max_threshold)
                                            ? 'text-red-400' 
                                            : 'text-white'
                                        }`}>
                                          {sensor.value.toFixed(1)}
                                        </span>
                                        <span className="text-cyan-200/70 text-sm">
                                          {sensor.unit || ''}
                                        </span>
                                        {/* Cảnh báo vượt ngưỡng */}
                                        {((sensor.min_threshold !== undefined && sensor.value < sensor.min_threshold) ||
                                          (sensor.max_threshold !== undefined && sensor.value > sensor.max_threshold)) && (
                                          <span className="text-red-400 text-base ml-1" title="Vượt quá ngưỡng nguy hiểm">
                                            !
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-slate-400 text-xs mb-1.5">Chưa có dữ liệu</div>
                                    )}
                                    
                                    {/* Ngưỡng */}
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
                                  
                                  {/* Controls */}
                                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {onSensorEnableToggle && (
                                      <Switch
                                        checked={sensor.enabled}
                                        onCheckedChange={(checked) => {
                                          if (sensorId) {
                                            handleSensorToggle(sensorId, checked);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="data-[state=checked]:bg-green-500 h-5 w-9"
                                      />
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSensorThreshold(sensor);
                                      }}
                                      className="h-7 px-2 text-xs text-cyan-200/70 hover:text-cyan-200 hover:bg-cyan-500/20"
                                      title="Chỉnh sửa ngưỡng"
                                    >
                                      ⚙
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                  </div>
                </div>
              )}

              {/* Actuators */}
              {deviceActuatorsList.length > 0 && (
                <div className="rounded-2xl backdrop-blur-xl border border-cyan-500/20 bg-white/5 p-3 flex flex-col min-h-0 flex-shrink">
                  <h4 className="text-white text-sm font-bold mb-2 flex-shrink-0">Điều khiển</h4>
                  <div className="space-y-2 overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: '160px', maxWidth: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)' }}>
                          {deviceActuatorsList.map((actuator) => (
                            <div 
                              key={actuator._id || actuator.id} 
                              className="rounded-lg border border-cyan-500/10 bg-white/5 p-3 hover:border-cyan-400/30 hover:bg-white/10 transition-all duration-200"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold text-sm">
                                      {actuator.name}
                                    </span>
                                    <span className="text-cyan-200/50 text-xs">
                                      ({actuator.type})
                                    </span>
                                  </div>
                                </div>
                                {onActuatorControl && (
                                  <Switch
                                    checked={actuator.state}
                                    onCheckedChange={(checked) => {
                                      const actuatorId = actuator._id || actuator.id;
                                      if (actuatorId) {
                                        handleActuatorToggle(actuatorId, checked);
                                      }
                                    }}
                                    className="data-[state=checked]:bg-green-500 h-5 w-9 flex-shrink-0"
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Charts */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">

              {/* Device Charts */}
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

        {/* Empty State - Fixed */}
        {!selectedDevice && (
          <div className="flex-1 flex items-center justify-center text-center min-h-0">
            <div className="backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-2xl p-12 shadow-2xl">
              <Plug className="w-20 h-20 mx-auto mb-6 text-cyan-400/50" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
              <p className="text-cyan-200/80 font-semibold text-lg mb-2">Chọn một thiết bị</p>
              <p className="text-cyan-200/60 text-sm">Chọn một thiết bị ở trên để xem chi tiết sensor và biểu đồ</p>
            </div>
          </div>
        )}

        {/* Edit Device Dialog */}
        {editingDevice && (
          <EditDeviceDialog
            key={editingDevice._id || editingDevice.id}
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

        {/* Edit Sensor Threshold Dialog */}
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
            }}
          />
        )}
      </div>
    </div>
  );
}
