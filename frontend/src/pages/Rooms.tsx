import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddRoomDialog } from '@/components/AddRoomDialog';
import { EditRoomDialog } from '@/components/EditRoomDialog';
import { DeleteRoomDialog } from '@/components/DeleteRoomDialog';
import { RoomCard } from '@/components/RoomCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Home, Plus, Lightbulb, Fan, AirVent, Plug, ExternalLink } from 'lucide-react';
import { roomAPI } from '@/services/api';
import { toast } from 'sonner';
import { roomDevicesCache } from '@/utils/roomDevicesCache';
import type { RoomsProps, Device, Room, Sensor } from '@/types';

export function Rooms({ 
  devices, 
  rooms: roomsProp,
  selectedRoom, 
  onRoomClick, 
  onClearSelection,
  sensors,
  actuators,
  onUpdateRoom,
  onDeviceToggle,
  onRoomControl,
}: RoomsProps) {
  const navigate = useNavigate();
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<{ room: Room; deviceCount: number } | null>(null);
  const [showAddDeviceDialog, setShowAddDeviceDialog] = useState(false);
  const [addingDevice, setAddingDevice] = useState(false);
  const [roomsWithData, setRoomsWithData] = useState<Room[]>([]);
  const fetchingRoomRef = useRef<Set<string>>(new Set()); // Track rooms đang được fetch để tránh duplicate calls
  const hasFetchedRoomsRef = useRef(false); // Track đã fetch rooms chưa
  
  // Lấy devices của selected room từ cache (RoomCard đã tự fetch và cache)
  // Rooms component CHỈ đọc từ cache, KHÔNG fetch mới để tránh duplicate calls
  const [roomDevices, setRoomDevices] = useState<Device[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0); // Track last update time
  
  // Local state để track enabled state của devices cho optimistic update
  const [localDeviceEnabled, setLocalDeviceEnabled] = useState<Map<string, boolean>>(new Map());
  
  // Sync local device enabled state with roomDevices when they change
  useEffect(() => {
    if (roomDevices.length > 0) {
      const newLocalState = new Map<string, boolean>();
      roomDevices.forEach(device => {
        const deviceId = device._id;
        if (deviceId) {
          newLocalState.set(deviceId, device.enabled !== undefined ? device.enabled : false);
        }
      });
      setLocalDeviceEnabled(newLocalState);
    }
  }, [roomDevices, lastUpdateTime]); // Include lastUpdateTime to force sync
  
  // LUÔN gọi API /rooms/ khi vào trang Rooms
  useEffect(() => {
    const fetchRoomsOnMount = async () => {
      // Chỉ fetch một lần khi mount
      if (hasFetchedRoomsRef.current) return;
      hasFetchedRoomsRef.current = true;
      
      try {
        // Gọi API để lấy danh sách phòng
        const roomsData = await roomAPI.getAllRooms();
        
        // Set rooms cơ bản vào roomsWithData (chưa có devices, sensors, actuators)
        setRoomsWithData(roomsData.map((room: any) => ({
          ...room,
          devices: [],
          sensors: [],
          actuators: []
        })));
      } catch (error) {
        console.error('Error fetching rooms on mount:', error);
        toast.error('Không thể tải danh sách phòng', { duration: 1000 });
      }
    };
    
    fetchRoomsOnMount();
  }, []); // Chỉ chạy một lần khi mount
  
  // Khởi tạo roomsWithData từ props.rooms khi có dữ liệu
  useEffect(() => {
    if (roomsProp && roomsProp.length > 0) {
      // Khởi tạo roomsWithData từ props (chưa có details)
      setRoomsWithData(prevRooms => {
        // Merge với prevRooms để giữ lại details của các room đã fetch
        const existingRoomMap = new Map(prevRooms.map(r => [r._id, r]));
        return roomsProp.map((room: any) => {
          const existing = existingRoomMap.get(room._id);
          // Nếu đã có details, giữ lại; nếu chưa có, set empty arrays
          if (existing && existing.devices !== undefined) {
            return existing;
          }
          return {
            ...room,
            devices: room.devices || [],
            sensors: room.sensors || [],
            actuators: room.actuators || []
          };
        });
      });
    }
  }, [roomsProp]);
  
  // Get rooms from props hoặc từ roomsWithData (ưu tiên roomsWithData nếu có)
  const rooms: Room[] = useMemo(() => {
    // Ưu tiên roomsWithData (có đầy đủ dữ liệu)
    if (roomsWithData.length > 0) {
      return roomsWithData;
    }
    // Fallback: Use rooms from props if available
    if (Array.isArray(roomsProp) && roomsProp.length > 0) {
      return roomsProp;
    }
    // Cấu trúc mới: Rooms đã có sẵn từ API, không cần tạo từ device.room_id
    // Nếu không có rooms từ props, trả về mảng rỗng
    return [];
  }, [roomsProp, roomsWithData]);

  
  useEffect(() => {
    if (!selectedRoom) {
      setRoomDevices([]);
      return;
    }
    
    // CHỈ lấy từ cache, KHÔNG fetch mới (để RoomCard tự fetch)
    // Rooms component không fetch để tránh duplicate calls với RoomCard
    const getRoomDevices = () => {
      const cached = roomDevicesCache.getCachedDevices(selectedRoom);
      if (cached) {
        setRoomDevices([...cached]); // Always create new array to ensure re-render
        setLastUpdateTime(Date.now());
      } else {
        // Nếu chưa có cache, set empty array và để RoomCard fetch xong sẽ update qua event
        setRoomDevices([]);
      }
    };
    
    getRoomDevices();
    
    // Listen for updates từ RoomCard (khi devices được update)
    const eventName = `room-devices-updated-${selectedRoom}`;
    const handleUpdate = (e: any) => {
      // Khi có update, lấy lại từ cache hoặc từ event detail
      const devices = e.detail?.devices || roomDevicesCache.getCachedDevices(selectedRoom);
      if (devices) {
        setRoomDevices([...devices]); // Create new array to force re-render
        setLastUpdateTime(Date.now());
      }
    };
    window.addEventListener(eventName, handleUpdate);
    
    // Also listen for room control events to update immediately
    const roomControlEventName = `room-control-completed-${selectedRoom}`;
    const handleRoomControlUpdate = () => {
      // Refresh devices after room control
      setTimeout(() => {
        const cached = roomDevicesCache.getCachedDevices(selectedRoom);
        if (cached) {
          setRoomDevices([...cached]); // Force re-render with new array
          setLastUpdateTime(Date.now());
        }
      }, 100);
    };
    window.addEventListener(roomControlEventName, handleRoomControlUpdate);
    
    // Listen for individual device updates to refresh room details
    const deviceUpdateEventName = `device-updated-${selectedRoom}`;
    const handleDeviceUpdate = () => {
      // When individual device is updated, refresh room details
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(`room-update-${selectedRoom}`));
      }, 200);
    };
    window.addEventListener(deviceUpdateEventName, handleDeviceUpdate);
    
    // Poll cache một lần nữa sau 100ms để catch data nếu RoomCard đã fetch xong
    const timeoutId = setTimeout(() => {
      const cached = roomDevicesCache.getCachedDevices(selectedRoom);
      if (cached && cached.length > 0) {
        setRoomDevices([...cached]); // Force re-render with new array
        setLastUpdateTime(Date.now());
      }
    }, 100);
    
    return () => {
      window.removeEventListener(eventName, handleUpdate);
      window.removeEventListener(roomControlEventName, handleRoomControlUpdate);
      window.removeEventListener(deviceUpdateEventName, handleDeviceUpdate);
      clearTimeout(timeoutId);
    };
  }, [selectedRoom]);

  // Tạo map roomId -> sensors từ roomsWithData để truyền cho RoomCard
  const roomSensorsMap = useMemo(() => {
    const map = new Map<string, Sensor[]>();
    roomsWithData.forEach((room: any) => {
      if (room._id && room.sensors && Array.isArray(room.sensors)) {
        map.set(room._id, room.sensors);
      }
    });
    return map;
  }, [roomsWithData]);
  
  // Dispatch event để RoomCard biết sensors đã có từ API (chỉ dispatch khi roomsWithData thay đổi)
  useEffect(() => {
    if (roomsWithData.length > 0) {
      roomsWithData.forEach((room: any) => {
        if (room._id && room.sensors && Array.isArray(room.sensors) && room.sensors.length > 0) {
          // Dispatch event với sensors đã được filter đúng cho room này
          window.dispatchEvent(new CustomEvent(`room-sensors-updated-${room._id}`, { 
            detail: { sensors: room.sensors } 
          }));
        }
      });
    }
  }, [roomsWithData]);

  // Get devices without room (query từ API cho mỗi room và lấy devices không có trong bất kỳ room nào)
  const [devicesWithoutRoom, setDevicesWithoutRoom] = useState<Device[]>([]);
  
  useEffect(() => {
    const fetchDevicesWithoutRoom = async () => {
      if (!Array.isArray(rooms) || rooms.length === 0) {
        setDevicesWithoutRoom(devices);
        return;
      }
      
      const allDeviceIdsInRooms = new Set<string>();
      
      // Lấy devices từ cache của tất cả rooms
      for (const room of rooms) {
        if (typeof room === 'string') continue;
        const roomId = room._id;
        
        // Lấy từ cache, nếu chưa có thì fetch
        let roomDevs: Device[] = [];
        const cached = roomDevicesCache.getCachedDevices(roomId);
        if (cached) {
          roomDevs = cached;
        } else {
          try {
            roomDevs = await roomDevicesCache.getDevices(roomId);
          } catch (error) {
            console.error(`Error fetching devices for room ${roomId}:`, error);
          }
        }
        
        roomDevs.forEach((d: Device) => {
          const deviceId = d._id;
          if (deviceId) allDeviceIdsInRooms.add(deviceId);
        });
      }
      
      // Lọc devices không có trong bất kỳ room nào
      const devicesNotInRooms = devices.filter(d => {
        const deviceId = d._id;
        return deviceId && !allDeviceIdsInRooms.has(deviceId);
      });
      setDevicesWithoutRoom(devicesNotInRooms);
    };
    
    // Debounce nhẹ để tránh gọi quá nhiều lần khi có nhiều thay đổi liên tiếp
    const timeoutId = setTimeout(() => {
      fetchDevicesWithoutRoom();
    }, 100); // Giảm debounce xuống 100ms
    
    return () => clearTimeout(timeoutId);
  }, [devices, rooms]);
  
  // Kiểm tra menu và điều chỉnh width
  useEffect(() => {
    const checkMenuAndSetWidth = () => {
      const hasMenu = document.querySelector('#menu') !== null || document.querySelector('aside') !== null; // Kiểm tra menu
      const roomListDiv = document.getElementById('room-list-container');
      const emptyStateDiv = document.getElementById('empty-state-container');
      const noDeviceDiv = document.getElementById('no-device-container');
      
      const setWidth = (element: HTMLElement | null) => {
        if (!element) return;
        
        if (hasMenu) {
          // Kiểm tra xem menu có đang hiển thị không (trên màn hình lớn >= 1024px)
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

      setWidth(roomListDiv);
      // Không set width cho device-list-container vì nó đã có container cha điều chỉnh
      setWidth(emptyStateDiv);
      setWidth(noDeviceDiv);
    };

    // Chờ DOM render xong
    const timer = setTimeout(checkMenuAndSetWidth, 100);
    window.addEventListener('resize', checkMenuAndSetWidth);
    
    // Kiểm tra lại khi sidebar thay đổi
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

  // Get selected room name
  const selectedRoomName = useMemo(() => {
    if (!selectedRoom) return '';
    const room = rooms.find(r => r._id === selectedRoom);
    return room?.name || '';
  }, [selectedRoom, rooms]);

  // Handle add device to room (cấu trúc mới: Room chứa device_ids)
  const handleAddDeviceToRoom = async (deviceId: string) => {
    if (!selectedRoom || !selectedRoomName) {
      toast.error('Vui lòng chọn phòng trước', { duration: 1000 });
      return;
    }

    setAddingDevice(true);
    try {
      // Sử dụng API mới: thêm device_id vào room.device_ids
      const { roomAPI } = await import('@/services/api');
      await roomAPI.addDeviceToRoom(selectedRoom, deviceId);
      
      toast.success('Đã thêm thiết bị vào phòng', { duration: 1000 });
      
      // Chỉ refresh room cụ thể thay vì fetch tất cả rooms
      if (selectedRoom && !fetchingRoomRef.current.has(selectedRoom)) {
        fetchingRoomRef.current.add(selectedRoom);
        try {
          const roomData = await roomAPI.getRoomDetails(selectedRoom);
          
          // Đánh dấu room đã được fetch details
          const roomDataWithFlag = { ...roomData, _fetchedDetails: true };
          
          // Cập nhật room trong roomsWithData
          setRoomsWithData(prevRooms => {
            return prevRooms.map(r => 
              r._id === selectedRoom ? { ...r, ...roomDataWithFlag } : r
            );
          });
          
          // Cập nhật cache
          if (roomData.devices && roomData.devices.length > 0) {
            roomDevicesCache.setDevices(selectedRoom, roomData.devices);
            window.dispatchEvent(new CustomEvent(`room-devices-updated-${selectedRoom}`, { 
              detail: { devices: roomData.devices } 
            }));
          }
        } catch (error) {
          console.error('Error refreshing room data:', error);
        } finally {
          fetchingRoomRef.current.delete(selectedRoom);
        }
      }
      
      // Gọi onUpdateRoom nếu có
      if (onUpdateRoom) {
        await onUpdateRoom();
      }
      
      setShowAddDeviceDialog(false);
    } catch (error: any) {
      console.error('Error adding device to room:', error);
      toast.error(error.message || 'Không thể thêm thiết bị vào phòng', { duration: 1000 });
    } finally {
      setAddingDevice(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
  };

  const handleDeleteRoom = (room: Room, deviceCount: number) => {
    setDeletingRoom({ room, deviceCount });
  };

  const handleRoomUpdateSuccess = async () => {
    // Không fetch rooms ở đây nữa vì useAppData đã fetch và sẽ cập nhật qua props
    // Chỉ cập nhật local state từ props khi props thay đổi
    if (onUpdateRoom) {
      await onUpdateRoom();
    }
    
    setEditingRoom(null);
    setDeletingRoom(null);
    if (deletingRoom && selectedRoom === deletingRoom.room._id) {
      onClearSelection?.();
    }
  };

  const handleAddRoomSuccess = async (roomName: string, roomId?: string) => {
    // Gọi onUpdateRoom để refresh rooms list từ useAppData
    if (onUpdateRoom) {
      await onUpdateRoom();
    }
    
    // Nếu có roomId từ response, sử dụng luôn; nếu không thì tìm từ roomsProp
    let targetRoomId = roomId;
    
    if (!targetRoomId) {
      // Fallback: tìm room mới trong roomsProp sau khi refresh
      await new Promise(resolve => setTimeout(resolve, 300));
      const newRoom = roomsProp?.find((r: Room) => r.name === roomName);
      targetRoomId = newRoom?._id;
    }
    
    // Fetch details cho room mới nếu có ID
    if (targetRoomId) {
      // Fetch details cho room mới
      if (!fetchingRoomRef.current.has(targetRoomId)) {
        fetchingRoomRef.current.add(targetRoomId);
        try {
          const roomData = await roomAPI.getRoomDetails(targetRoomId);
          
          // Đánh dấu room đã được fetch details
          const roomDataWithFlag = { ...roomData, _fetchedDetails: true };
          
          // Cập nhật room trong roomsWithData
          setRoomsWithData(prevRooms => {
            const updatedRooms = prevRooms.map(r => 
              r._id === targetRoomId ? { ...r, ...roomDataWithFlag } : r
            );
            // Nếu room chưa có trong list, thêm vào
            if (!updatedRooms.find(r => r._id === targetRoomId)) {
              updatedRooms.push(roomDataWithFlag);
            }
            return updatedRooms;
          });
          
          // Cập nhật cache
          if (roomData.devices && roomData.devices.length > 0) {
            roomDevicesCache.setDevices(targetRoomId, roomData.devices);
            window.dispatchEvent(new CustomEvent(`room-devices-updated-${targetRoomId}`, { 
              detail: { devices: roomData.devices } 
            }));
          }
          
          // Dispatch event để RoomCard cập nhật sensors
          if (roomData.sensors) {
            window.dispatchEvent(new CustomEvent(`room-sensors-updated-${targetRoomId}`, { 
              detail: { sensors: roomData.sensors } 
            }));
          }
        } catch (error) {
          console.error('Error fetching new room details:', error);
        } finally {
          fetchingRoomRef.current.delete(targetRoomId);
        }
      }
    }
  };

  const handleDeleteRoomSuccess = () => {
    handleRoomUpdateSuccess();
  };


  // Wrapper để cập nhật local state sau khi toggle device power
  const handleDeviceToggle = useCallback(async (deviceId: string) => {
    if (!onDeviceToggle) return;
    
    // Lấy enabled state hiện tại từ props hoặc local state
    const device = roomDevices.find(d => d._id === deviceId) || 
                   devicesWithoutRoom.find(d => d._id === deviceId) ||
                   devices.find(d => d._id === deviceId);
    const currentEnabled = localDeviceEnabled.get(deviceId) ?? 
                          (device?.enabled !== undefined ? device.enabled : false);
    const newEnabled = !currentEnabled;
    
    // Optimistic update: cập nhật ngay lập tức
    setLocalDeviceEnabled(prev => {
      const newMap = new Map(prev);
      newMap.set(deviceId, newEnabled);
      return newMap;
    });
    
    try {
      await onDeviceToggle(deviceId);
      
      // After successful toggle, refresh room details to get updated state
      if (selectedRoom) {
        // Dispatch device update event first
        window.dispatchEvent(new CustomEvent(`device-updated-${selectedRoom}`, { 
          detail: { deviceId, enabled: newEnabled } 
        }));
        
        // Then trigger room details refresh with a delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(`room-update-${selectedRoom}`));
        }, 300); // Small delay to allow backend to process
      }
      
      // API đã thành công, state đã được cập nhật ở trên
    } catch (error) {
      // Rollback nếu API thất bại
      setLocalDeviceEnabled(prev => {
        const newMap = new Map(prev);
        newMap.set(deviceId, currentEnabled);
        return newMap;
      });
      throw error;
    }
  }, [onDeviceToggle, roomDevices, devicesWithoutRoom, devices, localDeviceEnabled, selectedRoom]);

  // Sync local state với props khi devices thay đổi
  // Chỉ sync cho các device mới hoặc device không có trong local state
  useEffect(() => {
    const allDevices = [...roomDevices, ...devicesWithoutRoom, ...devices];
    setLocalDeviceEnabled(prev => {
      const newMap = new Map(prev);
      allDevices.forEach(device => {
        const deviceId = device._id;
        const enabled = device.enabled !== undefined ? device.enabled : false;
        // Chỉ sync nếu device chưa có trong local state (để giữ optimistic update)
        if (!newMap.has(deviceId)) {
          newMap.set(deviceId, enabled);
        }
      });
      return newMap;
    });
  }, [roomDevices, devicesWithoutRoom, devices]); // Sync khi devices thay đổi từ props

  const handleViewDeviceDetails = (deviceId: string) => {
    navigate('/devices', { state: { selectedDeviceId: deviceId } });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden font-sans min-h-screen w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div className="relative z-10 h-full flex flex-col overflow-hidden w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-shrink-0 mb-4 px-4 md:px-6 lg:px-8 gap-3 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden', minWidth: 0 }}>
          <div>
            <h2 className="text-white text-xl sm:text-2xl font-bold mb-1 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
              Quản Lý Phòng
            </h2>
            <p className="text-cyan-200/70 text-sm font-medium">Quản lý phòng và thiết bị trong từng phòng</p>
          </div>
          <Button
            onClick={() => setShowAddRoom(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white gap-2 shadow-xl shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 font-bold px-3 sm:px-4 h-9 sm:h-10 text-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm Phòng Mới</span>
            <span className="sm:hidden">Thêm Phòng</span>
          </Button>
        </div>

        {/* Room List Container - Horizontal Scrollable */}
        <div 
          id="room-list-container"
          className="box-border min-w-0 px-4 md:px-6 lg:px-8 mb-3" 
          style={{ maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}
        >
          <div 
            className="w-full backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-xl shadow-2xl p-2 sm:p-3 overflow-x-auto overflow-y-hidden" 
            id="room-list-scroll-container"
            style={{ 
              width: '100%', 
              maxWidth: '100%', 
              boxSizing: 'border-box',
              minWidth: 0,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style>{`
              #room-list-scroll-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5);
              }
              #room-list-scroll-container::-webkit-scrollbar {
                height: 8px;
                display: block !important;
              }
              #room-list-scroll-container::-webkit-scrollbar-track {
                background: rgba(15, 23, 42, 0.9);
                border-radius: 10px;
                margin: 0 4px;
                border: 1px solid rgba(6, 182, 212, 0.4);
                box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4);
              }
              #room-list-scroll-container::-webkit-scrollbar-thumb {
                background: linear-gradient(90deg, rgba(6, 182, 212, 0.95), rgba(59, 130, 246, 0.95));
                border-radius: 10px;
                border: 2px solid rgba(15, 23, 42, 0.9);
                min-width: 80px;
                box-shadow: 0 2px 8px rgba(6, 182, 212, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                cursor: grab;
              }
              #room-list-scroll-container::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(90deg, rgba(6, 182, 212, 1), rgba(59, 130, 246, 1));
                box-shadow: 0 2px 10px rgba(6, 182, 212, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25);
              }
              #room-list-scroll-container::-webkit-scrollbar-thumb:active {
                background: linear-gradient(90deg, rgba(6, 182, 212, 0.85), rgba(59, 130, 246, 0.85));
                cursor: grabbing;
                box-shadow: 0 1px 4px rgba(6, 182, 212, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
              }
              #room-list-scroll-container::-webkit-scrollbar-button {
                display: none;
              }
            `}</style>
            <div className="inline-flex gap-2 sm:gap-3 touch-pan-x" style={{ width: 'max-content', paddingBottom: '8px' }}>
              {rooms.map((room) => {
                const isSelected = selectedRoom === room._id;
                
                // Ưu tiên sensors từ room data (từ API getAllRooms với include_data=true)
                // Sensors từ roomSensorsMap đã được filter đúng cho room này rồi
                const roomSensorsFromData = roomSensorsMap.get(room._id);
                // Nếu không có từ roomSensorsMap, filter từ sensors props theo devices của room
                let sensorsForCard = roomSensorsFromData;
                if (!sensorsForCard && sensors && sensors.length > 0 && room.devices) {
                  const roomDeviceIds = (room.devices as Device[]).map(d => d._id).filter(Boolean);
                  if (roomDeviceIds.length > 0) {
                    sensorsForCard = sensors.filter(s => {
                      const deviceId = s.device_id;
                      return deviceId && roomDeviceIds.includes(deviceId);
                    });
                  }
                }
                if (!sensorsForCard) {
                  sensorsForCard = [];
                }
                
                return (
                  <RoomCard
                    key={room._id}
                    id={`room-card-${room._id}`}
                    room={room}
                    sensors={sensorsForCard}
                    actuators={actuators || []}
                    isSelected={isSelected}
                    onSelect={async (roomId) => {
                      // Gọi onRoomClick trước để set selected room (không block UI)
                      onRoomClick?.(roomId);
                      
                      // LUÔN gọi detail API khi click vào phòng (refresh data mới nhất)
                      // Kiểm tra xem room đang được fetch chưa (tránh duplicate calls)
                      if (fetchingRoomRef.current.has(roomId)) {
                        return; // Đang fetch rồi, không gọi lại
                      }
                      
                      fetchingRoomRef.current.add(roomId);
                      try {
                        const roomData = await roomAPI.getRoomDetails(roomId);
                        
                        // Đánh dấu room đã được fetch details
                        const roomDataWithFlag = { ...roomData, _fetchedDetails: true };
                        
                        // Cập nhật room trong roomsWithData
                        setRoomsWithData(prevRooms => {
                          const updatedRooms = prevRooms.map(r => 
                            r._id === roomId ? { ...r, ...roomDataWithFlag } : r
                          );
                          // Nếu room chưa có trong list, thêm vào
                          if (!updatedRooms.find(r => r._id === roomId)) {
                            updatedRooms.push(roomDataWithFlag);
                          }
                          return updatedRooms;
                        });
                        
                        // Cập nhật cache
                        if (roomData.devices && roomData.devices.length > 0) {
                          roomDevicesCache.setDevices(roomId, roomData.devices);
                          window.dispatchEvent(new CustomEvent(`room-devices-updated-${roomId}`, { 
                            detail: { devices: roomData.devices } 
                          }));
                        }
                        
                        // Dispatch event để RoomCard cập nhật averaged_sensors
                        if (roomData.averaged_sensors) {
                          window.dispatchEvent(new CustomEvent(`room-averaged-sensors-updated-${roomId}`, { 
                            detail: { averaged_sensors: roomData.averaged_sensors } 
                          }));
                        }
                      } catch (error) {
                        console.error('Error fetching room data:', error);
                        toast.error('Không thể tải dữ liệu phòng', { duration: 1000 });
                      } finally {
                        fetchingRoomRef.current.delete(roomId);
                      }
                    }}
                    onRoomControl={onRoomControl}
                    onEditRoom={handleEditRoom}
                    onDeleteRoom={handleDeleteRoom}
                    onUpdateRoom={onUpdateRoom}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Room Devices List */}
        {selectedRoom && (
          <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 lg:px-8 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflowX: 'hidden', overflowY: 'visible' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 flex-shrink-0 gap-2 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}>
              <div>
                <h3 className="text-white text-base sm:text-lg font-bold tracking-tight mb-0" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  Các Thiết Bị Trong Phòng
                </h3>
                <p className="text-cyan-200/60 text-xs">
                  {selectedRoomName && `Phòng: ${selectedRoomName}`}
                </p>
              </div>
              <Button
                onClick={() => setShowAddDeviceDialog(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white gap-1.5 shadow-xl shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 font-bold text-xs h-7 px-2.5 w-full sm:w-auto"
              >
                <Plus className="w-3 h-3" />
                Thêm thiết bị
              </Button>
            </div>
            
            {roomDevices.length > 0 ? (
            <div
              className="box-border min-w-0 backdrop-blur-xl border rounded-2xl shadow-2xl p-2.5 sm:p-3 w-full"
              id="device-list-container"
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                minWidth: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <style>{`
                #device-list-container {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5);
                }
                #device-list-container::-webkit-scrollbar {
                  width: 8px;
                }
                #device-list-container::-webkit-scrollbar:vertical {
                  display: block;
                }
                #device-list-container::-webkit-scrollbar-track {
                  background: rgba(15, 23, 42, 0.9);
                  border-radius: 10px;
                  margin: 4px 0;
                  border: 1px solid rgba(6, 182, 212, 0.4);
                  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4);
                }
                #device-list-container::-webkit-scrollbar-thumb {
                  background: linear-gradient(180deg, rgba(6, 182, 212, 0.95), rgba(59, 130, 246, 0.95));
                  border-radius: 10px;
                  border: 2px solid rgba(15, 23, 42, 0.9);
                  min-height: 80px;
                  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                  cursor: grab;
                }
                #device-list-container::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(180deg, rgba(6, 182, 212, 1), rgba(59, 130, 246, 1));
                  box-shadow: 0 2px 10px rgba(6, 182, 212, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25);
                }
                #device-list-container::-webkit-scrollbar-thumb:active {
                  background: linear-gradient(180deg, rgba(6, 182, 212, 0.85), rgba(59, 130, 246, 0.85));
                  cursor: grabbing;
                  box-shadow: 0 1px 4px rgba(6, 182, 212, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                }
                #device-list-container::-webkit-scrollbar-button {
                  display: none;
                }
              `}</style>
              <div className="flex flex-col gap-2.5" key={`devices-${selectedRoom}-${lastUpdateTime}`}>
                {roomDevices.map((device) => {
                  const deviceId = device._id;
                  // Ưu tiên local state (optimistic update), fallback về props
                  const deviceEnabled = localDeviceEnabled.has(deviceId) 
                    ? localDeviceEnabled.get(deviceId)!
                    : (device.enabled !== undefined ? device.enabled : false);
                  const deviceStatus = device.status || 'offline'; // online hoặc offline
                  
                  // Icon mapping
                  const iconMap: Record<string, typeof Lightbulb> = {
                    light: Lightbulb,
                    fan: Fan,
                    ac: AirVent,
                    plug: Plug,
                  };
                  const Icon = iconMap[device.type] || Plug;
                  
                  return (
                    <div
                      key={deviceId}
                      className={`box-border rounded-xl backdrop-blur-xl border p-2 sm:p-2.5 transition-all duration-300 shadow-md hover:shadow-xl w-full ${
                        deviceStatus === 'online'
                          ? 'border-green-500/40 bg-gradient-to-br from-green-500/15 to-emerald-600/15 hover:border-green-500/60 hover:from-green-500/20 hover:to-emerald-600/20'
                          : 'border-red-500/40 bg-gradient-to-br from-red-500/15 to-rose-600/15 hover:border-red-500/60 hover:from-red-500/20 hover:to-rose-600/20'
                      }`}
                      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Icon */}
                          <div 
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg transition-all ${
                              deviceEnabled 
                                ? 'bg-gradient-to-br from-green-500/40 to-emerald-500/40 border-2 border-green-400/50' 
                                : 'bg-slate-700/50 border-2 border-slate-600/50'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${deviceEnabled ? 'text-green-300' : 'text-slate-400'}`} />
                          </div>
                          
                          {/* Name + Type */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h4 className="text-white font-bold text-xs sm:text-sm truncate">
                                {device.name}
                              </h4>
                              <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                                deviceStatus === 'online' 
                                  ? 'bg-green-500 shadow-lg shadow-green-500/50' 
                                  : 'bg-red-500 shadow-lg shadow-red-500/50'
                              }`} 
                              title={deviceStatus === 'online' ? 'Online' : 'Offline'}
                              />
                            </div>
                            <p className="text-cyan-200/70 text-xs truncate capitalize font-medium">
                              {device.type}
                            </p>
                          </div>
                        </div>
                        
                        {/* Controls - Status, Switch and Detail Button */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Online/Offline Status */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            deviceStatus === 'online'
                              ? 'bg-green-500/25 text-green-400 border border-green-500/30'
                              : 'bg-red-500/30 text-red-400 border border-red-500/50 shadow-sm shadow-red-500/20'
                          }`}>
                            {deviceStatus === 'online' ? 'Online' : 'Offline'}
                          </span>
                          
                          {/* Chi tiết Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-cyan-200/90 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-600/20 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDeviceDetails(deviceId);
                            }}
                            title="Chi tiết thiết bị"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                          
                          {/* Bật/Tắt Switch */}
                          {onDeviceToggle && (
                            <Switch
                              checked={deviceEnabled}
                              onCheckedChange={() => {
                                handleDeviceToggle(deviceId);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-600 scale-75"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
              <div
                className="box-border min-w-0 backdrop-blur-xl border rounded-2xl shadow-2xl p-2.5 sm:p-3 w-full"
                id="no-device-container"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(6, 182, 212, 0.9) rgba(15, 23, 42, 0.5)',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center border-2 border-cyan-500/30">
                    <Plug className="w-8 h-8 text-cyan-400/70" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Phòng này chưa có thiết bị nào</h3>
                  <p className="text-cyan-200/60 text-sm mb-4">Thêm thiết bị để bắt đầu quản lý phòng này</p>
                  <Button
                    onClick={() => setShowAddDeviceDialog(true)}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white gap-2 shadow-xl shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 font-bold px-4 h-9 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm thiết bị
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State - No Room Selected */}
        {!selectedRoom && (
          <div className="flex-1 flex items-center justify-center text-center py-8 px-4 md:px-6 lg:px-8 w-full" style={{ width: '100%', maxWidth: '100%', overflow: 'visible', boxSizing: 'border-box', minWidth: 0 }}>
            <div 
              id="empty-state-container"
              className="box-border min-w-0 backdrop-blur-xl bg-slate-800/40 border border-cyan-500/30 rounded-2xl p-8 sm:p-10 shadow-2xl w-full max-w-md" 
              style={{ maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible' }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center border-2 border-cyan-500/30">
                <Home className="w-10 h-10 text-cyan-400/70" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 211, 238, 0.4))' }} />
              </div>
              <h3 className="text-white font-bold text-xl mb-3">Chọn một phòng</h3>
              <p className="text-cyan-200/60 text-sm leading-relaxed">Chọn một phòng ở trên để xem và quản lý các thiết bị trong phòng đó</p>
            </div>
          </div>
        )}

        {/* Add Room Dialog */}
        {showAddRoom && (
          <AddRoomDialog
            open={true}
            onOpenChange={setShowAddRoom}
            onSuccess={(roomName) => handleAddRoomSuccess(roomName)}
            existingRooms={rooms.map(r => typeof r === 'string' ? r : r.name)}
          />
        )}

        {/* Edit Room Dialog */}
        {editingRoom && (
          <EditRoomDialog
            roomName={editingRoom.name}
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setEditingRoom(null);
              }
            }}
            onSuccess={async () => {
              if (onUpdateRoom) {
                await onUpdateRoom();
              }
              setEditingRoom(null);
            }}
          />
        )}

        {/* Delete Room Dialog */}
        {deletingRoom && (
          <DeleteRoomDialog
            roomName={deletingRoom.room.name}
            deviceCount={deletingRoom.deviceCount}
            open={true}
            onOpenChange={(open) => !open && setDeletingRoom(null)}
            onSuccess={() => handleDeleteRoomSuccess()}
          />
        )}

        {/* Add Device to Room Dialog */}
        <Dialog open={showAddDeviceDialog} onOpenChange={setShowAddDeviceDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Thêm Thiết Bị Vào Phòng</DialogTitle>
              <DialogDescription className="text-slate-400">
                Chọn thiết bị chưa có phòng để thêm vào "{selectedRoomName}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: 'thin' }}>
              {devicesWithoutRoom.length === 0 ? (
                <div className="text-center py-12">
                  <Plug className="w-16 h-16 mx-auto mb-4 text-cyan-400/50" />
                  <p className="text-cyan-200/80 font-medium">Không có thiết bị nào chưa có phòng</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {devicesWithoutRoom.map((device) => {
                    const deviceId = device._id;
                    // Ưu tiên local state (optimistic update), fallback về props
                    const deviceEnabled = localDeviceEnabled.has(deviceId) 
                      ? localDeviceEnabled.get(deviceId)!
                      : (device.enabled !== undefined ? device.enabled : false);
                    const deviceStatus = device.status || 'offline'; // online hoặc offline
                    
                    const iconMap: Record<string, typeof Lightbulb> = {
                      light: Lightbulb,
                      fan: Fan,
                      ac: AirVent,
                      plug: Plug,
                    };
                    const Icon = iconMap[device.type] || Plug;
                    
                    return (
                      <div
                        key={deviceId}
                        className={`rounded-xl backdrop-blur-xl bg-white/10 border p-3 transition-all duration-200 hover:bg-white/15 cursor-pointer ${
                          deviceEnabled
                            ? 'border-green-400/40 bg-green-500/15'
                            : 'border-cyan-500/20 bg-white/5'
                        }`}
                        onClick={() => handleAddDeviceToRoom(deviceId)}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 relative ${
                              deviceEnabled ? 'bg-green-500/20' : 'bg-slate-500/20'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${deviceEnabled ? 'text-green-400' : 'text-slate-400'}`} />
                            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                              deviceStatus === 'online' 
                                ? 'bg-green-500 shadow-lg shadow-green-500/50' 
                                : 'bg-red-500 shadow-lg shadow-red-500/50'
                            }`} 
                            title={deviceStatus === 'online' ? 'Online' : 'Offline'}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h4 className="text-white font-bold text-sm truncate">
                                {device.name}
                              </h4>
                            </div>
                            <p className="text-cyan-200/60 text-xs truncate capitalize">
                              {device.type}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              deviceStatus === 'online'
                                ? 'bg-green-500/25 text-green-400 border border-green-500/30'
                                : 'bg-red-500/30 text-red-400 border border-red-500/50 shadow-sm shadow-red-500/20'
                            }`}>
                              {deviceStatus === 'online' ? 'Online' : 'Offline'}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              deviceEnabled 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {deviceEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDeviceDialog(false)}
                disabled={addingDevice}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
