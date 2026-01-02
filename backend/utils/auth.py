from jose import jwt, ExpiredSignatureError, JWTError
from fastapi import Depends, HTTPException, Header, status
from datetime import datetime, timedelta
from utils.database import users_collection, refresh_tokens_collection
from utils.timezone import get_vietnam_now_naive
import secrets
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = os.environ.get("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", 30))


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = get_vietnam_now_naive() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    import pytz
    vietnam_tz = pytz.timezone('Asia/Ho_Chi_Minh')
    expire_utc = vietnam_tz.localize(expire).astimezone(pytz.UTC)
    to_encode.update({"exp": expire_utc})
    
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_email: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = get_vietnam_now_naive() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    refresh_tokens_collection.insert_one({
        "token_hash": token_hash,
        "user_email": user_email,
        "created_at": get_vietnam_now_naive(),
        "expires_at": expires_at,
        "is_revoked": False
    })
    
    return token


def verify_refresh_token(token: str) -> dict:
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        )
    
    try:
        token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
        
        token_doc = refresh_tokens_collection.find_one({
            "token_hash": token_hash,
            "is_revoked": False
        })
        
        if not token_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ",
            )
        
        if token_doc["expires_at"] < get_vietnam_now_naive():
            refresh_tokens_collection.delete_one({"_id": token_doc["_id"]})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ",
            )
        
        return {"user_email": token_doc["user_email"]}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Lỗi xác thực refresh token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        )


def revoke_refresh_token(token: str):
    try:
        if not token or not token.strip():
            return
            
        token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
        refresh_tokens_collection.update_one(
            {"token_hash": token_hash},
            {"$set": {"is_revoked": True}}
        )
    except Exception as e:
        print(f"Lỗi thu hồi refresh token: {e}")


def revoke_all_user_refresh_tokens(user_email: str):
    refresh_tokens_collection.update_many(
        {"user_email": user_email, "is_revoked": False},
        {"$set": {"is_revoked": True}}
    )


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(Authorization: str = Header(None)):
    if not Authorization or not Authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu hoặc sai header Authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = Authorization.split(" ")[1]
    email = verify_token(token)
    user = users_collection.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    return user
