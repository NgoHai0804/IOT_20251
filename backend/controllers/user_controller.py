from fastapi import HTTPException, status
from utils.database import users_collection
from models.user_models import create_user_dict
from utils.auth import create_access_token
import bcrypt

# ==========================
# Register
# ==========================
def register_user(user_data):
    try:
        # Kiểm tra pw
        if not (8 <= len(user_data.password) <= 30):
            return {
                "status": False,
                "message": "Password must be between 8 and 30 characters",
                "data": None
            }

        if users_collection.find_one({"email": user_data.email}):
            return {
                "status": False,
                "message": "Email already exists",
                "data": None
            }

        hashed_pw = bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        new_user = create_user_dict(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hashed_pw,
            phone=user_data.phone
        )

        result = users_collection.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        new_user.pop("password_hash", None)

        return {
            "status": True,
            "message": "User registered successfully",
            "data": new_user
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# Login --> Trả về JWT
# ==========================
def login_user(user_data):
    try:
        # Kiểm tra pw
        if not (8 <= len(user_data.password) <= 30):
            return {
                "status": False,
                "message": "Invalid email or password",
                "data": None
            }

        # Tìm tài khoản
        user = users_collection.find_one({"email": user_data.email})
        if not user:
            return {
                "status": False,
                "message": "Invalid email or password",
                "data": None
            }

        # Check pw -> True
        if not bcrypt.checkpw(user_data.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
            return {
                "status": False,
                "message": "Invalid email or password",
                "data": None
            }

        print(1)
        token = create_access_token({"sub": user["email"]})
        print(token)
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)

        return {
            "status": True,
            "message": "Login successful",
            "data": {"token": token, "user": user}
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# Info
# ==========================
def info_user(current_user):
    try:
        user = users_collection.find_one({"email": current_user["email"]})
        if not user:
            return {
                "status": False,
                "message": "User not found",
                "data": None
            }

        # Convert ObjectId sang string
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)

        return {
            "status": True,
            "message": "User info retrieved successfully",
            "data": {"user": user}
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# Logout
# ==========================
def logout_user(current_user=None):
    """Đăng xuất (frontend chỉ cần xóa token)"""
    try:
        return {
            "status": True,
            "message": "User logged out successfully",
            "data": None
        }
    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }


# ==========================
# Update info
# ==========================
def change_user_info(payload, current_user):
    """Cập nhật thông tin người dùng hiện tại"""
    try:
        email = current_user["email"]

        update_data = {}
        if payload.full_name:
            update_data["full_name"] = payload.full_name
        if payload.phone:
            update_data["phone"] = payload.phone

        if not update_data:
            return {
                "status": False,
                "message": "No fields to update",
                "data": None
            }

        users_collection.update_one({"email": email}, {"$set": update_data})
        updated_user = users_collection.find_one({"email": email})
        updated_user["_id"] = str(updated_user["_id"])
        updated_user.pop("password_hash", None)

        return {
            "status": True,
            "message": "User information updated successfully",
            "data": updated_user
        }

    except Exception as e:
        return {
            "status": False,
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }
