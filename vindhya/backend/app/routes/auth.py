from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db, User
from app.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = "Student"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


@router.post("/signup", response_model=AuthResponse)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id, user.email)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "xp_points": user.xp_points,
            "streak_days": user.streak_days,
        }
    }


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "xp_points": current_user.xp_points,
        "streak_days": current_user.streak_days,
        "low_bandwidth_mode": current_user.low_bandwidth_mode,
    }


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    low_bandwidth_mode: Optional[bool] = None


@router.patch("/me")
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.name is not None:
        current_user.name = data.name
    if data.low_bandwidth_mode is not None:
        current_user.low_bandwidth_mode = data.low_bandwidth_mode
    await db.commit()
    return {"id": current_user.id, "name": current_user.name, "low_bandwidth_mode": current_user.low_bandwidth_mode}
