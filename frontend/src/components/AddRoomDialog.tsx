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
import { Button } from './ui/button';
import { toast } from 'sonner';
import { roomAPI } from '@/services/api';

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (roomName: string, roomId?: string) => void;
  existingRooms: string[];
}

export function AddRoomDialog({ open, onOpenChange, onSuccess, existingRooms }: AddRoomDialogProps) {
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomName.trim()) {
      toast.error('Tên phòng không được để trống', { duration: 1000 });
      return;
    }

    if (existingRooms.includes(roomName.trim())) {
      toast.error('Tên phòng đã tồn tại', { duration: 1000 });
      return;
    }

    setLoading(true);
    try {
      const trimmedRoomName = roomName.trim();
      
      // Gọi API để tạo room trên server
      const createdRoom = await roomAPI.createRoom(trimmedRoomName, '');
      
      toast.success(`Đã thêm phòng "${trimmedRoomName}"`, { duration: 1000 });
      // Truyền cả roomName và roomId (nếu có) cho onSuccess
      onSuccess(trimmedRoomName, createdRoom?._id || createdRoom?.id);
      onOpenChange(false);
      setRoomName('');
    } catch (error: any) {
      console.error('Error adding room:', error);
      toast.error(error.message || 'Không thể thêm phòng', { duration: 1000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm Phòng Mới</DialogTitle>
          <DialogDescription className="text-slate-400">
            Nhập tên phòng mới. Phòng sẽ hiển thị ngay cả khi chưa có thiết bị nào.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="room-name">Tên Phòng</Label>
              <Input
                id="room-name"
                placeholder="e.g., Phòng khách, Phòng ngủ"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setRoomName('');
              }}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading || !roomName.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang thêm...' : 'Thêm Phòng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

