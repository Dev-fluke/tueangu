const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
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

module.exports = {
  getNote,
  saveNote,
  clearNote,
  isSupabase
};
