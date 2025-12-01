import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';
import { roomAPI } from '@/services/api';
import { toast } from 'sonner';

interface DeleteRoomDialogProps {
  roomName: string;
  deviceCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteRoomDialog({ 
  roomName, 
  deviceCount, 
  open, 
  onOpenChange, 
  onSuccess 
}: DeleteRoomDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await roomAPI.deleteRoom(roomName);
      toast.success(`Đã xóa phòng "${roomName}". ${deviceCount} thiết bị đã được chuyển sang "Không xác định"`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error.message || 'Không thể xóa phòng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Xóa phòng
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Bạn có chắc chắn muốn xóa phòng "{roomName}"?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">
              <strong>Lưu ý:</strong> Tất cả {deviceCount} thiết bị trong phòng này sẽ được chuyển sang phòng "Không xác định".
            </p>
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
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang xóa...' : 'Xóa phòng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

