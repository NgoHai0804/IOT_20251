import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from '@/components/Login';
import { LandingPage, Dashboard, Devices, Rooms, Analytics, Notifications } from '@/pages';
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute';
import { SharedLayout } from '@/components/SharedLayout';
import { useAppData } from '@/hooks/useAppData';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('User');
  const appData = useAppData();

  const handleLogin = (user: string) => {
    setUsername(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
  };

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <LandingPage />
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/login" 
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <Login onLogin={handleLogin} />
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Dashboard
                  sensors={appData.sensors}
                  devices={appData.devices}
                  temperatureData={appData.temperatureData}
                  energyData={appData.energyData}
                  humidityData={appData.humidityData}
                  onDeviceToggle={appData.handleDeviceToggle}
                  onBrightnessChange={appData.handleBrightnessChange}
                  onSpeedChange={appData.handleSpeedChange}
                  onTemperatureChange={appData.handleTemperatureChange}
                />
              </SharedLayout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/devices" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Devices
                  devices={appData.devices}
                  rooms={appData.rooms}
                  onDeviceToggle={appData.handleDeviceToggle}
                  onBrightnessChange={appData.handleBrightnessChange}
                  onSpeedChange={appData.handleSpeedChange}
                  onTemperatureChange={appData.handleTemperatureChange}
                  onAddDevice={appData.handleAddDevice}
                />
              </SharedLayout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/rooms" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Rooms devices={appData.devices} />
              </SharedLayout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Analytics
                  sensors={appData.sensors}
                  temperatureData={appData.temperatureData}
                  energyData={appData.energyData}
                  humidityData={appData.humidityData}
                />
              </SharedLayout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/notifications" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Notifications
                  notifications={appData.notifications}
                  onMarkAsRead={appData.handleMarkAsRead}
                  onClearAll={appData.handleClearAllNotifications}
                />
              </SharedLayout>
            </ProtectedRoute>
          } 
        />
      </Routes>
      
      <Toaster position="top-right" />
    </>
  );
}

export default App;