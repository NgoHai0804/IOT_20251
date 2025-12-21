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

  // Set devices cho một room (khi có update từ bên ngoài)
  setDevices(roomId: string, devices: Device[]) {
    this.cache.set(roomId, devices);
    this.fetchedRoomIds.add(roomId);
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
