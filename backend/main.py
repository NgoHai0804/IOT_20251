from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import user_routes, user_device_router, sensor_data_router, room_router
from utils.mqtt_client import mqtt_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="IoT Backend API",
    description="Backend API cho hệ thống IoT",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(user_routes.router)
app.include_router(user_device_router.router)
app.include_router(sensor_data_router.router)
app.include_router(room_router.router)

# Root endpoint
@app.get("/")
def root():
    return {"status": True, "message": "IoT Backend API is running", "data": None}

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Startup event - Kết nối MQTT khi server khởi động
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting IoT Backend API...")
    try:
        mqtt_client.connect()
        logger.info("✅ MQTT client initialized")
    except Exception as e:
        logger.error(f"❌ Error initializing MQTT client: {str(e)}")

# Shutdown event - Ngắt kết nối MQTT khi server tắt
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down IoT Backend API...")
    try:
        mqtt_client.disconnect()
        logger.info("✅ MQTT client disconnected")
    except Exception as e:
        logger.error(f"❌ Error disconnecting MQTT client: {str(e)}")

# uvicorn main:app --reload
