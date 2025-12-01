from pydantic import BaseModel, Field
from typing import Any, Optional, List
from datetime import datetime


# ======= Response chung =======
class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None


# ======= Sensor Data Response =======
class SensorDataItem(BaseModel):
    sensor_data_id: str
    sensor_id: str
    device_id: str
    sensor_type: str
    value: float
    extra: Optional[dict] = {}
    note: Optional[str] = ""
    timestamp: str
    created_at: str


# ======= Get Sensor Data Request =======
class GetSensorDataRequest(BaseModel):
    device_id: Optional[str] = None
    sensor_id: Optional[str] = None
    sensor_type: Optional[str] = None
    limit: Optional[int] = Field(default=100, ge=1, le=1000)
    start_time: Optional[str] = None  # ISO format datetime
    end_time: Optional[str] = None    # ISO format datetime

