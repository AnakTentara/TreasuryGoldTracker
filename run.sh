#!/bin/bash
# run.sh - Pterodactyl Startup Script Execution

echo "=== STARTING TREASURY AUTOMATION MONITORING APP ==="

# 1. Validasi Ekosistem Node Core
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules tidak ditemukan. Menginstal dependensi..."
    npm install --omit=dev
fi

# 2. Inisialisasi Database
echo "[INFO] Menjalankan pengecekan skema database lokal..."
node src/database/db_init.js

# 3. Eksekusi Aplikasi Utama
# Menjalankan server web dashboard (Express) yang juga mengeksekusi worker loop di latar belakang
echo "[INFO] Meluncurkan Web Dashboard & Monitoring Engine..."
# If compiled for production, run compiled server. Otherwise start with tsx.
if [ -f "dist/server.cjs" ]; then
    exec node dist/server.cjs
else
    # Install tsx if missing in dev mode, but in production we prefer compiled code
    exec npx tsx server.ts
fi
