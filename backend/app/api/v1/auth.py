from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, MeResponse, ChangePasswordRequest, ForgotPasswordRequest

router = APIRouter()

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    user = User(full_name=payload.full_name, email=payload.email,
                phone=payload.phone, hashed_password=hash_password(payload.password))
    db.add(user); db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)))

@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(
        id=user.id, full_name=user.full_name, email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Đổi mật khẩu của chính tài khoản đang đăng nhập (mọi role đều dùng được).

    Token hiện tại vẫn dùng được sau khi đổi (JWT không phụ thuộc mật khẩu),
    nên frontend không cần đăng xuất người dùng.
    """
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải khác mật khẩu hiện tại")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Đặt lại mật khẩu khi quên, không cần đăng nhập (form "Quên mật khẩu?"
    ở trang đăng nhập): nhập email đã đăng ký + mật khẩu mới là đổi được.

    Chưa có bước xác minh qua email (gửi mã/link cần cấu hình SMTP riêng,
    để dành cho hướng phát triển sau) — vì vậy tài khoản quản trị KHÔNG
    được đặt lại qua form công khai này, tránh người lạ chiếm quyền admin.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email chưa được đăng ký")
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role.lower() == UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản quản trị không đặt lại mật khẩu qua form này, vui lòng liên hệ quản trị hệ thống",
        )
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Đã đặt lại mật khẩu, mời đăng nhập bằng mật khẩu mới."}
