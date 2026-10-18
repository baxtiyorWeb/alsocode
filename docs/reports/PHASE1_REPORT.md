# PHASE 1 — YAKUNIY BOSQICH HISOBOTI (COMPREHENSIVE ARCHITECTURAL REPORT)

**Loyiha:** O'zbek Tili Uchun Mustaqil Lokal Til Modeli (Uzbek LLM Studio)  
**Bosqich:** Phase 1 & Phase 1.5 Yakuni  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior ML Engineering Team  
**Uskuna Resurslari:** Intel Core i5-2400 (4 yadro), 7 GB RAM, NVIDIA GeForce GTX 750 Ti (2 GB VRAM), ~11 GB bo'sh disk  

---

## 1. LOYIHANING STRATEGIK MAQSADI VA MEZONLARI

Ushbu loyihaning bosh maqsadi — tashqi sun'iy intellekt API'lariga (Gemini, OpenAI, Anthropic va h.k.) qaram bo'lmagan, o'zbek tilining fonetik, morfologik va semantik qonuniyatlarini o'z ichki parametrlari (og'irliklari) orqali o'rganadigan, lokal kompyuterda mustaqil ravishda ishlaydigan xususiy til modelini yaratishdir.

### Asosiy Qoidalar:
1. **Lokal Inference:** Model javob berish vaqtida hech qanday tashqi AI API'larga murojaat qilmaydi.
2. **Haqiqiy O'rganish:** Model javoblari qotib qolgan shablonlar (canned templates) yoki simulyatsiyaga emas, balki gradientlar orqali o'qitilgan parametrlarga va o'rganilgan ma'lumotlarga tayanadi.
3. **Mavjud Pipeline Daxlsizligi:** Tashqi `aiGateway` faqat oflayn ma'lumot yig'ish va dataset yaratish bosqichida xizmat qiladi, inference bilan aralashtirilmaydi.

---

## 2. DATASET INVENTARIZATSIYASI VA 10 000 TA MAQSAD SARI HOLAT

Ma'lumotlar bazasi taxminlar bilan emas, kod orqali hisoblangan aniq raqamlar bilan xatlovdan o'tkazildi:

| Ko'rsatkich | Haqiqiy Qiymat | Izoh |
| :--- | :--- | :--- |
| **Lokal `data/knowledge.json`** | **10 000 ta** | Neon PostgreSQL bilan to'liq sinxronlangan (2-qadam yakuni ✅) |
| **Neon PostgreSQL (`ai_knowledge`)** | **10 000 ta** | Serverless bazada to'plangan unikal namunalar |
| **Birlashgan Unikal To'plam** | **10 000 ta** | Barcha dublikatlar SHA-256 xesh orqali chiqarilgan |
| **Takroriy Yozuvlar (Duplicates)** | **0 ta** | Normalizatsiyalangan matn darajasida dublikat yo'q |
| **10 000 ta Maqsadga Nisbatan** | **100.0%** | **MARRAGA TO'LIQ ERISHILDI!** (Qolgan: 0 ta) |

### 2.1. Kategoriyalar Taqsimoti
To'plam 116 ta toifadan iborat bo'lib, quyidagi yirik bloklarga bo'lingan:
* **Kundalik til va ijtimoiy suhbat:** 5 855 ta (58.55%)
* **Sabab-oqibat va deduktiv mantiq:** 1 200 ta (12.0%)
* **Matematika va algoritmik fikrlash:** 1 000 ta (10.0%)
* **Ko'p bosqichli savol-javob:** 1 000 ta (10.0%)
* **Xatolarni aniqlash va tuzatish:** 945 ta (9.45%)

### 2.2. Sintetik Ma'lumotlar Sifati va Reasoning Ulushi
* **Reasoning va Instruction ulushi:** **41.45% (4 145 ta yangi unikal namuna)**.
* **Sifat kafolati:** Mantiqiy va matematik masalalar tasodifiy gallyutsinatsiyalarga emas, balki qat'iy mantiqiy qoidalar, amallar tartibi va qadam-baqadam izohlar asosida tekshirib kiritildi.
* **10 000 ta yakuniy taqsimot:**
  1. *5 855 ta* — O'zbekcha til, umumiy bilim va kundalik suhbat (100% mavjud ✅)
  2. *1 200 ta* — Sabab-oqibat va deduktiv mantiq (100% mavjud ✅)
  3. *1 000 ta* — Matematika va algoritmik fikrlash (100% mavjud ✅)
  4. *1 000 ta* — Ko'p bosqichli savol-javob (100% mavjud ✅)
  5. *945 ta* — Xatolarni topish, tuzatish va tushuntirish (100% mavjud ✅)

---

## 3. TRAIN, VALIDATION VA TEST TAQSIMOTI (`data/dataset_splits.json`)

Tizimda ma'lumotlarning bir-biriga sizib o'tishini (Data Leakage) oldini oluvchi deterministik ajratish yangilandi:

* **Random Seed:** 42 (Mulberry32 PRNG va SHA-256 xeshlash)
* **Train to'plami:** 7 996 ta namuna (80%) — model parametrlari gradientlarini o'rganish uchun.
* **Validation to'plami:** 999 ta namuna (10%) — giperparametrlarni baholash va overfittingni nazorat qilish uchun.
* **Test to'plami:** 1 000 ta namuna (10%) — yakuniy mustaqil tekshirish uchun.
* **Leakage tekshiruvi:** $0.0\%$ kesishish (Train va Test orasida aynan bir xil matnlar mavjud emas).

