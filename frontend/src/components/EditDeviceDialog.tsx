import { useState } from 'react';
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
import { deviceAPI } from '@/services/api';
import { toast } from 'sonner';
import type { Device, EditDeviceDialogProps } from '@/types';

export function EditDeviceDialog({ device, rooms, onUpdateDevice }: EditDeviceDialogProps) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  // Khởi tạo form với giá trị ban đầu từ device
  const [deviceName, setDeviceName] = useState(device.name);
  const [devicePassword, setDevicePassword] = useState('');
  const [deviceRoom, setDeviceRoom] = useState(device.room);
  const [customRoom, setCustomRoom] = useState('');
  const [showCustomRoom, setShowCustomRoom] = useState(!rooms.includes(device.room));
  
  // Không có useEffect để reset form - giữ nguyên input của user khi đang chỉnh sửa
  // Form chỉ được khởi tạo một lần khi component mount

  const handleRoomChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomRoom(true);
      setDeviceRoom('');
    } else {
      setShowCustomRoom(false);
      setDeviceRoom(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceName || !deviceRoom) {
      toast.error('Vui lòng điền đầy đủ thông tin');
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
        location: deviceRoom,
      };

      // Chỉ cập nhật mật khẩu nếu người dùng nhập
      if (devicePassword.trim()) {
        updateData.device_password = devicePassword;
      }

      await deviceAPI.updateDevice(device.id, updateData);
      
      toast.success('Cập nhật thiết bị thành công');
      setOpen(false);
      // Delay refresh để đảm bảo dialog đóng trước
      setTimeout(() => {
        onUpdateDevice();
      }, 100);
    } catch (error: any) {
      console.error('Error updating device:', error);
      toast.error(error.message || 'Không thể cập nhật thiết bị');
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
              <Label htmlFor="edit-room">Phòng/Vị trí</Label>
              <Select
                value={showCustomRoom ? 'custom' : deviceRoom}
                onValueChange={handleRoomChange}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Chọn phòng" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {rooms.map((room) => (
                    <SelectItem
                      key={room}
                      value={room}
                      className="text-white hover:bg-slate-700"
                    >
                      {room}
                    </SelectItem>
                  ))}
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
              disabled={loading || !deviceName || !deviceRoom}
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

