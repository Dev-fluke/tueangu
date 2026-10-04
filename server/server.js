const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getNote, saveNote, clearNote, getImages, addImage, deleteImage, getVapidKeys, saveVapidKeys, addSubscription, getAllSubscriptions, addReminder, getPendingReminders, markReminderSent, deleteReminder, isSupabase } = require('./database');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    res.status(500).json({ 
      success: false, 
      message: 'บันทึกข้อมูลไม่สำเร็จ', 
      error: error.message || error 
    });
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

// --- IMAGES API ---

app.get('/api/images', async (req, res) => {
  try {
    const images = await getImages();
    res.json({ success: true, data: images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ success: false, message: 'โหลดรูปภาพไม่สำเร็จ' });
  }
});

app.post('/api/images', async (req, res) => {
  try {
    const { id, data } = req.body;
    if (!id || !data) return res.status(400).json({ success: false, message: 'id and data required' });
    const saved = await addImage(id, data);
    io.emit('images_updated'); // broadcast to all clients
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Error adding image:', error);
    res.status(500).json({ success: false, message: 'อัปโหลดรูปภาพไม่สำเร็จ' });
  }
});

app.delete('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteImage(id);
    io.emit('images_updated'); // broadcast to all clients
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: 'ลบรูปภาพไม่สำเร็จ' });
  }
});

// Serve static frontend build if it exists (for Render single-service deployment)
const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// WebSocket for real-time collaboration
io.on('connection', (socket) => {
  // When a user types or saves, they broadcast the new text
  socket.on('note_update', (content) => {
    socket.broadcast.emit('note_update', content);
  });
});

// Push Notifications Setup
app.get('/api/vapidPublicKey', async (req, res) => {
  try {
    let keys = await getVapidKeys();
    if (!keys) {
      keys = webpush.generateVAPIDKeys();
      await saveVapidKeys(keys);
    }
    res.json({ publicKey: keys.publicKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get VAPID keys' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    await addSubscription(subscription);
    res.status(201).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

app.post('/api/reminders', async (req, res) => {
  try {
    const { text, triggerTime } = req.body;
    await addReminder(text, triggerTime);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add reminder' });
  }
});

app.get('/api/reminders', async (req, res) => {
  try {
    const pending = await getPendingReminders();
    res.json({ success: true, data: pending });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

app.delete('/api/reminders/:id', async (req, res) => {
  try {
    await deleteReminder(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// Cron job to check for reminders every minute
cron.schedule('* * * * *', async () => {
  try {
    const pending = await getPendingReminders();
    if (pending.length === 0) return;

    let keys = await getVapidKeys();
    if (!keys) return;
    
    webpush.setVapidDetails('mailto:test@example.com', keys.publicKey, keys.privateKey);
    const subscriptions = await getAllSubscriptions();

    for (let reminder of pending) {
      const payload = JSON.stringify({ title: 'ช่วยเตือนกู ⏰', body: reminder.text });
      for (let sub of subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error('Error sending push to a subscription', err);
        }
      }
      await markReminderSent(reminder.id);
    }
  } catch (err) {
    console.error('Cron job error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Database provider: ${isSupabase ? 'Supabase' : 'SQLite'}`);
});
