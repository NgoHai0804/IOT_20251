import { useMemo } from 'react';
import { SensorCard } from '@/components/SensorCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home } from 'lucide-react';
import type { DashboardProps, Sensor } from '@/types';

interface RoomData {
  room: string;
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
  // Group sensors and devices by room
  const roomData = useMemo(() => {
    const roomMap = new Map<string, RoomData>();

    // Initialize rooms
    rooms.forEach(room => {
      roomMap.set(room, {
        room,
        sensors: [],
        deviceCount: 0,
      });
    });

    // Add sensors to rooms
    sensors.forEach(sensor => {
      const room = sensor.room;
      if (!roomMap.has(room)) {
        roomMap.set(room, {
          room,
          sensors: [],
          deviceCount: 0,
        });
      }
      roomMap.get(room)!.sensors.push(sensor);
    });

    // Count devices per room
    devices.forEach(device => {
      const room = device.room;
      if (roomMap.has(room)) {
        roomMap.get(room)!.deviceCount++;
      }
    });

    // Calculate averages
    roomMap.forEach((data, room) => {
      const tempSensors = data.sensors.filter(s => s.type === 'temperature');
      const humiditySensors = data.sensors.filter(s => s.type === 'humidity');
      const energySensors = data.sensors.filter(s => s.type === 'energy');

      if (tempSensors.length > 0) {
        data.avgTemperature = tempSensors.reduce((sum, s) => sum + s.value, 0) / tempSensors.length;
      }
      if (humiditySensors.length > 0) {
        data.avgHumidity = humiditySensors.reduce((sum, s) => sum + s.value, 0) / humiditySensors.length;
      }
      if (energySensors.length > 0) {
        data.totalEnergy = energySensors.reduce((sum, s) => sum + s.value, 0);
      }
    });

    return Array.from(roomMap.values());
  }, [sensors, devices, rooms]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-white text-2xl font-bold mb-2">Tổng Quan Theo Phòng</h2>
        <p className="text-slate-400 text-sm">Khái quát và tổng hợp dữ liệu sensor theo từng phòng</p>
      </div>

      {/* Room Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roomData.map((roomData) => (
          <Card key={roomData.room} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Home className="w-5 h-5 text-blue-400" />
                </div>
                <CardTitle className="text-white">{roomData.room}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Thiết bị</span>
                  <span className="text-white font-semibold">{roomData.deviceCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Sensor</span>
                  <span className="text-white font-semibold">{roomData.sensors.length}</span>
                </div>
                {roomData.avgTemperature !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Nhiệt độ TB</span>
                    <span className="text-white font-semibold">{roomData.avgTemperature.toFixed(1)}°C</span>
                  </div>
                )}
                {roomData.avgHumidity !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Độ ẩm TB</span>
                    <span className="text-white font-semibold">{roomData.avgHumidity.toFixed(1)}%</span>
                  </div>
                )}
                {roomData.totalEnergy !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Năng lượng</span>
                    <span className="text-white font-semibold">{roomData.totalEnergy.toFixed(1)} kWh</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sensors by Room */}
      {roomData.map((roomData) => (
        <div key={roomData.room}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-blue-400" />
              <h3 className="text-white text-xl font-semibold">{roomData.room}</h3>
              <span className="text-slate-400 text-sm">
                ({roomData.sensors.length} sensor{roomData.sensors.length !== 1 ? 's' : ''})
              </span>
            </div>
          </div>
          {roomData.sensors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
              Chưa có sensor trong phòng này
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-6">
              {roomData.sensors.map((sensor) => (
                <SensorCard key={sensor.id} {...sensor} />
              ))}
            </div>
          )}
        </div>
      ))}

    </div>
  );
}
