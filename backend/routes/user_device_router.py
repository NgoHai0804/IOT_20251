from fastapi import APIRouter, Depends, HTTPException
from controllers import user_device_controller
from schemas.user_device_schemas import *
from utils.auth import get_current_user



router = APIRouter(prefix="/user-device", tags=["UserDevice"])

@router.post("/add", response_model=ResponseSchema)
async def add_device_route(payload: AddDevice, current_user: dict = Depends(get_current_user)):
    """
    Thêm thiết bị cho người dùng
    - device_serial: ID vật lý của thiết bị (serial number)
    - password: Mật khẩu của thiết bị (nếu có)
    """
    return user_device_controller.add_device(
        current_user,
        payload.device_serial,  # Sử dụng device_serial thay vì device_id
        payload.password
    )

@router.post("/get-device", response_model=ResponseSchema)
async def get_info_device_route(payload: Device, current_user: dict = Depends(get_current_user)):
    return user_device_controller.get_info_device(current_user, payload.device_id)

@router.get("/get-all-device", response_model=ResponseSchema)
async def get_all_device_route(current_user: dict = Depends(get_current_user)):
    return user_device_controller.get_all_device(current_user)

@router.post("/update", response_model=ResponseSchema)
async def update_device_route(payload: UpdateDevice, current_user: dict = Depends(get_current_user)):
    """
    Cập nhật thông tin thiết bị
    Cho phép cập nhật:
    - device_name: Tên thiết bị
    - device_password: Mật khẩu thiết bị
    - location: Vị trí/phòng
    - note: Ghi chú
    - status: Trạng thái
    
    Chỉ người dùng đã liên kết với thiết bị mới có thể cập nhật.
    """
    update_dict = payload.dict(exclude_none=True)
    device_id = update_dict.pop("device_id")
    return user_device_controller.update_device(current_user, device_id, update_dict)
