# actuator_models.py
from datetime import datetime
import uuid


def create_actuator_dict(device_id: str, actuator_type: str, name: str, pin: int = 0, state: bool = False, enabled: bool = True) -> dict:
    """
    Tạo dict Actuator
    {
      "_id": "act_01",
      "device_id": "device_01",
      "type": "relay",
      "name": "Đèn trần",
      "pin": 23,
      "state": false,
      "enabled": true
    }
    """
    return {
        "_id": f"act_{str(uuid.uuid4())[:8]}",  # act_01, act_02...
        "device_id": device_id,
        "type": actuator_type,  # relay, motor, led, etc.
        "name": name,
        "pin": pin,
        "state": state,
        "enabled": enabled,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
