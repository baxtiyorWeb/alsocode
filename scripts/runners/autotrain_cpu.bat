@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
title Sun'iy Intellekt - Auto-Train + CPU O'qitish (Optimallashtirilgan)
echo =======================================================================
echo   AVTOMATIK BILIM GENERATSIYASI VA CPU ORQALI O'QITISH
echo =======================================================================
echo.

node scripts/autotrain_cpu.js

echo.
echo =======================================================================
echo Jarayon yakunlandi. Chiqish uchun istalgan tugmani bosing...
echo =======================================================================
pause > nul
