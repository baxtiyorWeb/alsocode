@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
title Sun'iy Intellekt Neyron Tarmoq - GPU O'qitish (NVIDIA / WebGL)
echo =======================================================================
echo   SUN'IY INTELLEKTNI GPU (GRAFIK KARTA) BILAN O'QITISH
echo =======================================================================
echo.

node scripts/legacy_mlp/train_gpu.js

echo.
echo =======================================================================
echo Jarayon yakunlandi. Chiqish uchun istalgan tugmani bosing...
echo =======================================================================
pause > nul
