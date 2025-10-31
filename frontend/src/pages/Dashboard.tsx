import { SensorCard } from '@/components/SensorCard';
import { DeviceCard } from '@/components/DeviceCard';
import { ChartsPanel } from '@/components/ChartsPanel';
import type { DashboardProps } from '@/types';

export function Dashboard({
  sensors,
  devices,
  temperatureData,
  energyData,
  humidityData,
  onDeviceToggle,
  onBrightnessChange,
  onSpeedChange,
  onTemperatureChange,
}: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Sensors Overview */}
      <div>
        <h3 className="text-white mb-4">Sensor Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {sensors.map((sensor) => (
            <SensorCard key={sensor.id} {...sensor} />
          ))}
        </div>
      </div>

      {/* Quick Device Controls */}
      <div>
        <h3 className="text-white mb-4">Quick Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.slice(0, 4).map((device) => (
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

      {/* Charts */}
      <ChartsPanel
        temperatureData={temperatureData}
        energyData={energyData}
        humidityData={humidityData}
      />
    </div>
  );
}