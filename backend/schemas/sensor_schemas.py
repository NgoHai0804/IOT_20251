from pydantic import BaseModel, Field
from typing import Any, Optional


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


class SensorEnableControl(BaseModel):
    """Bật/tắt cảm biến"""
    enabled: bool = Field(..., description="Enable/disable sensor")


class SensorCreate(BaseModel):
    """Tạo cảm biến mới"""
    device_id: str = Field(..., description="Device ID")
    type: str = Field(..., description="Sensor type: temperature, humidity, gas, light, motion")
    name: str = Field(..., description="Sensor name")
    unit: str = Field(default="", description="Unit")
    pin: int = Field(default=0, description="GPIO pin")


class SensorUpdate(BaseModel):
    """Cập nhật cảm biến"""
    name: Optional[str] = None
    type: Optional[str] = None  # temperature, humidity, energy
    pin: Optional[int] = None


class SensorThresholdUpdate(BaseModel):
    """Cập nhật ngưỡng cảm biến"""
    min_threshold: Optional[float] = Field(None, description="Ngưỡng dưới (null để xóa)")
    max_threshold: Optional[float] = Field(None, description="Ngưỡng trên (null để xóa)")
