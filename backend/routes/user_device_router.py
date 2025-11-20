from fastapi import APIRouter, Depends, HTTPException
from controllers import user_device_controller
from schemas.user_device_schemas import *
from utils.auth import get_current_user



router = APIRouter(prefix="/user-device", tags=["UserDevice"])

@router.post("/add", response_model=ResponseSchema)
async def add_device_route(payload: AddDevice, current_user: dict = Depends(get_current_user)):
    return user_device_controller.add_device(
        current_user,
        payload.device_id,   # Thay payload.get("device_id")
        payload.password     # Truy cập trực tiếp
    )

@router.post("/get-device", response_model=ResponseSchema)
async def get_info_device_route(payload: Device, current_user: dict = Depends(get_current_user)):
    return user_device_controller.get_info_device(current_user)

@router.post("/get-all-device", response_model=ResponseSchema)
async def get_all_device_route(current_user: dict = Depends(get_current_user)):
    return user_device_controller.get_all_device(current_user)

@router.post("/update", response_model=ResponseSchema)
async def update_device_route(payload: UpdateDevice, current_user: dict = Depends(get_current_user)):
    return user_device_controller.update_device(payload, current_user)
