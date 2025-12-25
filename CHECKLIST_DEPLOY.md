# ✅ Checklist Kiểm tra Deploy Docker & Render

## 📋 Tổng quan

Checklist này đảm bảo mọi thứ đã được cấu hình đúng để build Docker và chạy trên Render.

---

## ✅ 1. Dockerfile Configuration

### ✅ Đã kiểm tra:
- [x] **Syntax**: `# syntax=docker/dockerfile:1.7` (hỗ trợ cache mounts)
- [x] **Multi-stage build**: Frontend builder + Backend
- [x] **Base images**: 
  - `node:20-slim` (không dùng alpine để tránh musl issues)
  - `python:3.11-slim`
- [x] **Cache mounts**: 
  - npm: `--mount=type=cache,target=/root/.npm`
  - pip: `--mount=type=cache,target=/root/.cache/pip`
- [x] **PORT support**: `CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]`
- [x] **Health check**: Sử dụng PORT động từ environment
- [x] **Static files**: Copy frontend build vào `./static`
- [x] **Build args**: `VITE_API_BASE_URL` cho frontend build

**Status**: ✅ **OK**

---

## ✅ 2. Backend Dependencies (requirements.txt)

### ✅ Đã kiểm tra:
- [x] `fastapi==0.104.1`
- [x] `uvicorn[standard]==0.24.0`
- [x] `pymongo==4.6.0`
- [x] `python-jose[cryptography]==3.3.0` (JWT)
- [x] `passlib[bcrypt]==1.7.4` (password hashing)
- [x] `python-multipart==0.0.6` (file uploads)
- [x] `python-dotenv==1.0.0` (environment variables)
- [x] `paho-mqtt==1.6.1` (MQTT client)
- [x] `email-validator==2.1.0` ⭐ **MỚI THÊM** (cho EmailStr validation)

**Status**: ✅ **OK** - Tất cả dependencies đã có

---

## ✅ 3. JWT Import Fix

### ✅ Đã kiểm tra:
- [x] **File**: `backend/utils/auth.py`
- [x] **Import**: `from jose import jwt, ExpiredSignatureError, JWTError` ✅
- [x] **Không còn**: `import jwt` (sai) ❌
- [x] **Exception handling**: 
  - `ExpiredSignatureError` ✅
  - `JWTError` ✅ (thay vì `InvalidTokenError`)

**Status**: ✅ **OK** - Import đã sửa đúng

---

## ✅ 4. Health Check Endpoint

### ✅ Đã kiểm tra:
- [x] **Endpoint**: `/health` trong `backend/main.py`
- [x] **Response**: `{"status": "healthy"}`
- [x] **Dockerfile healthcheck**: Sử dụng PORT động
- [x] **Render health check**: Tự động detect `/health`

**Status**: ✅ **OK**

---

## ✅ 5. Frontend Build Configuration

### ✅ Đã kiểm tra:
- [x] **package.json**: Có script `build:docker` (bỏ qua TypeScript check)
- [x] **package-lock.json**: Tồn tại (cần cho `npm ci`)
- [x] **VITE_API_BASE_URL**: Được set từ build arg
- [x] **Build output**: Copy vào `./static` trong Docker

**Status**: ✅ **OK**

---

## ✅ 6. Environment Variables

