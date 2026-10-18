@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
title Sun'iy Intellekt Neyron Tarmoq - CPU O'qitish (Optimallashtirilgan)
echo =======================================================================
echo   SUN'IY INTELLEKTNI CPU (PROTSESSOR) BILAN O'QITISH
echo =======================================================================
echo.

node scripts/legacy_mlp/train_cpu.js

echo.
echo =======================================================================
echo Jarayon yakunlandi. Chiqish uchun istalgan tugmani bosing...
echo =======================================================================
pause > nul
