from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from utils.database import users_collection
from models.user_models import create_user_dict
from utils.auth import create_access_token, create_refresh_token, revoke_all_user_refresh_tokens
import bcrypt


# ==========================
# Đăng ký
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

        # Tạo user
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
# Đăng nhập --> JWT
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

        # Kiểm tra password
        if not bcrypt.checkpw(
            user_data.password.encode("utf-8"),
            user["password_hash"].encode("utf-8")
        ):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": False, "message": "Invalid email or password", "data": None}
            )

        # Tạo access token và refresh token
        access_token = create_access_token({"sub": user["email"]})
        refresh_token = create_refresh_token(user["email"])

        # Convert dữ liệu user để trả về
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=jsonable_encoder({
                "status": True,
                "message": "Login successful",
                "data": {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
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
# Thông tin
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
# Đăng xuất
# ==========================
def logout_user(current_user=None, refresh_token: str = None):
    try:
        # Nếu có refresh token, thu hồi nó
        if refresh_token:
            from utils.auth import revoke_refresh_token
            try:
                revoke_refresh_token(refresh_token)
            except:
                pass  # Ignore nếu token không hợp lệ
        
        # Nếu có current_user, thu hồi tất cả refresh token của user
        if current_user and "email" in current_user:
            revoke_all_user_refresh_tokens(current_user["email"])
        
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
# Refresh access token
# ==========================
def refresh_access_token(refresh_token: str):
    try:
        from utils.auth import verify_refresh_token, create_access_token, create_refresh_token
        
        # Xác thực refresh token
        token_info = verify_refresh_token(refresh_token)
        user_email = token_info["user_email"]
        
        # Kiểm tra user tồn tại
        user = users_collection.find_one({"email": user_email})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": False,
                    "message": "User not found",
                    "data": None
                }
            )
        
        # Tạo access token mới
        new_access_token = create_access_token({"sub": user_email})
        
        # Tạo refresh token mới (token rotation - tăng cường bảo mật)
        new_refresh_token = create_refresh_token(user_email)
        
        # Thu hồi refresh token cũ
        from utils.auth import revoke_refresh_token
        revoke_refresh_token(refresh_token)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=jsonable_encoder({
                "status": True,
                "message": "Token refreshed successfully",
                "data": {
                    "access_token": new_access_token,
                    "refresh_token": new_refresh_token
                }
            })
        )
        
    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={
                "status": False,
                "message": e.detail,
                "data": None
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
# Cập nhật thông tin
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
