from fastapi import APIRouter
from controllers import iot_device_controller
from schemas.iot_device_schemas import *

router = APIRouter(prefix="/iot/device", tags=["IoT Device"])


@router.post("/register", response_model=ResponseSchema)
async def register_device_route(payload: IoTRegisterDevice):
    """
    API đăng ký thiết bị IoT với server
    - device_serial: Serial number của thiết bị
    - device_name: Tên thiết bị
    - device_type: Loại thiết bị
    - device_password: Mật khẩu thiết bị (tùy chọn)
    - location: Vị trí/phòng (tùy chọn)
    - note: Ghi chú (tùy chọn)
    
    Trả về device_id để thiết bị sử dụng cho các API khác
    """
    return iot_device_controller.register_device(
        device_serial=payload.device_serial,
        device_name=payload.device_name,
        device_type=payload.device_type,
        device_password=payload.device_password,
        location=payload.location,
        note=payload.note
    )


@router.post("/{device_id}/sensor/add", response_model=ResponseSchema)
async def add_sensor_route(device_id: str, payload: IoTAddSensor):
    """
    API thêm sensor cho thiết bị IoT
    - device_id: ID của thiết bị (từ URL)
    - sensor_id: ID của sensor
    - name: Tên sensor
    - sensor_type: Loại sensor (temperature, humidity, light, motion, energy)
    - note: Ghi chú (tùy chọn)
    """
    return iot_device_controller.add_sensor(
        device_id=device_id,
        sensor_id=payload.sensor_id,
        name=payload.name,
        sensor_type=payload.sensor_type,
        note=payload.note
    )


@router.get("/{device_id}/status", response_model=ResponseSchema)
async def get_device_status_route(device_id: str):
    """
    API lấy trạng thái và lệnh điều khiển từ server cho thiết bị IoT
    - device_id: ID của thiết bị (từ URL)
    
    Trả về:
    - cloud_status: Trạng thái cloud (on/off)
    - commands: Danh sách lệnh điều khiển nếu có
    - device_status: Trạng thái thiết bị (online/offline)
    
    Khi gọi API này, trạng thái device sẽ được cập nhật thành "online"
    """
    return iot_device_controller.get_device_status(device_id)
