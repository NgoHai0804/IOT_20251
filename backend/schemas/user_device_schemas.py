# app/schemas/user_schemas.py
from pydantic import BaseModel, EmailStr
from typing import Any, Optional


class ResponseSchema(BaseModel):
    status: bool
    message: str
    data: Optional[Any] = None

class UserBase(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class UpdateDevice(UserBase):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""

class AddDevice(BaseModel):
    device_id: str
    password: str

class Device(BaseModel):
    device_id: str
