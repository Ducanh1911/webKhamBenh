from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.user import User, UserRole

bearer = HTTPBearer(auto_error=False)

def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chưa đăng nhập")
    try:
        payload = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub") or 0)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Không tìm thấy người dùng")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Chỉ tài khoản có role admin mới qua được. Tài khoản thường -> 403."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cần quyền quản trị")
    return user


def get_current_non_admin(user: User = Depends(get_current_user)) -> User:
    """Tách biệt quản trị và bệnh nhân: admin không dùng luồng đặt lịch của bệnh nhân -> 403.

    Admin chỉ quản lý lịch qua API /admin, nên các endpoint đặt/xem/hủy lịch
    của chính mình đều chặn admin ở đây, không chỉ ẩn nút ở frontend.
    """
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản quản trị chỉ dùng trang Quản trị")
    return user


def _role_str(user: User) -> str:
    """Role dạng chuỗi, chịu được cả enum lẫn chuỗi thô trong DB."""
    role = user.role
    return role.value if hasattr(role, "value") else str(role)


def get_current_doctor(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Doctor:
    """Chỉ tài khoản role bác sĩ mới qua được; trả về hồ sơ Doctor của họ.

    So sánh role không phân biệt hoa/thường (giống list_users ở admin.py):
    trong DB còn sót role lưu dạng chữ hoa từ đợt sửa constraint trước đây.
    Tài khoản doctor nhưng chưa có hồ sơ Doctor (vd: đổi role từ bệnh nhân
    lên bác sĩ qua trang Quản trị) -> 404, không trả lịch của ai khác.
    """
    if _role_str(user).lower() != UserRole.DOCTOR.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cần quyền bác sĩ")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tài khoản bác sĩ chưa có hồ sơ")
    return doctor
