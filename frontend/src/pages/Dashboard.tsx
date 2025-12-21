import { useMemo, useState, useEffect } from 'react';
import { SensorCard } from '@/components/SensorCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home } from 'lucide-react';
import { roomDevicesCache } from '@/utils/roomDevicesCache';
import type { DashboardProps, Sensor, Room, Device } from '@/types';

interface RoomData {
  room: Room;
  roomName: string;
  sensors: Sensor[];
  deviceCount: number;
  avgTemperature?: number;
  avgHumidity?: number;
  totalEnergy?: number;
}

export function Dashboard({
  sensors,
  devices,
  rooms,
}: DashboardProps) {
  // Map roomId -> deviceIds (query từ API)
  const [roomDevicesMap, setRoomDevicesMap] = useState<Map<string, string[]>>(new Map());
  
  // Fetch devices cho mỗi room từ cache (tránh duplicate calls)
  useEffect(() => {
    const fetchRoomDevices = async () => {
      if (!Array.isArray(rooms) || rooms.length === 0) return;
      
      const newMap = new Map<string, string[]>();
      
      // Sử dụng cache để tránh duplicate calls
      for (const room of rooms) {
        if (typeof room === 'string') continue;
        const roomId = room._id;
        
        try {
          // Sử dụng cache thay vì gọi API trực tiếp
          const roomDevices = await roomDevicesCache.getDevices(roomId);
          const deviceIds = roomDevices.map((d: Device) => d._id || d.id).filter(Boolean);
          newMap.set(roomId, deviceIds);
        } catch (error) {
          console.error(`Error fetching devices for room ${roomId}:`, error);
          newMap.set(roomId, []);
        }
      }
      
      setRoomDevicesMap(newMap);
    };
    
    fetchRoomDevices();
  }, [rooms]);
  
  // Group sensors and devices by room
  const roomData = useMemo(() => {
    const roomMap = new Map<string, RoomData>();

    // Initialize rooms - rooms is now an array of Room objects
    if (Array.isArray(rooms)) {
      rooms.forEach((room: Room | string) => {
        // Handle both Room object and string (for backward compatibility)
        const roomObj = typeof room === 'string' 
          ? { _id: room, name: room, description: '' } as Room
          : room;
        const roomName = typeof room === 'string' ? room : room.name;
        const roomId = typeof room === 'string' ? room : room._id;
        
        // Lấy deviceIds từ roomDevicesMap
        const deviceIds = roomDevicesMap.get(roomId) || [];
        
        roomMap.set(roomId, {
          room: roomObj,
          roomName,
          sensors: [],
          deviceCount: deviceIds.length,
        });
      });
    }

    // Tìm room chứa device từ roomDevicesMap
    sensors.forEach(sensor => {
      // Find device that contains this sensor
      const device = devices.find((d: Device) => d._id === sensor.device_id);
      if (device) {
        const deviceId = device._id || device.id;
        
        // Tìm room chứa device này từ roomDevicesMap
        for (const [roomId, deviceIds] of roomDevicesMap.entries()) {
          if (deviceIds.includes(deviceId)) {
            const foundRoom = Array.isArray(rooms) ? rooms.find((r: Room | string) => {
              if (typeof r === 'string') return r === roomId;
              return r._id === roomId;
            }) : null;
            
            if (foundRoom) {
              const roomObj = typeof foundRoom === 'string' 
                ? { _id: foundRoom, name: foundRoom, description: '' } as Room
                : foundRoom;
              const roomName = typeof foundRoom === 'string' ? foundRoom : foundRoom.name;
              
              if (!roomMap.has(roomId)) {
                roomMap.set(roomId, {
                  room: roomObj,
                  roomName,
                  sensors: [],
                  deviceCount: deviceIds.length,
                });
              }
              
              // Add room name to sensor for display
              const roomEntry = roomMap.get(roomId);
              if (roomEntry) {
                const sensorWithRoom = {
                  ...sensor,
                  room: roomEntry.roomName,  // Add room name for SensorCard
                };
                roomEntry.sensors.push(sensorWithRoom);
              }
            }
            break; // Device chỉ thuộc 1 room
          }
        }
      }
    });

    // Calculate averages
    roomMap.forEach((data, roomId) => {
      const tempSensors = data.sensors.filter(s => s.type === 'temperature');
      const humiditySensors = data.sensors.filter(s => s.type === 'humidity');
      const energySensors = data.sensors.filter(s => s.type === 'energy');

      if (tempSensors.length > 0) {
        data.avgTemperature = tempSensors.reduce((sum, s) => sum + (s.value || 0), 0) / tempSensors.length;
      }
      if (humiditySensors.length > 0) {
        data.avgHumidity = humiditySensors.reduce((sum, s) => sum + (s.value || 0), 0) / humiditySensors.length;
      }
      if (energySensors.length > 0) {
        data.totalEnergy = energySensors.reduce((sum, s) => sum + (s.value || 0), 0);
      }
    });

    return Array.from(roomMap.values());
  }, [sensors, devices, rooms, roomDevicesMap]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-white text-3xl font-bold mb-3 tracking-tight">Tổng Quan Theo Phòng</h2>
        <p className="text-cyan-200/70 text-base">Khái quát và tổng hợp dữ liệu sensor theo từng phòng</p>
      </div>

      {/* Room Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {roomData.map((roomData) => (
          <Card key={roomData.room._id} className="bg-slate-800/60 border-slate-700/80 backdrop-blur-xl hover:bg-slate-800/80 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                  <Home className="w-6 h-6 text-cyan-400" />
                </div>
                <CardTitle className="text-white text-lg font-bold">{roomData.roomName}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                  <span className="text-cyan-200/70 text-sm font-medium">Thiết bị</span>
                  <span className="text-white font-bold text-base">{roomData.deviceCount}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                  <span className="text-cyan-200/70 text-sm font-medium">Sensor</span>
                  <span className="text-white font-bold text-base">{roomData.sensors.length}</span>
                </div>
                {roomData.avgTemperature !== undefined && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                    <span className="text-orange-200/80 text-sm font-medium">Nhiệt độ TB</span>
                    <span className="text-orange-300 font-bold text-base">{roomData.avgTemperature.toFixed(1)}°C</span>
                  </div>
                )}
                {roomData.avgHumidity !== undefined && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                    <span className="text-blue-200/80 text-sm font-medium">Độ ẩm TB</span>
                    <span className="text-blue-300 font-bold text-base">{roomData.avgHumidity.toFixed(1)}%</span>
                  </div>
                )}
                {roomData.totalEnergy !== undefined && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <span className="text-green-200/80 text-sm font-medium">Năng lượng</span>
                    <span className="text-green-300 font-bold text-base">{roomData.totalEnergy.toFixed(1)} kWh</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


    </div>
  );
}
