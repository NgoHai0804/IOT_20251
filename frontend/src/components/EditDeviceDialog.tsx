import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { deviceAPI, roomAPI } from '@/services/api';
import { toast } from 'sonner';
import type { Device, EditDeviceDialogProps } from '@/types';

export function EditDeviceDialog({ device, rooms, onUpdateDevice }: EditDeviceDialogProps) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  
  // Khởi tạo form với giá trị ban đầu từ device
  const [deviceName, setDeviceName] = useState(device.name);
  const [devicePassword, setDevicePassword] = useState('');
  const [deviceRoom, setDeviceRoom] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [showCustomRoom, setShowCustomRoom] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [originalRoomId, setOriginalRoomId] = useState<string>(''); // Track original room ID
  
  // Tìm room chứa device này
  useEffect(() => {
    const findCurrentRoom = async () => {
      const deviceId = device._id || device.id;
      setLoadingRoom(true);
      
      try {
        // Tìm trong rooms data trước
        const foundRoom = Array.isArray(rooms) ? rooms.find((r: any) => {
          if (typeof r === 'string') return false;
          // Kiểm tra nếu room có devices và device này có trong đó
          if (r.devices && Array.isArray(r.devices)) {
            return r.devices.some((d: Device) => (d._id || d.id) === deviceId);
          }
          return false;
        }) : null;
        
        if (foundRoom && typeof foundRoom === 'object') {
          setDeviceRoom(foundRoom._id);
          setCurrentRoomName(foundRoom.name);
          setOriginalRoomId(foundRoom._id); // Set original room ID
          setShowCustomRoom(false);
        } else {
          // Nếu không tìm thấy trong rooms data, gọi API để tìm
          const roomData = await roomAPI.findDeviceRoom(deviceId);
          if (roomData) {
            setDeviceRoom(roomData._id);
            setCurrentRoomName(roomData.name);
            setOriginalRoomId(roomData._id); // Set original room ID
            setShowCustomRoom(false);
          } else {
            // Fallback: sử dụng device.location nếu có
            if (device.location) {
              const roomByLocation = Array.isArray(rooms) ? rooms.find((r: any) => {
                if (typeof r === 'string') return r === device.location;
                return r.name === device.location;
              }) : null;
              
              if (roomByLocation && typeof roomByLocation === 'object') {
                setDeviceRoom(roomByLocation._id);
                setCurrentRoomName(roomByLocation.name);
                setOriginalRoomId(roomByLocation._id); // Set original room ID
                setShowCustomRoom(false);
              } else {
                // Device có location nhưng không tìm thấy room tương ứng
                setCustomRoom(device.location);
                setDeviceRoom(device.location);
                setCurrentRoomName(device.location);
                setOriginalRoomId(''); // No original room ID
                setShowCustomRoom(true);
              }
            } else {
              // Device không có room
              setDeviceRoom('');
              setCurrentRoomName('');
              setOriginalRoomId(''); // No original room ID
              setShowCustomRoom(false);
            }
          }
        }
      } catch (error) {
        console.error('Error finding device room:', error);
        // Fallback to device.location
        if (device.location) {
          setCustomRoom(device.location);
          setDeviceRoom(device.location);
          setCurrentRoomName(device.location);
          setShowCustomRoom(true);
        }
      } finally {
        setLoadingRoom(false);
      }
    };
    
    findCurrentRoom();
  }, [device, rooms]);

  const handleRoomChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomRoom(true);
      setDeviceRoom('');
    } else if (value === 'none') {
      setShowCustomRoom(false);
      setDeviceRoom('');
    } else {
      setShowCustomRoom(false);
      setDeviceRoom(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceName) {
      toast.error('Vui lòng điền tên thiết bị', { duration: 1000 });
      return;
    }

    setLoading(true);
    try {
      const updateData: {
        device_name?: string;
        device_password?: string;
        location?: string;
      } = {
        device_name: deviceName,
      };

      // Chỉ cập nhật location nếu có (location không còn bắt buộc)
      if (deviceRoom && deviceRoom !== 'none') {
        updateData.location = deviceRoom;
      }

      // Chỉ cập nhật mật khẩu nếu người dùng nhập
      if (devicePassword.trim()) {
        updateData.device_password = devicePassword;
      }

      const deviceIdToUpdate = device._id || device.id || device.device_id;
      await deviceAPI.updateDevice(deviceIdToUpdate, updateData);
      
      // Nếu có thay đổi room, cập nhật qua API mới
      if (deviceRoom && deviceRoom !== 'none' && deviceRoom !== originalRoomId) {
        // Tìm room_id từ room name hoặc room_id
        const targetRoom = Array.isArray(rooms) ? rooms.find((r: any) => {
          if (typeof r === 'string') return r === deviceRoom;
          return r._id === deviceRoom || r.name === deviceRoom;
        }) : null;
        
        if (targetRoom && typeof targetRoom === 'object') {
          const { roomAPI } = await import('@/services/api');
          await roomAPI.addDeviceToRoom(targetRoom._id, deviceIdToUpdate);
        }
      } else if (!deviceRoom || deviceRoom === 'none') {
        // Xóa device khỏi room nếu không chọn phòng
        if (originalRoomId) {
          const { roomAPI } = await import('@/services/api');
          await roomAPI.removeDeviceFromRoom(originalRoomId, deviceIdToUpdate);
        }
      }
      
      toast.success('Cập nhật thiết bị thành công', { duration: 1000 });
      setOpen(false);
      // Delay refresh để đảm bảo dialog đóng trước
      setTimeout(() => {
        onUpdateDevice();
      }, 100);
    } catch (error: any) {
      console.error('Error updating device:', error);
      toast.error(error.message || 'Không thể cập nhật thiết bị', { duration: 1000 });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Delay refresh để dialog đóng hoàn toàn trước
    setTimeout(() => {
      onUpdateDevice();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thiết bị</DialogTitle>
          <DialogDescription className="text-slate-400">
            Cập nhật thông tin thiết bị của bạn
            {loadingRoom ? (
              <span className="block mt-1 text-yellow-400 text-sm">
                Đang tìm phòng hiện tại...
              </span>
            ) : currentRoomName ? (
              <span className="block mt-1 text-cyan-400 text-sm">
                Hiện tại đang ở: {currentRoomName}
              </span>
            ) : (
              <span className="block mt-1 text-slate-500 text-sm">
                Chưa được gán vào phòng nào
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Tên thiết bị</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Living Room Light"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-password">Mật khẩu thiết bị</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Để trống nếu không muốn thay đổi"
                value={devicePassword}
                onChange={(e) => setDevicePassword(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-500">
                Chỉ nhập mật khẩu mới nếu muốn thay đổi
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-room">Phòng/Vị trí (Tùy chọn)</Label>
              <Select
                value={showCustomRoom ? 'custom' : deviceRoom || 'none'}
                onValueChange={handleRoomChange}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Không chọn phòng" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="none" className="text-white hover:bg-slate-700">
                    Không chọn phòng
                  </SelectItem>
                  {rooms.map((room) => {
                    const roomId = typeof room === 'string' ? room : room._id;
                    const roomName = typeof room === 'string' ? room : room.name;
                    return (
                      <SelectItem
                        key={roomId}
                        value={roomId}
                        className="text-white hover:bg-slate-700"
                      >
                        {roomName}
                      </SelectItem>
                    );
                  })}
                  <SelectItem
                    value="custom"
                    className="text-white hover:bg-slate-700"
                  >
                    + Thêm phòng mới
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCustomRoom && (
              <div className="grid gap-2">
                <Label htmlFor="edit-customRoom">Tên phòng mới</Label>
                <Input
                  id="edit-customRoom"
                  placeholder="e.g., Garage"
                  value={customRoom}
                  onChange={(e) => {
                    setCustomRoom(e.target.value);
                    setDeviceRoom(e.target.value);
                  }}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading || !deviceName}
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

