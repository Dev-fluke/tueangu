-- ==============================================================
-- 🚀 SQL Setup Script สำหรับ Supabase (รันใน Supabase SQL Editor)
-- ==============================================================

-- 1. สร้างตาราง notes
CREATE TABLE IF NOT EXISTS public.notes (
    id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. สร้างแถวเริ่มต้น id = 1 หากยังไม่มี
INSERT INTO public.notes (id, content, updated_at)
VALUES (1, '', now())
ON CONFLICT (id) DO NOTHING;

-- 3. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 4. กำหนด Policies ให้สามารถอ่านและบันทึกได้
DROP POLICY IF EXISTS "Allow public read access" ON public.notes;
CREATE POLICY "Allow public read access" 
ON public.notes FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.notes;
CREATE POLICY "Allow public insert access" 
ON public.notes FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.notes;
CREATE POLICY "Allow public update access" 
ON public.notes FOR UPDATE 
TO public 
USING (true);
