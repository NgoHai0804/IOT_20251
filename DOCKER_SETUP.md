# Hướng dẫn Docker Setup cho IoT Smart Home

## Cấu trúc Docker

Project sử dụng multi-stage build:
1. **Stage 1**: Build React frontend với Vite
2. **Stage 2**: Python FastAPI backend + serve static files từ frontend

## Build Docker Image

### Build local

```bash
docker build -t iot-smart-home:latest \
  --build-arg VITE_API_BASE_URL=http://localhost:8000 \
  .
```

### Build với docker-compose

```bash
docker-compose build
```

## Chạy với Docker Compose

1. Tạo file `.env` ở root project:
```env
# Server Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Database Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
DB_NAME=iot_app

# JWT Configuration
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# MQTT Configuration
MQTT_BROKER=your-mqtt-broker
MQTT_PORT=8883
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password

# Frontend API URL (cho build time)
VITE_API_BASE_URL=http://localhost:8000
```

2. Chạy container:
```bash
docker-compose up -d
```

3. Xem logs:
```bash
docker-compose logs -f
```

4. Dừng container:
```bash
docker-compose down
```

## CI/CD với GitHub Actions

### Cấu hình Secrets trong GitHub

Vào Settings > Secrets and variables > Actions, thêm các secrets sau:

1. **DOCKERHUB_USERNAME**: Username Docker Hub
2. **DOCKERHUB_TOKEN**: Access token Docker Hub
3. **VITE_API_BASE_URL**: URL API cho frontend build (optional)
4. **SERVER_HOST**: IP/hostname của server deploy
5. **SERVER_USER**: Username SSH để deploy
6. **SERVER_SSH_KEY**: Private SSH key để deploy

### Workflow tự động

Khi push code lên branch `master` hoặc `main`:
1. Tự động build Docker image
2. Push image lên Docker Hub với tag `staging`
3. Tự động deploy lên server (nếu có cấu hình SSH)

### Manual trigger

Workflow cũng chạy khi có Pull Request để test build.

## Deploy lên Server

### Chuẩn bị server

1. Cài đặt Docker và Docker Compose
2. Tạo thư mục project:
```bash
mkdir -p /opt/iot-smart-home
cd /opt/iot-smart-home
```

3. Tạo file `docker-compose.yml` và `.env` trên server

4. Pull và chạy:
```bash
docker-compose pull
docker-compose up -d
```

### Health Check

Container có health check tự động:
- Endpoint: `http://localhost:8000/health`
- Interval: 30s
- Timeout: 10s
- Retries: 3

## Troubleshooting

### Frontend không load

Kiểm tra:
1. Static files đã được copy vào container chưa
2. `VITE_API_BASE_URL` đã được set đúng chưa
3. Backend có serve static files không

### Backend không kết nối database

Kiểm tra:
1. `MONGO_URI` trong `.env` đúng chưa
2. Network có thể truy cập MongoDB không
3. Credentials có đúng không

### MQTT không kết nối

Kiểm tra:
1. `MQTT_BROKER`, `MQTT_USERNAME`, `MQTT_PASSWORD` đã set chưa
2. Network có thể truy cập MQTT broker không
3. Port 8883 có mở không (nếu cần)
