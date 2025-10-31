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

export function SensorCard({ name, type, value, unit, room, lastUpdate, trend }: Sensor) {
  const Icon = iconMap[type];
  const gradient = colorMap[type];
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            {trend && (
              <div className={`text-xs px-2 py-1 rounded ${
                trend === 'up' ? 'bg-red-500/20 text-red-400' :
                trend === 'down' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-slate-400 text-sm">{name}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-white text-3xl">{value}</span>
              <span className="text-slate-400 text-lg">{unit}</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-xs">
            <span className="text-slate-500">{room}</span>
            <span className="text-slate-500">{formatTime(lastUpdate)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
