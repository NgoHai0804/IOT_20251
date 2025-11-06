import { ChartsPanel } from '@/components/ChartsPanel';
import { SensorCard } from '@/components/SensorCard';
import type { AnalyticsProps } from '@/types';

export function Analytics({
  sensors,
  temperatureData,
  energyData,
  humidityData,
}: AnalyticsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white mb-4">Analytics & Trends</h3>
        <ChartsPanel
          temperatureData={temperatureData}
          energyData={energyData}
          humidityData={humidityData}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((sensor) => (
          <SensorCard key={sensor.id} {...sensor} />
        ))}
      </div>
    </div>
  );
}