========================================================================
SUN'IY INTELLEKTNI O'QITISH (TRAINING) BO'YICHA TO'LIQ QO'LLANMA (GPU & CPU)
========================================================================

Ushbu paket sun'iy intellekt neyron tarmog'ini ham GPU (apparat grafik kartasi),
ham CPU (protsessor) orqali professional darajada o'qitish imkoniyatiga ega.

1. BUYRUQLAR ORQALI ISHGA TUSHIRISH (CLI):
------------------------------------------------------------------------
- GPU orqali o'qitish (NVIDIA / WebGL CUDA yadrolari):
    npm run train:gpu
    # yoki
    node train.js --gpu

- CPU orqali o'qitish (Optimizatsiyalangan Sparse-vektor algoritmi):
    npm run train:cpu
    # yoki
    node train.js --cpu

- Avtomatik rejim (GPU mavjud bo'lsa GPU, aks holda CPU):
    npm run train
    # yoki
    node train.js

2. WINDOWS FOYDALANUVCHILARI UCHUN (1-KLIK BILAN):
------------------------------------------------------------------------
- "train.bat" faylini 2 marta bosing.
- Sizga qulay menyu chiqadi:
    [1] GPU orqali o'qitish (NVIDIA / WebGL)
    [2] CPU orqali o'qitish (Optimallashtirilgan)
    [3] Avtomatik aniqlash (Auto-detect)
- Kerakli raqamni tanlang (1 yoki 2) va Enter bosing.

3. VEB BOSHQARUV PANELI (WEB UI) ORQALI:
------------------------------------------------------------------------
- Serverni yoqing:
    npm start   (yoki node server.js)
- Brauzerda http://localhost:3000 ga kiring.
- Yuqori o'ng burchakda apparat indikatori turadi:
    ⚡ GPU Faol (NVIDIA GeForce GTX ...)  yoki  🖥️ CPU Faol
- "Tarmoqni qayta o'qitish" bo'limida menyudan "⚡ GPU (Tezlashtirilgan)" yoki
  "🖥️ CPU (Protsessor)" ni tanlab, bitta tugma bilan o'qitishni boshlashingiz mumkin.

4. MODEL VA MA'LUMOTLAR MOSLIGI:
------------------------------------------------------------------------
- GPU va CPU dvigatellari 100% bir xil arxitektura va og'irlik formatidan foydalanadi.
- GPU da o'qitilgan model CPU da, CPU da o'qitilgan model GPU da hech qanday
  o'zgarishsiz ishlayveradi.
- Natijalar avtomatik tarzda:
    1) data/model.json
    2) data/vocab.json
    3) Neon Serverless PostgreSQL bazasiga (agar internet ulangan bo'lsa)
  sinxronda saqlanadi.
========================================================================
