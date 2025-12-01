import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from '@/components/Login';
import { LandingPage, Dashboard, Devices, Rooms, Notifications } from '@/pages';
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute';
import { SharedLayout } from '@/components/SharedLayout';
import { useAppData } from '@/hooks/useAppData';
import { authAPI } from '@/services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('User');
  const appData = useAppData();

  // Check if user is already authenticated on mount
  useEffect(() => {
    const token = authAPI.getToken();
    if (token) {
      setIsAuthenticated(true);
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) {
        try {
          const user = JSON.parse(userInfo);
          setUsername(user.full_name || user.email || 'User');
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const handleLogin = (user: string) => {
    setUsername(user);
    setIsAuthenticated(true);
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        setUsername(userData.full_name || userData.email || user);
      } catch (e) {
        setUsername(user);
      }
    }
  };

  const handleLogout = () => {
    authAPI.logout();
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
                  onDeviceToggle={appData.handleDeviceToggle}
                  onBrightnessChange={appData.handleBrightnessChange}
                  onSpeedChange={appData.handleSpeedChange}
                  onTemperatureChange={appData.handleTemperatureChange}
                  selectedDeviceId={appData.selectedDeviceId}
                  selectedRoom={appData.selectedRoom}
                  onDeviceClick={appData.setSelectedDeviceId}
                  onRoomClick={appData.setSelectedRoom}
                  onClearSelection={() => {
                    appData.setSelectedDeviceId(null);
                    appData.setSelectedRoom(null);
                  }}
                  rooms={appData.rooms}
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
                  onUpdateDevice={appData.handleUpdateDevice}
                  selectedDeviceId={appData.selectedDeviceId}
                  onDeviceClick={appData.setSelectedDeviceId}
                  onClearSelection={() => {
                    appData.setSelectedDeviceId(null);
                    appData.setSelectedRoom(null);
                  }}
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
          path="/rooms" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SharedLayout 
                username={username}
                onLogout={handleLogout}
                unreadNotifications={appData.unreadCount}
              >
                <Rooms 
                  devices={appData.devices}
                  selectedRoom={appData.selectedRoom}
                  onRoomClick={appData.setSelectedRoom}
                  onClearSelection={() => {
                    appData.setSelectedDeviceId(null);
                    appData.setSelectedRoom(null);
                  }}
                  sensors={appData.sensors}
                  temperatureData={appData.temperatureData}
                  energyData={appData.energyData}
                  humidityData={appData.humidityData}
                  onUpdateRoom={appData.handleUpdateDevice}
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