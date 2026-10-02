# 📝 ช่วยเตือนกู (TueanGu) - Minimalist Auto-Saving Notepad

เว็บแอพพลิเคชั่นช่วยเตือนและจดบันทึกสไตล์เรโทร-โมเดิร์น (Modern Neo-Brutalist Minimalism) ตามแบบโครงร่างที่ระบุ พร้อมฟังก์ชันบันทึกอัตโนมัติลงฐานข้อมูล SQLite

---

## ✨ ฟีเจอร์หลัก (Features)

1. **เคอร์เซอร์กระพริบพร้อมพิมพ์ทันที (Immediate Typing Focus):**
   - เมื่อเปิดหน้าเว็บ เคอร์เซอร์จะถูกโฟกัสที่พื้นที่เขียนข้อความทันทีโดยไม่ต้องคลิก
   - คลิกที่บริเวณใดก็ได้ในกล่องเพื่อกลับมาโฟกัสพิมพ์ต่อได้ทันที
2. **ระบบบันทึกอัตโนมัติ (Debounced Auto-Save):**
   - เมื่อหยุดพิมพ์เป็นเวลา 700ms ระบบจะส่งข้อความไปบันทึกลงฐานข้อมูล SQLite ทันที
   - มีสถานะแจ้งเตือนชัดเจน: `กำลังพิมพ์...` -> `กำลังบันทึก...` -> `บันทึกแล้ว` พร้อมระบุเวลาล่าสุด
   - รองรับคีย์ลัด `Ctrl + S` / `Cmd + S` เพื่อบันทึกทันที
3. **ปุ่มล้าง (Clear Button):**
   - ปุ่ม "ล้าง" ด้านขวาบนตามรูปภาพ layout
   - เมื่อกดจะมีหน้าต่างยืนยันเพื่อป้องกันการล้างข้อมูลโดยไม่ตั้งใจ
   - เมื่อล้างเสร็จ ข้อความในฐานข้อมูล SQLite จะถูกล้างออก และเคอร์เซอร์จะกลับมาโฟกัสพร้อมพิมพ์ข้อความใหม่ทันที
4. **ความสวยงามและทันสมัย (Modern Minimalist UI):**
   - กรอบเส้นขอบสีดำคมชัด (Neo-Brutalist Border & Shadow) ตรงตามรูปภาพต้นแบบ
   - รองรับฟอนต์ภาษาไทย **Prompt** ที่อ่านง่ายและสวยงาม
   - แสดงสถิติ: จำนวนตัวอักษร, จำนวนคำ, จำนวนบรรทัด
   - ปุ่มคัดลอก (Copy) ข้อความคลิกเดียวเข้าคลิปบอร์ด

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express
- **Database:** SQLite3

---

## 🚀 วิธีการติดตั้งและรันโปรเจกต์ (Getting Started)

### 1. ติดตั้ง Dependencies
ติดตั้ง dependencies ของทั้ง root, backend และ frontend:

```bash
# ติดตั้ง root dependencies
npm install

# ติดตั้ง server dependencies
cd server
npm install
cd ..

# ติดตั้ง client dependencies
cd client
npm install
cd ..
```

### 2. รันระบบ (Run Application)

รันทั้ง Backend (Express + SQLite) และ Frontend (React + Vite) พร้อมกันด้วยคำสั่งเดียว:

```bash
npm run dev
```

หรือเปิดใช้งานแยกกัน:
- **Backend (Port 5000):**
  ```bash
  npm run server
  ```
- **Frontend (Port 5173):**
  ```bash
  npm run client
  ```

เปิดเบราว์เซอร์ไปที่: **[http://localhost:5173](http://localhost:5173)**
