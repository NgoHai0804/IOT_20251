import { useState } from 'react';
import { motion } from 'motion/react';
import { Home, LayoutDashboard, Lightbulb, Bell, BarChart3, LogOut, Menu, X, User } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { NavLink, useLocation } from 'react-router-dom';
import type { DashboardLayoutProps } from '@/types';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'devices', label: 'Devices', icon: Lightbulb, path: '/devices' },
  { id: 'rooms', label: 'Rooms', icon: Home, path: '/rooms' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications' },
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
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800/50 backdrop-blur-lg border-r border-slate-700 z-50 -translate-x-full lg:translate-x-0 transition-transform duration-300 data-[open=true]:translate-x-0"
        data-open={sidebarOpen}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white">Smart Home</h1>
                <p className="text-slate-400 text-sm">Control Center</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const showBadge = item.id === 'notifications' && unreadNotifications > 0;

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={() => {
                    const isActive = location.pathname === item.path;
                    
                    return `w-full justify-start gap-3 flex items-center p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`;
                  }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {showBadge && (
                    <Badge className="bg-red-500 text-white">
                      {unreadNotifications}
                    </Badge>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3 mb-3 p-3 bg-slate-700/30 rounded-lg">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{username}</p>
                <p className="text-slate-400 text-xs">User</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 transition-all duration-200"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-800/50 backdrop-blur-lg border-b border-slate-700">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-white"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
              <div>
                <h2 className="text-white capitalize">
                  {location.pathname === '/' ? 'Dashboard' : 
                   location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2)}
                </h2>
                <p className="text-slate-400 text-sm">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
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
