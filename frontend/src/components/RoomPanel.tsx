import { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Bed, UtensilsCrossed, Bath, Sofa, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { Device, RoomPanelProps } from '@/types';

const roomIcons: Record<string, any> = {
  'Living Room': Sofa,
  'Bedroom': Bed,
  'Kitchen': UtensilsCrossed,
  'Bathroom': Bath,
  'Office': Home,
};

export function RoomPanel({ 
  devices, 
  onRoomClick, 
  selectedRoom,
  onEditRoom,
  onDeleteRoom,
}: RoomPanelProps) {
  // Group devices by room (cấu trúc mới: từ room.device_ids)
  // Note: RoomPanel này có vẻ không được sử dụng nữa, nhưng vẫn cập nhật để tương thích
  const devicesByRoom = devices.reduce((acc, device) => {
    // Tìm room chứa device này từ room.device_ids
    const deviceId = device._id || device.id;
    const roomName = device.room || 'Chưa có phòng'; // Fallback nếu không tìm thấy
    
    if (!acc[roomName]) {
      acc[roomName] = [];
    }
    acc[roomName].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  return (
    <div className="space-y-4">
      {Object.entries(devicesByRoom).map(([room, roomDevices], index) => {
        const Icon = roomIcons[room] || Home;
        const activeCount = roomDevices.filter(d => d.status === 'on').length;
        const isSelected = selectedRoom === room;
        
        return (
          <motion.div
            key={room}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className={`bg-slate-800/50 border-slate-700 backdrop-blur-sm transition-all ${
                isSelected
                  ? 'ring-2 ring-yellow-500/50 border-yellow-500/30' 
                  : 'hover:border-slate-600'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => onRoomClick?.(room)}
                  >
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white">{room}</CardTitle>
                      <p className="text-slate-400 text-xs mt-1">
                        {roomDevices.length} thiết bị
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                      {activeCount}/{roomDevices.length} Active
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="bg-slate-800 border-slate-700"
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          className="text-white hover:bg-slate-700 cursor-pointer"
                          onClick={() => onEditRoom?.(room)}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Chỉnh sửa tên phòng
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 hover:bg-red-500/20 cursor-pointer"
                          onClick={() => onDeleteRoom?.(room, roomDevices.length)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Xóa phòng
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent onClick={() => onRoomClick?.(room)} className="cursor-pointer">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {roomDevices.map((device) => (
                    <motion.div
                      key={device.id}
                      whileHover={{ scale: 1.05 }}
                      className={`p-3 rounded-lg border transition-all ${
                        device.status === 'on'
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-700/30 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          device.status === 'on' ? 'bg-green-500' : 'bg-slate-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{device.name}</p>
                          <p className="text-slate-400 text-xs capitalize">{device.type}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
