import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Activity, Wifi, WifiOff, AlertCircle, TrendingUp, Zap, Droplets, Thermometer } from 'lucide-react';
import { roomDevicesCache } from '@/utils/roomDevicesCache';
import type { DashboardProps, Sensor, Room, Device } from '@/types';
import { sensorSupportsThreshold } from '@/types';

interface RoomData {
  room: Room;
  roomName: string;
  sensors: Sensor[];
  devices: Device[];
  deviceCount: number;
  onlineDevices: number;
  offlineDevices: number;
  avgTemperature?: number;
  avgHumidity?: number;
  totalEnergy?: number;
}

export function Dashboard({
  sensors,
  devices,
  rooms,
}: DashboardProps) {
  const [roomDevicesMap, setRoomDevicesMap] = useState<Map<string, Device[]>>(new Map());
  useEffect(() => {
    const fetchRoomDevices = async () => {
      if (!Array.isArray(rooms) || rooms.length === 0) return;
      
      const newMap = new Map<string, Device[]>();
      
      for (const room of rooms) {
        if (typeof room === 'string') continue;
        const roomId = room._id;
        
        try {
          const roomDevices = await roomDevicesCache.getDevices(roomId);
          newMap.set(roomId, roomDevices);
        } catch (error) {
          console.error(`Error fetching devices for room ${roomId}:`, error);
          newMap.set(roomId, []);
        }
      }
      
      setRoomDevicesMap(newMap);
    };
    
    fetchRoomDevices();
  }, [rooms]);
  
  const overallStats = useMemo(() => {
    const totalRooms = Array.isArray(rooms) ? rooms.length : 0;
    const totalDevices = devices.length;
    const totalSensors = sensors.length;
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const offlineDevices = totalDevices - onlineDevices;
    const enabledDevices = devices.filter(d => d.enabled).length;
    
    const tempSensors = sensors.filter(s => s.type === 'temperature' && s.value !== undefined);
    const humiditySensors = sensors.filter(s => s.type === 'humidity' && s.value !== undefined);
    const gasSensors = sensors.filter(s => s.type === 'gas' && s.value !== undefined);
    
    const avgTemp = tempSensors.length > 0
      ? tempSensors.reduce((sum, s) => sum + (s.value || 0), 0) / tempSensors.length
      : undefined;
    
    const avgHumidity = humiditySensors.length > 0
      ? humiditySensors.reduce((sum, s) => sum + (s.value || 0), 0) / humiditySensors.length
      : undefined;
    
    const avgGas = gasSensors.length > 0
      ? gasSensors.reduce((sum, s) => sum + (s.value || 0), 0) / gasSensors.length
      : undefined;
    
    const alertSensors = sensors.filter(s => {
      if (!s.enabled || s.value === undefined) return false;
      // Chỉ kiểm tra threshold cho sensor hỗ trợ threshold
      if (!sensorSupportsThreshold(s.type)) return false;
      return (s.min_threshold !== undefined && s.value < s.min_threshold) ||
             (s.max_threshold !== undefined && s.value > s.max_threshold);
    }).length;
    
    return {
      totalRooms,
      totalDevices,
      totalSensors,
      onlineDevices,
      offlineDevices,
      enabledDevices,
      avgTemp,
      avgHumidity,
      avgGas,
      alertSensors,
    };
  }, [rooms, devices, sensors]);
  
  const roomData = useMemo(() => {
    const roomMap = new Map<string, RoomData>();

    if (Array.isArray(rooms)) {
      rooms.forEach((room: Room | string) => {
        const roomObj = typeof room === 'string' 
          ? { _id: room, name: room, description: '' } as Room
          : room;
        const roomName = typeof room === 'string' ? room : room.name;
        const roomId = typeof room === 'string' ? room : room._id;
        
        const roomDevices = roomDevicesMap.get(roomId) || [];
        
        roomMap.set(roomId, {
          room: roomObj,
          roomName,
          sensors: [],
          devices: roomDevices,
          deviceCount: roomDevices.length,
          onlineDevices: roomDevices.filter(d => d.status === 'online').length,
          offlineDevices: roomDevices.filter(d => d.status === 'offline').length,
        });
      });
    }

    sensors.forEach(sensor => {
      const device = devices.find((d: Device) => d._id === sensor.device_id);
      if (device) {
        const deviceId = device._id;
        
        for (const [roomId, roomDevices] of roomDevicesMap.entries()) {
          const deviceIds = roomDevices.map((d: Device) => d._id).filter(Boolean);
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
                const roomDevicesList = roomDevicesMap.get(roomId) || [];
                roomMap.set(roomId, {
                  room: roomObj,
                  roomName,
                  sensors: [],
                  devices: roomDevicesList,
                  deviceCount: roomDevicesList.length,
                  onlineDevices: roomDevicesList.filter(d => d.status === 'online').length,
                  offlineDevices: roomDevicesList.filter(d => d.status === 'offline').length,
                });
              }
              
              const roomEntry = roomMap.get(roomId);
              if (roomEntry) {
                roomEntry.sensors.push(sensor);
              }
            }
            break;
          }
        }
      }
    });

    roomMap.forEach((data) => {
      const tempSensors = data.sensors.filter(s => s.type === 'temperature' && s.value !== undefined);
      const humiditySensors = data.sensors.filter(s => s.type === 'humidity' && s.value !== undefined);
      const gasSensors = data.sensors.filter(s => s.type === 'gas' && s.value !== undefined);

      if (tempSensors.length > 0) {
        data.avgTemperature = tempSensors.reduce((sum, s) => sum + (s.value || 0), 0) / tempSensors.length;
      }
      if (humiditySensors.length > 0) {
        data.avgHumidity = humiditySensors.reduce((sum, s) => sum + (s.value || 0), 0) / humiditySensors.length;
      }
      if (gasSensors.length > 0) {
        data.totalEnergy = gasSensors.reduce((sum, s) => sum + (s.value || 0), 0) / gasSensors.length;
      }
    });

    return Array.from(roomMap.values());
  }, [sensors, devices, rooms, roomDevicesMap]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-3xl font-bold mb-2 tracking-tight">Tổng Quan Hệ Thống</h2>
        <p className="text-cyan-200/70 text-base">Khái quát và tổng hợp dữ liệu toàn hệ thống</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-200/70 text-sm font-medium">Tổng số phòng</CardTitle>
              <Home className="w-5 h-5 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overallStats.totalRooms}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-200/70 text-sm font-medium">Tổng thiết bị</CardTitle>
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overallStats.totalDevices}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <div className="flex items-center gap-1 text-green-400">
                <Wifi className="w-3 h-3" />
                <span>{overallStats.onlineDevices} online</span>
              </div>
              <div className="flex items-center gap-1 text-red-400">
                <WifiOff className="w-3 h-3" />
                <span>{overallStats.offlineDevices} offline</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-200/70 text-sm font-medium">Tổng sensor</CardTitle>
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overallStats.totalSensors}</div>
            {overallStats.alertSensors > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-orange-400">
                <AlertCircle className="w-3 h-3" />
                <span>{overallStats.alertSensors} cảnh báo</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-200/70 text-sm font-medium">Trạng thái</CardTitle>
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overallStats.totalDevices > 0 
                ? Math.round((overallStats.onlineDevices / overallStats.totalDevices) * 100)
                : 0}%
            </div>
            <div className="text-xs text-cyan-200/70 mt-2">Thiết bị hoạt động</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-white text-xl font-semibold mb-4 tracking-tight">Chi Tiết Theo Phòng</h3>
        
        {roomData.length === 0 ? (
          <Card className="bg-slate-800/60 border-slate-700/80 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <Home className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg font-medium mb-2">Chưa có phòng nào</p>
              <p className="text-slate-500 text-sm">Thêm phòng mới để bắt đầu quản lý thiết bị</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roomData.map((roomData) => (
              <Card key={roomData.room._id} className="bg-slate-800/60 border-slate-700/80 backdrop-blur-xl hover:bg-slate-800/80 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                        <Home className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg font-bold">{roomData.roomName}</CardTitle>
                        {roomData.room.description && (
                          <p className="text-cyan-200/60 text-xs mt-1">{roomData.room.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                      <span className="text-cyan-200/70 text-sm font-medium">Thiết bị</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-base">{roomData.deviceCount}</span>
                        {roomData.deviceCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="flex items-center gap-0.5 text-green-400">
                              <Wifi className="w-3 h-3" />
                              <span>{roomData.onlineDevices}</span>
                            </div>
                            {roomData.offlineDevices > 0 && (
                              <div className="flex items-center gap-0.5 text-red-400">
                                <WifiOff className="w-3 h-3" />
                                <span>{roomData.offlineDevices}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                      <span className="text-cyan-200/70 text-sm font-medium">Cảm biến</span>
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
                        <span className="text-green-200/80 text-sm font-medium">Khí gas</span>
                        <span className="text-green-300 font-bold text-base">{roomData.totalEnergy.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