### ✅ Cần set trên Render:
- [x] `MONGO_URI` - MongoDB connection string
- [x] `DB_NAME` - Database name (mặc định: `iot_app`)
- [x] `SECRET_KEY` - JWT secret key
- [x] `ALGORITHM` - JWT algorithm (mặc định: `HS256`)
- [x] `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiry (mặc định: `1440`)
- [x] `MQTT_BROKER` - MQTT broker URL
- [x] `MQTT_PORT` - MQTT port (mặc định: `8883`)
- [x] `MQTT_USERNAME` - MQTT username
- [x] `MQTT_PASSWORD` - MQTT password
- [x] `CORS_ORIGINS` - CORS allowed origins (cập nhật với domain Render)
- [x] `VITE_API_BASE_URL` - Frontend API URL (cho build time)

**Status**: ⚠️ **CẦN SET TRÊN RENDER** (xem `RENDER_DEPLOY.md`)

---

## ✅ 7. Static Files Serving

### ✅ Đã kiểm tra:
- [x] **Logic**: Kiểm tra `static_dir.exists()` và `index.html`
- [x] **Assets mount**: `/assets` được mount riêng
- [x] **SPA routing**: Catch-all route serve `index.html`
- [x] **API routes**: Được exclude khỏi static serving

**Status**: ✅ **OK**

---

## ✅ 8. CI/CD Workflow

### ✅ Đã kiểm tra:
- [x] **GitHub Actions**: `.github/workflows/cicd-docker.yml`
- [x] **Build platform**: `linux/amd64` (tránh QEMU)
- [x] **Cache**: GHA cache + Registry cache
- [x] **Build args**: `VITE_API_BASE_URL` từ secrets
- [x] **Push**: Tự động push lên Docker Hub

**Status**: ✅ **OK**

---

## ✅ 9. Docker Ignore

### ✅ Đã kiểm tra:
- [x] **.dockerignore**: Loại trừ đúng files (node_modules, __pycache__, .env, etc.)
- [x] **Build context**: Không copy files không cần thiết

**Status**: ✅ **OK**

---

## ✅ 10. Email Validation

### ✅ Đã kiểm tra:
- [x] **Schemas sử dụng EmailStr**: 
  - `backend/schemas/user_schemas.py`
  - `backend/schemas/user_device_schemas.py`
- [x] **Dependency**: `email-validator==2.1.0` đã có trong requirements.txt

**Status**: ✅ **OK** - Đã fix lỗi `ModuleNotFoundError: No module named 'email_validator'`

---

## 🎯 Tổng kết

### ✅ Đã sẵn sàng:
1. ✅ Dockerfile tối ưu với cache mounts
2. ✅ Tất cả dependencies đã có (bao gồm email-validator)
3. ✅ JWT import đã sửa đúng
4. ✅ Health check endpoint hoạt động
5. ✅ PORT support cho Render
6. ✅ Frontend build configuration đúng
7. ✅ Static files serving logic đúng
8. ✅ CI/CD workflow hoạt động

### ⚠️ Cần làm trên Render:
1. ⚠️ Set Environment Variables (xem `RENDER_DEPLOY.md`)
2. ⚠️ Cập nhật `CORS_ORIGINS` với domain Render thực tế
3. ⚠️ Cập nhật `VITE_API_BASE_URL` với domain Render thực tế

---

## 🚀 Bước tiếp theo

1. **Rebuild Docker image** (nếu chưa rebuild sau khi thêm email-validator):
   ```bash
   docker build -t ngohai0804/iot-smart-home:latest .
   docker push ngohai0804/iot-smart-home:latest
   ```

2. **Deploy trên Render**:
   - Xem hướng dẫn chi tiết trong `RENDER_DEPLOY.md`
   - Set tất cả Environment Variables
   - Deploy và kiểm tra logs

3. **Kiểm tra sau khi deploy**:
   - Health check: `https://your-app.onrender.com/health`
   - API docs: `https://your-app.onrender.com/docs`
   - Frontend: `https://your-app.onrender.com/`

---

## 📝 Notes

- **email-validator**: Đã thêm vào requirements.txt để fix lỗi `ModuleNotFoundError`
- **PORT**: Render tự động inject, Dockerfile đã hỗ trợ
- **Health check**: Sử dụng PORT động, không hardcode
- **CORS**: Nhớ cập nhật với domain Render thực tế
- **Build time**: Với cache mounts, build nhanh hơn 3-10 lần

---

**Last Updated**: Sau khi fix lỗi email-validator
**Status**: ✅ **SẴN SÀNG DEPLOY**

