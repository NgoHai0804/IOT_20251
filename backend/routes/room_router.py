from fastapi import APIRouter, Depends
from controllers import room_controller
from schemas.room_schemas import *
from utils.auth import get_current_user


router = APIRouter(prefix="/rooms", tags=["Room"])


@router.post("/", response_model=ResponseSchema)
async def create_room_route(payload: RoomCreate, current_user: dict = Depends(get_current_user)):
    """Tạo phòng mới"""
    user_id = str(current_user["_id"])
    return room_controller.create_room(payload.name, payload.description or "", user_id)


@router.get("/", response_model=ResponseSchema)
async def get_all_rooms_route(
    include_data: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy danh sách tất cả phòng của user
    - include_data=true: Trả về đầy đủ dữ liệu (devices, sensors với dữ liệu mới nhất, actuators)
    - include_data=false: Chỉ trả về danh sách rooms (mặc định)
    """
    user_id = str(current_user["_id"])
    if include_data:
        return room_controller.get_all_rooms_with_data(user_id)
    return room_controller.get_all_rooms(user_id)


@router.get("/{room_id}", response_model=ResponseSchema)
async def get_room_route(room_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy thông tin phòng của user"""
    user_id = str(current_user["_id"])
    return room_controller.get_room(room_id, user_id)


@router.get("/{room_id}/details", response_model=ResponseSchema)
async def get_room_details_route(room_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy thông tin chi tiết phòng kèm devices, sensors, actuators của user"""
    user_id = str(current_user["_id"])
    return room_controller.get_room_details(room_id, user_id)


@router.post("/{room_id}/control", response_model=ResponseSchema)
async def control_room_route(room_id: str, payload: RoomControl, current_user: dict = Depends(get_current_user)):
    """
    Điều khiển theo phòng
    POST /rooms/{room_id}/control
    {
      "action": "off"  // hoặc "on"
    }
    """
    user_id = str(current_user["_id"])
    return room_controller.control_room(room_id, payload.action, user_id)


# Legacy routes (giữ lại để tương thích)
@router.post("/update-name", response_model=ResponseSchema)
async def update_room_name_route(payload: UpdateRoomName, current_user: dict = Depends(get_current_user)):
    """
    Cập nhật tên phòng (legacy)
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
    Xóa phòng (legacy)
    - room_name: Tên phòng cần xóa
    
    Tất cả devices trong phòng sẽ được chuyển sang phòng "Không xác định".
    """
    return room_controller.delete_room(
        current_user,
        payload.room_name
    )

@router.post("/{room_id}/devices/{device_id}", response_model=ResponseSchema)
async def add_device_to_room_route(room_id: str, device_id: str, current_user: dict = Depends(get_current_user)):
    """Thêm device vào room (thêm device_id vào room.device_ids)"""
    return room_controller.add_device_to_room(current_user, room_id, device_id)

@router.delete("/{room_id}/devices/{device_id}", response_model=ResponseSchema)
async def remove_device_from_room_route(room_id: str, device_id: str, current_user: dict = Depends(get_current_user)):
    """Xóa device khỏi room (xóa device_id khỏi room.device_ids)"""
    return room_controller.remove_device_from_room(current_user, room_id, device_id)

