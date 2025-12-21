from fastapi import APIRouter, Depends
from controllers import device_controller
from schemas.device_schemas import *
from utils.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["Device"])


@router.post("/{device_id}/power", response_model=ResponseSchema)
async def control_device_power_route(device_id: str, payload: DevicePowerControl, current_user: dict = Depends(get_current_user)):
    """
    Bật/tắt thiết bị
    POST /devices/{device_id}/power
    {
      "enabled": false
    }
    """
    user_id = str(current_user["_id"])
    return device_controller.control_device_power(device_id, payload.enabled, user_id)


@router.get("/{device_id}", response_model=ResponseSchema)
async def get_device_route(device_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy thông tin thiết bị của user"""
    user_id = str(current_user["_id"])
    return device_controller.get_device(device_id, user_id)


@router.get("/room/{room_id}", response_model=ResponseSchema)
async def get_devices_by_room_route(room_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy danh sách thiết bị theo phòng của user"""
    user_id = str(current_user["_id"])
    return device_controller.get_devices_by_room(room_id, user_id)
