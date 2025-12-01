from pydantic import BaseModel, EmailStr, Field
from typing import Any, Optional
import uuid


# ======= Response chung =======
class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


# ======= Thông tin cơ bản user =======
class UserBase(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


# ======= Update Device =======
class UpdateDevice(BaseModel):
    """
    Schema để cập nhật thông tin thiết bị
    - device_id: ID của thiết bị (UUID) - bắt buộc
    - device_name: Tên thiết bị (tùy chọn)
    - device_password: Mật khẩu thiết bị (tùy chọn)
    - location: Vị trí/phòng của thiết bị (tùy chọn)
    - note: Ghi chú (tùy chọn)
    - status: Trạng thái thiết bị (tùy chọn)
    """
    device_id: str = Field(..., description="Device ID (UUID) - required")
    device_name: Optional[str] = Field(None, description="Device name")
    device_password: Optional[str] = Field(None, description="Device password")
    location: Optional[str] = Field(None, description="Device location/room")
    note: Optional[str] = Field(None, description="Device note")
    status: Optional[str] = Field(None, description="Device status (online/offline)")


# ======= Add Device =======
class AddDevice(BaseModel):
    """
    Schema để thêm thiết bị cho người dùng
    - device_serial: ID vật lý của thiết bị (serial number) - đây là ID mà người dùng nhập
    - password: Mật khẩu của thiết bị (nếu thiết bị có mật khẩu)
    """
    device_serial: str = Field(..., description="Device serial number (physical device ID)")
    password: Optional[str] = Field(None, description="Device password (if required)")


# ======= Device cơ bản =======
class Device(BaseModel):
    device_id: str
