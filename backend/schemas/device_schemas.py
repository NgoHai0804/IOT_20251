from pydantic import BaseModel, Field
from typing import Any, Optional


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


class DevicePowerControl(BaseModel):
    """Bật/tắt thiết bị"""
    enabled: bool = Field(..., description="Enable/disable device")


class DeviceCreate(BaseModel):
    """Tạo thiết bị mới"""
    name: str = Field(..., description="Device name")
    room_id: str = Field(..., description="Room ID")
    type: str = Field(default="esp32", description="Device type")
    ip: Optional[str] = Field(None, description="Device IP address")


class DeviceUpdate(BaseModel):
    """Cập nhật thiết bị"""
    name: Optional[str] = None
    room_id: Optional[str] = None
    type: Optional[str] = None
    ip: Optional[str] = None
    status: Optional[str] = None
