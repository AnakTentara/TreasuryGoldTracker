// src/database/db_init.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(process.cwd(), 'treasury.db');

console.log('=== INITIALIZING TREASURY AUTOMATION MONITORING DATABASE ===');
console.log('Database path:', DB_FILE);

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('[ERROR] Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('[INFO] Successfully connected to SQLite database.');
});

db.serialize(() => {
  // 1. Create app_settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      field_key TEXT PRIMARY KEY,
      field_value TEXT,
      description TEXT
    )
  `, (err) => {
    if (err) {
      console.error('[ERROR] Failed to create app_settings table:', err);
      process.exit(1);
    }
    console.log('[INFO] app_settings table verified.');
  });

  // 2. Create gold_price_history table
  db.run(`
    CREATE TABLE IF NOT EXISTS gold_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      harga_beli REAL NOT NULL,
      harga_jual REAL NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('[ERROR] Failed to create gold_price_history table:', err);
      process.exit(1);
    }
    console.log('[INFO] gold_price_history table verified.');
  });

  // 3. Create alert_history table
  db.run(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      harga_jual REAL NOT NULL,
      floating_pnl_rp REAL NOT NULL,
      floating_pnl_percent REAL NOT NULL,
      status TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('[ERROR] Failed to create alert_history table:', err);
      process.exit(1);
    }
    console.log('[INFO] alert_history table verified.');
  });

  // 3b. Create transactions table for tracking multiple purchases
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modal_awal REAL NOT NULL,
      harga_beli_awal REAL NOT NULL,
      tanggal_beli TEXT NOT NULL,
      notes TEXT
    )
  `, (err) => {
    if (err) {
      console.error('[ERROR] Failed to create transactions table:', err);
      process.exit(1);
    }
    console.log('[INFO] transactions table verified.');

    // Backward compatibility migration: If the transactions table is empty,
    // migrate the legacy values or default ones from app_settings
    db.get('SELECT COUNT(*) as count FROM transactions', [], (errCount, row) => {
      if (!errCount && row && row.count === 0) {
        db.all('SELECT field_key, field_value FROM app_settings WHERE field_key IN ("modal_awal", "harga_beli_awal")', [], (errSettings, rows) => {
          let legacyModal = 100000;
          let legacyHarga = 1450000;
          if (!errSettings && rows) {
            rows.forEach((r) => {
              if (r.field_key === 'modal_awal') legacyModal = parseFloat(r.field_value) || 100000;
              if (r.field_key === 'harga_beli_awal') legacyHarga = parseFloat(r.field_value) || 1450000;
            });
          }
          db.run(
            'INSERT INTO transactions (modal_awal, harga_beli_awal, tanggal_beli, notes) VALUES (?, ?, ?, ?)',
            [legacyModal, legacyHarga, new Date().toISOString(), 'Transaksi Pertama (Migrasi)'],
            (errInsert) => {
              if (errInsert) {
                console.error('[ERROR] Failed to migrate initial legacy transaction:', errInsert);
              } else {
                console.log('[INFO] Successfully migrated legacy settings to the new transactions table!');
              }
            }
          );
        });
      }
    });
  });

  // 4. Seed default settings
  const defaultSettings = [
    { key: 'modal_awal', value: '100000', desc: 'Modal awal investasi dalam Rupiah' },
    { key: 'harga_beli_awal', value: '1450000', desc: 'Harga beli per gram saat transaksi dilakukan' },
    { key: 'target_profit_percent', value: '5.0', desc: 'Batas persentase keuntungan untuk memicu alert' },
    { key: 'discord_webhook', value: '', desc: 'URL Webhook Discord' },
    { key: 'whatsapp_api_endpoint', value: '', desc: 'Endpoint pengiriman pesan WhatsApp' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO app_settings (field_key, field_value, description) VALUES (?, ?, ?)');
  defaultSettings.forEach((setting) => {
    stmt.run(setting.key, setting.value, setting.desc, (err) => {
      if (err) {
        console.error(`[ERROR] Failed to seed ${setting.key}:`, err);
      } else {
        console.log(`[INFO] Seed status for ${setting.key}: Done/Skipped`);
      }
    });
  });
  stmt.finalize();
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('[ERROR] Error closing database:', err);
    process.exit(1);
  }
  console.log('[INFO] Database initialization completed successfully.');
});
