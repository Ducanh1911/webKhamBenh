from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://localhost/medibook"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = ""
    OPENAI_API_KEY: str = ""
    # MoMo sandbox: cấu hình bằng biến môi trường trên Render, không
    # commit key vào repo. Chưa cấu hình thì endpoint thanh toán trả 503.
    MOMO_PARTNER_CODE: str = ""
    MOMO_ACCESS_KEY: str = ""
    MOMO_SECRET_KEY: str = ""
    MOMO_CREATE_URL: str = "https://test-payment.momo.vn/v2/gateway/api/create"
    MOMO_QUERY_URL: str = "https://test-payment.momo.vn/v2/gateway/api/query"
    MOMO_IPN_URL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
