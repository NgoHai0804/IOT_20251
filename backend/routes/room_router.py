from fastapi import APIRouter, Depends
from controllers import room_controller
from schemas.room_schemas import *
from utils.auth import get_current_user


router = APIRouter(prefix="/room", tags=["Room"])


@router.post("/update-name", response_model=ResponseSchema)
async def update_room_name_route(payload: UpdateRoomName, current_user: dict = Depends(get_current_user)):
    """
    Cập nhật tên phòng
    - old_room_name: Tên phòng cũ
    - new_room_name: Tên phòng mới
    
    Tất cả devices trong phòng cũ sẽ được chuyển sang phòng mới.
    """
    return room_controller.update_room_name(
        current_user,
        payload.old_room_name,
        payload.new_room_name
    )


@router.post("/delete", response_model=ResponseSchema)
async def delete_room_route(payload: DeleteRoom, current_user: dict = Depends(get_current_user)):
    """
    Xóa phòng
    - room_name: Tên phòng cần xóa
    
    Tất cả devices trong phòng sẽ được chuyển sang phòng "Không xác định".
    """
    return room_controller.delete_room(
        current_user,
        payload.room_name
    )

