import { useState, useEffect, useMemo } from 'react';
import { DeviceCard } from '@/components/DeviceCard';
import { AddDeviceDialog } from '@/components/AddDeviceDialog';
import { EditDeviceDialog } from '@/components/EditDeviceDialog';
import { SensorCard } from '@/components/SensorCard';
import { ChartsPanel } from '@/components/ChartsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DevicesProps, Device, Sensor } from '@/types';

export function Devices({
  devices,
  rooms,
  onDeviceToggle,
  onBrightnessChange,
  onSpeedChange,
  onTemperatureChange,
  onAddDevice,
  onUpdateDevice,
  selectedDeviceId,
  onDeviceClick,
  onClearSelection,
  sensors,
  temperatureData,
  energyData,
  humidityData,
}: DevicesProps) {
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  
  // Tìm device đang edit từ devices array
  const editingDevice = editingDeviceId 
    ? devices.find(d => d.id === editingDeviceId) || null
    : null;

  // Tìm device được chọn
  const selectedDevice = selectedDeviceId 
    ? devices.find(d => d.id === selectedDeviceId) || null
    : null;

  // Filter sensors của device được chọn
  const deviceSensors = useMemo(() => {
    if (!selectedDeviceId) return [];
    return sensors.filter(s => s.deviceId === selectedDeviceId);
  }, [sensors, selectedDeviceId]);
  
  // Clear editing state nếu device không còn tồn tại
  useEffect(() => {
    if (editingDeviceId && !devices.find(d => d.id === editingDeviceId)) {
      setEditingDeviceId(null);
    }
  }, [devices, editingDeviceId]);

  return (
    <div className="space-y-6">
      {/* Device Selection Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-2xl font-bold">Quản Lý Thiết Bị</h2>
          <AddDeviceDialog onAddDevice={onAddDevice} rooms={rooms} />
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Chọn một thiết bị để xem chi tiết dữ liệu sensor của thiết bị đó
        </p>
      </div>

      {/* Device List */}
      <div>
        <h3 className="text-white mb-4">Danh Sách Thiết Bị</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              {...device}
              onToggle={onDeviceToggle}
              onBrightnessChange={onBrightnessChange}
              onSpeedChange={onSpeedChange}
              onTemperatureChange={onTemperatureChange}
              onEdit={(device) => setEditingDeviceId(device.id)}
              onClick={onDeviceClick}
              isSelected={selectedDeviceId === device.id}
            />
          ))}
        </div>
      </div>

      {/* Selected Device Details */}
      {selectedDevice && (
        <div className="space-y-6">
          {/* Device Info Card */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">{selectedDevice.name}</CardTitle>
                    <p className="text-slate-400 text-sm mt-1">
                      {selectedDevice.room} • {selectedDevice.type}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Đóng
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Trạng thái</p>
                  <p className={`text-lg font-semibold ${
                    selectedDevice.status === 'on' ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {selectedDevice.status === 'on' ? 'Bật' : 'Tắt'}
                  </p>
                </div>
                {selectedDevice.brightness !== undefined && (
                  <div>
                    <p className="text-slate-400 text-sm">Độ sáng</p>
                    <p className="text-white text-lg font-semibold">{selectedDevice.brightness}%</p>
                  </div>
                )}
                {selectedDevice.speed !== undefined && (
                  <div>
                    <p className="text-slate-400 text-sm">Tốc độ</p>
                    <p className="text-white text-lg font-semibold">{selectedDevice.speed}%</p>
                  </div>
                )}
                {selectedDevice.temperature !== undefined && (
                  <div>
                    <p className="text-slate-400 text-sm">Nhiệt độ</p>
                    <p className="text-white text-lg font-semibold">{selectedDevice.temperature}°C</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Device Sensors */}
          <div>
            <h3 className="text-white text-xl font-semibold mb-4">
              Sensor của {selectedDevice.name}
            </h3>
            {deviceSensors.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
                Thiết bị này chưa có sensor nào
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {deviceSensors.map((sensor) => (
                  <SensorCard key={sensor.id} {...sensor} />
                ))}
              </div>
            )}
          </div>

          {/* Device Charts */}
          {deviceSensors.length > 0 && (
            <div>
              <h3 className="text-white text-xl font-semibold mb-4">
                Biểu Đồ Dữ Liệu
              </h3>
              <ChartsPanel
                temperatureData={temperatureData}
                energyData={energyData}
                humidityData={humidityData}
              />
            </div>
          )}
        </div>
      )}

      {/* Edit Device Dialog */}
      {editingDevice && (
        <EditDeviceDialog
          key={editingDevice.id}
          device={editingDevice}
          rooms={rooms}
          onUpdateDevice={async () => {
            await onUpdateDevice();
            setTimeout(() => {
              setEditingDeviceId(null);
            }, 200);
          }}
        />
      )}
    </div>
  );
}
