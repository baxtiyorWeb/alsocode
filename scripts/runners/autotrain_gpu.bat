@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
title Sun'iy Intellekt - Auto-Train + GPU O'qitish (NVIDIA / WebGL)
echo =======================================================================
echo   AVTOMATIK BILIM GENERATSIYASI VA GPU ORQALI O'QITISH
echo =======================================================================
echo.

node scripts/autotrain_gpu.js

echo.
echo =======================================================================
echo Jarayon yakunlandi. Chiqish uchun istalgan tugmani bosing...
echo =======================================================================
pause > nul
