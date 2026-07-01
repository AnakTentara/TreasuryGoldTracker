#!/bin/bash
# run.sh - Pterodactyl Startup Script Execution

echo "=== STARTING TREASURY AUTOMATION MONITORING APP ==="

# 1. Validasi Ekosistem Node Core
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules tidak ditemukan. Menginstal dependensi..."
    npm install --omit=dev
else
    # Verifikasi apakah binary native sqlite3 cocok dengan sistem (masalah GLIBC)
    echo "[INFO] Memverifikasi kecocokan binary SQLite..."
    node --input-type=module -e "import 'sqlite3'" &>/dev/null
    if [ $? -ne 0 ]; then
        echo "[WARNING] Terdeteksi ketidakcocokan binary native SQLite (biasanya karena perbedaan versi GLIBC di server)."
        echo "[INFO] Menjalankan rebuild sqlite3 dari source untuk server ini..."
        npm rebuild sqlite3 --build-from-source || npm install sqlite3 --force
    fi
fi

# 2. Inisialisasi Database
echo "[INFO] Menjalankan pengecekan skema database lokal..."
node src/database/db_init.cjs

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
