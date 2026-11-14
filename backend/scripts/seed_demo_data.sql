-- Seed demo data cho MediBook AI — 15/11/2026
-- Chạy trong Neon SQL Editor, database medibook, branch production.
-- Idempotent: chạy lại không tạo trùng (ON CONFLICT / NOT EXISTS).
-- Mật khẩu mặc định của tất cả tài khoản mới: 123456 (đã băm bcrypt).

-- 1. Thêm 6 chuyên khoa mới (đã có 6: Nội tổng quát, Nhi khoa, Răng hàm mặt, Tim mạch, Da liễu, Mắt)
INSERT INTO specialties (name, description) VALUES
('Tai Mũi Họng', 'Khám và điều trị các bệnh về tai, mũi, họng.'),
('Thần kinh', 'Khám và điều trị các bệnh về hệ thần kinh.'),
('Tiêu hóa', 'Khám và điều trị các bệnh về đường tiêu hóa.'),
('Cơ xương khớp', 'Khám và điều trị các bệnh về cơ, xương, khớp.'),
('Sản phụ khoa', 'Chăm sóc sức khỏe sinh sản và thai kỳ.'),
('Hô hấp', 'Khám và điều trị các bệnh về đường hô hấp.')
ON CONFLICT (name) DO NOTHING;

-- 2. Thêm 10 tài khoản bác sĩ mới (mật khẩu: 123456)
INSERT INTO users (full_name, email, phone, hashed_password, role) VALUES
('BS. Đỗ Thanh Hương', 'bs.huong@medibook.vn', '0901000011', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Ngô Quang Huy', 'bs.huy@medibook.vn', '0901000012', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Bùi Thị Lan', 'bs.lan@medibook.vn', '0901000013', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Trần Quốc Bảo', 'bs.bao@medibook.vn', '0901000014', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Phạm Thu Trang', 'bs.trang@medibook.vn', '0901000015', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Lê Hoàng Nam', 'bs.nam@medibook.vn', '0901000016', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Nguyễn Minh Tuấn', 'bs.tuan@medibook.vn', '0901000017', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Vũ Thị Ngọc', 'bs.ngoc@medibook.vn', '0901000018', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Hoàng Văn Sơn', 'bs.son@medibook.vn', '0901000019', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR'),
('BS. Đặng Thu Hằng', 'bs.hang@medibook.vn', '0901000020', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'DOCTOR')
ON CONFLICT (email) DO NOTHING;

-- 3. Hồ sơ bác sĩ cho 10 tài khoản trên (nối theo email + tên chuyên khoa, không phụ thuộc id)
INSERT INTO doctors (user_id, specialty_id, clinic_name, years_experience, consultation_fee, bio)
SELECT u.id, s.id, 'Phòng khám MediBook', v.exp, v.fee, v.bio
FROM (VALUES
  ('bs.huong@medibook.vn', 'Tai Mũi Họng', 9, 220000, 'Bác sĩ tai mũi họng, nhiều kinh nghiệm khám trẻ em và người lớn.'),
  ('bs.huy@medibook.vn', 'Thần kinh', 12, 300000, 'Bác sĩ thần kinh, chuyên khám đau đầu, chóng mặt và rối loạn giấc ngủ.'),
  ('bs.lan@medibook.vn', 'Tiêu hóa', 10, 250000, 'Bác sĩ tiêu hóa, chuyên khám dạ dày, đại tràng và gan mật.'),
  ('bs.bao@medibook.vn', 'Cơ xương khớp', 15, 320000, 'Bác sĩ cơ xương khớp, chuyên khám thoái hóa khớp và chấn thương thể thao.'),
  ('bs.trang@medibook.vn', 'Sản phụ khoa', 8, 280000, 'Bác sĩ sản phụ khoa, chuyên theo dõi thai kỳ và khám phụ khoa.'),
  ('bs.nam@medibook.vn', 'Hô hấp', 11, 260000, 'Bác sĩ hô hấp, chuyên khám hen suyễn, viêm phổi và bệnh phổi tắc nghẽn.'),
  ('bs.tuan@medibook.vn', 'Tim mạch', 14, 350000, 'Bác sĩ tim mạch, chuyên khám tăng huyết áp và bệnh mạch vành.'),
  ('bs.ngoc@medibook.vn', 'Da liễu', 7, 200000, 'Bác sĩ da liễu, chuyên khám mụn, viêm da và chăm sóc da.'),
  ('bs.son@medibook.vn', 'Mắt', 13, 300000, 'Bác sĩ mắt, chuyên khám tật khúc xạ và bệnh võng mạc.'),
  ('bs.hang@medibook.vn', 'Nội tổng quát', 6, 180000, 'Bác sĩ nội tổng quát, khám sức khỏe tổng quát cho người lớn.')
) AS v(email, spec, exp, fee, bio)
JOIN users u ON u.email = v.email
JOIN specialties s ON s.name = v.spec
WHERE NOT EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = u.id);

-- 4. Thêm 10 tài khoản bệnh nhân mới (mật khẩu: 123456)
INSERT INTO users (full_name, email, phone, hashed_password, role) VALUES
('Nguyễn Thị Mai', 'bn.mai@medibook.vn', '0912000011', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Trần Văn Đức', 'bn.duc@medibook.vn', '0912000012', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Lê Thị Hoa', 'bn.hoa@medibook.vn', '0912000013', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Phạm Minh Khôi', 'bn.khoi@medibook.vn', '0912000014', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Hoàng Anh Thư', 'bn.thu@medibook.vn', '0912000015', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Vũ Quốc Anh', 'bn.quocanh@medibook.vn', '0912000016', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Đỗ Phương Linh', 'bn.linh@medibook.vn', '0912000017', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Ngô Đình Thắng', 'bn.thang@medibook.vn', '0912000018', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Bùi Khánh Vy', 'bn.vy@medibook.vn', '0912000019', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT'),
('Đinh Văn Hậu', 'bn.hau@medibook.vn', '0912000020', '$2b$12$Quss4pVVu3j7aYsmN02oq.NhKdh6NE/i7d9.Ecb70.HxxwzHYGuJO', 'PATIENT')
ON CONFLICT (email) DO NOTHING;

-- 5. Kiểm tra
SELECT COUNT(*) AS so_chuyen_khoa FROM specialties;
SELECT COUNT(*) AS so_bac_si FROM doctors;
SELECT COUNT(*) AS so_benh_nhan FROM users WHERE LOWER(role::text) = 'patient';
SELECT s.name AS chuyen_khoa, COUNT(d.id) AS so_bac_si FROM specialties s LEFT JOIN doctors d ON d.specialty_id = s.id GROUP BY s.id, s.name ORDER BY s.id;
