import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import type { Actuator } from '@/types';
import { newActuatorAPI } from '@/services/api';

interface EditActuatorNameDialogProps {
  actuator: Actuator | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditActuatorNameDialog({
  actuator,
  open,
  onOpenChange,
  onSuccess,
}: EditActuatorNameDialogProps) {
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (actuator) {
      setName(actuator.name || '');
    }
  }, [actuator, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actuator) return;

    if (!name.trim()) {
      toast.error('Tên điều khiển không được để trống', { duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      await newActuatorAPI.updateActuator(
        actuator._id,
        name.trim(),
        undefined,
        undefined
      );
      toast.success('Đã cập nhật thông tin điều khiển', { duration: 1000 });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating actuator:', error);
      toast.error(error.message || 'Không thể cập nhật điều khiển', { duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  if (!actuator) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Chỉnh sửa điều khiển</DialogTitle>
          <DialogDescription className="text-slate-400">
            {actuator.type}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-cyan-200">
                Tên điều khiển
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên điều khiển"
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              {loading ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

