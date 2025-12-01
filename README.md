# IoT Smart Home System

Hệ thống quản lý thiết bị IoT với backend FastAPI và frontend React.

## Cấu trúc Project

```
IOT_BaiTapLon20251/
├── backend/          # FastAPI backend
│   ├── controllers/ # Business logic
│   ├── models/      # Data models
│   ├── routes/      # API routes
│   ├── schemas/     # Pydantic schemas
│   ├── utils/       # Utilities (auth, database)
│   └── main.py      # Entry point
│
└── frontend/         # React + TypeScript frontend
    ├── src/
    │   ├── components/  # React components
    │   ├── hooks/       # Custom hooks
    │   ├── pages/       # Page components
    │   ├── services/    # API services
    │   └── types/       # TypeScript types
```

## Yêu cầu

- Python 3.8+
- Node.js 16+
- MongoDB
- npm hoặc yarn

## Cài đặt Backend

1. Cài đặt dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Cấu hình MongoDB:
- Đảm bảo MongoDB đang chạy trên `localhost:27017`
- Database sẽ tự động tạo: `iot_app`

3. Tạo file `.env` (tùy chọn):
```env
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

4. Khởi động backend:
```bash
uvicorn main:app --reload
```

Backend sẽ chạy tại: `http://localhost:8000`

## Cài đặt Frontend

1. Cài đặt dependencies:
```bash
cd frontend
npm install
```

2. Tạo file `.env` (tùy chọn):
```env
VITE_API_BASE_URL=http://localhost:8000
```

3. Khởi động frontend:
```bash
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /users/register` - Đăng ký user mới
- `POST /users/login` - Đăng nhập

### Devices
- `POST /user-device/add` - Thêm device cho user
- `POST /user-device/get-all-device` - Lấy tất cả devices của user
- `POST /user-device/get-device` - Lấy thông tin device cụ thể
- `POST /user-device/update` - Cập nhật device

## Sử dụng

1. **Đăng ký/Đăng nhập:**
   - Truy cập `/login`
   - Đăng nhập với email và password

2. **Quản lý Devices:**
   - Vào trang `/devices`
   - Click "Add Device" để thêm device mới
   - Nhập device_id và password (nếu có)

3. **Xem Dashboard:**
   - Vào trang `/dashboard` để xem tổng quan
   - Xem devices và sensors

## Lưu ý

- Backend cần chạy trước khi frontend có thể kết nối
- Đảm bảo MongoDB đang chạy
- CORS đã được cấu hình cho localhost:5173 và localhost:3000

