from fastapi import APIRouter, Depends
from controllers import sensor_controller
from schemas.sensor_schemas import *
from utils.auth import get_current_user

router = APIRouter(prefix="/sensors", tags=["Sensor"])


@router.post("/{sensor_id}/enable", response_model=ResponseSchema)
async def control_sensor_enable_route(sensor_id: str, payload: SensorEnableControl, current_user: dict = Depends(get_current_user)):
    """
    Bật/tắt cảm biến
    POST /sensors/{sensor_id}/enable
    {
      "enabled": false
    }
    """
    user_id = str(current_user["_id"])
    return sensor_controller.control_sensor_enable(sensor_id, payload.enabled, user_id)


@router.get("/device/{device_id}", response_model=ResponseSchema)
async def get_sensors_by_device_route(device_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy danh sách cảm biến theo thiết bị của user"""
    user_id = str(current_user["_id"])
    return sensor_controller.get_sensors_by_device(device_id, user_id)


@router.post("/{sensor_id}/update", response_model=ResponseSchema)
async def update_sensor_route(sensor_id: str, payload: SensorUpdate, current_user: dict = Depends(get_current_user)):
    """
    Cập nhật thông tin cảm biến (name, type, pin)
    Unit sẽ tự động được set dựa trên type
    POST /sensors/{sensor_id}/update
    {
      "name": "Nhiệt độ phòng khách",
      "type": "temperature",
      "pin": 4
    }
    """
    user_id = str(current_user["_id"])
    return sensor_controller.update_sensor(
        sensor_id, 
        payload.name, 
        payload.type, 
        payload.pin, 
        user_id
    )


@router.post("/{sensor_id}/threshold", response_model=ResponseSchema)
async def update_sensor_threshold_route(sensor_id: str, payload: SensorThresholdUpdate, current_user: dict = Depends(get_current_user)):
    """
    Cập nhật ngưỡng nguy hiểm của cảm biến (ngưỡng trên và dưới)
    POST /sensors/{sensor_id}/threshold
    {
      "min_threshold": 10.0,  // null để xóa ngưỡng dưới
      "max_threshold": 50.0   // null để xóa ngưỡng trên
    }
    """
    user_id = str(current_user["_id"])
    return sensor_controller.update_sensor_threshold(
        sensor_id, 
        payload.min_threshold, 
        payload.max_threshold, 
        user_id
    )
