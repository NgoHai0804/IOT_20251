from pydantic import BaseModel, Field
from typing import Any, Optional


# ======= Response chung =======
class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


# ======= Register Device (cho IoT device) =======
class IoTRegisterDevice(BaseModel):
    """
    Schema để thiết bị IoT đăng ký với server
    - device_id: ID của thiết bị (bắt buộc) - device tự tạo và gửi lên, dùng làm identifier duy nhất
    - device_name: Tên thiết bị (bắt buộc)
    - device_type: Loại thiết bị (bắt buộc)
    - device_password: Mật khẩu thiết bị (tùy chọn, để bảo mật)
    - location: Vị trí/phòng (tùy chọn)
    - note: Ghi chú (tùy chọn)
    """
    device_id: str = Field(..., description="Device ID - required, device tự tạo và gửi lên, dùng làm identifier duy nhất")
    device_name: str = Field(..., description="Device name - required")
    device_type: str = Field(..., description="Device type - required")
    device_password: Optional[str] = Field(None, description="Device password - optional")
    location: Optional[str] = Field(None, description="Device location/room - optional")
    note: Optional[str] = Field(None, description="Device note - optional")


# ======= Add Sensor (cho IoT device) =======
class IoTAddSensor(BaseModel):
    """
    Schema để thiết bị IoT thêm sensor
    - sensor_id: ID của sensor (bắt buộc) - có thể là ID từ thiết bị
    - name: Tên sensor (bắt buộc)
    - sensor_type: Loại sensor (bắt buộc) - temperature, humidity, light, motion, energy
    - note: Ghi chú (tùy chọn)
    """
    sensor_id: str = Field(..., description="Sensor ID - required")
    name: str = Field(..., description="Sensor name - required")
    sensor_type: str = Field(..., description="Sensor type (temperature, humidity, light, motion, energy) - required")
    note: Optional[str] = Field(None, description="Sensor note - optional")


# ======= Device ID =======
class DeviceID(BaseModel):
    device_id: str = Field(..., description="Device ID")
