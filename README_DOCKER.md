# Hướng dẫn Docker và CI/CD

## Cấu trúc Docker

Project sử dụng **multi-stage build**:
1. **Stage 1**: Build React frontend với Vite
2. **Stage 2**: Python FastAPI backend + serve static files từ frontend

## Build Docker Image

### Build local

```bash
# Build với giá trị mặc định
docker build -t iot-smart-home:latest .

# Build với custom API URL
docker build -t iot-smart-home:latest \
  --build-arg VITE_API_BASE_URL=https://api.yourdomain.com \
  .
```

### Build với docker-compose

```bash
docker-compose build
```

## Chạy với Docker Compose

1. **Tạo file `.env`** ở root project với các biến môi trường cần thiết (xem `backend/.env.example`)

2. **Chạy container**:
```bash
docker-compose up -d
```

3. **Xem logs**:
```bash
docker-compose logs -f
```

4. **Dừng container**:
```bash
docker-compose down
```

## CI/CD với GitHub Actions

### Cấu hình Secrets trong GitHub

Vào **Settings > Secrets and variables > Actions**, thêm các secrets sau:

#### Bắt buộc:
- `DOCKERHUB_USERNAME`: Username Docker Hub
- `DOCKERHUB_TOKEN`: Access token Docker Hub (tạo tại Docker Hub > Account Settings > Security)

#### Tùy chọn (cho build):
- `VITE_API_BASE_URL`: URL API cho frontend build (mặc định: `http://localhost:8000`)

#### Tùy chọn (cho deploy):
- `SERVER_HOST`: IP/hostname của server deploy
- `SERVER_USER`: Username SSH để deploy
- `SERVER_SSH_KEY`: Private SSH key để deploy

### Workflow tự động

Khi **push code** lên branch `master` hoặc `main`:
1. ✅ Tự động build Docker image
2. ✅ Push image lên Docker Hub với tag `staging`
3. ✅ Tự động deploy lên server (nếu có cấu hình SSH secrets)

Khi có **Pull Request**:
- ✅ Chỉ build để test, không push image

### Manual trigger

Workflow cũng chạy khi có Pull Request để test build.

## Deploy lên Server

### Chuẩn bị server

1. **Cài đặt Docker và Docker Compose**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
```

2. **Tạo thư mục project**:
```bash
sudo mkdir -p /opt/iot-smart-home
cd /opt/iot-smart-home
```

3. **Tạo file `docker-compose.yml`** (copy từ repo)

4. **Tạo file `.env`** với các biến môi trường thực tế

5. **Pull và chạy**:
```bash
docker compose pull
docker compose up -d
```

### Health Check

Container có health check tự động:
- **Endpoint**: `http://localhost:8000/health`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start period**: 40s

Kiểm tra health:
```bash
docker compose ps
```

## Troubleshooting

### Frontend không load

**Kiểm tra**:
1. Static files đã được copy vào container chưa:
   ```bash
   docker exec iot-backend ls -la /app/static
   ```

2. `VITE_API_BASE_URL` đã được set đúng chưa trong build args

3. Backend có serve static files không (kiểm tra logs)

### Backend không kết nối database

**Kiểm tra**:
1. `MONGO_URI` trong `.env` đúng chưa
2. Network có thể truy cập MongoDB không
3. Credentials có đúng không

### MQTT không kết nối

**Kiểm tra**:
1. `MQTT_BROKER`, `MQTT_USERNAME`, `MQTT_PASSWORD` đã set chưa
2. Network có thể truy cập MQTT broker không
3. Port 8883 có mở không (nếu cần)

### Build fails trong CI/CD

**Kiểm tra**:
1. Docker Hub credentials đúng chưa
2. Secrets đã được set trong GitHub chưa
3. Build logs trong GitHub Actions để xem lỗi cụ thể

## Cấu trúc Image

```
iot-smart-home:latest
├── /app/
│   ├── main.py (FastAPI backend)
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── static/ (Frontend build từ stage 1)
│       ├── index.html
│       ├── assets/
│       └── ...
```

## Ports

- **8000**: Backend API + Frontend (FastAPI serve cả hai)

## Environment Variables

Xem `backend/.env.example` và `frontend/.env.example` để biết các biến môi trường cần thiết.
