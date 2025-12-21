import { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { Room, Device, Sensor, Actuator } from '@/types';
import { Button } from './ui/button';
import { Home, ChevronRight, Wrench, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { roomDevicesCache } from '@/utils/roomDevicesCache';
import { sensorDataAPI } from '@/services/api';

interface RoomCardProps {
  id?: string;
  room: Room;
  sensors?: Sensor[];
  actuators?: Actuator[];
  isSelected?: boolean;
  onSelect?: (roomId: string) => void;
  onRoomControl?: (roomId: string, action: 'on' | 'off') => void;
  onEditRoom?: (room: Room) => void;
  onDeleteRoom?: (room: Room, deviceCount: number) => void;
  onUpdateRoom?: () => Promise<void>;
}

export function RoomCard({
  id,
  room,
  sensors,
  isSelected = false,
  onSelect,
  onRoomControl,
  onEditRoom,
  onDeleteRoom,
  onUpdateRoom,
}: RoomCardProps) {
  const location = useLocation();
  const isOnRoomsPage = location.pathname === '/rooms';
  const [roomDevices, setRoomDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [roomSensorsWithLatestData, setRoomSensorsWithLatestData] = useState<Sensor[]>([]);
  const lastRoomIdRef = useRef<string | null>(null);
  
  // Mỗi RoomCard tự fetch và quản lý devices của nó (sử dụng cache để tránh duplicate calls)
  useEffect(() => {
    const roomId = room._id;
    if (!roomId) {
      setRoomDevices([]);
      lastRoomIdRef.current = null;
      return;
    }
    
    // Chỉ fetch nếu roomId thay đổi
    if (lastRoomIdRef.current === roomId) {
      // Nếu đã có trong cache, lấy từ cache
      const cached = roomDevicesCache.getCachedDevices(roomId);
      if (cached) {
        setRoomDevices(cached);
      }
      return;
    }
    
    lastRoomIdRef.current = roomId;
    
    // Chỉ lấy từ cache, không fetch nữa
    // Devices sẽ được set vào cache từ API room details khi Rooms component fetch hoặc khi click vào room
    const getRoomDevices = () => {
      const cached = roomDevicesCache.getCachedDevices(roomId);
      if (cached) {
        setRoomDevices(cached);
      } else {
        setRoomDevices([]);
      }
    };
    
    getRoomDevices();
  }, [room._id]);
  
  // Refresh devices khi có update - sử dụng custom event
  const isRefreshingRef = useRef(false);
  useEffect(() => {
    if (!room._id) return;
    
    const handleRoomUpdate = async () => {
      const roomId = room._id;
      
      // Tránh gọi trùng lặp
      if (isRefreshingRef.current) {
        return;
      }
      
      isRefreshingRef.current = true;
      
      // Invalidate cache và fetch lại
      roomDevicesCache.invalidate(roomId);
      setIsLoading(true);
      
      try {
        // Fetch lại từ API (cache đã bị invalidate)
        const devices = await roomDevicesCache.getDevices(roomId);
        setRoomDevices(devices);
        
        // Dispatch event để các component khác biết đã update
        window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
          detail: { devices } 
        }));
      } catch (error: any) {
        console.error(`Error refreshing devices for room ${roomId}:`, error);
      } finally {
        setIsLoading(false);
        isRefreshingRef.current = false;
      }
    };
    
    // Listen for room update events
    const eventName = `room-update-${room._id}`;
    window.addEventListener(eventName, handleRoomUpdate);
    
    return () => {
      window.removeEventListener(eventName, handleRoomUpdate);
    };
  }, [room._id]);
  
  // Đếm số thiết bị đang hoạt động
  const activeDevices = useMemo(() => {
    return roomDevices.filter(d => {
      // Kiểm tra enabled trực tiếp, nếu không có thì mặc định là false
      return d.enabled === true;
    }).length;
  }, [roomDevices]);

  // Lấy sensors của room (từ props - đã được truyền từ API getAllRooms với include_data=true)
  const [roomSensorsFromEvent, setRoomSensorsFromEvent] = useState<Sensor[] | null>(null);
  
  // Lắng nghe event khi sensors được cập nhật từ API (khi click vào room hoặc khi API getAllRooms trả về)
  useEffect(() => {
    if (!room._id) return;
    
    const eventName = `room-sensors-updated-${room._id}`;
    const handleSensorsUpdate = (e: any) => {
      const updatedSensors = e.detail?.sensors;
      if (updatedSensors && Array.isArray(updatedSensors) && updatedSensors.length > 0) {
        setRoomSensorsFromEvent(updatedSensors);
      }
    };
    
    window.addEventListener(eventName, handleSensorsUpdate);
    
    return () => {
      window.removeEventListener(eventName, handleSensorsUpdate);
    };
  }, [room._id]);
  
  // Khi sensors từ props thay đổi và có value, cập nhật ngay
  // Sensors từ props (từ roomSensorsMap) đã được filter đúng cho room này rồi
  useEffect(() => {
    if (sensors && sensors.length > 0) {
      // Kiểm tra xem sensors có value không (từ API với data)
      const hasValues = sensors.some(s => s.value !== undefined && s.value !== null);
      if (hasValues && !roomSensorsFromEvent) {
        // Nếu sensors từ props có value (đã được filter đúng từ Rooms component),
        // set vào event state để hiển thị ngay
        setRoomSensorsFromEvent(sensors);
      } else if (!hasValues && roomDevices.length > 0) {
        // Nếu sensors chưa có value, filter lại để đảm bảo đúng room
        const roomDeviceIds = roomDevices.map(d => d._id).filter(Boolean);
        if (roomDeviceIds.length > 0) {
          const filteredSensors = sensors.filter(s => {
            const deviceId = s.device_id;
            return deviceId && roomDeviceIds.includes(deviceId);
          });
          if (filteredSensors.length > 0 && !roomSensorsFromEvent) {
            setRoomSensorsFromEvent(filteredSensors);
          }
        }
      }
    }
  }, [sensors, roomDevices, roomSensorsFromEvent]);
  
  const roomSensors = useMemo(() => {
    // Ưu tiên sensors từ event (khi click vào room hoặc khi API getAllRooms trả về)
    // Sensors từ event đã được filter đúng cho room này rồi
    if (roomSensorsFromEvent && roomSensorsFromEvent.length > 0) {
      return roomSensorsFromEvent;
    }
    
    // Sensors từ props (từ roomSensorsMap) đã được filter đúng cho room này rồi
    // Nếu sensors có value, sử dụng luôn (đã được filter đúng từ Rooms component)
    if (sensors && sensors.length > 0) {
      const hasValues = sensors.some(s => s.value !== undefined && s.value !== null);
      if (hasValues) {
        // Sensors từ roomSensorsMap đã được filter đúng, sử dụng luôn
        return sensors;
      }
      
      // Nếu sensors chưa có value, filter theo devices của room để đảm bảo đúng
      const roomDeviceIds = roomDevices.map(d => d._id).filter(Boolean);
      if (roomDeviceIds.length > 0) {
        const filteredSensors = sensors.filter(s => {
          const deviceId = s.device_id;
          return deviceId && roomDeviceIds.includes(deviceId);
        });
        if (filteredSensors.length > 0) {
          return filteredSensors;
        }
      }
    }
    
    return [];
  }, [sensors, roomDevices, roomSensorsFromEvent]);

  // Fetch dữ liệu sensor gần nhất định kỳ khi ở trang /rooms
  // Chỉ fetch nếu sensors từ props chưa có value (tức là API chưa trả về data)
  useEffect(() => {
    if (!isOnRoomsPage || !room._id || roomSensors.length === 0) {
      // Nếu không ở trang /rooms hoặc không có sensors, sử dụng sensors từ props
      setRoomSensorsWithLatestData([]);
      return;
    }

    // Kiểm tra xem sensors đã có value chưa (từ API với data)
    const sensorsHaveValues = roomSensors.some(s => s.value !== undefined && s.value !== null);
    
    // Nếu sensors đã có value từ API, không cần fetch riêng
    if (sensorsHaveValues) {
      setRoomSensorsWithLatestData(roomSensors);
      return;
    }

    // Reset dữ liệu cũ khi roomSensors thay đổi
    setRoomSensorsWithLatestData([]);

    const fetchLatestSensorData = async () => {
      try {
        // Lấy sensor_ids của phòng
        const roomSensorIds = roomSensors.map(s => s._id).filter(Boolean);
        if (roomSensorIds.length === 0) {
          setRoomSensorsWithLatestData(roomSensors);
          return;
        }

        // Fetch dữ liệu sensor gần nhất cho tất cả sensors của phòng
        // Fetch cho từng sensor hoặc fetch tất cả rồi filter
        // Tối ưu: fetch tất cả latest data rồi filter theo sensor_ids của phòng
        const allLatestSensorData = await sensorDataAPI.getLatestSensorData();
        
        // Lọc chỉ lấy dữ liệu của sensors trong phòng
        const roomSensorIdsSet = new Set(roomSensorIds);
        const filteredSensorData = allLatestSensorData.filter((data: any) => 
          data.sensor_id && roomSensorIdsSet.has(data.sensor_id)
        );

        // Tạo map sensor_id -> value và timestamp
        const sensorValueMap = new Map<string, { value: number; timestamp: string }>();
        filteredSensorData.forEach((data: any) => {
          if (data.sensor_id && data.value !== undefined) {
            sensorValueMap.set(data.sensor_id, {
              value: data.value,
              timestamp: data.timestamp || data.created_at || new Date().toISOString()
            });
          }
        });

        // Cập nhật sensors với dữ liệu mới nhất
        const updatedSensors = roomSensors.map(sensor => {
          const latestData = sensorValueMap.get(sensor._id);
          if (latestData) {
            return {
              ...sensor,
              value: latestData.value,
              lastUpdate: latestData.timestamp ? new Date(latestData.timestamp) : new Date()
            };
          }
          // Nếu không có dữ liệu mới, giữ nguyên sensor từ props
          return sensor;
        });

        setRoomSensorsWithLatestData(updatedSensors);
      } catch (error) {
        console.error(`Error fetching latest sensor data for room ${room._id}:`, error);
        // Fallback: sử dụng sensors từ props nếu có lỗi
        setRoomSensorsWithLatestData(roomSensors);
      }
    };

    // Fetch ngay lập tức
    fetchLatestSensorData();

    // Fetch định kỳ mỗi 30 giây khi ở trang /rooms (chỉ khi sensors chưa có value)
    const interval = setInterval(() => {
      // Kiểm tra lại xem sensors đã có value chưa
      const stillNeedFetch = !roomSensors.some(s => s.value !== undefined && s.value !== null);
      if (stillNeedFetch) {
        fetchLatestSensorData();
      }
    }, 30000); // 30 giây

    return () => clearInterval(interval);
  }, [isOnRoomsPage, room._id, roomSensors, roomDevices]);

  // Sử dụng sensors với dữ liệu mới nhất nếu có, nếu không thì dùng từ props
  const displaySensors = useMemo(() => {
    // Ưu tiên sensors từ event (từ API getAllRooms hoặc refreshRoomData)
    if (roomSensorsFromEvent && roomSensorsFromEvent.length > 0) {
      return roomSensorsFromEvent;
    }
    
    // Nếu sensors từ props đã có value (từ API getAllRooms với include_data=true), sử dụng luôn
    if (roomSensors.length > 0) {
      const hasValues = roomSensors.some(s => s.value !== undefined && s.value !== null);
      if (hasValues) {
        return roomSensors;
      }
    }
    
    // Nếu có dữ liệu từ fetch riêng, sử dụng
    if (isOnRoomsPage && roomSensorsWithLatestData.length > 0) {
      return roomSensorsWithLatestData;
    }
    
    // Fallback: dùng roomSensors
    return roomSensors;
  }, [isOnRoomsPage, roomSensorsWithLatestData, roomSensors, roomSensorsFromEvent]);

  return (
    <div
      id={id || `room-card-${room._id}`}
      className={`flex-shrink-0 flex-grow-0 rounded-2xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.02] ${
        isSelected
          ? 'border-cyan-400/60 bg-cyan-500/20 shadow-cyan-500/30 ring-2 ring-cyan-400/30 scale-[1.02]'
          : 'border-cyan-500/20 hover:border-cyan-400/40 hover:bg-white/15 bg-white/10'
      }`}
      style={{ 
        width: '280px',
        minWidth: '280px', 
        maxWidth: '280px',
        flexBasis: '280px',
        flexShrink: 0,
        flexGrow: 0,
      }}
      onClick={() => onSelect?.(room._id)}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 relative transition-all duration-300"
              style={{
                background: isSelected 
                  ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.4) 0%, rgba(59, 130, 246, 0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
                boxShadow: isSelected
                  ? '0 0 20px rgba(34, 211, 238, 0.6), inset 0 0 20px rgba(34, 211, 238, 0.2)'
                  : '0 0 15px rgba(34, 211, 238, 0.4), inset 0 0 15px rgba(34, 211, 238, 0.15)'
              }}
            >
              <Home className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-lg sm:text-xl truncate mb-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                {room.name}
              </h4>
              <p className="text-cyan-200/60 text-xs">
                {isLoading ? 'Đang tải...' : `${roomDevices.length} ${roomDevices.length === 1 ? 'thiết bị' : 'thiết bị'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(onEditRoom || onDeleteRoom) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-cyan-200/70 hover:text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-400/40 rounded-lg transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Wrench className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-slate-800 border-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onEditRoom && (
                    <DropdownMenuItem
                      className="text-cyan-200 hover:text-white hover:bg-cyan-500/20 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoom(room);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Sửa
                    </DropdownMenuItem>
                  )}
                  {onDeleteRoom && (
                    <DropdownMenuItem
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRoom(room, roomDevices.length);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onSelect && (
              <ChevronRight className={`w-5 h-5 text-cyan-400 transition-transform duration-300 flex-shrink-0 ${isSelected ? 'rotate-90' : ''}`} />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2.5 p-2.5 rounded-lg bg-slate-800/40 border border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${activeDevices > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <p className="text-cyan-200/70 text-sm font-medium">Thiết bị hoạt động</p>
            </div>
            <p className="text-white font-bold text-lg">{activeDevices}/{roomDevices.length}</p>
          </div>
          
          {/* Room Control */}
          {onRoomControl && roomDevices.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-2.5 flex-1 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onRoomControl(room._id, 'on');
                }}
              >
                Bật tất cả
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-2.5 flex-1 border-red-500/30 text-red-200 hover:bg-red-500/20 hover:border-red-400/50 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onRoomControl(room._id, 'off');
                }}
              >
                Tắt tất cả
              </Button>
            </div>
          )}
        </div>

        {/* Sensors Display */}
        {displaySensors.length > 0 && (
          <div className="mb-0 pb-3 border-t border-cyan-500/20 pt-3">
            <p className="text-cyan-200/70 text-xs font-medium mb-2 uppercase tracking-wide">Cảm biến</p>
            <div className="space-y-1.5">
              {displaySensors.map((sensor) => {
                const sensorValue = sensor.value !== undefined && sensor.value !== null ? sensor.value : 0;
                const sensorUnit = sensor.unit || '';
                const isOverThreshold = 
                  (sensor.min_threshold !== undefined && sensorValue < sensor.min_threshold) ||
                  (sensor.max_threshold !== undefined && sensorValue > sensor.max_threshold);
                
                const formatTime = (date: Date | string | undefined) => {
                  if (!date) return 'N/A';
                  const dateObj = date instanceof Date ? date : new Date(date);
                  if (isNaN(dateObj.getTime())) return 'N/A';
                  
                  const now = new Date();
                  const diff = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
                  
                  if (diff < 60) return `${diff}s`;
                  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
                  return `${Math.floor(diff / 3600)}h`;
                };

                return (
                  <div 
                    key={sensor._id} 
                    className={`bg-slate-800/60 border rounded-lg p-2.5 transition-all duration-200 hover:bg-slate-800/80 ${
                      isOverThreshold 
                        ? 'border-red-500/50 bg-red-500/15' 
                        : 'border-cyan-500/30 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {isOverThreshold && (
                        <span className="text-red-400 text-sm flex-shrink-0">!</span>
                      )}
                      <p className="text-white font-medium text-sm truncate flex-1 min-w-0">{sensor.name}</p>
                      <span className={`text-xl font-bold ${isOverThreshold ? 'text-red-400' : 'text-white'}`}>
                        {sensorValue.toFixed(1)}
                      </span>
                      <span className="text-cyan-200/70 text-xs">{sensorUnit}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      {(sensor.min_threshold !== undefined || sensor.max_threshold !== undefined) && (
                        <span className="text-cyan-200/60 truncate">
                          {sensor.min_threshold !== undefined && sensor.max_threshold !== undefined
                            ? `${sensor.min_threshold}-${sensor.max_threshold}${sensorUnit}`
                            : sensor.min_threshold !== undefined
                            ? `≥${sensor.min_threshold}${sensorUnit}`
                            : `≤${sensor.max_threshold}${sensorUnit}`}
                        </span>
                      )}
                      <span className="text-slate-400 flex-shrink-0 ml-2">
                        {formatTime(sensor.lastUpdate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
