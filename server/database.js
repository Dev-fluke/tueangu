const path = require('path');
require('dotenv').config();

let SUPABASE_URL = process.env.SUPABASE_URL;
if (SUPABASE_URL) {
  // If user accidentally copied the REST URL with /rest/v1, strip it down to the base URL
  SUPABASE_URL = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
let sqliteDb = null;

if (isSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('⚡ Connected to Supabase Database API:', SUPABASE_URL);
} else {
  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = path.join(__dirname, 'notes.db');
  
  sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Error opening SQLite database:', err.message);
    } else {
      console.log('📁 Using local SQLite database at', DB_PATH);
    }
  });

  sqliteDb.serialize(() => {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating table:', err.message);
        return;
      }
      sqliteDb.run(`
        INSERT OR IGNORE INTO notes (id, content, updated_at)
        VALUES (1, '', CURRENT_TIMESTAMP)
      `);
      
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS images (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating images table:', err.message);
        }
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          trigger_time DATETIME NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  });
}

/**
 * Retrieve current note
 */
async function getNote() {
  if (isSupabase) {
    const { data, error } = await supabase
      .from('notes')
      .select('content, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('Supabase getNote error:', error);
      throw error;
    }
    return data || { content: '', updated_at: new Date().toISOString() };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT content, updated_at FROM notes WHERE id = 1', [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { content: '', updated_at: new Date().toISOString() });
        }
      });
    });
  }
}

/**
 * Save note content (upsert)
 */
async function saveNote(content) {
  const updatedAt = new Date().toISOString();

  if (isSupabase) {
    const { data, error } = await supabase
      .from('notes')
      .upsert({ id: 1, content, updated_at: updatedAt })
      .select()
      .single();

    if (error) {
      console.error('Supabase saveNote error:', error);
      throw error;
    }
    return data;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(
        `INSERT INTO notes (id, content, updated_at) 
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
        [content, updatedAt],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: 1, content, updated_at: updatedAt });
          }
        }
      );
    });
  }
}

/**
 * Clear note content
 */
async function clearNote() {
  const updatedAt = new Date().toISOString();

  if (isSupabase) {
    const { data, error } = await supabase
      .from('notes')
      .update({ content: '', updated_at: updatedAt })
      .eq('id', 1)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Supabase clearNote error:', error);
      throw error;
    }
    return data || { id: 1, content: '', updated_at: updatedAt };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(
        `UPDATE notes SET content = '', updated_at = ? WHERE id = 1`,
        [updatedAt],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: 1, content: '', updated_at: updatedAt });
          }
        }
      );
    });
  }
}

/**
 * Get all images
 */
async function getImages() {
  if (isSupabase) {
    const { data, error } = await supabase
      .from('images')
      .select('id, data')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Supabase getImages error:', error);
      throw error;
    }
    return data || [];
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all('SELECT id, data FROM images ORDER BY created_at ASC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

/**
 * Add an image
 */
async function addImage(id, dataStr) {
  if (isSupabase) {
    const { data, error } = await supabase
      .from('images')
      .insert([{ id, data: dataStr }])
      .select()
      .single();
    if (error) {
      console.error('Supabase addImage error:', error);
      throw error;
    }
    return data;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(
        `INSERT INTO images (id, data) VALUES (?, ?)`,
        [id, dataStr],
        function (err) {
          if (err) reject(err);
          else resolve({ id, data: dataStr });
        }
      );
    });
  }
}

/**
 * Delete an image
 */
async function deleteImage(id) {
  if (isSupabase) {
    const { data, error } = await supabase
      .from('images')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('Supabase deleteImage error:', error);
      throw error;
    }
    return data || { id };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(`DELETE FROM images WHERE id = ?`, [id], function (err) {
        if (err) reject(err);
        else resolve({ id });
      });
    });
  }
}

/**
 * VAPID Keys logic
 */
async function getVapidKeys() {
  if (isSupabase) {
    const { data } = await supabase.from('settings').select('value').eq('key', 'vapid_keys').maybeSingle();
    return data ? JSON.parse(data.value) : null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get("SELECT value FROM settings WHERE key = 'vapid_keys'", [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? JSON.parse(row.value) : null);
      });
    });
  }
}

async function saveVapidKeys(keys) {
  const value = JSON.stringify(keys);
  if (isSupabase) {
    await supabase.from('settings').upsert({ key: 'vapid_keys', value });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(
        `INSERT INTO settings (key, value) VALUES ('vapid_keys', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [value],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });
  }
}

/**
 * Subscriptions logic
 */
async function addSubscription(subObj) {
  const str = JSON.stringify(subObj);
  if (isSupabase) {
    await supabase.from('push_subscriptions').insert([{ subscription: str }]);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run("INSERT INTO push_subscriptions (subscription) VALUES (?)", [str], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }
}

async function getAllSubscriptions() {
  if (isSupabase) {
    const { data } = await supabase.from('push_subscriptions').select('subscription');
    return (data || []).map(d => JSON.parse(d.subscription));
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT subscription FROM push_subscriptions", [], (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []).map(r => JSON.parse(r.subscription)));
      });
    });
  }
}

/**
 * Reminders logic
 */
async function addReminder(text, triggerTime) {
  if (isSupabase) {
    const { data } = await supabase.from('reminders').insert([{ text, trigger_time: triggerTime, status: 'pending' }]).select().single();
    return data;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run("INSERT INTO reminders (text, trigger_time, status) VALUES (?, ?, 'pending')", [text, triggerTime], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, text, trigger_time: triggerTime, status: 'pending' });
      });
    });
  }
}

async function getPendingReminders() {
  const now = new Date().toISOString();
  if (isSupabase) {
    const { data } = await supabase.from('reminders').select('*').eq('status', 'pending').lte('trigger_time', now);
    return data || [];
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM reminders WHERE status = 'pending' AND trigger_time <= ?", [now], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

async function markReminderSent(id) {
  if (isSupabase) {
    await supabase.from('reminders').update({ status: 'sent' }).eq('id', id);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run("UPDATE reminders SET status = 'sent' WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = {
  getNote,
  saveNote,
  clearNote,
  getImages,
  addImage,
  deleteImage,
  getVapidKeys,
  saveVapidKeys,
  addSubscription,
  getAllSubscriptions,
  addReminder,
  getPendingReminders,
  markReminderSent,
  isSupabase
};
