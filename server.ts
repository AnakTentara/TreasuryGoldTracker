// server.ts
import express from 'express';
import path from 'path';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { dbAll, dbGet, dbRun, getSetting, setSetting } from './src/database/db';
import { fetchTreasuryGoldPrice, performSync, sendNotifications, TransactionWithCalc } from './src/services/trackerService';

async function startServer() {
  // Ensure database schema is initialized and migrated
  try {
    console.log('[SERVER] Ensuring database is initialized...');
    execSync('node src/database/db_init.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('[SERVER] Database initialization failed:', err);
  }

  const app = express();
  const PORT = 3000;

  // Express parser
  app.use(express.json());

  // 1. GET /api/dashboard - Aggregates all dashboard data
  app.get('/api/dashboard', async (req, res) => {
    try {
      // Get settings
      const targetProfitPercent = parseFloat(await getSetting('target_profit_percent', '5.0'));
      const discordWebhook = await getSetting('discord_webhook', '');
      const whatsappApiEndpoint = await getSetting('whatsapp_api_endpoint', '');

      // Get latest price or fetch one if empty
      let latestPrice = await dbGet<{ id: number; timestamp: string; harga_beli: number; harga_jual: number }>(
        'SELECT * FROM gold_price_history ORDER BY id DESC LIMIT 1'
      );

      if (!latestPrice) {
        console.log('[DASHBOARD] No price history found, running initial fetch...');
        const price = await fetchTreasuryGoldPrice();
        await dbRun(
          'INSERT INTO gold_price_history (timestamp, harga_beli, harga_jual) VALUES (?, ?, ?)',
          [price.timestamp, price.hargaBeli, price.hargaJual]
        );
        latestPrice = {
          id: 1,
          timestamp: price.timestamp,
          harga_beli: price.hargaBeli,
          harga_jual: price.hargaJual
        };
      }

      // Fetch all transactions
      const transactions = await dbAll<{ id: number; modal_awal: number; harga_beli_awal: number; tanggal_beli: string; notes: string }>(
        'SELECT * FROM transactions ORDER BY id ASC'
      );

      // Calculate portfolio stats
      let totalModalAwal = 0;
      let totalVolumeEmas = 0;

      const transactionCalcs: TransactionWithCalc[] = transactions.map(t => {
        const volume = t.modal_awal / t.harga_beli_awal;
        totalModalAwal += t.modal_awal;
        totalVolumeEmas += volume;

        const nilaiSaatIni = volume * latestPrice.harga_jual;
        const pnlRp = nilaiSaatIni - t.modal_awal;
        const pnlPercent = t.modal_awal > 0 ? (pnlRp / t.modal_awal) * 100 : 0;

        return {
          id: t.id,
          modal_awal: t.modal_awal,
          harga_beli_awal: t.harga_beli_awal,
          tanggal_beli: t.tanggal_beli,
          notes: t.notes,
          volumeEmas: volume,
          nilaiAsetSaatIni: nilaiSaatIni,
          floatingPnlRp: pnlRp,
          floatingPnlPercent: pnlPercent
        };
      });

      const totalNilaiAsetSaatIni = totalVolumeEmas * latestPrice.harga_jual;
      const totalFloatingPnlRp = totalNilaiAsetSaatIni - totalModalAwal;
      const totalFloatingPnlPercent = totalModalAwal > 0 ? (totalFloatingPnlRp / totalModalAwal) * 100 : 0;

      // Get price history for charts
      const priceHistory = await dbAll<{ id: number; timestamp: string; harga_beli: number; harga_jual: number }>(
        'SELECT * FROM gold_price_history ORDER BY id DESC LIMIT 50'
      );

      // Get alert history
      const alertHistory = await dbAll<{ id: number; timestamp: string; harga_jual: number; floating_pnl_rp: number; floating_pnl_percent: number; status: string }>(
        'SELECT * FROM alert_history ORDER BY id DESC LIMIT 20'
      );

      res.json({
        settings: {
          target_profit_percent: targetProfitPercent,
          discord_webhook: discordWebhook,
          whatsapp_api_endpoint: whatsappApiEndpoint
        },
        latestPrice,
        calculations: {
          volumeEmas: totalVolumeEmas,
          nilaiAsetSaatIni: totalNilaiAsetSaatIni,
          floatingPnlRp: totalFloatingPnlRp,
          floatingPnlPercent: totalFloatingPnlPercent,
          modal_awal: totalModalAwal
        },
        transactions: transactionCalcs,
        priceHistory,
        alertHistory
      });
    } catch (error: any) {
      console.error('[API] /api/dashboard failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 1b. POST /api/transactions - Add a new transaction
  app.post('/api/transactions', async (req, res) => {
    try {
      const { modal_awal, harga_beli_awal, tanggal_beli, notes } = req.body;
      if (!modal_awal || !harga_beli_awal) {
        return res.status(400).json({ error: 'modal_awal and harga_beli_awal are required' });
      }
      
      const date = tanggal_beli || new Date().toISOString();
      const note = notes || '';

      await dbRun(
        'INSERT INTO transactions (modal_awal, harga_beli_awal, tanggal_beli, notes) VALUES (?, ?, ?, ?)',
        [parseFloat(modal_awal), parseFloat(harga_beli_awal), date, note]
      );

      console.log('[API] New gold purchase transaction recorded.');
      res.json({ success: true, message: 'Transaction recorded successfully' });
    } catch (error: any) {
      console.error('[API] POST /api/transactions failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 1c. DELETE /api/transactions/:id - Delete an existing transaction
  app.delete('/api/transactions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun('DELETE FROM transactions WHERE id = ?', [id]);
      console.log(`[API] Transaction with ID ${id} deleted.`);
      res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error: any) {
      console.error('[API] DELETE /api/transactions failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. POST /api/settings - Update settings in SQLite dynamically
  app.post('/api/settings', async (req, res) => {
    try {
      const { target_profit_percent, discord_webhook, whatsapp_api_endpoint } = req.body;

      if (target_profit_percent !== undefined) await setSetting('target_profit_percent', String(target_profit_percent));
      if (discord_webhook !== undefined) await setSetting('discord_webhook', String(discord_webhook));
      if (whatsapp_api_endpoint !== undefined) await setSetting('whatsapp_api_endpoint', String(whatsapp_api_endpoint));

      console.log('[API] App configurations updated successfully.');
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
      console.error('[API] POST /api/settings failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. POST /api/sync - Manually trigger sync and calculate P&L
  app.post('/api/sync', async (req, res) => {
    try {
      const syncResult = await performSync();
      res.json({ success: true, ...syncResult });
    } catch (error: any) {
      console.error('[API] POST /api/sync failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. POST /api/test-notification - Sends immediate test messages
  app.post('/api/test-notification', async (req, res) => {
    try {
      const { discord_webhook, whatsapp_api_endpoint } = req.body;
      const targetProfitPercent = parseFloat(await getSetting('target_profit_percent', '5.0'));
      
      // Fetch latest price for math
      let latestPrice = await dbGet<{ harga_jual: number }>('SELECT harga_jual FROM gold_price_history ORDER BY id DESC LIMIT 1');
      const currentJual = latestPrice ? latestPrice.harga_jual : 1420000;
      
      // Fetch all transactions
      const transactions = await dbAll<{ id: number; modal_awal: number; harga_beli_awal: number; tanggal_beli: string; notes: string }>(
        'SELECT * FROM transactions ORDER BY id ASC'
      );

      let totalModalAwal = 0;
      let totalVolumeEmas = 0;

      const transactionCalcs: TransactionWithCalc[] = transactions.map(t => {
        const volume = t.modal_awal / t.harga_beli_awal;
        totalModalAwal += t.modal_awal;
        totalVolumeEmas += volume;

        const nilaiSaatIni = volume * currentJual;
        const pnlRp = nilaiSaatIni - t.modal_awal;
        const pnlPercent = t.modal_awal > 0 ? (pnlRp / t.modal_awal) * 100 : 0;

        return {
          id: t.id,
          modal_awal: t.modal_awal,
          harga_beli_awal: t.harga_beli_awal,
          tanggal_beli: t.tanggal_beli,
          notes: t.notes,
          volumeEmas: volume,
          nilaiAsetSaatIni: nilaiSaatIni,
          floatingPnlRp: pnlRp,
          floatingPnlPercent: pnlPercent
        };
      });

      const totalNilaiAsetSaatIni = totalVolumeEmas * currentJual;
      const totalFloatingPnlRp = totalNilaiAsetSaatIni - totalModalAwal;
      const totalFloatingPnlPercent = totalModalAwal > 0 ? (totalFloatingPnlRp / totalModalAwal) * 100 : 0;

      console.log('[TEST NOTIFICATION] Sending test alerts...');
      const statuses = await sendNotifications({
        totalModalAwal,
        targetProfitPercent,
        hargaJual: currentJual,
        totalFloatingPnlRp,
        totalFloatingPnlPercent,
        totalVolumeEmas,
        transactions: transactionCalcs,
        discordWebhook: discord_webhook !== undefined ? discord_webhook : await getSetting('discord_webhook', ''),
        whatsappApiEndpoint: whatsapp_api_endpoint !== undefined ? whatsapp_api_endpoint : await getSetting('whatsapp_api_endpoint', '')
      });

      res.json({ success: true, statuses });
    } catch (error: any) {
      console.error('[API] POST /api/test-notification failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite & Client Asset Routing ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Launch Server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Full-stack gold tracker server running on http://localhost:${PORT}`);
  });

  // Run initial sync on boot (after a short delay to allow tables/DB to settle)
  setTimeout(async () => {
    try {
      console.log('[SERVER] Running boot synchronization...');
      await performSync();
    } catch (err) {
      console.error('[SERVER] Boot synchronization failed:', err);
    }
  }, 3000);

  // Background cron loop: runs every 1 hour (3600000 ms)
  setInterval(async () => {
    try {
      await performSync();
    } catch (err) {
      console.error('[BACKGROUND WORKER] Automated hourly sync failed:', err);
    }
  }, 60 * 60 * 1000);
}

startServer();
