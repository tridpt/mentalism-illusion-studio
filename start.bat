@echo off
chcp 65001 >nul
title ArcanaMind - Mentalism ^& Illusion Studio (Port 4155)
echo ============================================================
echo   ArcanaMind - San Khau Ao Thuat Toan Hoc ^& Ao Giac Thi Giac
echo   Dia chi truy cap: http://localhost:4155
echo ============================================================
node --experimental-sqlite --no-warnings server.js
pause
