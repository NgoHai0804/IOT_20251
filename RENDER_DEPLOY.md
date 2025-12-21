# Hướng dẫn Deploy lên Render

## 📋 Tổng quan

Render là một platform để deploy Docker containers. Project này đã được cấu hình sẵn để chạy trên Render.

## ✅ Đã được cấu hình

1. ✅ **Dockerfile** hỗ trợ PORT từ Render
2. ✅ **Health check endpoint** tại `/health` (và health check trong Dockerfile sử dụng PORT động)
3. ✅ **Import JWT** đã sửa đúng (`from jose import jwt`)
4. ✅ **Multi-stage build** tối ưu với cache mounts
5. ✅ **BuildKit cache** để build nhanh hơn (Render hỗ trợ BuildKit)

## 🚀 Cách Deploy trên Render

### Cách 1: Deploy từ Docker Hub (KHUYẾN NGHỊ)

1. **Build và push image lên Docker Hub** (từ CI/CD hoặc local):
   ```bash
   docker build -t ngohai0804/iot-smart-home:latest .
   docker push ngohai0804/iot-smart-home:latest
   ```

2. **Tạo Web Service trên Render**:
   - Vào [Render Dashboard](https://dashboard.render.com)
   - Click **New +** → **Web Service**
   - Chọn **Deploy an existing image from a registry**
   - Nhập image: `ngohai0804/iot-smart-home:latest`
   - Chọn **Docker Hub** làm registry

3. **Cấu hình Environment Variables**:
   - Vào **Environment** tab
   - Thêm các biến sau (click **Add Environment Variable**):

   ```
   # Database
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
   DB_NAME=iot_app
   
   # JWT
   SECRET_KEY=your-secret-key-here-min-32-chars
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   
   # MQTT
   MQTT_BROKER=your-mqtt-broker.com
   MQTT_PORT=8883
   MQTT_PORT_WS=8884
   MQTT_USERNAME=your-mqtt-username
   MQTT_PASSWORD=your-mqtt-password
   
   # CORS (cập nhật với domain Render của bạn)
   CORS_ORIGINS=https://your-app.onrender.com,http://localhost:5173
   
   # Frontend API URL (cho build time - Render tự động set PORT)
   VITE_API_BASE_URL=https://your-app.onrender.com
   ```

4. **Cấu hình khác**:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Bật nếu muốn tự động deploy khi push lên Docker Hub

5. **Deploy**:
   - Click **Create Web Service**
   - Render sẽ pull image và start container

### Cách 2: Deploy từ GitHub (Build trên Render)

1. **Tạo Web Service từ GitHub**:
   - Vào Render Dashboard
   - Click **New +** → **Web Service**
   - Kết nối GitHub repository
   - Chọn repository và branch

2. **Cấu hình Build**:
   - **Build Command**: (để trống, Render sẽ tự động detect Dockerfile)
   - **Start Command**: (để trống, Render sẽ dùng CMD từ Dockerfile)
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.` (root)

3. **Cấu hình Environment Variables** (giống Cách 1)

4. **Cấu hình Build Args** (nếu cần):
   - Vào **Environment** tab
   - Thêm:
   ```
   VITE_API_BASE_URL=https://your-app.onrender.com
   ```

5. **Deploy**:
   - Click **Create Web Service**
   - Render sẽ build Docker image và deploy

## 🔧 Cấu hình quan trọng

### 1. PORT Environment Variable

Render tự động inject biến `PORT`. Dockerfile đã được cấu hình để sử dụng:
```dockerfile
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### 2. Health Check

Render sẽ tự động check endpoint `/health`. Đảm bảo endpoint này trả về:
```json
{"status": "healthy"}
```

### 3. CORS Configuration

**QUAN TRỌNG**: Cập nhật `CORS_ORIGINS` với domain Render của bạn:
```
CORS_ORIGINS=https://your-app.onrender.com,http://localhost:5173
```

### 4. Frontend API URL

Nếu frontend chạy riêng, cập nhật `VITE_API_BASE_URL` trong frontend `.env`:
```
VITE_API_BASE_URL=https://your-app.onrender.com
```

## 📝 Sử dụng render.yaml (Tùy chọn)

Nếu muốn cấu hình bằng file, có thể dùng `render.yaml`:

1. **Commit `render.yaml`** vào repository
2. **Tạo Blueprint** trên Render:
   - Vào **Blueprints**
   - Click **New Blueprint**
   - Chọn repository
   - Render sẽ tự động detect `render.yaml`

**Lưu ý**: `render.yaml` chỉ là template. Bạn vẫn cần set các secrets (MONGO_URI, SECRET_KEY, etc.) trong Render Dashboard.

## 🐛 Troubleshooting

### Lỗi: ModuleNotFoundError: No module named 'jwt'

✅ **Đã fix**: Import đã được sửa thành `from jose import jwt`

### Lỗi: Port không được detect

**Kiểm tra**:
- Dockerfile CMD có sử dụng `${PORT}` không
- Environment variable `PORT` có được set không (Render tự động set)

### Lỗi: Health check failed

**Kiểm tra**:
- Endpoint `/health` có trả về `{"status": "healthy"}` không
- App có start thành công không (xem logs)

### Lỗi: CORS error

**Kiểm tra**:
- `CORS_ORIGINS` có chứa domain frontend không
- Format đúng: `https://domain1.com,https://domain2.com` (không có space)

### Lỗi: Database connection failed

**Kiểm tra**:
- `MONGO_URI` đúng format không
- MongoDB Atlas có whitelist IP của Render không (thêm `0.0.0.0/0` để cho phép tất cả)

### Lỗi: MQTT connection failed

**Kiểm tra**:
- `MQTT_BROKER`, `MQTT_USERNAME`, `MQTT_PASSWORD` đúng chưa
- MQTT broker có cho phép connection từ Render IP không

## 📊 Monitoring

Render cung cấp:
- **Logs**: Xem real-time logs trong Dashboard
- **Metrics**: CPU, Memory, Request count
- **Health Status**: Tự động check `/health` endpoint

## 🔄 Auto-Deploy

### Từ Docker Hub:
1. Build và push image với tag mới
2. Render sẽ tự động pull và deploy (nếu bật Auto-Deploy)

### Từ GitHub:
1. Push code lên branch được connect
2. Render sẽ tự động build và deploy

## 💡 Best Practices

1. **Sử dụng Secrets**: Không commit secrets vào code, dùng Environment Variables trong Render
2. **Health Check**: Đảm bảo `/health` endpoint hoạt động
3. **CORS**: Luôn cập nhật `CORS_ORIGINS` với domain thực tế
4. **Logs**: Kiểm tra logs thường xuyên để debug
5. **Database**: Sử dụng MongoDB Atlas với connection string đúng

## 📚 Tài liệu tham khảo

- [Render Docker Docs](https://render.com/docs/docker)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Health Checks](https://render.com/docs/health-checks)
