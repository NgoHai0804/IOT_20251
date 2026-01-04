import { useState } from 'react';
import { motion } from 'motion/react';
import { Home, LayoutDashboard, Lightbulb, Bell, BarChart3, LogOut, Menu, X, User, UserCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { NavLink, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import type { DashboardLayoutProps } from '@/types';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'rooms', label: 'Rooms', icon: Home, path: '/rooms' },
  { id: 'devices', label: 'Devices', icon: Lightbulb, path: '/devices' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications' },
  { id: 'profile', label: 'Hồ sơ', icon: UserCircle, path: '/profile' },
];

export function DashboardLayout({
  children,
  onLogout,
  username,
  unreadNotifications,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 z-50 -translate-x-full lg:translate-x-0 transition-transform duration-300 data-[open=true]:translate-x-0 shadow-2xl"
        data-open={sidebarOpen}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800/80">
            <Logo size="md" showText={true} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const showBadge = item.id === 'notifications' && unreadNotifications > 0;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={`w-full justify-start gap-3 flex items-center p-3.5 rounded-xl transition-all duration-200 relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white shadow-lg shadow-cyan-500/20 border border-cyan-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-cyan-400' : 'group-hover:scale-110'}`} />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {showBadge && (
                    <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-lg shadow-red-500/30">
                      {unreadNotifications}
                    </Badge>
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3 mb-3 p-3.5 bg-gradient-to-r from-slate-800/60 to-slate-800/40 rounded-xl border border-slate-700/50">
              <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{username}</p>
                <p className="text-cyan-200/60 text-xs">Người dùng</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 transition-all duration-200 font-medium"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header - Removed for all pages */}
        {/* Mobile menu button */}
        <div className="lg:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/80 p-3 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800/60"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Content */}
        <main className={`flex-1 ${location.pathname === '/devices' ? 'p-0' : 'p-4 md:p-6 lg:p-8'}`}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
