from pymongo import MongoClient
from datetime import datetime
from typing import Any, Dict
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "iot_app")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

users_collection = db["users"]
rooms_collection = db["rooms"]
devices_collection = db["devices"]
user_room_devices_collection = db["user_room_devices"]
sensors_collection = db["sensors"]
actuators_collection = db["actuators"]
sensor_data_collection = db["sensor_data"]
notifications_collection = db["notifications"]
refresh_tokens_collection = db["refresh_tokens"]

try:
    user_room_devices_collection.create_index([("user_id", 1), ("room_id", 1), ("device_id", 1)], unique=True)
    user_room_devices_collection.create_index([("user_id", 1)])
    user_room_devices_collection.create_index([("room_id", 1)])
    user_room_devices_collection.create_index([("device_id", 1)])
except Exception as e:
    pass

try:
    refresh_tokens_collection.create_index([("token_hash", 1)], unique=True)
    refresh_tokens_collection.create_index([("user_email", 1)])
    refresh_tokens_collection.create_index([("expires_at", 1)], expireAfterSeconds=0)
except Exception as e:
    pass


def sanitize_for_json(obj: Any) -> Any:
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
