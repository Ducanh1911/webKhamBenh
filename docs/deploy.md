# Deploy — MediBook AI

Thứ tự: **Neon → Render → Vercel**. Làm xong bước trước mới làm bước sau,
vì Render cần `DATABASE_URL`, Vercel cần URL của Render.

## 1. Neon Postgres (database)

1. Tạo project trên Neon, database tên `medibook`.
2. Copy connection string dạng pooled, có `?sslmode=require`.
   Ví dụ: `postgresql://user:pass@ep-xxx-pooler.neon.tech/medibook?sslmode=require`
3. Tạo branch `dev` trên Neon để test, branch `main` cho production.
4. Tạo bảng lần đầu (chạy local, trỏ `DATABASE_URL` sang Neon):
   ```bash
   cd backend
   python scripts/init_db.py
   ```

## 2. Render (backend FastAPI)

Dùng Blueprint với file `render.yaml` ở repo root, hoặc tạo tay:

- **Service:** Web Service, Python, plan Free
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`

Env vars trên Render:

| Key | Giá trị |
| --- | --- |
| `DATABASE_URL` | Connection string Neon (pooled, `sslmode=require`) |
| `SECRET_KEY` | Render generate, hoặc chuỗi ngẫu nhiên dài |
| `FRONTEND_URL` | URL Vercel sau bước 3, ví dụ `https://web-kham-benh.vercel.app` |
| `OPENAI_API_KEY` | Để trống nếu chưa dùng AI triage |

Kiểm tra sau deploy:
```bash
curl https://medibook-ai-api.onrender.com/health
# {"status":"ok","service":"medibook-ai"}
curl https://medibook-ai-api.onrender.com/docs
```

Lưu ý Render Free: service ngủ sau 15 phút không có traffic, request đầu
tiên sau đó sẽ chậm ~30-60 giây. Đây là giới hạn của gói Free, không phải lỗi code.

## 3. Vercel (frontend React)

1. Import repo `Ducanh1911/webKhamBenh` trên Vercel.
2. **Root Directory:** `frontend`
3. Framework Preset: Vite. Build Command `npm run build`, Output `dist` (mặc định).
4. Env var:
   - `VITE_API_URL` = URL Render ở bước 2, ví dụ `https://medibook-ai-api.onrender.com`
5. Deploy, mở domain Vercel và test đăng nhập.

## 4. Checklist trước khi báo xong

- [ ] `/health` trên Render trả `{"status":"ok"}`
- [ ] Frontend load được, form đăng nhập hiển thị đúng tông teal/trắng
- [ ] Đăng ký tài khoản mới → đăng nhập được (ghi log lỗi nếu 500: kiểm tra `DATABASE_URL` và bảng đã tạo chưa)
- [ ] CORS: `FRONTEND_URL` trên Render phải khớp đúng domain Vercel, không có `/` ở cuối
- [ ] Không commit file `.env` thật lên repo

## Rollback

- Render / Vercel đều có nút Redeploy commit cũ trong dashboard.
- Neon: dùng branch hoặc Point-in-Time Recovery, không sửa trực tiếp dữ liệu production bằng tay.