---

## 4. MODEL ARXITEKTURASI VA O'QITISH AUDITI

Loyihada parallel ravishda uchta darajadagi model komponentlari mavjud:

```
                            LOYIHA ARXITEKTURASI
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
src/neuralNetwork.js           src/generator.js           src/transformerModel.js
(24-neyronli MLP)              (Heuristik N-gram)         (Causal Transformer)
Niyat tasniflagich             Bi/Trigram + Cosine        2 Layer, 4 Head, 64-dim
(Classification)               (Prior + Softmax)          (Autoregressive Decoder)
```

### 4.1. Causal Decoder-Only Transformer (`src/transformerModel.js`)
* **Arxitektura:** 2 ta Transformer Decoder bloki, $d_{model} = 64$, 4 ta Attention boshi ($d_k = 16$), $d_{ffn} = 256$, Pre-LayerNorm, GELU faollashtiruvchisi, Causal Attention Mask.
* **Tokenizatsiya:** `src/uzbekTokenizer.js` (BPE, 396 subword).
* **Trening natijalari:** Checkpoint `data/checkpoints/transformer_best.json` da 12 epoch o'qitilgan, `trainLoss: 4.79`, `valLoss: 5.00`, `valPerplexity: 149.1`.
* **Aniqlangan texnik cheklov:** `trainStep` funksiyasida gradient faqat `lm_head`, `wte` va `wpe` uchun hisoblanib, ichki Attention va FFN bloklariga uzatilmagan (ichki qatlamlar tasodifiy initsializatsiyada muzlatilgan holatda qolgan).

### 4.2. Kognitiv Xotira va RAG
* **Kognitiv xotira (`src/memory.js`):** Simvolik JSON saqlash vositasi. Neyron tarmoq parametrlarini o'zgartirmaydi. Faktlarni suhbat vaqtida 0 ms da eslab qolish imkonini beradi.
* **RAG (`src/rag.js`):** 12-o'lchamli Skip-gram vektorlari va kosinus o'xshashlik orqali ishlaydi. Aloqasiz hujjatlar yuqori ball olmasligi uchun leksik kalit so'z filtri o'rnatildi.

---

## 5. MUSTAQIL 50 TA REASONING TEST NATIJALARI

Kognitiv xotira va RAG bazasida aynan saqlanmagan 50 ta yangi mantiqiy savol bo'yicha mustaqil baholash o'tkazildi:

* **Jami testlar:** 50 ta
* **To'g'ri xulosa chiqarilgan:** 5 ta (**10.0%**)
* **Halol rad etilgan ("Bilmayman"):** 10 ta (**20.0%**)
* **Noto'g'ri bog'langan / Adashgan:** 35 ta (**70.0%**)

### Toifalar bo'yicha tahlil:
1. **Deduktiv mantiq va arifmetika (10 — 22%):** Faqat sodda arifmetik tool orqali yoki qisman so'z mosligi hisobiga to'g'ri chiqdi.
2. **Sabab-oqibat va xatolarni aniqlash (0.0%):** Modelda sababiy bog'liqlik zanjirini quruvchi og'irliklar mavjud bo'lmagani sababli, savoldagi bitta so'z orqali bazadagi boshqa mavzuni olib javob berish holatlari kuzatildi.

---

## 6. HARDWARE CHEKLOVLARI VA REALISTIK AMALGA OSHIRISH

* **Uskuna:** Intel Core i5-2400 (4 yadro), 7 GB RAM, GTX 750 Ti (2 GB VRAM).
* **Xulosa:** Katta 7B yoki 1B parametrlik modellarni ushbu kompyuterda o'qitish imkonsiz.
* **Amaliy optimal yechim:**
  * Parametrlar soni: **1.5 — 2.5 million parametr**
  * Qatlamlar: 4 ta Decoder bloki
  * $d_{model} = 128$, Attention Heads = 4 ($d_k = 32$), $d_{ffn} = 512$
  * Kontekst uzunligi: 64 — 128 token
  * BPE lug'ati: 2 048 — 4 096 subword
  * Xotira sarfi: ~350 MB VRAM / ~1 GB RAM. Bu model GTX 750 Ti da to'liq xotiraga sig'adi va tezkor ishlaydi.

---

## 7. KEYINGI BOSQICH UCHUN ANIQ REJA

1. **Neon DB dagi 2 796 ta yozuvni integratsiya qilish:** Neon bazadagi 5 855 ta ma'lumotni to'liq lokal keshga birlashtirish.
2. **4 145 ta mantiqiy instruction namunalarini yaratish:** Sabab-oqibat, arifmetika, deduksiya va xato tuzatishga qaratilgan savol-javob datasetini to'plash.
3. **Transformer Backpropagation'ni to'liq qatlamlarga ulash:** `src/transformerModel.js` da Attention va FFN qatlamlarini to'liq gradient yangilanishiga o'tkazish.
4. **Mustaqil Lokal SFT:** Modelni yangilangan datasetda o'qitib, tashqi API'larsiz mustaqil o'zbekcha avtoregressiv javob berishini ta'minlash.
