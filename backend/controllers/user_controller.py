from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from utils.database import users_collection
from models.user_models import create_user_dict
from utils.auth import create_access_token
import bcrypt


# ==========================
# Register
# ==========================
def register_user(user_data):
    try:
        if not (8 <= len(user_data.password) <= 30):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Password must be between 8 and 30 characters",
                    "data": None
                }
            )

        if users_collection.find_one({"email": user_data.email}):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": False,
                    "message": "Email already exists",
                    "data": None
                }
            )

        # Create user
        hashed_pw = bcrypt.hashpw(
            user_data.password.encode(), bcrypt.gensalt()
        ).decode()

        new_user = create_user_dict(
            full_name=user_data.full_name,
            email=user_data.email,
            password_hash=hashed_pw,
            phone=user_data.phone
        )

        result = users_collection.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        new_user.pop("password_hash", None)

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": True,
                "message": "User registered successfully",
                "data": new_user
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Login --> JWT
# ==========================
def login_user(user_data):
    try:
        # Kiểm tra độ dài password
        if not (8 <= len(user_data.password) <= 30):
            return JSONResponse(
                status_code=status.HTTP_401_BAD_REQUEST,
                content={"status": False, "message": "Invalid email or password", "data": None}
            )

        # Kiểm tra email tồn tại
        user = users_collection.find_one({"email": user_data.email})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": False, "message": "Invalid email or password", "data": None}
            )

        # Check password
        if not bcrypt.checkpw(
            user_data.password.encode("utf-8"),
            user["password_hash"].encode("utf-8")
        ):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": False, "message": "Invalid email or password", "data": None}
            )

        # Tạo JWT
        token = create_access_token({"sub": user["email"]})

        # Convert dữ liệu user để trả về
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=jsonable_encoder({
                "status": True,
                "message": "Login successful",
                "data": {
                    "token": token,
                    "user": user
                }
            })
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Info
# ==========================
def info_user(current_user):
    try:
        # current_user là dict trả từ get_current_user, đảm bảo đã valid
        if not current_user or "email" not in current_user:
            return JSONResponse(
                status_code=401,
                content={
                    "status": False,
                    "message": "Invalid user",
                    "data": None
                }
            )

        user = users_collection.find_one({"email": current_user["email"]})
        print(user)
        if not user:
            return JSONResponse(
                status_code=404,
                content={
                    "status": False,
                    "message": "User not found",
                    "data": None
                }
            )

        # Chuyển ObjectId sang string và loại bỏ password
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)

        return JSONResponse(
            status_code=200,
            content=jsonable_encoder({
                "status": True,
                "message": "User info retrieved successfully",
                "data": user
            })
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Logout
# ==========================
def logout_user(current_user=None):
    try:
        return JSONResponse(
            status_code=200,
            content={
                "status": True,
                "message": "User logged out successfully",
                "data": None
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )


# ==========================
# Update info
# ==========================
def change_user_info(payload, current_user):
    try:
        email = current_user["email"]

        update_data = {}
        if payload.full_name:
            update_data["full_name"] = payload.full_name
        if payload.phone:
            update_data["phone"] = payload.phone

        if not update_data:
            return JSONResponse(
                status_code=400,
                content={
                    "status": False,
                    "message": "No fields to update",
                    "data": None
                }
            )

        users_collection.update_one({"email": email}, {"$set": update_data})
        updated_user = users_collection.find_one({"email": email})

        updated_user["_id"] = str(updated_user["_id"])
        updated_user.pop("password_hash", None)

        return JSONResponse(
            status_code=200,
            content=jsonable_encoder({
                "status": True,
                "message": "User information updated successfully",
                "data": updated_user
            })
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": False,
                "message": f"Unexpected error: {str(e)}",
                "data": None
            }
        )
