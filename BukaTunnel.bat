@echo off
title Membuka Terowongan Publik Cloudflare
color 0A
echo.
echo ========================================================
echo MEMPERSIAPKAN CLOUDFLARE ZERO TRUST KE PORT LOKAL 3000
echo ========================================================
echo.
echo Menjalankan daemon cloudflared.exe...
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
pause
