import { useState, useMemo } from 'react';
import { RoomPanel } from '@/components/RoomPanel';
import { EditRoomDialog } from '@/components/EditRoomDialog';
import { DeleteRoomDialog } from '@/components/DeleteRoomDialog';
import { SensorCard } from '@/components/SensorCard';
import { ChartsPanel } from '@/components/ChartsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, X, Thermometer, Droplets, Zap } from 'lucide-react';
import type { RoomsProps, Sensor } from '@/types';

export function Rooms({ 
  devices, 
  selectedRoom, 
  onRoomClick, 
  onClearSelection,
  sensors,
  temperatureData,
  energyData,
  humidityData,
  onUpdateRoom,
}: RoomsProps) {
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<{ name: string; deviceCount: number } | null>(null);

  // Filter sensors by selected room
  const roomSensors = useMemo(() => {
    if (!selectedRoom) return [];
    return sensors?.filter(s => s.room === selectedRoom) || [];
  }, [sensors, selectedRoom]);

  // Calculate room statistics
  const roomStats = useMemo(() => {
    if (!selectedRoom || !roomSensors.length) return null;

    const tempSensors = roomSensors.filter(s => s.type === 'temperature');
    const humiditySensors = roomSensors.filter(s => s.type === 'humidity');
    const energySensors = roomSensors.filter(s => s.type === 'energy');

    return {
      avgTemperature: tempSensors.length > 0
        ? tempSensors.reduce((sum, s) => sum + s.value, 0) / tempSensors.length
        : undefined,
      avgHumidity: humiditySensors.length > 0
        ? humiditySensors.reduce((sum, s) => sum + s.value, 0) / humiditySensors.length
        : undefined,
      totalEnergy: energySensors.length > 0
        ? energySensors.reduce((sum, s) => sum + s.value, 0)
        : undefined,
      deviceCount: devices.filter(d => d.room === selectedRoom).length,
    };
  }, [selectedRoom, roomSensors, devices]);

  const handleEditRoom = (roomName: string) => {
    setEditingRoom(roomName);
  };

  const handleDeleteRoom = (roomName: string, deviceCount: number) => {
    setDeletingRoom({ name: roomName, deviceCount });
  };

  const handleRoomUpdateSuccess = async () => {
    if (onUpdateRoom) {
      await onUpdateRoom();
    }
    setEditingRoom(null);
    setDeletingRoom(null);
    // Clear selection if deleted room was selected
    if (deletingRoom && selectedRoom === deletingRoom.name) {
      onClearSelection?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-white text-2xl font-bold mb-2">Quản Lý Phòng</h2>
        <p className="text-slate-400 text-sm">Chọn phòng để xem chi tiết, chỉnh sửa hoặc xóa phòng</p>
      </div>

      {/* Room List - Compact Layout */}
      <div>
        <h3 className="text-white mb-4">Danh Sách Phòng</h3>
        <RoomPanel 
          devices={devices} 
          onRoomClick={onRoomClick}
          selectedRoom={selectedRoom}
          onEditRoom={handleEditRoom}
          onDeleteRoom={handleDeleteRoom}
        />
      </div>

      {/* Selected Room Details - Compact */}
      {selectedRoom && roomStats && (
        <div className="space-y-4">
          {/* Room Statistics Card - Compact */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <Home className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">{selectedRoom}</CardTitle>
                    <p className="text-slate-400 text-xs mt-1">
                      {roomStats.deviceCount} thiết bị • {roomSensors.length} sensor
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Đóng
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {roomStats.avgTemperature !== undefined && (
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer className="w-4 h-4 text-orange-400" />
                      <p className="text-slate-400 text-xs">Nhiệt Độ</p>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {roomStats.avgTemperature.toFixed(1)}°C
                    </p>
                  </div>
                )}

                {roomStats.avgHumidity !== undefined && (
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <p className="text-slate-400 text-xs">Độ Ẩm</p>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {roomStats.avgHumidity.toFixed(1)}%
                    </p>
                  </div>
                )}

                {roomStats.totalEnergy !== undefined && (
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-green-400" />
                      <p className="text-slate-400 text-xs">Năng Lượng</p>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {roomStats.totalEnergy.toFixed(1)} kWh
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Room Sensors - Compact Grid */}
          {roomSensors.length > 0 && (
            <div>
              <h3 className="text-white text-lg font-semibold mb-3">
                Sensor ({roomSensors.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {roomSensors.map((sensor) => (
                  <SensorCard key={sensor.id} {...sensor} />
                ))}
              </div>
            </div>
          )}

          {/* Room Charts */}
          {roomSensors.length > 0 && temperatureData && energyData && humidityData && (
            <div>
              <h3 className="text-white text-lg font-semibold mb-3">Biểu Đồ</h3>
              <ChartsPanel
                temperatureData={temperatureData}
                energyData={energyData}
                humidityData={humidityData}
              />
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedRoom && (
        <div className="text-center py-12 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
          <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Chọn một phòng ở trên để xem chi tiết thông số và biểu đồ</p>
        </div>
      )}

      {/* Edit Room Dialog */}
      {editingRoom && (
        <EditRoomDialog
          roomName={editingRoom}
          open={true}
          onOpenChange={(open) => !open && setEditingRoom(null)}
          onSuccess={handleRoomUpdateSuccess}
        />
      )}

      {/* Delete Room Dialog */}
      {deletingRoom && (
        <DeleteRoomDialog
          roomName={deletingRoom.name}
          deviceCount={deletingRoom.deviceCount}
          open={true}
          onOpenChange={(open) => !open && setDeletingRoom(null)}
          onSuccess={handleRoomUpdateSuccess}
        />
      )}
    </div>
  );
}
