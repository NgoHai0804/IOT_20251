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
import { Button } from './ui/button';
import { roomAPI } from '@/services/api';
import { toast } from 'sonner';

interface EditRoomDialogProps {
  roomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newRoomName?: string) => void;
}

export function EditRoomDialog({ roomName, open, onOpenChange, onSuccess }: EditRoomDialogProps) {
  const [newRoomName, setNewRoomName] = useState(roomName);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNewRoomName(roomName);
    }
  }, [open, roomName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newRoomName.trim()) {
      toast.error('Tên phòng không được để trống', { duration: 1000 });
      return;
    }

    if (newRoomName.trim() === roomName) {
      toast.error('Tên phòng mới phải khác tên phòng cũ', { duration: 1000 });
      return;
    }

    setLoading(true);
    try {
      await roomAPI.updateRoomName(roomName, newRoomName.trim());
      toast.success('Cập nhật tên phòng thành công', { duration: 1000 });
      onSuccess(newRoomName.trim());
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating room name:', error);
      toast.error(error.message || 'Không thể cập nhật tên phòng', { duration: 1000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tên phòng</DialogTitle>
          <DialogDescription className="text-slate-400">
            Cập nhật tên phòng. Tất cả thiết bị trong phòng này sẽ được chuyển sang phòng mới.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="room-name">Tên phòng mới</Label>
              <Input
                id="room-name"
                placeholder="e.g., Phòng khách"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading || !newRoomName.trim() || newRoomName.trim() === roomName}
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



