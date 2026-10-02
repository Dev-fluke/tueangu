const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getNote, saveNote, clearNote, isSupabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isSupabase ? 'Supabase' : 'SQLite',
    timestamp: new Date().toISOString()
  });
});

// GET: Retrieve the note
app.get('/api/note', async (req, res) => {
  try {
    const note = await getNote();
    res.json({ success: true, data: note });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลได้' });
  }
});

// POST: Save or update the note (for auto-save)
app.post('/api/note', async (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    const saved = await saveNote(content);
    res.json({ success: true, data: saved, message: 'บันทึกสำเร็จแล้ว' });
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ success: false, message: 'บันทึกข้อมูลไม่สำเร็จ' });
  }
});

// POST: Clear the note
app.post('/api/note/clear', async (req, res) => {
  try {
    const cleared = await clearNote();
    res.json({ success: true, data: cleared, message: 'ล้างข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error clearing note:', error);
    res.status(500).json({ success: false, message: 'ล้างข้อมูลไม่สำเร็จ' });
  }
});

// Serve static frontend build if it exists (for Render single-service deployment)
const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Database provider: ${isSupabase ? 'Supabase' : 'SQLite'}`);
});
