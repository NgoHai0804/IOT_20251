from pymongo import MongoClient
from datetime import datetime
from typing import Any, Dict

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "iot_app"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
devices_collection = db["devices"]
user_devices_collection = db["user_devices"]
sensors_collection = db["sensors"]
sensor_data_collection = db["sensor_data"]


def sanitize_for_json(obj: Any) -> Any:
    """Convert MongoDB objects to JSON serializable format"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, '__dict__'):
        return {k: sanitize_for_json(v) for k, v in obj.__dict__.items()}
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif hasattr(obj, '__str__') and not isinstance(obj, (str, int, float, bool, type(None))):
        return str(obj)
    return obj
