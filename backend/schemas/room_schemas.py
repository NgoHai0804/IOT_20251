from pydantic import BaseModel, Field
from typing import Any, Optional


# ======= Response chung =======
class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


# ======= Room Create =======
class RoomCreate(BaseModel):
    """Tạo phòng mới"""
    name: str = Field(..., description="Room name")
    description: Optional[str] = Field("", description="Room description")


# ======= Room Update =======
class RoomUpdate(BaseModel):
    """Cập nhật phòng"""
    name: Optional[str] = None
    description: Optional[str] = None


# ======= Room Control =======
class RoomControl(BaseModel):
    """Điều khiển theo phòng"""
    action: str = Field(..., description="Action: 'on' or 'off'")


# ======= Update Room Name (Legacy) =======
class UpdateRoomName(BaseModel):
    """
    Schema để cập nhật tên phòng (legacy - giữ lại để tương thích)
    - old_room_name: Tên phòng cũ
    - new_room_name: Tên phòng mới
    """
    old_room_name: str = Field(..., description="Old room name")
    new_room_name: str = Field(..., description="New room name")


# ======= Delete Room (Legacy) =======
class DeleteRoom(BaseModel):
    """
    Schema để xóa phòng (legacy - giữ lại để tương thích)
    - room_name: Tên phòng cần xóa
    """
    room_name: str = Field(..., description="Room name to delete")



