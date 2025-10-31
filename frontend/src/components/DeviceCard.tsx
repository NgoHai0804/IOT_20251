import { motion } from 'motion/react';
import { Lightbulb, Fan, AirVent, Plug } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import type { DeviceCardProps } from '@/types';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  light: Lightbulb,
  fan: Fan,
  ac: AirVent,
  plug: Plug,
};

const colorMap: Record<string, string> = {
  light: 'from-yellow-500 to-amber-500',
  fan: 'from-blue-500 to-cyan-500',
  ac: 'from-indigo-500 to-purple-500',
  plug: 'from-green-500 to-emerald-500',
};

export function DeviceCard({
  id,
  name,
  type,
  status,
  room,
  brightness,
  speed,
  temperature,
  lastActive,
  onToggle,
  onBrightnessChange,
  onSpeedChange,
  onTemperatureChange,
}: DeviceCardProps) {
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
      <Card className={`bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden transition-all ${
        status === 'on' ? 'ring-2 ring-blue-500/50' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center ${
              status === 'off' ? 'opacity-50' : ''
            }`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <Switch
              checked={status === 'on'}
              onCheckedChange={() => onToggle(id)}
            />
          </div>
          
          <div className="space-y-1 mb-4">
            <p className="text-white">{name}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${
                status === 'on' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
              }`}>
                {status.toUpperCase()}
              </span>
              <span className="text-slate-500">{room}</span>
            </div>
          </div>
          
          {status === 'on' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 mb-4"
            >
              {type === 'light' && brightness !== undefined && onBrightnessChange && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Brightness</span>
                    <span className="text-white">{brightness}%</span>
                  </div>
                  <Slider
                    value={[brightness]}
                    onValueChange={(value) => onBrightnessChange(id, value[0])}
                    max={100}
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
              )}
              
              {type === 'fan' && speed !== undefined && onSpeedChange && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Speed</span>
                    <span className="text-white">{speed}%</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={(value) => onSpeedChange(id, value[0])}
                    max={100}
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
              )}
              
              {type === 'ac' && temperature !== undefined && onTemperatureChange && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Temperature</span>
                    <span className="text-white">{temperature}°C</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={(value) => onTemperatureChange(id, value[0])}
                    min={16}
                    max={30}
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
              )}
            </motion.div>
          )}
          
          <div className="pt-3 border-t border-slate-700 flex justify-between text-xs">
            <span className="text-slate-500">Last active</span>
            <span className="text-slate-400">{formatTime(lastActive)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
