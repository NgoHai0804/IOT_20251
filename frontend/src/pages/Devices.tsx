import { DeviceCard } from '@/components/DeviceCard';
import { AddDeviceDialog } from '@/components/AddDeviceDialog';
import type { DevicesProps } from '@/types';

export function Devices({
  devices,
  rooms,
  onDeviceToggle,
  onBrightnessChange,
  onSpeedChange,
  onTemperatureChange,
  onAddDevice,
}: DevicesProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white">All Devices</h3>
          <AddDeviceDialog onAddDevice={onAddDevice} rooms={rooms} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              {...device}
              onToggle={onDeviceToggle}
              onBrightnessChange={onBrightnessChange}
              onSpeedChange={onSpeedChange}
              onTemperatureChange={onTemperatureChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}