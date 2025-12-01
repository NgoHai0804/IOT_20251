import { X, Monitor, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import type { Device } from '@/types';

interface DeviceRoomSelectorProps {
  devices: Device[];
  rooms: string[];
  selectedDeviceId: string | null;
  selectedRoom: string | null;
  onDeviceSelect: (deviceId: string | null) => void;
  onRoomSelect: (room: string | null) => void;
  onClearSelection: () => void;
}

export function DeviceRoomSelector({
  devices,
  rooms,
  selectedDeviceId,
  selectedRoom,
  onDeviceSelect,
  onRoomSelect,
  onClearSelection,
}: DeviceRoomSelectorProps) {
  // Get unique rooms from devices
  const uniqueRooms = Array.from(new Set(devices.map(d => d.room)));

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold">Chọn thiết bị hoặc phòng để xem sensor</h3>
            {(selectedDeviceId || selectedRoom) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <X className="w-4 h-4 mr-2" />
                Xóa lựa chọn
              </Button>
            )}
          </div>

          {/* Selection Status */}
          {(selectedDeviceId || selectedRoom) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-400 text-sm">
                {selectedDeviceId 
                  ? `Đang xem sensor của: ${devices.find(d => d.id === selectedDeviceId)?.name || selectedDeviceId}`
                  : `Đang xem sensor của phòng: ${selectedRoom}`
                }
              </span>
            </div>
          )}

          {/* Device Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-slate-400" />
              <h4 className="text-slate-300 text-sm font-medium">Thiết bị</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedDeviceId === null && !selectedRoom ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  onDeviceSelect(null);
                  onRoomSelect(null);
                }}
                className={selectedDeviceId === null && !selectedRoom 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "border-slate-600 text-slate-300 hover:bg-slate-700/50"
                }
              >
                Tất cả
              </Button>
              {devices.map((device) => (
                <Button
                  key={device.id}
                  variant={selectedDeviceId === device.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    onDeviceSelect(device.id);
                    onRoomSelect(null);
                  }}
                  className={selectedDeviceId === device.id
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700/50"
                  }
                >
                  {device.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-4 h-4 text-slate-400" />
              <h4 className="text-slate-300 text-sm font-medium">Phòng</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueRooms.map((room) => (
                <Button
                  key={room}
                  variant={selectedRoom === room ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    onRoomSelect(room);
                    onDeviceSelect(null);
                  }}
                  className={selectedRoom === room
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700/50"
                  }
                >
                  {room}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

