from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    display_name: str = Field(min_length=1, max_length=80)
    invite_code: str


class LoginCreate(BaseModel):
    email: str
    password: str


class ChangePasswordCreate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=256)


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    body_weight_kg: float | None = Field(default=None, gt=0, le=700)


class UserRead(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    body_weight_kg: float | None


class InviteCreate(BaseModel):
    expires_in_days: int = Field(default=7, ge=1, le=90)


class InviteRead(BaseModel):
    id: int
    expires_at: datetime
    used_at: datetime | None
    created_at: datetime


class InviteCreated(InviteRead):
    code: str


class AccountDelete(BaseModel):
    password: str
