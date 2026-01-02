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
  const hasFetchedDetailsRef = useRef(false); // Track đã fetch detail chưa
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Debounce updates
  
  // Helper function to refresh room details (chỉ khi cần thiết, với debounce)
  const refreshRoomDetails = useCallback(async () => {
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Debounce updates to prevent rapid successive calls
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        // Kiểm tra xem có cần fetch mới không
        const currentDevices = roomDevicesCache.getCachedDevices(room._id);
        
        const roomData = await roomAPI.getRoomDetails(room._id);
        
        if (roomData.devices) {
          // So sánh với dữ liệu hiện tại để tránh update không cần thiết
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
            
            // Chỉ update state và dispatch event nếu cache thực sự thay đổi
            if (wasUpdated) {
              setRoomDevices(roomData.devices);
              setRefreshTrigger(prev => prev + 1); // Force refresh
              
              // Dispatch event để các component khác biết
              window.dispatchEvent(new CustomEvent(`room-devices-updated-${room._id}`, { 
                detail: { devices: roomData.devices } 
              }));
              
              // Dispatch room control completion event
              window.dispatchEvent(new CustomEvent(`room-control-completed-${room._id}`));
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing room details:', error);
      }
    }, 100); // 100ms debounce
  }, [room._id]);
  
  // Mỗi RoomCard kiểm tra và sử dụng dữ liệu có sẵn thay vì tự fetch
  useEffect(() => {
    const roomId = room._id;
    if (!roomId) {
      setRoomDevices([]);
      setAveragedSensors([]);
      lastRoomIdRef.current = null;
      hasFetchedDetailsRef.current = false;
      return;
    }
    
    // Nếu roomId thay đổi, reset flag và state
    if (lastRoomIdRef.current !== roomId) {
      lastRoomIdRef.current = roomId;
      hasFetchedDetailsRef.current = false;
      setAveragedSensors([]);
    }
    
    // Nếu room đã có averaged_sensors từ props, sử dụng luôn
    if (room.averaged_sensors && Array.isArray(room.averaged_sensors) && room.averaged_sensors.length > 0) {
      setAveragedSensors(room.averaged_sensors);
    }
    
    // Kiểm tra cache trước khi fetch
    const cached = roomDevicesCache.getCachedDevices(roomId);
    if (cached && cached.length > 0 && !hasFetchedDetailsRef.current) {
      setRoomDevices(cached);
      setRefreshTrigger(prev => prev + 1);
    }
    
    // Luôn fetch room details để có dữ liệu chính xác từ API
    if (!hasFetchedDetailsRef.current && isOnRoomsPage) {
      hasFetchedDetailsRef.current = true;
      setIsLoading(true);
      
      roomAPI.getRoomDetails(roomId)
        .then((roomData) => {
          // Cập nhật devices vào cache và state từ room details API
          const devices = roomData.devices || [];
          roomDevicesCache.setDevices(roomId, devices);
          setRoomDevices(devices);
          setRefreshTrigger(prev => prev + 1); // Force refresh
          
          // Cập nhật averaged_sensors từ API response
          if (roomData.averaged_sensors && Array.isArray(roomData.averaged_sensors)) {
            setAveragedSensors(roomData.averaged_sensors);
          }
          
          // Dispatch event để các component khác biết
          window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
            detail: { devices } 
          }));
        })
        .catch((error) => {
          console.error(`Error fetching room details for ${roomId}:`, error);
          // Set empty array nếu có lỗi
          setRoomDevices([]);
          setRefreshTrigger(prev => prev + 1);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [room._id, room.devices, isOnRoomsPage]);
  
  // Refresh devices khi có update - sử dụng custom event (chỉ khi thực sự cần)
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
      
      try {
        // Thay vì invalidate cache và fetch lại, chỉ fetch nếu cần thiết
        const currentCached = roomDevicesCache.getCachedDevices(roomId);
        
        // Chỉ fetch nếu cache rỗng hoặc dữ liệu cũ
        if (!currentCached || currentCached.length === 0) {
          setIsLoading(true);
          const roomData = await roomAPI.getRoomDetails(roomId);
          const devices = roomData.devices || [];
          roomDevicesCache.setDevices(roomId, devices);
          setRoomDevices(devices);
          
          // Cập nhật averaged_sensors từ API response
          if (roomData.averaged_sensors && Array.isArray(roomData.averaged_sensors)) {
            setAveragedSensors(roomData.averaged_sensors);
          }
          
          setRefreshTrigger(prev => prev + 1);
          
          // Dispatch event để các component khác biết đã update
          window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
            detail: { devices } 
          }));
        } else {
          // Sử dụng dữ liệu cache hiện có
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
    
    // Listen for room update events
    const eventName = `room-update-${room._id}`;
    window.addEventListener(eventName, handleRoomUpdate);
    
    return () => {
      window.removeEventListener(eventName, handleRoomUpdate);
      // Cleanup timeout on unmount
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [room._id]);
  
  // Đếm số thiết bị đang hoạt động
  const activeDevices = useMemo(() => {
    const activeCount = roomDevices.filter(d => {
      // Kiểm tra enabled trực tiếp, nếu không có thì mặc định là false
      return d.enabled === true;
    }).length;
    
    return activeCount;
  }, [roomDevices, refreshTrigger]); // Add refreshTrigger to dependencies

  // Lắng nghe event để cập nhật averaged_sensors khi Rooms component fetch room details
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

  // Lấy sensors đã được tính trung bình từ backend (từ trường averaged_sensors)
  const roomSensors = useMemo(() => {
    // Ưu tiên lấy từ state local (từ API response)
    if (averagedSensors.length > 0) {
      return averagedSensors;
    }
    
    // Fallback: lấy từ room.averaged_sensors (từ props)
    if (room.averaged_sensors && Array.isArray(room.averaged_sensors) && room.averaged_sensors.length > 0) {
      return room.averaged_sensors;
    }
    
    // Fallback: lấy từ devices nếu không có averaged_sensors
    const allSensors: Sensor[] = [];
    if (room.devices && Array.isArray(room.devices)) {
      room.devices.forEach((device: any) => {
        if (device.sensors && Array.isArray(device.sensors)) {
          allSensors.push(...device.sensors);
        }
      });
    }
    
    // Fallback: lấy từ roomDevices nếu có
    if (allSensors.length === 0 && roomDevices.length > 0) {
      roomDevices.forEach((device: any) => {
        if (device.sensors && Array.isArray(device.sensors)) {
          allSensors.push(...device.sensors);
        }
      });
    }
    
    // Fallback: lấy từ props sensors nếu có (tương thích với cấu trúc cũ)
    if (allSensors.length === 0 && sensors && sensors.length > 0) {
      return sensors;
    }
    
    return allSensors;
  }, [averagedSensors, room.averaged_sensors, room.devices, roomDevices, sensors]);

  // Sử dụng sensors từ room details API (sensors đã nằm trong devices)
  // Room details API đã tự động lấy sensor data mới nhất
  const rawSensors = useMemo(() => {
    return roomSensors;
  }, [roomSensors]);

  // Nhóm sensors theo type và tính trung bình dựa vào thời gian
  // Backend đã tính trung bình rồi, FE chỉ cần hiển thị
  const displaySensors = useMemo(() => {
    if (!rawSensors || rawSensors.length === 0) {
      return [];
    }

    // Backend đã tính trung bình và nhóm theo type rồi
    // Chỉ cần trả về sensors từ backend
    return rawSensors;
  }, [rawSensors]);

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
          <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-slate-800/40 border border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                activeDevices > 0 
                  ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' 
                  : 'bg-slate-500'
              }`} />
              <p className="text-cyan-200/70 text-sm font-medium">Thiết bị hoạt động</p>
            </div>
            <p className={`font-bold text-base transition-colors duration-300 ${
              activeDevices > 0 ? 'text-green-400' : 'text-white'
            }`}>
              {activeDevices}/{roomDevices.length}
            </p>
          </div>
          
          {/* Room Control */}
          {onRoomControl && roomDevices.length > 0 && (
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
                    
                    // Immediate optimistic update - assume all devices will be enabled
                    const optimisticDevices = roomDevices.map(device => ({
                      ...device,
                      enabled: true
                    }));
                    setRoomDevices(optimisticDevices);
                    setRefreshTrigger(prev => prev + 1);
                    
                    // Auto-refresh room details after control to get actual state
                    setTimeout(refreshRoomDetails, 500); // Wait 500ms for backend to process
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
                    
                    // Immediate optimistic update - assume all devices will be disabled
                    const optimisticDevices = roomDevices.map(device => ({
                      ...device,
                      enabled: false
                    }));
                    setRoomDevices(optimisticDevices);
                    setRefreshTrigger(prev => prev + 1);
                    
                    // Auto-refresh room details after control to get actual state
                    setTimeout(refreshRoomDetails, 500); // Wait 500ms for backend to process
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
              {displaySensors.map((sensor: Sensor) => {
                const hasValue = sensor.value !== undefined && sensor.value !== null;
                const sensorValue = hasValue ? sensor.value : null;
                const sensorUnit = sensor.unit || '';
                const isOverThreshold = hasValue && (
                  (sensor.min_threshold !== undefined && sensorValue! < sensor.min_threshold) ||
                  (sensor.max_threshold !== undefined && sensorValue! > sensor.max_threshold)
                );
                
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
                    className={`bg-slate-800/60 border rounded-lg p-2 transition-all duration-200 hover:bg-slate-800/80 ${
                      isOverThreshold 
                        ? 'border-red-500/50 bg-red-500/15' 
                        : 'border-cyan-500/30 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isOverThreshold && (
                        <span className="text-red-400 text-sm flex-shrink-0">!</span>
                      )}
                      <p className="text-white font-medium text-xs truncate flex-1 min-w-0">{sensor.name}</p>
                      <span className={`text-lg font-bold ${isOverThreshold ? 'text-red-400' : hasValue ? 'text-white' : 'text-slate-400'}`}>
                        {hasValue ? sensorValue!.toFixed(1) : 'N/A'}
                      </span>
                      {hasValue && <span className="text-cyan-200/70 text-xs">{sensorUnit}</span>}
                    </div>
                    <div className="flex items-center justify-end text-xs">
                      <span className="text-slate-400 flex-shrink-0">
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

// Utility function để so sánh devices arrays hiệu quả
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

// Memoize component để tránh re-render không cần thiết
export const RoomCard = React.memo(RoomCardComponent, (prevProps, nextProps) => {
  // So sánh các props quan trọng để quyết định có re-render không
  return (
    prevProps.room._id === nextProps.room._id &&
    prevProps.room.name === nextProps.room.name &&
    prevProps.room.updated_at === nextProps.room.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.sensors?.length === nextProps.sensors?.length &&
    // So sánh devices hiệu quả hơn
    compareDevicesArrays(prevProps.room.devices, nextProps.room.devices)
  );
});
