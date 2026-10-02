# 📝 ช่วยเตือนกู (TueanGu) - Minimalist Auto-Saving Notepad

เว็บแอพพลิเคชั่นช่วยเตือนและจดบันทึกสไตล์เรโทร-โมเดิร์น (Modern Neo-Brutalist Minimalism) ตามแบบโครงร่าง พร้อมฟังก์ชันบันทึกอัตโนมัติ รองรับทั้ง **SQLite** (สำหรับการพัฒนาในเครื่อง Local) และ **Supabase Database API** (สำหรับการ Deploy ใช้งานจริงบนคลาวด์ Render)

---

## ✨ ฟีเจอร์หลัก (Features)

1. **เคอร์เซอร์กระพริบพร้อมพิมพ์ทันที (Immediate Typing Focus):**
   - เมื่อเปิดหน้าเว็บ เคอร์เซอร์จะถูกโฟกัสที่พื้นที่เขียนข้อความทันทีโดยไม่ต้องคลิก
   - คลิกที่บริเวณใดก็ได้ในกล่องเพื่อกลับมาโฟกัสพิมพ์ต่อได้ทันที
2. **ระบบบันทึกอัตโนมัติ (Debounced Auto-Save):**
   - เมื่อหยุดพิมพ์เป็นเวลา 700ms ระบบจะส่งข้อความไปบันทึกอัตโนมัติทันที
   - มีสถานะแจ้งเตือนชัดเจน: `กำลังพิมพ์...` -> `กำลังบันทึก...` -> `บันทึกแล้ว` พร้อมระบุเวลาล่าสุด
   - รองรับคีย์ลัด `Ctrl + S` / `Cmd + S` เพื่อบันทึกทันที
3. **ปุ่มล้าง (Clear Button):**
   - ตัวอักษรสีแดงอ่อนนุ่มนวลตา (`text-red-400`) อยู่ฝั่งขวาบนตามแบบ
   - มีหน้าต่างป๊อปอัปยืนยันก่อนลบเพื่อความปลอดภัย
   - ล้างข้อมูลทั้งบนหน้าจอและในฐานข้อมูลให้ทันที
4. **ความสวยงามและทันสมัย (Modern Minimalist UI):**
   - กรอบเส้นขอบสีดำคมชัด (Neo-Brutalist Border & Divider)
   - ฟอนต์ทางการของ LINE: **LINE Seed Sans TH** อ่านง่าย คมชัด ทันสมัย
   - รองรับหน้าจอโทรศัพท์แบบเต็มจอ 100% (Edge-to-Edge) ไร้ขอบว่างด้านข้าง
   - แสดงสถิติ: จำนวนตัวอักษร, จำนวนคำ, จำนวนบรรทัด
   - ปุ่มคัดลอก (Copy) ข้อความคลิกเดียวเข้าคลิปบอร์ด

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, LINE Seed Sans TH
- **Backend:** Node.js, Express
- **Database:** Supabase (PostgreSQL) สำหรับ Production / SQLite3 สำหรับ Local Dev
- **Hosting:** Render (Web Service รองรับทั้ง Frontend + Backend ในตัวเดียว)

---

## 🚀 ขั้นตอนการ Deploy ใช้งานจริง (Deployment Guide)

### 📌 ขั้นตอนที่ 1: อัปโหลดโค้ดขึ้น GitHub

1. เข้าไปที่ [GitHub](https://github.com/) แล้วสร้าง **New Repository** ใหม่ (เช่น ชื่อ `tueangu`) ตั้งเป็น Public หรือ Private ตามต้องการ
2. รันคำสั่งต่อไปนี้ใน Terminal เพื่อ Push โค้ดขึ้น GitHub:
   ```bash
   git remote add origin https://github.com/<USERNAME-ของคุณ>/tueangu.git
   git branch -M main
   git push -u origin main
   ```

---

### 📌 ขั้นตอนที่ 2: ตั้งค่าฐานข้อมูลบน Supabase

1. เข้าไปที่ [Supabase](https://supabase.com/) แล้วกดสร้าง **New Project**
2. เมื่อโปรเจกต์พร้อมใช้งาน ให้ไปที่เมนู **SQL Editor** ด้านซ้าย
3. คัดลอกคำสั่ง SQL จากไฟล์ [`supabase-setup.sql`](./supabase-setup.sql) ไปวางแล้วกด **Run**:
   ```sql
   CREATE TABLE IF NOT EXISTS public.notes (
       id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
       content TEXT NOT NULL DEFAULT '',
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );

   INSERT INTO public.notes (id, content, updated_at)
   VALUES (1, '', now())
   ON CONFLICT (id) DO NOTHING;

   ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Allow public read access" ON public.notes FOR SELECT TO public USING (true);
   CREATE POLICY "Allow public insert access" ON public.notes FOR INSERT TO public WITH CHECK (true);
   CREATE POLICY "Allow public update access" ON public.notes FOR UPDATE TO public USING (true);
   ```
4. ไปที่เมนู **Project Settings** -> **API** เพื่อคัดลอก 2 ค่านี้ไว้:
   - **Project URL** (เช่น `https://xyzproject.supabase.co`)
   - **anon public key** หรือ **service_role secret key**

---

### 📌 ขั้นตอนที่ 3: Deploy ขึ้น Render

1. เข้าไปที่ [Render](https://render.com/) และเข้าสู่ระบบ (เชื่อมกับบัญชี GitHub)
2. กด **New +** แล้วเลือก **Web Service**
3. เลือก Repository `tueangu` ที่เพิ่ง Push ขึ้นไป
4. กำหนดการตั้งค่าดังนี้:
   - **Name:** `tueangu` (หรือชื่อตามต้องการ)
   - **Language:** `Node`
   - **Branch:** `main`
   - **Build Command:**
     ```bash
     npm run render-build
     ```
   - **Start Command:**
     ```bash
     npm run render-start
     ```
5. เลื่อนลงมาที่หัวข้อ **Environment Variables** แล้วกดเพิ่ม 2 ค่า:
   - Key: `SUPABASE_URL` | Value: *(Project URL จาก Supabase)*
   - Key: `SUPABASE_KEY` | Value: *(anon key หรือ service_role key จาก Supabase)*
   - Key: `NODE_ENV` | Value: `production`
6. กด **Create Web Service**
7. รอ Render ทำการ Build และ Deploy ประมาณ 1-2 นาที เมื่อเสร็จเรียบร้อยจะได้รับ URL (เช่น `https://tueangu.onrender.com`) สามารถนำไปเปิดใช้งานบนโทรศัพท์มือถือและคอมพิวเตอร์ได้ทันที 24 ชม.!

---

## 💻 วิธีการรันบนเครื่อง Local (Development)

```bash
# ติดตั้ง dependencies
npm install
npm install --prefix server
npm install --prefix client

# รันทั้ง Backend และ Frontend พร้อมกัน
npm run dev
```

เปิดเบราว์เซอร์:
- **Local:** [http://localhost:5173](http://localhost:5173)
- **โทรศัพท์มือถือ (Wi-Fi วงเดียวกัน):** [http://192.168.0.104:5173](http://192.168.0.104:5173)
