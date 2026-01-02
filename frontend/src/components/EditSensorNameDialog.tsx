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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import type { Sensor } from '@/types';
import { newSensorAPI } from '@/services/api';

interface EditSensorNameDialogProps {
  sensor: Sensor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Mapping type -> unit và label
const sensorTypeOptions = [
  { value: 'temperature', label: 'Nhiệt độ', unit: '°C' },
  { value: 'humidity', label: 'Độ ẩm', unit: '%' },
  { value: 'gas', label: 'Khí gas', unit: 'ppm' },
];

export function EditSensorNameDialog({
  sensor,
  open,
  onOpenChange,
  onSuccess,
}: EditSensorNameDialogProps) {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sensor) {
      setName(sensor.name || '');
      setType(sensor.type || '');
    }
  }, [sensor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensor) return;

    if (!name.trim()) {
      toast.error('Tên cảm biến không được để trống', { duration: 2000 });
      return;
    }

    if (!type) {
      toast.error('Vui lòng chọn loại cảm biến', { duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      await newSensorAPI.updateSensor(
        sensor._id,
        name.trim(),
        type,
        undefined
      );
      toast.success('Đã cập nhật thông tin cảm biến', { duration: 1000 });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating sensor:', error);
      toast.error(error.message || 'Không thể cập nhật cảm biến', { duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  if (!sensor) return null;

  const selectedTypeOption = sensorTypeOptions.find(opt => opt.value === type);
  const displayUnit = selectedTypeOption?.unit || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Chỉnh sửa cảm biến</DialogTitle>
          <DialogDescription className="text-slate-400">
            Đơn vị sẽ tự động được cập nhật theo loại cảm biến
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-cyan-200">
                Tên cảm biến
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên cảm biến"
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-cyan-200">
                Loại cảm biến
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full">
                  <SelectValue placeholder="Chọn loại cảm biến" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {sensorTypeOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-white focus:bg-slate-600"
                    >
                      {option.label} ({option.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {displayUnit && (
                <p className="text-xs text-slate-400">
                  Đơn vị: <span className="text-cyan-400">{displayUnit}</span>
                </p>
              )}
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

