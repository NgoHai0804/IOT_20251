import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { newDeviceAPI } from '@/services/api';
import { toast } from 'sonner';

interface DeleteDeviceDialogProps {
  deviceId: string;
  deviceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteDeviceDialog({
  deviceId,
  deviceName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteDeviceDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await newDeviceAPI.deleteDevice(deviceId);
      toast.success('Thiết bị đã được xóa thành công', { duration: 2000 });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting device:', error);
      toast.error(error.message || 'Không thể xóa thiết bị', { duration: 2000 });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Xóa thiết bị</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Hành động này không thể hoàn tác
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-slate-300 mb-4">
            Bạn có chắc chắn muốn xóa thiết bị <span className="font-semibold text-white">"{deviceName}"</span>?
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">
              <strong>Cảnh báo:</strong> Việc xóa thiết bị sẽ:
            </p>
            <ul className="text-red-300 text-sm mt-2 space-y-1 ml-4">
              <li>• Xóa vĩnh viễn tất cả dữ liệu cảm biến</li>
              <li>• Xóa tất cả cấu hình điều khiển</li>
              <li>• Loại bỏ thiết bị khỏi tất cả phòng</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? 'Đang xóa...' : 'Xóa thiết bị'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}