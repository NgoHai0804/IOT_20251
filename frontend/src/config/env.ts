// Cấu hình biến môi trường cho frontend

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Validation: Kiểm tra xem API_BASE_URL có hợp lệ không
if (!API_BASE_URL || API_BASE_URL.trim() === '') {
  console.warn('VITE_API_BASE_URL không được thiết lập, sử dụng giá trị mặc định: http://localhost:8000');
}

// Export tất cả các biến môi trường để dễ quản lý
export const env = {
  API_BASE_URL,
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
} as const;

// Helper function để log cấu hình (chỉ trong development)
if (import.meta.env.DEV) {
  console.log('Frontend Environment Configuration:', {
    API_BASE_URL,
    MODE: import.meta.env.MODE,
  });
}
