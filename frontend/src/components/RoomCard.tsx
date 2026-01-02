import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import React from 'react';
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
import { roomAPI } from '@/services/api';

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

const RoomCardComponent = function RoomCard({
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
  const [isControlling, setIsControlling] = useState(false); // Add loading state for room control
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh trigger
  const [averagedSensors, setAveragedSensors] = useState<Sensor[]>([]); // Lưu averaged_sensors từ API
  const lastRoomIdRef = useRef<string | null>(null);
  const hasFetchedDetailsRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const refreshRoomDetails = useCallback(async () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
        try {
          const currentDevices = roomDevicesCache.getCachedDevices(room._id);
          const roomData = await roomAPI.getRoomDetails(room._id);
          
          if (roomData.devices) {
            const hasChanges = !currentDevices || 
              currentDevices.length !== roomData.devices.length ||
              currentDevices.some((device, index) => {
                const newDevice = roomData.devices[index];
                return !newDevice || 
                  device._id !== newDevice._id || 
                  device.enabled !== newDevice.enabled ||
                  device.name !== newDevice.name ||
                  device.status !== newDevice.status;
              });
            
            if (hasChanges) {
              const wasUpdated = roomDevicesCache.setDevices(room._id, roomData.devices);
              
              if (wasUpdated) {
                setRoomDevices(roomData.devices);
                setRefreshTrigger(prev => prev + 1);
                
                window.dispatchEvent(new CustomEvent(`room-devices-updated-${room._id}`, { 
                  detail: { devices: roomData.devices } 
                }));
                
                window.dispatchEvent(new CustomEvent(`room-control-completed-${room._id}`));
              }
            }
          }
        } catch (error) {
          console.error('Error refreshing room details:', error);
        }
      }, 100);
  }, [room._id]);
  
  useEffect(() => {
    const roomId = room._id;
    if (!roomId) {
      setRoomDevices([]);
      setAveragedSensors([]);
      lastRoomIdRef.current = null;
      hasFetchedDetailsRef.current = false;
      return;
    }
    
    if (lastRoomIdRef.current !== roomId) {
      lastRoomIdRef.current = roomId;
      hasFetchedDetailsRef.current = false;
      setAveragedSensors([]);
    }
    
    if (room.averaged_sensors && Array.isArray(room.averaged_sensors) && room.averaged_sensors.length > 0) {
      setAveragedSensors(room.averaged_sensors);
    }
    
    const cached = roomDevicesCache.getCachedDevices(roomId);
    if (cached && cached.length > 0 && !hasFetchedDetailsRef.current) {
      setRoomDevices(cached);
      setRefreshTrigger(prev => prev + 1);
    }
    
    if (!hasFetchedDetailsRef.current && isOnRoomsPage) {
      hasFetchedDetailsRef.current = true;
      setIsLoading(true);
      
      roomAPI.getRoomDetails(roomId)
        .then((roomData) => {
          const devices = roomData.devices || [];
          roomDevicesCache.setDevices(roomId, devices);
          setRoomDevices(devices);
          setRefreshTrigger(prev => prev + 1);
          
          if (roomData.averaged_sensors && Array.isArray(roomData.averaged_sensors)) {
            setAveragedSensors(roomData.averaged_sensors);
          }
          
          window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
            detail: { devices } 
          }));
        })
        .catch((error) => {
          console.error(`Error fetching room details for ${roomId}:`, error);
          setRoomDevices([]);
          setRefreshTrigger(prev => prev + 1);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [room._id, room.devices, isOnRoomsPage]);
  
  const isRefreshingRef = useRef(false);
  useEffect(() => {
    if (!room._id) return;
    
    const handleRoomUpdate = async () => {
      const roomId = room._id;
      
      if (isRefreshingRef.current) {
        return;
      }
      
      isRefreshingRef.current = true;
      
      try {
        const currentCached = roomDevicesCache.getCachedDevices(roomId);
        
        if (!currentCached || currentCached.length === 0) {
          setIsLoading(true);
          const roomData = await roomAPI.getRoomDetails(roomId);
          const devices = roomData.devices || [];
          roomDevicesCache.setDevices(roomId, devices);
          setRoomDevices(devices);
          
          if (roomData.averaged_sensors && Array.isArray(roomData.averaged_sensors)) {
            setAveragedSensors(roomData.averaged_sensors);
          }
          
          setRefreshTrigger(prev => prev + 1);
          
          window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
            detail: { devices } 
          }));
        } else {
          setRoomDevices(currentCached);
          setRefreshTrigger(prev => prev + 1);
        }
      } catch (error: any) {
        console.error(`Error refreshing devices for room ${roomId}:`, error);
      } finally {
        setIsLoading(false);
        isRefreshingRef.current = false;
      }
    };
    
    const eventName = `room-update-${room._id}`;
    window.addEventListener(eventName, handleRoomUpdate);
    
    return () => {
      window.removeEventListener(eventName, handleRoomUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [room._id]);
  

  useEffect(() => {
    if (!room._id) return;
    
    const eventName = `room-averaged-sensors-updated-${room._id}`;
    const handleAveragedSensorsUpdate = (e: any) => {
      const updatedSensors = e.detail?.averaged_sensors;
      if (updatedSensors && Array.isArray(updatedSensors)) {
        setAveragedSensors(updatedSensors);
      }
    };
    
    window.addEventListener(eventName, handleAveragedSensorsUpdate);
    
    return () => {
      window.removeEventListener(eventName, handleAveragedSensorsUpdate);
    };
  }, [room._id]);

  const roomSensors = useMemo(() => {
    if (averagedSensors.length > 0) {
      return averagedSensors;
    }
    
    if (room.averaged_sensors && Array.isArray(room.averaged_sensors) && room.averaged_sensors.length > 0) {
      return room.averaged_sensors;
    }
    
    const allSensors: Sensor[] = [];
    if (room.devices && Array.isArray(room.devices)) {
      room.devices.forEach((device: any) => {
        if (device.sensors && Array.isArray(device.sensors)) {
          allSensors.push(...device.sensors);
        }
      });
    }
    
    if (allSensors.length === 0 && roomDevices.length > 0) {
      roomDevices.forEach((device: any) => {
        if (device.sensors && Array.isArray(device.sensors)) {
          allSensors.push(...device.sensors);
        }
      });
    }
    
    if (allSensors.length === 0 && sensors && sensors.length > 0) {
      return sensors;
    }
    
    return allSensors;
  }, [averagedSensors, room.averaged_sensors, room.devices, roomDevices, sensors]);

  const displaySensors = useMemo(() => {
    if (!roomSensors || roomSensors.length === 0) {
      return [];
    }
    return roomSensors;
  }, [roomSensors]);

  return (
    <div
      id={id || `room-card-${room._id}`}
      className={`flex-shrink-0 flex-grow-0 rounded-2xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.02] ${
        isSelected
          ? 'border-cyan-400/60 bg-cyan-500/20 shadow-cyan-500/30 ring-2 ring-cyan-400/30 scale-[1.02]'
          : 'border-cyan-500/20 hover:border-cyan-400/40 hover:bg-white/15 bg-white/10'
      }`}
      style={{ 
        width: '260px',
        minWidth: '260px', 
        maxWidth: '260px',
        flexBasis: '260px',
        flexShrink: 0,
        flexGrow: 0,
      }}
      onClick={() => onSelect?.(room._id)}
    >
      <div className="p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative transition-all duration-300"
              style={{
                background: isSelected 
                  ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.4) 0%, rgba(59, 130, 246, 0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
                boxShadow: isSelected
                  ? '0 0 20px rgba(34, 211, 238, 0.6), inset 0 0 20px rgba(34, 211, 238, 0.2)'
                  : '0 0 15px rgba(34, 211, 238, 0.4), inset 0 0 15px rgba(34, 211, 238, 0.15)'
              }}
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-base sm:text-lg truncate mb-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
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
        <div className="mb-2">
          {/* Room Control */}
          {onRoomControl && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isControlling}
                className="h-7 text-xs px-2 flex-1 bg-green-500/10 border-green-500/40 text-green-200 hover:bg-green-500/25 hover:border-green-400/60 hover:text-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isControlling) return;
                  
                  setIsControlling(true);
                  try {
                    // Call room control
                    await onRoomControl(room._id, 'on');
                    
                    const updatedDevices = roomDevices.map(device => ({
                      ...device,
                      enabled: true
                    }));
                    setRoomDevices(updatedDevices);
                    setRefreshTrigger(prev => prev + 1);
                    
                    setTimeout(refreshRoomDetails, 500);
                  } catch (error) {
                    console.error('Error controlling room:', error);
                  } finally {
                    setIsControlling(false);
                  }
                }}
              >
                {isControlling ? 'Đang xử lý...' : 'Bật tất cả'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isControlling}
                className="h-7 text-xs px-2 flex-1 bg-red-500/10 border-red-500/40 text-red-200 hover:bg-red-500/25 hover:border-red-400/60 hover:text-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isControlling) return;
                  
                  setIsControlling(true);
                  try {
                    // Call room control
                    await onRoomControl(room._id, 'off');
                    
                    const updatedDevices = roomDevices.map(device => ({
                      ...device,
                      enabled: false
                    }));
                    setRoomDevices(updatedDevices);
                    setRefreshTrigger(prev => prev + 1);
                    
                    setTimeout(refreshRoomDetails, 500);
                  } catch (error) {
                    console.error('Error controlling room:', error);
                  } finally {
                    setIsControlling(false);
                  }
                }}
              >
                {isControlling ? 'Đang xử lý...' : 'Tắt tất cả'}
              </Button>
            </div>
          )}
        </div>

        {/* Sensors Display */}
        {displaySensors.length > 0 && (
          <div className="mb-0 pb-2 border-t border-cyan-500/20 pt-2">
            <p className="text-cyan-200/70 text-xs font-medium mb-1.5 uppercase tracking-wide">Cảm biến</p>
            <div className="space-y-1">
              {displaySensors.map((sensor: Sensor, index: number) => {
                const hasValue = sensor.value !== undefined && sensor.value !== null;
                const sensorValue = hasValue ? sensor.value : null;
                const sensorUnit = sensor.unit || '';
                const isOverThreshold = hasValue && (
                  (sensor.min_threshold !== undefined && sensorValue! < sensor.min_threshold) ||
                  (sensor.max_threshold !== undefined && sensorValue! > sensor.max_threshold)
                );
                
                const formatTime = (date: Date | string | undefined) => {
                  if (!date) return '--';
                  const dateObj = date instanceof Date ? date : new Date(date);
                  if (isNaN(dateObj.getTime())) return '--';
                  
                  const now = new Date();
                  const diff = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
                  
                  // Vừa xong
                  if (diff < 10) return 'Vừa xong';
                  // Giây
                  if (diff < 60) return `${diff}s`;
                  // Phút
                  if (diff < 3600) {
                    const minutes = Math.floor(diff / 60);
                    return `${minutes} phút`;
                  }
                  // Giờ
                  if (diff < 86400) {
                    const hours = Math.floor(diff / 3600);
                    return `${hours} giờ`;
                  }
                  // Ngày
                  const days = Math.floor(diff / 86400);
                  if (days === 1) return 'Hôm qua';
                  if (days < 7) return `${days} ngày`;
                  // Quá 7 ngày - hiển thị ngày tháng
                  return dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                };

                const sensorKey = sensor._id || sensor.id || `sensor-${room._id}-${index}`;

                return (
                  <div 
                    key={sensorKey} 
                    className={`relative bg-slate-800/60 border rounded-lg p-2 transition-all duration-200 hover:bg-slate-800/80 ${
                      isOverThreshold 
                        ? 'border-red-500/50 bg-red-500/15' 
                        : 'border-cyan-500/30 bg-white/5'
                    }`}
                  >
                    {/* Thời gian ở góc trên bên phải */}
                    <div className="absolute top-1.5 right-2">
                      <span className="text-slate-500/70 text-[10px] font-medium">
                        {formatTime(sensor.lastUpdate)}
                      </span>
                    </div>
                    
                    {/* Tên sensor */}
                    <div className="flex items-center gap-1.5 mb-1.5 pr-12">
                      {isOverThreshold && (
                        <span className="text-red-400 text-sm flex-shrink-0">!</span>
                      )}
                      <p className="text-white font-medium text-xs truncate flex-1 min-w-0">{sensor.name}</p>
                    </div>
                    
                    {/* Giá trị và đơn vị */}
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold ${isOverThreshold ? 'text-red-400' : hasValue ? 'text-white' : 'text-slate-400'}`}>
                        {hasValue ? sensorValue!.toFixed(1) : 'N/A'}
                      </span>
                      {hasValue && <span className="text-cyan-200/70 text-sm">{sensorUnit}</span>}
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

const compareDevicesArrays = (devices1?: Device[], devices2?: Device[]): boolean => {
  if (!devices1 && !devices2) return true;
  if (!devices1 || !devices2) return false;
  if (devices1.length !== devices2.length) return false;
  
  return devices1.every((device1, index) => {
    const device2 = devices2[index];
    return device1._id === device2._id && 
           device1.enabled === device2.enabled &&
           device1.name === device2.name &&
           device1.status === device2.status;
  });
};

export const RoomCard = React.memo(RoomCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.room._id === nextProps.room._id &&
    prevProps.room.name === nextProps.room.name &&
    prevProps.room.updated_at === nextProps.room.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.sensors?.length === nextProps.sensors?.length &&
    compareDevicesArrays(prevProps.room.devices, nextProps.room.devices)
  );
});
