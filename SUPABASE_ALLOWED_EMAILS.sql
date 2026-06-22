-- Run this code in your Supabase SQL Editor

-- 1. Create the allowed_emails table
CREATE TABLE IF NOT EXISTS allowed_emails (
  email text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Turn on Row Level Security (RLS)
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- 3. Allow anyone to query the allowed_emails table (so the frontend can check signups)
CREATE POLICY "Allow public read access on allowed_emails"
  ON allowed_emails
  FOR SELECT
  USING (true);

-- 4. Allow administrators to insert/update/delete emails
CREATE POLICY "Allow admins to manage allowed_emails"
  ON allowed_emails
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- 5. (Optional) Insert some test allowed emails for students
INSERT INTO allowed_emails (email) VALUES 
('student1@gmail.com'),
('student2@googlemail.com')
ON CONFLICT (email) DO NOTHING;
