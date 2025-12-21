# sensor_models.py
from datetime import datetime
import uuid


def get_default_thresholds(sensor_type: str) -> tuple[float | None, float | None]:
    """
    Trả về ngưỡng mặc định dựa trên loại sensor
    Returns: (min_threshold, max_threshold)
    """
    defaults = {
        "temperature": (10.0, 40.0),  # Nhiệt độ: 10-40°C
        "humidity": (30.0, 80.0),      # Độ ẩm: 30-80%
        "gas": (None, 100.0),          # Khí gas: dưới 100 ppm
        "light": (None, 1000.0),       # Ánh sáng: dưới 1000 lux
        "motion": (None, None),        # Motion: không có ngưỡng
    }
    return defaults.get(sensor_type.lower(), (None, None))


def create_sensor_dict(device_id: str, sensor_type: str, name: str, unit: str = "", pin: int = 0, enabled: bool = True, min_threshold: float = None, max_threshold: float = None, auto_set_threshold: bool = True) -> dict:
    """
    Tạo dict Sensor
    {
      "_id": "sensor_01",
      "device_id": "device_01",
      "type": "temperature",
      "name": "Nhiệt độ",
      "unit": "°C",
      "pin": 4,
      "enabled": true,
      "min_threshold": 10.0,  # Ngưỡng dưới (tùy chọn)
      "max_threshold": 50.0   # Ngưỡng trên (tùy chọn)
    }
    """
    sensor_dict = {
        "_id": f"sensor_{str(uuid.uuid4())[:8]}",  # sensor_01, sensor_02...
        "device_id": device_id,
        "type": sensor_type,  # temperature, humidity, gas, light, motion
        "name": name,
        "unit": unit,
        "pin": pin,
        "enabled": enabled,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Tự động set ngưỡng mặc định nếu chưa có và auto_set_threshold = True
    if auto_set_threshold and min_threshold is None and max_threshold is None:
        default_min, default_max = get_default_thresholds(sensor_type)
        if default_min is not None:
            sensor_dict["min_threshold"] = default_min
        if default_max is not None:
            sensor_dict["max_threshold"] = default_max
    else:
        # Sử dụng giá trị được truyền vào
        if min_threshold is not None:
            sensor_dict["min_threshold"] = min_threshold
        if max_threshold is not None:
            sensor_dict["max_threshold"] = max_threshold
    
    return sensor_dict
