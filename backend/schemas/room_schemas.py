from pydantic import BaseModel, Field
from typing import Any, Optional


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


class RoomCreate(BaseModel):
    """Tạo phòng mới"""
    name: str = Field(..., description="Room name")
    description: Optional[str] = Field("", description="Room description")


class RoomUpdate(BaseModel):
    """Cập nhật phòng"""
    name: Optional[str] = None
    description: Optional[str] = None


class RoomControl(BaseModel):
    """Điều khiển theo phòng"""
    action: str = Field(..., description="Action: 'on' or 'off'")


class UpdateRoomName(BaseModel):
    """Schema để cập nhật tên phòng (legacy - giữ lại để tương thích)"""
    old_room_name: str = Field(..., description="Old room name")
    new_room_name: str = Field(..., description="New room name")


class DeleteRoom(BaseModel):
    """Schema để xóa phòng (legacy - giữ lại để tương thích)"""
    room_name: str = Field(..., description="Room name to delete")



