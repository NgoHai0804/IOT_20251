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

cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_routes.router)
app.include_router(user_device_router.router)
app.include_router(sensor_data_router.router)
app.include_router(room_router.router)
app.include_router(iot_device_router.router)
app.include_router(device_router.router)
app.include_router(sensor_router.router)
app.include_router(actuator_router.router)
app.include_router(notification_router.router)

static_dir = Path(__file__).parent / "static"
if static_dir.exists() and (static_dir / "index.html").exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith(("api/", "users/", "rooms/", "devices/", "sensors/", "actuators/", "sensor-data/", "notifications/", "health", "user-device", "iot-device")):
            return {"status": False, "message": "Không tìm thấy", "data": None}
        
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        
        return {"status": False, "message": "Không tìm thấy", "data": None}

@app.get("/")
def root():
    if static_dir.exists():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
    return {"status": True, "message": "API Backend IoT đang chạy", "data": None}

@app.get("/health")
def health_check():
    return {"status": "hoạt động bình thường"}

async def check_offline_devices_periodically():
    """Chạy định kỳ để kiểm tra và cập nhật trạng thái offline cho devices"""
    while True:
        try:
            await asyncio.sleep(60)
            mqtt_client.check_and_update_offline_devices(timeout_minutes=5)
        except Exception as e:
            logger.error(f"Lỗi trong background task kiểm tra offline devices: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    logger.info("Đang khởi động IoT Backend API...")
    try:
        mqtt_client.connect()
        asyncio.create_task(check_offline_devices_periodically())
    except Exception as e:
        logger.error(f"Lỗi khởi tạo MQTT client: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Đang tắt IoT Backend API...")
    try:
        mqtt_client.disconnect()
    except Exception as e:
        logger.error(f"Lỗi ngắt kết nối MQTT client: {str(e)}")
