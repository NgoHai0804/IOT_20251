import { RoomPanel } from '@/components/RoomPanel';
import type { RoomsProps } from '@/types';

export function Rooms({ devices }: RoomsProps) {
  return (
    <div>
      <h3 className="text-white mb-4">Room Overview</h3>
      <RoomPanel devices={devices} />
    </div>
  );
}