import { NotificationsPanel } from '@/components/NotificationsPanel';
import type { NotificationsProps } from '@/types';

export function Notifications({
  notifications,
  onMarkAsRead,
  onClearAll,
}: NotificationsProps) {
  return (
    <div>
      <NotificationsPanel
        notifications={notifications}
        onMarkAsRead={onMarkAsRead}
        onClearAll={onClearAll}
      />
    </div>
  );
}