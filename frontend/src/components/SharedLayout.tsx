import { DashboardLayout } from './DashboardLayout';
import type { SharedLayoutProps } from '@/types';

export function SharedLayout({ 
  children, 
  username, 
  onLogout, 
  unreadNotifications 
}: SharedLayoutProps) {
  return (
    <DashboardLayout
      onLogout={onLogout}
      username={username}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </DashboardLayout>
  );
}