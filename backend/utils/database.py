from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "iot_app"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
users_collection = db["users"]
