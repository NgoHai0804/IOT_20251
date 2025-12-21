from pydantic import BaseModel, Field
from typing import Any, Optional


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


class ActuatorControl(BaseModel):
    """Điều khiển actuator"""
    state: bool = Field(..., description="Actuator state (on/off)")


class ActuatorCreate(BaseModel):
    """Tạo actuator mới"""
    device_id: str = Field(..., description="Device ID")
    type: str = Field(..., description="Actuator type: relay, motor, led, etc.")
    name: str = Field(..., description="Actuator name")
    pin: int = Field(default=0, description="GPIO pin")


class ActuatorUpdate(BaseModel):
    """Cập nhật actuator"""
    name: Optional[str] = None
    pin: Optional[int] = None
    enabled: Optional[bool] = None
