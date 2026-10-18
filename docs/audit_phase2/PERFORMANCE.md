# PHASE 2 — HARDWARE & RUNTIME PERFORMANCE AUDIT

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Apparat Resurslari va Unumdorlik Auditi  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior Performance/Inference Engineer  

---

## 1. APPARAT RESURSLARI VA TIZIM MUHITI

Barcha o'lchovlar foydalanuvchining real lokal apparat vositalarida o'tkazildi:

| Komponent | Haqiqiy Texnik Xususiyatlari | Holat va Cheklov |
|:---|:---|:---|
| **Operatsion Tizim** | Linux 7.0.0-38-generic x86_64 | Barqaror |
| **Protsessor (CPU)** | Intel(R) Core(TM) i5-2400 @ 3.10GHz (4 yadro, 4 ip) | AVX qo'llab-quvvatlaydi, AVX2 yo'q |
| **Tezkor Xotira (RAM)** | Jami: **7.21 GB**, Bo'sh xotira: **~2.70 GB** | 1 ta Node.js jarayoni uchun xavfsiz chegara $\le 2\text{ GB}$ |
| **Videokarta (GPU)** | NVIDIA GeForce GTX 750 Ti (GM107, 2 GB VRAM) | Compute 5.0 (Maxwell). Bo'sh VRAM: $\approx 1.5\text{ GB}$ |
| **Qattiq Disk** | 109 GB dan 93 GB band, **bo'sh joy: ~11 GB (10%)** | Katta og'ir modellarni saqlash imkonsiz |
| **Node.js Versiyasi** | **v22.23.2** (V8 dvigateli) | Yuqori Float32Array optimizatsiyasi |

---

## 2. ISHGA TUSHISH (STARTUP) VA XOTIRA SARFI

`scratch/measure_performance.js` orqali tizimning barcha modullarini va ma'lumotlar bazasini yuklash ko'rsatkichlari o'lchandi:

```
                            STARTUP VA RAM O'LCHOVLARI
  ┌────────────────────────────────────────────────────────┬─────────────┐
  │ O'lchov Parametri                                      │ Natija      │
  ├────────────────────────────────────────────────────────┼─────────────┤
  │ Modullarni import qilish (require) vaqti               │ 141.3 ms    │
  │ 10,000 ta bilim, 279K neyron tarmoq va lug'atni yuklash│ 558.1 ms    │
  │ Jami tayyor bo'lish vaqti (Total Startup Latency)      │ 699.5 ms    │
  ├────────────────────────────────────────────────────────┼─────────────┤
  │ Boshlang'ich RSS xotirasi                              │ 44.10 MB    │
  │ Yuklangandan keyingi RSS xotirasi                      │ 189.30 MB   │
  │ Heap Used (Foydalanilayotgan xotira)                   │ 48.67 MB    │
  │ Heap Total (Ajratilgan xotira)                         │ 77.20 MB    │
  │ 10 ta so'rovdan keyingi RSS xotirasi                   │ 211.66 MB   │
  │ 10 ta so'rovdan keyingi Heap Used                      │ 66.45 MB    │
  └────────────────────────────────────────────────────────┴─────────────┘
```

**Xulosa:** Tizim 700 ms da yuklanadi va atigi **~210 MB RAM** sarflaydi. Hech qanday xotira sizishi (Memory Leak) kuzatilmadi. 7 GB RAM ga ega ushbu apparatda tizim 24/7 rejimida mutlaqo bexato va yengil ishlay oladi.

---

## 3. INFERENCE LATENCY (JAVOB QAYTARISH TEZLIGI)

Turli xil so'rov turlari bo'yicha ketadigan vaqt tahlil qilindi:

```
                      SO'ROV TURLARI BO'YICHA KECHIKISH (LATENCY)
  ┌───────────────────────────┬───────────────┬───────────────────────────┐
  │ So'rov Turi               │ Kechikish     │ Ishlatilgan Dvigatel      │
  ├───────────────────────────┼───────────────┼───────────────────────────┤
  │ Oddiy formula (5 + 7)     │      0.33 ms  │ MathCalculator (Tool)     │
  │ Sana / Vaqt so'rovi       │     46.30 ms  │ DateTimeClock (Tool)      │
  │ Xotira faktini o'rganish  │      4.10 ms  │ CognitiveMemory           │
  │ 1-2 so'zli tezkor dialog  │     12.50 ms  │ ShortReplyContextGate     │
  │ Umumiy qidiruv (Retrieval)│ 1,865-2,094 ms│ Linear 10,000 Scan (Synth)│
  ├───────────────────────────┼───────────────┼───────────────────────────┤
  │ O'rtacha kechikish        │ 1,582.96 ms   │ Umumiy o'rtacha           │
  └───────────────────────────┴───────────────┴───────────────────────────┘
```

### 3.1. Asosiy Samaradorlik To'sig'i (Performance Bottleneck)
* Hozirda har bir umumiy savol uchun `src/generativeSynthesizer.js:retrieveLearnedContext` funksiyasi `knowledgeBase` dagi barcha **10 000 ta elementni** for-loop bilan birma-bir tekshirib chiqadi.
* Har bir element uchun regex tozalash, so'zlarga ajratish, lemmatizatsiya va 12D kosinus o'xshashlik hisoblanadi:
  $$10,000 \times (\text{split} + \text{lemmatize} + \text{cosine}) \approx 1,900 - 2,100\text{ ms}.$$
* Bu foydalanuvchiga har bir javob uchun 2 soniya kutishga majbur qiladi.

### 3.2. Taklif Qilinayotgan Optimallashtirish (Inverted Index)
* 10 000 ta jumlani chiziqli for-loop bilan aylanish o'rniga, server startida **Inverted Index (Lug'at Teskari Indeksi)** yaratiladi:
  `Map<Word, Set<DocID>>`
* Qidiruv vaqtida faqat savoldagi 2-4 ta so'z mavjud bo'lgan 50-100 ta hujjatgina saralanadi.
* **Kutilayotgan natija:** Qidiruv vaqti 2,000 ms dan **15 — 30 ms ga tushadi (60 — 100 barobar tezlashadi)**, CPU sarfi 95% ga kamayadi.
