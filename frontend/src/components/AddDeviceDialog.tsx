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
import type { Device, AddDeviceDialogProps } from '@/types';

export function AddDeviceDialog({ onAddDevice, rooms }: AddDeviceDialogProps) {
  const [open, setOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'light' | 'fan' | 'ac' | 'plug'>('light');
  const [deviceRoom, setDeviceRoom] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [showCustomRoom, setShowCustomRoom] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceName || !deviceRoom) {
      return;
    }

    const newDevice: Omit<Device, 'id' | 'lastActive'> = {
      name: deviceName,
      type: deviceType,
      status: 'off',
      room: deviceRoom,
    };

    // Add default values based on device type
    if (deviceType === 'light') {
      newDevice.brightness = 50;
    } else if (deviceType === 'fan') {
      newDevice.speed = 50;
    } else if (deviceType === 'ac') {
      newDevice.temperature = 24;
    }

    onAddDevice(newDevice);

    // Reset form
    setDeviceName('');
    setDeviceType('light');
    setDeviceRoom('');
    setCustomRoom('');
    setShowCustomRoom(false);
    setOpen(false);
  };

  const handleRoomChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomRoom(true);
      setDeviceRoom('');
    } else {
      setShowCustomRoom(false);
      setDeviceRoom(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Add Device
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
              <Label htmlFor="name">Device Name</Label>
              <Input
                id="name"
                placeholder="e.g., Living Room Light"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Device Type</Label>
              <Select value={deviceType} onValueChange={(value: any) => setDeviceType(value)}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="light" className="text-white hover:bg-slate-700">
                    Light
                  </SelectItem>
                  <SelectItem value="fan" className="text-white hover:bg-slate-700">
                    Fan
                  </SelectItem>
                  <SelectItem value="ac" className="text-white hover:bg-slate-700">
                    Air Conditioner
                  </SelectItem>
                  <SelectItem value="plug" className="text-white hover:bg-slate-700">
                    Smart Plug
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="room">Room</Label>
              <Select value={showCustomRoom ? 'custom' : deviceRoom} onValueChange={handleRoomChange}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {rooms.map((room) => (
                    <SelectItem key={room} value={room} className="text-white hover:bg-slate-700">
                      {room}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="text-white hover:bg-slate-700">
                    + Add New Room
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCustomRoom && (
              <div className="grid gap-2">
                <Label htmlFor="customRoom">New Room Name</Label>
                <Input
                  id="customRoom"
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
              onClick={() => setOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!deviceName || !deviceRoom}
            >
              Add Device
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
