import { useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartsPanelProps, ChartDataPoint } from '@/types';

interface ChartsPanelExtendedProps extends ChartsPanelProps {
  sensorName?: string;
  chartType?: 'temperature' | 'humidity' | 'energy';
  selectedDays?: 1 | 3 | 7;
  onSelectedDaysChange?: (days: 1 | 3 | 7) => void;
  showDaySelector?: boolean;
}

export const ChartsPanel = memo(function ChartsPanel({ 
  temperatureData, 
  energyData, 
  humidityData, 
  sensorName, 
  chartType,
  selectedDays,
  onSelectedDaysChange,
  showDaySelector = false
}: ChartsPanelExtendedProps) {
  // Determine which data to show based on chartType or available data
  const chartData = useMemo(() => {
    if (chartType === 'temperature' && temperatureData && temperatureData.length > 0) {
      return { data: temperatureData, type: 'temperature' as const };
    }
    if (chartType === 'humidity' && humidityData && humidityData.length > 0) {
      return { data: humidityData, type: 'humidity' as const };
    }
    if (chartType === 'energy' && energyData && energyData.length > 0) {
      return { data: energyData, type: 'energy' as const };
    }
    
    // Auto-detect based on available data
    if (temperatureData && temperatureData.length > 0) {
      return { data: temperatureData, type: 'temperature' as const };
    }
    if (humidityData && humidityData.length > 0) {
      return { data: humidityData, type: 'humidity' as const };
    }
    if (energyData && energyData.length > 0) {
      return { data: energyData, type: 'energy' as const };
    }
    
    return { data: [], type: 'temperature' as const };
  }, [temperatureData, humidityData, energyData, chartType]);

  const hasData = chartData.data.length > 0;
  const displayName = sensorName || 'Sensor Data Trends';

  return (
    <Card className="bg-slate-800/60 border-slate-700/80 backdrop-blur-xl h-full flex flex-col shadow-xl">
      <CardHeader className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-xl font-bold">{displayName}</CardTitle>
          {showDaySelector && selectedDays !== undefined && onSelectedDaysChange && (
            <div className="flex items-center gap-3">
              <span className="text-cyan-200/70 text-sm font-medium">Khoảng thời gian:</span>
              {([1, 3, 7] as const).map((days) => (
                <Button
                  key={days}
                  variant={selectedDays === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => onSelectedDaysChange(days)}
                  className={`h-9 px-4 text-xs font-bold transition-all duration-200 ${
                    selectedDays === days
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-cyan-400 shadow-lg shadow-cyan-500/40'
                      : 'bg-slate-900/60 border-cyan-500/30 text-cyan-200/80 hover:bg-slate-800/80 hover:border-cyan-400/50 hover:text-white'
                  }`}
                >
                  {days} ngày
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartData.type === 'temperature' ? (
              <AreaChart data={chartData.data}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.5} />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '10px',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={3}
                  fill="url(#tempGradient)"
                />
              </AreaChart>
            ) : chartData.type === 'humidity' ? (
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.5} />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '10px',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.5} />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '10px',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[10, 10, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-cyan-200/60">
            <div className="text-center">
              <p className="font-semibold text-lg mb-2">Chưa có dữ liệu</p>
              <p className="text-sm">Chọn một sensor để xem biểu đồ</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
