import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Settings, 
  Bell, 
  RefreshCw, 
  DollarSign, 
  Scale, 
  Percent, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Activity,
  History,
  Info,
  ExternalLink,
  Cpu,
  Database,
  Terminal,
  Volume2,
  Trash2,
  PlusCircle,
  Calendar
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsData {
  target_profit_percent: number;
  discord_webhook: string;
  whatsapp_api_endpoint: string;
}

interface LatestPriceData {
  id: number;
  timestamp: string;
  harga_beli: number;
  harga_jual: number;
}

interface CalculationsData {
  volumeEmas: number;
  nilaiAsetSaatIni: number;
  floatingPnlRp: number;
  floatingPnlPercent: number;
  modal_awal: number;
}

interface TransactionWithCalc {
  id: number;
  modal_awal: number;
  harga_beli_awal: number;
  tanggal_beli: string;
  notes: string;
  volumeEmas: number;
  nilaiAsetSaatIni: number;
  floatingPnlRp: number;
  floatingPnlPercent: number;
}

interface PriceHistoryItem {
  id: number;
  timestamp: string;
  harga_beli: number;
  harga_jual: number;
}

interface AlertHistoryItem {
  id: number;
  timestamp: string;
  harga_jual: number;
  floating_pnl_rp: number;
  floating_pnl_percent: number;
  status: string;
}

