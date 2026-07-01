// src/database/db.ts
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'treasury.db');

export const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('[DATABASE] Failed to connect to SQLite:', err);
  } else {
    console.log('[DATABASE] Connected to SQLite database:', DB_FILE);
  }
});

export function dbRun(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error(`[DATABASE ERROR] Run failed: ${sql}`, err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

export function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error(`[DATABASE ERROR] Get failed: ${sql}`, err);
        reject(err);
      } else {
        resolve(row as T);
      }
    });
  });
}

export function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error(`[DATABASE ERROR] All failed: ${sql}`, err);
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

// Key-Value Setting helpers
export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const row = await dbGet<{ field_value: string }>('SELECT field_value FROM app_settings WHERE field_key = ?', [key]);
    return row ? row.field_value : defaultValue;
  } catch (err) {
    console.error(`[DATABASE] Failed to get setting ${key}:`, err);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await dbRun(
      'INSERT INTO app_settings (field_key, field_value) VALUES (?, ?) ON CONFLICT(field_key) DO UPDATE SET field_value = excluded.field_value',
      [key, value]
    );
  } catch (err) {
    console.error(`[DATABASE] Failed to set setting ${key}:`, err);
    throw err;
  }
}
