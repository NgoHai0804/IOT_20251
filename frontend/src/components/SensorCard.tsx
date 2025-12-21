import { motion } from 'motion/react';
import { Thermometer, Droplets, Sun, Activity, Zap } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { Sensor } from '@/types';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  temperature: Thermometer,
  humidity: Droplets,
  light: Sun,
  motion: Activity,
  energy: Zap,
};

const colorMap: Record<string, string> = {
  temperature: 'from-orange-500 to-red-500',
  humidity: 'from-blue-500 to-cyan-500',
  light: 'from-yellow-500 to-amber-500',
  motion: 'from-purple-500 to-pink-500',
  energy: 'from-green-500 to-emerald-500',
};

// Phiên bản thẻ sensor gọn hơn, ít padding và kích thước nhỏ hơn
export function SensorCard({ name, type, value, unit, room, lastUpdate, trend, min_threshold, max_threshold }: Sensor) {
  const Icon = iconMap[type] || Thermometer;
  const gradient = colorMap[type] || 'from-slate-500 to-slate-600';
  
  const formatTime = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };
  
  const displayValue = value !== undefined && value !== null ? value : 0;
  const displayUnit = unit || '';
  const displayRoom = room || 'Unknown';
  
  // Kiểm tra vượt ngưỡng
  const isOverThreshold = (min_threshold !== undefined && displayValue < min_threshold) ||
                          (max_threshold !== undefined && displayValue > max_threshold);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className={`bg-slate-800/60 border backdrop-blur-xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isOverThreshold 
          ? 'border-red-500/40 bg-red-500/10 hover:border-red-500/60' 
          : 'border-slate-700/80 hover:border-cyan-500/40 hover:bg-slate-800/80'
      }`}>
        <CardContent className="px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0 ${
              isOverThreshold ? 'ring-2 ring-red-400/50' : ''
            }`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            
            {/* Thông số ngang */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-white text-sm font-semibold truncate">{name}</p>
                {trend && (
                  <div className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                    trend === 'up' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    trend === 'down' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className={`text-2xl font-bold ${isOverThreshold ? 'text-red-400' : 'text-white'}`}>
                  {displayValue.toFixed(1)}
                </span>
                <span className="text-cyan-200/70 text-xs font-medium">{displayUnit}</span>
                {isOverThreshold && (
                  <span className="text-red-400 text-sm ml-1 animate-pulse" title="Vượt quá ngưỡng nguy hiểm">
                    !
                  </span>
                )}
              </div>
              {/* Hiển thị ngưỡng nếu có */}
              {(min_threshold !== undefined || max_threshold !== undefined) && (
                <div className={`text-[10px] font-medium mb-1.5 px-2 py-0.5 rounded ${
                  isOverThreshold 
                    ? 'text-red-300 bg-red-500/10 border border-red-500/20' 
                    : 'text-cyan-200/60 bg-slate-900/40'
                }`}>
                  {min_threshold !== undefined && max_threshold !== undefined
                    ? `${min_threshold}-${max_threshold}${displayUnit}`
                    : min_threshold !== undefined
                    ? `≥${min_threshold}${displayUnit}`
                    : `≤${max_threshold}${displayUnit}`}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-cyan-200/70 bg-slate-900/60 px-2 py-1 rounded-md truncate font-medium border border-cyan-500/20">
                  {displayRoom}
                </span>
                <span className="text-slate-400 flex-shrink-0 font-medium">
                  {formatTime(lastUpdate)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
