from pydantic import BaseModel, EmailStr, Field
from typing import Any, Optional
import uuid


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


class UserBase(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class UpdateDevice(BaseModel):
    """
    Schema để cập nhật thông tin thiết bị
    - device_id: ID của thiết bị (UUID) - bắt buộc
    - device_name: Tên thiết bị (tùy chọn)
    - device_password: Mật khẩu thiết bị (tùy chọn)
    - location: Vị trí/phòng của thiết bị (tùy chọn)
    - note: Ghi chú (tùy chọn)
    - status: Trạng thái thiết bị (tùy chọn)
    - cloud_status: Trạng thái cloud (on/off) - điều khiển từ server (tùy chọn)
    """
    device_id: str = Field(..., description="Device ID (UUID) - required")
    device_name: Optional[str] = Field(None, description="Device name")
    device_password: Optional[str] = Field(None, description="Device password")
    location: Optional[str] = Field(None, description="Device location/room")
    note: Optional[str] = Field(None, description="Device note")
    status: Optional[str] = Field(None, description="Device status (online/offline)")
    cloud_status: Optional[str] = Field(None, description="Cloud status (on/off) - control from server")


class AddDevice(BaseModel):
    """
    Schema để thêm thiết bị cho người dùng
    - device_id: ID của thiết bị (bắt buộc) - dùng để tìm thiết bị trong hệ thống
    - device_password: Mật khẩu thiết bị (tùy chọn) - để trống nếu thiết bị không có mật khẩu
    - device_name: Tên thiết bị (bắt buộc)
    - location: Phòng/vị trí thiết bị (bắt buộc)
    - note: Ghi chú (tùy chọn)
    """
    device_id: str = Field(..., description="Device ID - required, dùng để tìm thiết bị trong hệ thống")
    device_password: Optional[str] = Field(None, description="Device password - optional, leave empty if device has no password")
    device_name: str = Field(..., description="Device name - required")
    location: str = Field(..., description="Device location/room - required")
    note: Optional[str] = Field(None, description="Device note - optional")


class Device(BaseModel):
    device_id: str
