# app/utils/auth.py
from jose import jwt, ExpiredSignatureError, JWTError
from fastapi import Depends, HTTPException, Header, status
from datetime import datetime, timedelta
from utils.database import users_collection, refresh_tokens_collection
import secrets
import hashlib

import os
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = os.environ.get("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 15)) # 15 phút (ngắn hơn để test refresh)
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", 30)) # 30 ngày

print(SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS)

# =========================
# Tạo JWT access token
# =========================
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    
    # Chuyển ObjectId hoặc UUID sang string nếu cần
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# =========================
# Tạo refresh token
# =========================
def create_refresh_token(user_email: str) -> str:
    """
    Tạo refresh token ngẫu nhiên và lưu vào database
    Returns: refresh token string
    """
    # Tạo token ngẫu nhiên an toàn
    token = secrets.token_urlsafe(32)
    
    # Hash token trước khi lưu vào database (bảo mật)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Thời gian hết hạn
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Lưu vào database
    refresh_tokens_collection.insert_one({
        "token_hash": token_hash,
        "user_email": user_email,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
        "is_revoked": False
    })
    
    return token


# =========================
# Xác thực refresh token
# =========================
def verify_refresh_token(token: str) -> dict:
    """
    Xác thực refresh token và trả về thông tin user
    Returns: dict với user_email nếu hợp lệ
    Raises: HTTPException nếu token không hợp lệ
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    try:
        # Hash token để so sánh
        token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
        
        # Tìm token trong database
        token_doc = refresh_tokens_collection.find_one({
            "token_hash": token_hash,
            "is_revoked": False
        })
        
        if not token_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        
        # Kiểm tra hết hạn
        if token_doc["expires_at"] < datetime.utcnow():
            # Xóa token hết hạn
            refresh_tokens_collection.delete_one({"_id": token_doc["_id"]})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        
        return {"user_email": token_doc["user_email"]}
        
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        print(f"Error verifying refresh token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# =========================
# Thu hồi refresh token
# =========================
def revoke_refresh_token(token: str):
    """
    Đánh dấu refresh token là đã thu hồi
    """
    try:
        if not token or not token.strip():
            return  # Silently ignore invalid tokens
            
        token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
        refresh_tokens_collection.update_one(
            {"token_hash": token_hash},
            {"$set": {"is_revoked": True}}
        )
    except Exception as e:
        print(f"Error revoking refresh token: {e}")
        # Don't raise exception, just log the error


# =========================
# Thu hồi tất cả refresh token của user
# =========================
def revoke_all_user_refresh_tokens(user_email: str):
    """
    Thu hồi tất cả refresh token của một user (khi đổi mật khẩu, logout, etc.)
    """
    refresh_tokens_collection.update_many(
        {"user_email": user_email, "is_revoked": False},
        {"$set": {"is_revoked": True}}
    )


# =========================
# Xác thực và giải mã token
# =========================
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")  # Thường là email
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# =========================
# Dependency của FastAPI
# =========================
def get_current_user(Authorization: str = Header(None)):
    if not Authorization or not Authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = Authorization.split(" ")[1]
    email = verify_token(token)
    user = users_collection.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user
