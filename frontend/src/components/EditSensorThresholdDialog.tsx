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
import type { Sensor } from '@/types';
import { newSensorAPI } from '@/services/api';

interface EditSensorThresholdDialogProps {
  sensor: Sensor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSensorThresholdDialog({
  sensor,
  open,
  onOpenChange,
  onSuccess,
}: EditSensorThresholdDialogProps) {
  const [minThreshold, setMinThreshold] = useState<string>('');
  const [maxThreshold, setMaxThreshold] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sensor) {
      setMinThreshold(sensor.min_threshold?.toString() || '');
      setMaxThreshold(sensor.max_threshold?.toString() || '');
    }
  }, [sensor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensor) return;

    // Validate
    const min = minThreshold.trim() === '' ? null : parseFloat(minThreshold);
    const max = maxThreshold.trim() === '' ? null : parseFloat(maxThreshold);

    if (min !== null && isNaN(min)) {
      toast.error('Ngưỡng dưới phải là số', { duration: 2000 });
      return;
    }
    if (max !== null && isNaN(max)) {
      toast.error('Ngưỡng trên phải là số', { duration: 2000 });
      return;
    }
    if (min !== null && max !== null && min > max) {
      toast.error('Ngưỡng dưới phải nhỏ hơn hoặc bằng ngưỡng trên', { duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      await newSensorAPI.updateSensorThreshold(
        sensor._id,
        min,
        max
      );
      toast.success('Đã cập nhật ngưỡng cảm biến', { duration: 1000 });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating sensor threshold:', error);
      toast.error(error.message || 'Không thể cập nhật ngưỡng', { duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMinThreshold('');
    setMaxThreshold('');
  };

  if (!sensor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Chỉnh sửa ngưỡng cảm biến</DialogTitle>
          <DialogDescription className="text-slate-400">
            {sensor.name} ({sensor.type})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="min_threshold" className="text-cyan-200">
                Ngưỡng dưới ({sensor.unit || ''})
              </Label>
              <Input
                id="min_threshold"
                type="number"
                step="0.1"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                placeholder="Để trống để xóa"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-400">
                Cảnh báo khi giá trị nhỏ hơn ngưỡng này
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_threshold" className="text-cyan-200">
                Ngưỡng trên ({sensor.unit || ''})
              </Label>
              <Input
                id="max_threshold"
                type="number"
                step="0.1"
                value={maxThreshold}
                onChange={(e) => setMaxThreshold(e.target.value)}
                placeholder="Để trống để xóa"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-400">
                Cảnh báo khi giá trị lớn hơn ngưỡng này
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Xóa tất cả
            </Button>
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
