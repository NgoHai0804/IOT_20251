import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { deviceAPI } from '@/services/api';
import { toast } from 'sonner';
import type { AddDeviceDialogProps } from '@/types';

export function AddDeviceDialog({ onAddDevice, rooms }: AddDeviceDialogProps) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceRoom, setDeviceRoom] = useState('');
  const [note, setNote] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [showCustomRoom, setShowCustomRoom] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceId || !deviceName) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc', { duration: 1000 });
      return;
    }

    setLoading(true);
    try {
      // Nếu không chọn phòng, truyền empty string
      const location = deviceRoom && deviceRoom !== 'none' ? deviceRoom : '';
      await deviceAPI.addDevice(deviceId, deviceName, location, note || undefined);
      toast.success('Thêm thiết bị thành công', { duration: 1000 });
      
      // Reset form
      setDeviceId('');
      setDeviceName('');
      setDeviceRoom('');
      setNote('');
      setCustomRoom('');
      setShowCustomRoom(false);
      setOpen(false);
      
      // Refresh data
      onAddDevice({} as any); // Pass empty object, the hook will refresh
    } catch (error: any) {
      console.error('Error adding device:', error);
      toast.error(error.message || 'Không thể thêm thiết bị', { duration: 1000 });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 font-semibold">
          <Plus className="w-4 h-4" />
          Thêm Thiết Bị Mới
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add a new smart device to your home. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="deviceId">ID Thiết Bị <span className="text-red-400">*</span></Label>
              <Input
                id="deviceId"
                placeholder="Nhập ID thiết bị"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Tên Thiết Bị <span className="text-red-400">*</span></Label>
              <Input
                id="name"
                placeholder="e.g., Đèn phòng khách"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="room">Chọn Phòng (Tùy chọn)</Label>
              <Select value={showCustomRoom ? 'custom' : deviceRoom || 'none'} onValueChange={handleRoomChange}>
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
                      <SelectItem key={roomId} value={roomId} className="text-white hover:bg-slate-700">
                        {roomName}
                      </SelectItem>
                    );
                  })}
                  <SelectItem value="custom" className="text-white hover:bg-slate-700">
                    + Thêm phòng mới
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCustomRoom && (
              <div className="grid gap-2">
                <Label htmlFor="customRoom">Tên Phòng Mới</Label>
                <Input
                  id="customRoom"
                  placeholder="e.g., Phòng ngủ"
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

            <div className="grid gap-2">
              <Label htmlFor="note">Ghi Chú</Label>
              <Input
                id="note"
                placeholder="Nhập ghi chú (tùy chọn)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200"
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!deviceId || !deviceName || loading}
            >
              {loading ? 'Đang thêm...' : 'Thêm Thiết Bị'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
