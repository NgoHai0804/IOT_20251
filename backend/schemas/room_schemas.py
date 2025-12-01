from pydantic import BaseModel, Field
from typing import Any, Optional


# ======= Response chung =======
class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


# ======= Update Room Name =======
class UpdateRoomName(BaseModel):
    """
    Schema để cập nhật tên phòng
    - old_room_name: Tên phòng cũ
    - new_room_name: Tên phòng mới
    """
    old_room_name: str = Field(..., description="Old room name")
    new_room_name: str = Field(..., description="New room name")


# ======= Delete Room =======
class DeleteRoom(BaseModel):
    """
    Schema để xóa phòng
    - room_name: Tên phòng cần xóa
    """
    room_name: str = Field(..., description="Room name to delete")