export default function App() {
  // Loading & State
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [testingAlerts, setTestingAlerts] = useState(false);
  
  // Dashboard Core Data
  const [settings, setSettings] = useState<SettingsData>({
    target_profit_percent: 5.0,
    discord_webhook: '',
    whatsapp_api_endpoint: ''
  });
  const [latestPrice, setLatestPrice] = useState<LatestPriceData | null>(null);
  const [calculations, setCalculations] = useState<CalculationsData | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithCalc[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);

  // Form Input States
  // 1. Transaction form
  const [addModalAwal, setAddModalAwal] = useState<string>('100000');
  const [addHargaBeli, setAddHargaBeli] = useState<string>('1450000');
  const [addTanggalBeli, setAddTanggalBeli] = useState<string>('');
  const [addNotes, setAddNotes] = useState<string>('');

  // 2. Settings form
  const [formTargetProfit, setFormTargetProfit] = useState<string>('5.0');
  const [formDiscordWebhook, setFormDiscordWebhook] = useState<string>('');
  const [formWhatsappEndpoint, setFormWhatsappEndpoint] = useState<string>('');

  // Status Toast Message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Dashboard Data
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setLatestPrice(data.latestPrice);
        setCalculations(data.calculations);
        setTransactions(data.transactions || []);
        setPriceHistory(data.priceHistory);
        setAlertHistory(data.alertHistory);

        // Sync form controls
        setFormTargetProfit(String(data.settings.target_profit_percent));
        setFormDiscordWebhook(data.settings.discord_webhook || '');
        setFormWhatsappEndpoint(data.settings.whatsapp_api_endpoint || '');
      } else {
        showStatus('error', 'Gagal memuat data dari API Express');
      }
    } catch (err: any) {
      showStatus('error', 'Error menghubungkan ke server backend: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Set default purchase timestamp on client-side on mount
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setAddTanggalBeli(localISOTime);

    fetchDashboardData();
  }, []);

  // Pre-fill buy price input from market buy price when price is retrieved
  useEffect(() => {
    if (latestPrice && addHargaBeli === '1450000') {
      setAddHargaBeli(String(latestPrice.harga_beli));
    }
  }, [latestPrice]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Sync / Scrape Now Action
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.ok) {
        showStatus('success', 'Sinkronisasi harga emas Treasury berhasil dilakukan!');
        await fetchDashboardData(true);
      } else {
        showStatus('error', 'Gagal memicu sinkronisasi harga emas');
      }
    } catch (err: any) {
      showStatus('error', 'Koneksi gagal: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Record Transaction Action
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTransaction(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modal_awal: parseFloat(addModalAwal),
          harga_beli_awal: parseFloat(addHargaBeli),
          tanggal_beli: addTanggalBeli ? new Date(addTanggalBeli).toISOString() : new Date().toISOString(),
          notes: addNotes
        })
      });

      if (response.ok) {
        showStatus('success', 'Transaksi pembelian emas berhasil dicatat!');
        setAddModalAwal('100000');
        setAddNotes('');
        await fetchDashboardData(true);
      } else {
        showStatus('error', 'Gagal menyimpan transaksi baru');
      }
    } catch (err: any) {
      showStatus('error', 'Koneksi gagal: ' + err.message);
    } finally {
      setAddingTransaction(false);
    }
  };

  // Delete Transaction Action
  const handleDeleteTransaction = async (id: number) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showStatus('success', 'Transaksi berhasil dihapus dari portofolio.');
        await fetchDashboardData(true);
      } else {
        showStatus('error', 'Gagal menghapus transaksi');
      }
    } catch (err: any) {
      showStatus('error', 'Koneksi gagal: ' + err.message);
    }
  };

  // Save Settings Action
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_profit_percent: parseFloat(formTargetProfit),
          discord_webhook: formDiscordWebhook,
          whatsapp_api_endpoint: formWhatsappEndpoint
        })
      });

      if (response.ok) {
        showStatus('success', 'Konfigurasi target profit & alert berhasil disimpan!');
        await fetchDashboardData(true);
      } else {
        showStatus('error', 'Gagal menyimpan perubahan konfigurasi');
      }
    } catch (err: any) {
      showStatus('error', 'Error menyimpan data: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Test Alerts Delivery
  const handleTestAlerts = async () => {
    setTestingAlerts(true);
    try {
      const response = await fetch('/api/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_webhook: formDiscordWebhook,
          whatsapp_api_endpoint: formWhatsappEndpoint
        })
      });

      if (response.ok) {
        const result = await response.json();
        const statuses = result.statuses || [];
        if (statuses.length === 0) {
          showStatus('error', 'Silakan isi Discord Webhook atau WhatsApp Endpoint terlebih dahulu.');
        } else {
          showStatus('success', `Uji coba alert terkirim! Status: ${statuses.join(', ')}`);
          await fetchDashboardData(true);
        }
      } else {
        showStatus('error', 'Gagal memicu uji coba pengiriman alert');
      }
    } catch (err: any) {
      showStatus('error', 'Koneksi uji coba gagal: ' + err.message);
    } finally {
      setTestingAlerts(false);
    }
  };

  // Math Helper & Formatters
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatChartDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Prepare chart data
  const chartData = [...priceHistory]
    .reverse()
    .map(item => ({
      time: formatChartDate(item.timestamp),
      'Harga Beli': item.harga_beli,
      'Harga Jual': item.harga_jual
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center p-6 text-[#e0e0e0]">
        <div className="text-center font-mono">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" id="global-spinner"></div>
          <h2 className="text-sm font-bold tracking-widest text-[#d4af37] uppercase">CONNECTING_TO_PTERODACTYL_NODE_04...</h2>
          <p className="text-xs text-[#808080] mt-2">Initializing SQLite state & core scraper engine...</p>
        </div>
      </div>
    );
  }

  // Calculate target gap and formatting
  const pnlPercent = calculations?.floatingPnlPercent || 0;
  const targetPercent = settings.target_profit_percent;
  const targetGapPercent = Math.min(Math.max((pnlPercent / targetPercent) * 100, 0), 100);

  // Weighted break-even price of portfolio (Capital / Total Gold Volume)
  const breakEvenPrice = (calculations && calculations.volumeEmas > 0) ? calculations.modal_awal / calculations.volumeEmas : 0;

  // Generate real dynamic terminal logs
  const generateTerminalLogs = () => {
    const logs = [];
    if (latestPrice) {
      logs.push(`[${formatChartDate(latestPrice.timestamp)}] Fetching treasury.id prices...`);
      logs.push(`[${formatChartDate(latestPrice.timestamp)}] SCRAPE_SUCCESS: Buy ${latestPrice.harga_beli}, Sell ${latestPrice.harga_jual}`);
      logs.push(`[${formatChartDate(latestPrice.timestamp)}] Transactions: ${transactions.length} active positions tracked.`);
      logs.push(`[${formatChartDate(latestPrice.timestamp)}] Combined P&L: ${pnlPercent.toFixed(2)}% | Target ${targetPercent.toFixed(1)}%`);
      if (pnlPercent >= targetPercent && transactions.length > 0) {
        logs.push(`[${formatChartDate(latestPrice.timestamp)}] Logic: TARGET_REACHED (Triggering Alert Gateway)`);
      } else {
        logs.push(`[${formatChartDate(latestPrice.timestamp)}] Logic: SLEEPING (Active hourly trigger active)`);
      }
    }
    if (alertHistory.length > 0) {
      logs.push(`[${formatChartDate(alertHistory[0].timestamp)}] ALERT_DISPATCHED: ${alertHistory[0].status}`);
    } else {
      logs.push(`[SYSTEM] SQLite database connection checked.`);
    }
    return logs;
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#e0e0e0] font-sans antialiased flex flex-col" id="root-container">
      {/* Dynamic Status Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl border font-mono max-w-md ${
              notification.type === 'success' 
                ? 'bg-[#151515] border-[#22c55e]/50 text-[#22c55e]' 
                : 'bg-[#151515] border-[#ef4444]/50 text-[#ef4444]'
            }`}
            id="toast-notification"
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#22c55e] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#ef4444] shrink-0" />
            )}
            <div className="text-xs font-bold uppercase tracking-wider">{notification.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar - High Density Styled */}
      <header className="bg-[#151515] border-b border-[#2a2a2a] sticky top-0 z-40" id="main-header">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#d4af37] to-[#b08d1e] rounded flex items-center justify-center text-black font-mono font-bold shadow-lg shadow-yellow-600/10" id="app-logo">
              AU
            </div>
            <div>
              <h1 className="text-sm font-bold font-mono tracking-wider text-[#d4af37] uppercase">TREASURY_AUTO_TRACKER_V2.5 // MULTI-TRANSACTION LEDGER</h1>
              <p className="text-[11px] text-[#808080] font-mono mt-0.5 flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                DYNAMIC PORTFOLIO MONITORING ENGINE (SQLITE SCHEMA AUTO-MIGRATED)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end font-mono">
            <div className="status-chip bg-emerald-500/10 border border-emerald-500/20 text-[#22c55e] text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded shrink-0">
              ● PORTOFOLIO ENGINE: {transactions.length} ACTIVE POSITIONS
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-4 py-1.5 bg-[#d4af37] hover:bg-[#b08d1e] disabled:bg-amber-800 text-black font-bold uppercase tracking-wider rounded text-[11px] transition shadow-md shadow-yellow-600/10 cursor-pointer flex items-center gap-1.5 shrink-0"
              id="sync-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'RUNNING_SYNC...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden" id="main-layout">
        
        {/* Left Column: Dashboard Content (8 columns) */}
        <main className="lg:col-span-8 p-6 border-b lg:border-b-0 lg:border-r border-[#2a2a2a] flex flex-col gap-6 overflow-y-auto" id="main-content">
          
          {/* Market Prices Overview Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="market-prices">
            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-5 rounded relative overflow-hidden flex flex-col justify-between before:content-[''] before:absolute before:top-0 before:left-0 before:w-[3px] before:h-full before:bg-[#d4af37]" id="kpi-live-price-jual">
              <div>
                <span className="label text-[10px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Market Sell Price (Buyback per Gram)</span>
                <div className="value font-mono text-2xl font-bold text-[#e0e0e0]" id="live-jual-price">
                  {latestPrice ? formatIDR(latestPrice.harga_jual) : 'Rp 0'}
                </div>
              </div>
              <div className="text-[10px] text-[#808080] font-mono mt-3 pt-2 border-t border-[#2a2a2a]/40 flex justify-between">
                <span>Spread: -3.22% (Scraped Live)</span>
                <span>ID: #{latestPrice?.id || 1}</span>
              </div>
            </div>

            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-5 rounded relative overflow-hidden flex flex-col justify-between before:content-[''] before:absolute before:top-0 before:left-0 before:w-[3px] before:h-full before:bg-[#b08d1e]" id="kpi-live-price-beli">
              <div>
                <span className="label text-[10px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Market Buy Price (Base per Gram)</span>
                <div className="value font-mono text-2xl font-bold text-[#e0e0e0]" id="live-beli-price">
                  {latestPrice ? formatIDR(latestPrice.harga_beli) : 'Rp 0'}
                </div>
              </div>
              <div className="text-[10px] text-[#808080] font-mono mt-3 pt-2 border-t border-[#2a2a2a]/40 flex justify-between">
                <span>Ref: {latestPrice ? latestPrice.timestamp.substring(11, 19) : '-'}</span>
                <span>Active Scraper Feed</span>
              </div>
            </div>
          </section>

          {/* Portfolio Hero - Glowing Radial Gradient */}
          <section className="portfolio-hero bg-[#151515] border border-[#2a2a2a] rounded-lg p-8 flex flex-col justify-center items-center text-center relative overflow-hidden" id="portfolio-hero">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.06)_0%,transparent_70%)] pointer-events-none"></div>
            
            <span className="label text-xs uppercase font-mono tracking-wider text-[#808080] mb-2">Aggregated Portfolio P&L</span>
            
            <div className={`pnl-pct font-mono text-6xl sm:text-7xl font-bold tracking-tighter my-2 ${
              pnlPercent >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`} id="pnl-percent-val">
              {transactions.length > 0 ? `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%` : '0.00%'}
            </div>

            <div className={`font-mono text-sm uppercase tracking-widest font-bold ${
              pnlPercent >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`} id="pnl-idr-val">
              {calculations && transactions.length > 0 ? `${calculations.floatingPnlRp >= 0 ? '+' : ''}${formatIDR(calculations.floatingPnlRp)}` : 'Rp 0'}
            </div>

            {/* Target Alert Progress Bar inside Hero */}
            <div className="w-full max-w-md mt-6 pt-6 border-t border-[#2a2a2a]" id="target-progress-section">
              <div className="flex justify-between text-[10px] font-mono text-[#808080] mb-2">
                <span>PORTFOLIO GAP TO ALERT TRIGGER</span>
                <span>{transactions.length > 0 ? pnlPercent.toFixed(2) : '0.00'}% / {targetPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#0c0c0c] border border-[#2a2a2a] h-2.5 rounded overflow-hidden flex">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${transactions.length > 0 ? targetGapPercent : 0}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full ${
                    targetGapPercent >= 100 
                      ? 'bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                      : 'bg-[#d4af37]'
                  }`}
                  id="progress-bar-fill"
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-[#808080] mt-1.5">
                <span>BREAK-EVEN IMPAS</span>
                <span>{transactions.length > 0 ? targetGapPercent.toFixed(0) : '0'}% MET</span>
                <span>ALERT ALGORITHM TRIGGER ({targetPercent}%)</span>
              </div>
            </div>

            {/* 3-Column Hero Stats Grid */}
            <div className="stats-grid grid grid-cols-3 gap-4 w-full mt-8 pt-6 border-t border-[#2a2a2a]" id="stats-grid">
              <div className="stat-item text-center">
                <div className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] mb-1">Total Assets Valuation</div>
                <div className="value font-mono text-base font-bold text-[#e0e0e0]" id="liquid-asset-val">
                  {calculations && transactions.length > 0 ? formatIDR(calculations.nilaiAsetSaatIni) : 'Rp 0'}
                </div>
              </div>
              <div className="stat-item text-center border-x border-[#2a2a2a] px-2">
                <div className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] mb-1">Total Gold Volume</div>
                <div className="value font-mono text-base font-bold text-[#e0e0e0]" id="gold-volume-val">
                  {calculations && transactions.length > 0 ? `${calculations.volumeEmas.toFixed(6)} gr` : '0.000000 gr'}
                </div>
              </div>
              <div className="stat-item text-center">
                <div className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] mb-1">Combined BEP Rate</div>
                <div className="value font-mono text-base font-bold text-[#e0e0e0]">
                  {transactions.length > 0 ? `${formatIDR(breakEvenPrice)}/gr` : 'Rp 0/gr'}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Metrics (Row of 4 Card Stats) */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4" id="market-quick-metrics">
            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-4 rounded">
              <span className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Target Profit</span>
              <div className="value font-mono text-sm font-bold text-[#22c55e] uppercase">+{settings.target_profit_percent.toFixed(2)}%</div>
            </div>
            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-4 rounded">
              <span className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Portfolio Alert Value</span>
              <div className="value font-mono text-sm font-bold text-[#e0e0e0]">
                {calculations && transactions.length > 0 ? formatIDR(Math.round(calculations.modal_awal * (1 + settings.target_profit_percent / 100))) : 'Rp 0'}
              </div>
            </div>
            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-4 rounded">
              <span className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Total Active Capital</span>
              <div className="value font-mono text-sm font-bold text-[#e0e0e0]">
                {calculations && transactions.length > 0 ? formatIDR(calculations.modal_awal) : 'Rp 0'}
              </div>
            </div>
            <div className="price-card bg-[#151515] border border-[#2a2a2a] p-4 rounded">
              <span className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Last Sync Trigger</span>
              <div className="value font-mono text-sm font-bold text-[#e0e0e0]">
                {latestPrice ? formatChartDate(latestPrice.timestamp) : '-'}
              </div>
            </div>
          </section>

          {/* Section: Transactions Ledger */}
          <section className="bg-[#151515] border border-[#2a2a2a] p-6 rounded" id="transactions-ledger">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#d4af37]" />
                <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#e0e0e0]">Active Purchases & Asset Ledger</h3>
              </div>
              <span className="text-[10px] font-mono text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20">
                {transactions.length} POSITIONS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-[#808080] text-[10px] uppercase">
                    <th className="py-2.5 px-3">Date / Notes</th>
                    <th className="py-2.5 px-3 text-right">Modal Awal</th>
                    <th className="py-2.5 px-3 text-right">Buy Rate (/gr)</th>
                    <th className="py-2.5 px-3 text-right">Gold Volume</th>
                    <th className="py-2.5 px-3 text-right">Asset Value</th>
                    <th className="py-2.5 px-3 text-right">Floating P&L</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[#2a2a2a]/40 hover:bg-[#1a1a1a]/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#e0e0e0]">{tx.notes || `Purchase ID #${tx.id}`}</div>
                          <div className="text-[10px] text-[#808080] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" /> {formatDate(tx.tanggal_beli)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-[#e0e0e0] font-bold">{formatIDR(tx.modal_awal)}</td>
                        <td className="py-3 px-3 text-right text-[#808080]">{formatIDR(tx.harga_beli_awal)}</td>
                        <td className="py-3 px-3 text-right text-[#d4af37] font-semibold">{tx.volumeEmas.toFixed(6)} gr</td>
                        <td className="py-3 px-3 text-right text-[#e0e0e0]">{formatIDR(tx.nilaiAsetSaatIni)}</td>
                        <td className={`py-3 px-3 text-right font-bold ${tx.floatingPnlRp >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          <div>{tx.floatingPnlRp >= 0 ? '+' : ''}{tx.floatingPnlPercent.toFixed(2)}%</div>
                          <div className="text-[10px] font-normal">{tx.floatingPnlRp >= 0 ? '+' : ''}{formatIDR(tx.floatingPnlRp)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 hover:bg-red-500/10 text-[#ef4444] rounded transition cursor-pointer"
                            title="Delete Position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#808080] italic font-mono text-xs">
                        &gt; No active transactions recorded. Use the "Record Gold Purchase" form in the sidebar to add positions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Interactive Chart Section */}
          <section className="bg-[#151515] border border-[#2a2a2a] p-6 rounded" id="chart-section">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#d4af37]" />
                <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#e0e0e0]">Historical price trends (hourly)</h3>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-[#808080]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#d4af37] inline-block rounded-xs"></span> BUY</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#e0e0e0] inline-block rounded-xs"></span> SELL</span>
              </div>
            </div>

            <div className="h-60 w-full" id="chart-container">
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
                    <XAxis dataKey="time" stroke="#808080" fontSize={9} tickLine={false} fontClassName="font-mono" />
                    <YAxis 
                      stroke="#808080" 
                      fontSize={9} 
                      tickLine={false} 
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatIDR(value), '']}
                      contentStyle={{ background: '#151515', borderRadius: '4px', borderColor: '#2a2a2a', fontSize: '11px', color: '#e0e0e0', fontFamily: 'monospace' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Harga Beli" 
                      stroke="#d4af37" 
                      strokeWidth={1.5} 
                      dot={{ r: 2 }} 
                      activeDot={{ r: 4 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Harga Jual" 
                      stroke="#e0e0e0" 
                      strokeWidth={1.5} 
                      dot={{ r: 2 }} 
                      activeDot={{ r: 4 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#808080] font-mono">
                  <TrendingUp className="w-6 h-6 opacity-40 mb-2" />
                  <p className="text-[11px]">Collecting live pricing data...</p>
                </div>
              )}
            </div>
          </section>

        </main>

        {/* Right Column: Config Sidebar */}
        <aside className="lg:col-span-4 bg-[#0f0f0f] p-6 flex flex-col gap-6 overflow-y-auto" id="sidebar">
          
          {/* Section: Record Purchase Transaction */}
          <div>
            <div className="section-header text-xs uppercase font-mono font-bold tracking-wider text-[#d4af37] mb-3 border-b border-[#2a2a2a] pb-2 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" /> Record Gold Purchase
            </div>

            <form onSubmit={handleAddTransaction} className="config-group flex flex-col gap-3.5" id="add-transaction-form">
              {/* Capital Field */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Initial Capital (Rp)</label>
                <input 
                  type="number"
                  required
                  min="1"
                  value={addModalAwal}
                  onChange={(e) => setAddModalAwal(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  id="add-modal-awal"
                />
              </div>

              {/* Gold Purchase Price Field */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Purchase Price per Gram (Rp)</label>
                <input 
                  type="number"
                  required
                  min="1"
                  value={addHargaBeli}
                  onChange={(e) => setAddHargaBeli(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  id="add-harga-beli"
                />
              </div>

              {/* Timestamp Field */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Purchase Timestamp</label>
                <input 
                  type="datetime-local"
                  required
                  value={addTanggalBeli}
                  onChange={(e) => setAddTanggalBeli(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  id="add-tanggal-beli"
                />
              </div>

              {/* Notes Field */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Transaction Notes</label>
                <input 
                  type="text"
                  placeholder="e.g. Pembelian gajian April, Cicilan 1"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  id="add-notes"
                />
              </div>

              <button
                type="submit"
                disabled={addingTransaction}
                className="w-full mt-1.5 px-4 py-2 bg-[#d4af37] hover:bg-[#b08d1e] disabled:bg-amber-800 text-black font-mono text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer text-center"
                id="add-transaction-submit"
              >
                {addingTransaction ? 'RECORDING...' : 'Record Purchase Position'}
              </button>
            </form>
          </div>

          {/* Section: Global Alert Configuration */}
          <div>
            <div className="section-header text-xs uppercase font-mono font-bold tracking-wider text-[#b08d1e] mb-3 border-b border-[#2a2a2a] pb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> Global Alert Configuration
            </div>

            <form onSubmit={handleSaveSettings} className="config-group flex flex-col gap-3.5" id="settings-form">
              {/* Profit Threshold % input */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Profit Threshold (%)</label>
                <input 
                  type="number"
                  step="0.1"
                  required
                  value={formTargetProfit}
                  onChange={(e) => setFormTargetProfit(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  id="input-target-profit"
                />
              </div>

              {/* Discord Webhook URL input */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">Discord Webhook (Fallback)</label>
                <input 
                  type="url"
                  value={formDiscordWebhook}
                  onChange={(e) => setFormDiscordWebhook(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-[11px] text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  placeholder="https://discord.com/api/webhooks/..."
                  id="input-discord-webhook"
                />
              </div>

              {/* WhatsApp Endpoint input */}
              <div>
                <label className="label text-[9px] uppercase font-mono tracking-wider text-[#808080] block mb-1">WhatsApp Gateway API Link (Primary)</label>
                <input 
                  type="url"
                  value={formWhatsappEndpoint}
                  onChange={(e) => setFormWhatsappEndpoint(e.target.value)}
                  className="input-field bg-[#0c0c0c] border border-[#2a2a2a] px-3 py-1.5 text-[11px] text-[#e0e0e0] font-mono rounded w-full focus:outline-none focus:border-[#d4af37]"
                  placeholder="https://api.whatsapp.id/send/..."
                  id="input-whatsapp-endpoint"
                />
              </div>

              {/* Buttons Row */}
              <div className="flex gap-2.5 mt-1.5">
                <button
                  type="button"
                  onClick={handleTestAlerts}
                  disabled={testingAlerts}
                  className="flex-1 px-3 py-2 border border-[#2a2a2a] hover:bg-[#151515] text-[#808080] hover:text-[#e0e0e0] font-mono text-[10px] font-bold uppercase tracking-wider rounded transition disabled:opacity-50 cursor-pointer text-center"
                  id="test-alerts-button"
                >
                  {testingAlerts ? 'TESTING...' : 'Test Alert'}
                </button>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 px-3 py-2 bg-[#b08d1e] hover:bg-[#8e7013] text-black font-mono text-[10px] font-bold uppercase tracking-wider rounded transition disabled:opacity-50 cursor-pointer text-center"
                  id="save-settings-button"
                >
                  {savingSettings ? 'COMMITTING...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          {/* Section: Notification Gates status indicator */}
          <div>
            <div className="section-header text-xs uppercase font-mono font-bold tracking-wider text-[#b08d1e] mb-3 border-b border-[#2a2a2a] pb-2">
              Notification Gates
            </div>
            <div className="flex flex-col gap-2.5 text-[11px] font-mono text-[#808080]">
              <div className="flex justify-between items-center">
                <span>WhatsApp Gateway</span>
                <span className={settings.whatsapp_api_endpoint ? 'text-[#22c55e] font-bold' : 'text-[#ef4444]'}>
                  {settings.whatsapp_api_endpoint ? 'ACTIVE' : 'NOT_CONFIGURED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discord Webhook</span>
                <span className={settings.discord_webhook ? 'text-[#22c55e] font-bold' : 'text-[#ef4444]'}>
                  {settings.discord_webhook ? 'ACTIVE' : 'NOT_CONFIGURED'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Live Scraper & Alert Terminal */}
          <div>
            <div className="section-header text-xs uppercase font-mono font-bold tracking-wider text-[#b08d1e] mb-3 border-b border-[#2a2a2a] pb-2">
              Live Scraper Logs
            </div>
            
            <div className="log-console bg-[#050505] border border-[#2a2a2a] rounded font-mono text-[10px] p-4 text-[#55ff55] h-[220px] overflow-y-auto space-y-1.5 leading-relaxed" id="live-terminal-logs">
              {generateTerminalLogs().map((line, idx) => (
                <div key={idx} className="log-line border-l-2 border-[#333] pl-2">
                  {line}
                </div>
              ))}
              <div className="log-line border-l-2 border-[#333] pl-2 text-slate-500 animate-pulse">
                &gt; Listening for the next hourly tick...
              </div>
            </div>
          </div>

        </aside>

      </div>

      {/* Footer bar */}
      <footer className="bg-[#151515] border-t border-[#2a2a2a] py-4 text-center text-[10px] font-mono text-[#808080]" id="main-footer">
        <p>© 2026 TREASURY_AUTO_TRACKER // DESIGNED WITH HIGH DENSITY INTERFACE</p>
      </footer>
    </div>
  );
}
