import { motion } from 'motion/react';
import { Home, Bed, UtensilsCrossed, Bath, Sofa } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import type { Device, RoomPanelProps } from '@/types';

const roomIcons: Record<string, any> = {
  'Living Room': Sofa,
  'Bedroom': Bed,
  'Kitchen': UtensilsCrossed,
  'Bathroom': Bath,
  'Office': Home,
};

export function RoomPanel({ devices }: RoomPanelProps) {
  // Group devices by room
  const devicesByRoom = devices.reduce((acc, device) => {
    if (!acc[device.room]) {
      acc[device.room] = [];
    }
    acc[device.room].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  return (
    <div className="space-y-4">
      {Object.entries(devicesByRoom).map(([room, roomDevices], index) => {
        const Icon = roomIcons[room] || Home;
        const activeCount = roomDevices.filter(d => d.status === 'on').length;
        
        return (
          <motion.div
            key={room}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <CardTitle className="text-white">{room}</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                    {activeCount}/{roomDevices.length} Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {roomDevices.map((device) => (
                    <motion.div
                      key={device.id}
                      whileHover={{ scale: 1.05 }}
                      className={`p-3 rounded-lg border transition-all ${
                        device.status === 'on'
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-700/30 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          device.status === 'on' ? 'bg-green-500' : 'bg-slate-500'
                        }`} />
                        <div>
                          <p className="text-white text-sm">{device.name}</p>
                          <p className="text-slate-400 text-xs capitalize">{device.type}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
