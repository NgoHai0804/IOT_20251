# Hướng dẫn cấu hình biến môi trường cho Frontend

## Tạo file .env

Copy file `.env.example` thành `.env` và điền các giá trị thực tế:

```bash
cp .env.example .env
```

## Các biến môi trường

### VITE_API_BASE_URL
URL của backend API server.

**Ví dụ:**
```env
# Development
VITE_API_BASE_URL=http://localhost:8000

# Production (Render)
VITE_API_BASE_URL=https://iot-20251.onrender.com
```

## Lưu ý

1. **Tiền tố VITE_**: Tất cả biến môi trường trong Vite phải có tiền tố `VITE_` để được expose cho client-side code.

2. **Restart dev server**: Sau khi thay đổi file `.env`, bạn cần restart Vite dev server để áp dụng thay đổi:
   ```bash
   npm run dev
   ```

3. **Build time**: Các biến môi trường được embed vào code tại thời điểm build, không thể thay đổi sau khi build.

4. **Security**: Không commit file `.env` vào git. File `.env.example` đã được thêm vào `.gitignore`.

## Cấu hình cho Render Deployment

Khi deploy lên Render, URL server sẽ được tự động set trong file `render.yaml`:
- `VITE_API_BASE_URL=https://iot-20251.onrender.com`

File `.env.production` đã được tạo sẵn với URL Render. Khi build trên Render, biến môi trường sẽ được inject từ `render.yaml`.

## Kiểm tra cấu hình

Trong development mode, bạn có thể xem cấu hình hiện tại trong console của browser khi ứng dụng khởi động.
