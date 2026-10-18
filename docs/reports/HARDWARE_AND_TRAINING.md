# APPARAT VA TRENING BO'YICHA TEXNIK QO'LLANMA: HARDWARE_AND_TRAINING.md
**Loyiha:** From-Scratch O'zbekcha Kognitiv Til Modeli  
**Sana:** 2026-10-17  
**Holat:** Ishlab chiqarish darajasida tekshirilgan

---

## 1. MAVJUD APPARAT TAHLILI (HARDWARE SPECIFICATIONS)

Loyiha amalga oshirilayotgan ishchi kompyuterning real xususiyatlari:

| Resurs turi | Haqiqiy parametr | Mavjud cheklov va tavsiya |
| :--- | :--- | :--- |
| **Markaziy Protsessor (CPU)** | Intel(R) Core(TM) i5-2400 @ 3.10GHz (4 yadro, 4 ip) | AVX1 qo'llab-quvvatlaydi, AVX2 yo'q. Float32Array vektorlashtirilgan hisob-kitoblar tavsiya etiladi. |
| **Operativ Xotira (RAM)** | Jami 7.2 GiB (Bo'sh: $\sim 2.5\text{ GiB}$, Swap: 19 GiB) | Katta batch size (32+) RAM OOM xavfini tug'diradi. Tavsiya: batch 8-16, seq len 32-48. |
| **Grafik Protsessor (GPU)** | NVIDIA GeForce GTX 750 Ti (GM107, Compute Capability 5.0) | VRAM: **2048 MiB (2 GB)**. Xwayland/Desktop $\sim 520\text{ MB}$ oladi, qolgan bo'sh: $\approx 1.5\text{ GB}$. |
| **Drayver va CUDA** | Driver 580.178.04, CUDA 13.0 | Zamonaviy PyTorch CUDA relizlari CC 5.0 (sm_50) ni qo'llab-quvvatlamaydi. `gpu.js` WebGL shaderlari ishlaydi. |
| **Disk Xotirasi** | 109 GB (Band: 93 GB, Bo'sh: **11 GB** — 90% to'la) | Og'ir gigabaytlik checkpointlar yozish taqiqlanadi (disk to'lib qolishi mumkin). Faqat best/latest JSON saqlanadi. |
| **Dasturiy Muhit** | Node.js v22.23.2, Python 3.14.4 (torch yo'q) | Sof, tezkor, o'zaro mos JavaScript Float32Array arxitekturasi eng maqbul va barqaror tanlovdir. |

---

## 2. 2,500 – 3,000 TA NAMUNANING HAQIQIY IMKONIYATLARI VA CHEKLOVLARI

Muhandislik tamoyillariga ko'ra, sun'iy intellekt bo'yicha illyuziyalarga yo'l qo'yilmaydi:

1. **Umumiy bilimlar va Dunyoqarash:**
   - 2,500 – 3,000 ta jumla ($\approx 40,000 - 60,000$ token) bilan ChatGPT yoki LLaMA kabi global enciklopedik bilimga ega ulkan LLM yaratish **ilmiy va amaliy jihatdan mumkin emas**.
   - Buning uchun milliardlab tokenlar (Wikipedia, kitoblar, yangiliklar korpusi) kerak bo'ladi.
2. **Ushbu hajmda nimalarga erishish mumkin:**
   - O'zbek tili grammatik qoliplarini, fe'l bog'lanishlarini va so'z tartibini (Ega — To'ldiruvchi — Kesim) o'rganish;
   - Kundalik dialog vaziyatlarida (salomlashish, hol-ahvol, dalda berish, hazil) mantiqiy javob berish;
   - Prompt-Response (SFT) orqali kiritilgan savolga mos kontekstda javob qaytarish;
   - Kognitiv xotiraga kiritilgan yangi faktlarni eslab qolish va dialogda qo'llash.

---

## 3. MODEL MASHTABI VA PARAMETRLAR LOGIKASI

Mavjud apparat (i5 CPU va 2GB VRAM) uchun tanlangan optimal Transformer konfiguratsiyasi:

* **Model nomi:** `UzbekCausalTransformer-v1`
* **Qatlamlar soni ($n_{layers}$):** 2 ta Decoder Block
* **Attention boshlari ($n_{heads}$):** 4 ta (har bir bosh $d_k = 16$)
* **Yashirin o'lcham ($d_{model}$):** 64
* **Feed-Forward kengligi ($d_{ffn}$):** 256 ($4 \times d_{model}$)
* **Kontekst oynasi ($maxSeqLen$):** 48 token
* **Subword Lug'ati ($V$):** 396 token
* **Jami parametrlar:** **153,344 ta** (153.3k)
* **Xotira sarfi (RAM):** $\approx 45\text{ MB}$ (ultra-yengil, tezkor, OOM xavfi 0%)
* **Inference tezligi:** 150–350 token/soniya (Intel i5 CPU da)

---

## 4. MA'LUMOTLAR VA LEAKAGE MONITORINGI

Treningda overfitting va ma'lumotlar buzilishini oldini olish qoidalari:
1. **Shaffof Split:** 80% Train, 10% Validation, 10% Test.
2. **Deterministik Xesh:** Har bir jumla normalizatsiya qilinib SHA256 xeshlanadi. Ikki to'plamda bir xil xesh takrorlanishi test darajasida taqiqlangan.
3. **Loss Masking:** Model inson savolini yodlab olmasligi uchun `<human>` qismi gradient hisobidan chiqariladi (mask=0). Gradientlar faqat model javobi (`<bot>` qismi) bo'yicha orqaga uzatiladi.
4. **Early Stopping:** Agar Validation loss ketma-ket 4 epoxa davomida yaxshilanmasa, modelning ortiqcha yodlab olishi (overfitting) to'xtatiladi.
