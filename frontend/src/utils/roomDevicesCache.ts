// Cache và quản lý devices của rooms để tránh gọi API trùng lặp
type Device = any;

class RoomDevicesCache {
  private cache = new Map<string, Device[]>();
  private pendingRequests = new Map<string, Promise<Device[]>>();
  private fetchedRoomIds = new Set<string>();

  async getDevices(roomId: string): Promise<Device[]> {
    // Nếu đã có trong cache, trả về ngay
    if (this.cache.has(roomId)) {
      return Promise.resolve(this.cache.get(roomId)!);
    }

    // Không fetch nữa - chỉ trả về empty array
    // Devices sẽ được set vào cache từ API room details
    return Promise.resolve([]);
  }

  // Invalidate cache cho một room (khi có update)
  invalidate(roomId: string) {
    this.cache.delete(roomId);
    this.fetchedRoomIds.delete(roomId);
  }

  // Invalidate tất cả cache
  invalidateAll() {
    this.cache.clear();
    this.fetchedRoomIds.clear();
  }

  // Set devices cho một room (chỉ khi có thay đổi)
  setDevices(roomId: string, devices: Device[]) {
    const existing = this.cache.get(roomId);
    
    // So sánh với dữ liệu hiện có để tránh update không cần thiết
    if (existing && this.areDevicesEqual(existing, devices)) {
      return false; // Không có thay đổi
    }
    
    this.cache.set(roomId, devices);
    this.fetchedRoomIds.add(roomId);
    return true; // Có thay đổi
  }

  // So sánh hai arrays devices
  private areDevicesEqual(devices1: Device[], devices2: Device[]): boolean {
    if (devices1.length !== devices2.length) return false;
    
    return devices1.every((device1, index) => {
      const device2 = devices2[index];
      return device1._id === device2._id && 
             device1.enabled === device2.enabled &&
             device1.name === device2.name &&
             device1.status === device2.status;
    });
  }

  // Get devices từ cache (không fetch)
  getCachedDevices(roomId: string): Device[] | undefined {
    return this.cache.get(roomId);
  }

  // Check xem room đã được fetch chưa
  hasFetched(roomId: string): boolean {
    return this.fetchedRoomIds.has(roomId);
  }
}

// Singleton instance
export const roomDevicesCache = new RoomDevicesCache();
