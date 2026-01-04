from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routes import user_routes, user_device_router, sensor_data_router, room_router, iot_device_router, device_router, sensor_router, actuator_router, notification_router
from utils.mqtt_client import mqtt_client
import logging
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="IoT Backend API",
    description="Backend API cho hệ thống IoT",
    version="1.0.0"
)

# Cấu hình CORS từ biến môi trường
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các routes
app.include_router(user_routes.router)
app.include_router(user_device_router.router)
app.include_router(sensor_data_router.router)
app.include_router(room_router.router)
app.include_router(iot_device_router.router)
app.include_router(device_router.router)
app.include_router(sensor_router.router)
app.include_router(actuator_router.router)
app.include_router(notification_router.router)

# Mount static files từ frontend build (nếu có)
# Static files được copy vào thư mục static trong Docker container (cùng cấp với main.py)
static_dir = Path(__file__).parent / "static"
if static_dir.exists() and (static_dir / "index.html").exists():
    # Mount static assets (phải mount trước catch-all route)
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    # Serve các file static khác (favicon, images, etc.)
    @app.get("/favicon.ico")
    @app.get("/vite.svg")
    async def serve_favicon():
        favicon_path = static_dir / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(str(favicon_path))
        vite_svg = static_dir / "vite.svg"
        if vite_svg.exists():
            return FileResponse(str(vite_svg))
        return {"status": False, "message": "Không tìm thấy", "data": None}
    
    # Catch-all route để serve SPA (phải đặt sau tất cả API routes)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Bỏ qua nếu là API route (đã được xử lý bởi routers ở trên)
        if full_path.startswith(("api/", "users/", "rooms/", "devices/", "sensors/", "actuators/", "sensor-data/", "notifications/", "health", "user-device", "iot-device")):
            return {"status": False, "message": "Không tìm thấy", "data": None}
        
        # Serve file static nếu tồn tại
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        # Serve index.html cho SPA routes
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        
        return {"status": False, "message": "Không tìm thấy", "data": None}

# Endpoint gốc
@app.get("/")
def root():
    # Nếu có static files, redirect đến frontend
    if static_dir.exists():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
    return {"status": True, "message": "API Backend IoT đang chạy", "data": None}

# Kiểm tra trạng thái hệ thống
@app.get("/health")
def health_check():
    return {"status": "hoạt động bình thường"}

# Background task để kiểm tra và cập nhật trạng thái offline cho devices
async def check_offline_devices_periodically():
    """Chạy định kỳ để kiểm tra và cập nhật trạng thái offline cho devices"""
    while True:
        try:
            await asyncio.sleep(60)  # Chạy mỗi 60 giây
            # Tăng timeout lên 5 phút để tránh false positive (device có thể tạm thời không gửi message)
            mqtt_client.check_and_update_offline_devices(timeout_minutes=5)
        except Exception as e:
            logger.error(f"Lỗi trong background task kiểm tra offline devices: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            await asyncio.sleep(60)  # Đợi 60 giây trước khi thử lại

# Sự kiện khởi động - Kết nối MQTT khi server khởi động
@app.on_event("startup")
async def startup_event():
    logger.info("Đang khởi động IoT Backend API...")
    try:
        mqtt_client.connect()
        logger.info("Đã khởi tạo MQTT client")
        
        # Khởi động background task để kiểm tra offline devices
        asyncio.create_task(check_offline_devices_periodically())
        logger.info("Đã khởi động background task kiểm tra trạng thái offline devices")
    except Exception as e:
        logger.error(f"Lỗi khởi tạo MQTT client: {str(e)}")

# Sự kiện tắt - Ngắt kết nối MQTT khi server tắt
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Đang tắt IoT Backend API...")
    try:
        mqtt_client.disconnect()
        logger.info("Đã ngắt kết nối MQTT client")
    except Exception as e:
        logger.error(f"Lỗi ngắt kết nối MQTT client: {str(e)}")

# uvicorn main:app --reload
