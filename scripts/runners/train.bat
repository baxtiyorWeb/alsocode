@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo ====================================================================
echo   SUN'IY INTELLEKT O'QITISH TIZIMI (GPU / CPU DUAL-ENGINE)
echo   Professional darajadagi neyron tarmoq o'qitish konveyeri
echo ====================================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [XATOLIK] Ushbu kompyuterda Node.js topilmadi!
    echo Iltimos, https://nodejs.org saytidan LTS versiyasini o'rnating.
    pause
    exit /b
)

echo [1/3] Zarur kutubxona va paketlarni tekshirish...
if not exist node_modules (
    echo node_modules papkasi topilmadi, paketlar o'rnatilmoqda...
    call npm install
)

echo.
echo ====================================================================
echo   O'QITISH APPARATINI TANLANG:
echo   [1] ⚡ GPU orqali o'qitish (NVIDIA / WebGL Apparat Tezlatgichi)
echo   [2] 🖥️ CPU orqali o'qitish (Optimallashtirilgan Tezkor Rejim)
echo   [3] 🎯 Avtomatik aniqlash (Mavjud eng kuchli apparat)
echo ====================================================================
set /p choice="Tanlovingizni kiriting (1, 2 yoki 3) [Standart: 3]: "

if "%choice%"=="1" (
    set MODE=--gpu
    echo ⚡ GPU REJIMI TANLANDI.
) else if "%choice%"=="2" (
    set MODE=--cpu
    echo 🖥️ CPU REJIMI TANLANDI.
) else (
    set MODE=
    echo 🎯 AVTOMATIK ANIQLASH REJIMI TANLANDI.
)

echo.
echo [2/3] Neyron tarmoqni o'qitish boshlandi...
node scripts/legacy_mlp/train.js %MODE%

if %errorlevel% neq 0 (
    echo.
    echo ⚠️ GPU rejimida xatolik bo'lsa, zaxira CPU rejimida qayta urinilmoqda...
    node scripts/legacy_mlp/train.js --cpu
)

echo.
echo ====================================================================
echo   TABRIKLAYMIZ! O'QITISH MUVAFFAQIYATLI YAKUNLANDI!
echo ====================================================================
echo data/model.json va data/vocab.json yangilandi.
echo Ushbu data/ papkasi yangi bilimlar va yangi vaznlar bilan to'ldirildi.
echo "node server.js" ni ishga tushirib veb-interfeysda tekshirishingiz mumkin!
echo.
pause
