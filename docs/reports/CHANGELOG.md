# O'ZGARISHLAR VA MUHANDISLIK HISOBOTI: CHANGELOG.md
**Loyiha:** From-Scratch O'zbekcha Kognitiv Til Modeli (Uzbek LLM)  
**Sana:** 2026-10-17  
**Holat:** Bosqich A — F to'liq amalga oshirildi

---

## 1. DASTLABKI AUDIT VA ILMIY HAQIQATNING ANIQLANISHI
* **Audit hisoboti tuzildi:** [`CURRENT_STATE.md`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/CURRENT_STATE.md).
* **Aniqlangan haqiqat:**
  * Mavjud loyihada ilgari haqiqiy generative til modeli (Transformer LLM) bo'lmagan; mavjud tarmoq faqat 2 qatlamli Bag-of-Words niyat tasniflagichi (MLP) bo'lgan.
  * `src/attention.js` va `src/multiHeadAttention.js` faqat tasodifiy sonlardan iborat bo'lib, o'qitilmagan va veb-interfeysda heatmap chizish uchun ishlatilgan.
  * Dataset 100% Train setida o'qitilib, aynan o'sha to'plamda tekshirilgan (100% Data Leakage).
  * `package.json` dagi `"test": "node index.js"` va `"cli": "node cli.js"` mavjud bo'lmagan fayllarga yo'naltirilib, buzilgan bo'lgan.

---

## 2. YANGI YARATILGAN ARXITEKTURA VA MODULLAR

### A. Markaziy Konfiguratsiya
* **Fayl:** [`src/llmConfig.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/llmConfig.js)
* **Vazifasi:** Model o'lchamlari ($d_{model}=64$, $n_{heads}=4$, $d_{ffn}=256$, $n_{layers}=2$), maxsus tokenlar (`<pad>`, `<bos>`, `<eos>`, `<unk>`, `<human>`, `<bot>`), trening giperparametrlari (LR, warmup, cosine decay), va split nisbatlari (80/10/10).

### B. O'zbek Tili Subword Tokenizatori
* **Fayl:** [`src/uzbekTokenizer.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/uzbekTokenizer.js)
* **Xususiyatlari:**
  * Barcha apostrof variantlarini (`ʻ`, `ʼ`, `‘`, `’`, `'`, `` ` ``) yagona standart `'` ga unifikatsiya qiladi;
  * O'zbek tili harf birikmalari (`o'`, `g'`, `sh`, `ch`, `ng`) va agglyutinativ affikslarini to'g'ri bo'laklaydi;
  * Subword/Character fallback: noma'lum so'zlarni belgilarga ajratadi, OOV yo'qotish 0%;
  * 100% Round-trip fidelity (`decode(encode(text)) === text`).

### C. Causal Decoder-Only Transformer (Transformer-JS)
* **Fayl:** [`src/transformerModel.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/transformerModel.js)
* **Xususiyatlari:**
  * Causal Lower-Triangular Masking (kelajak tokenlarni ko'rish 100% to'silgan);
  * Multi-Head Scaled Dot-Product Self-Attention;
  * Pre-LayerNorm va Residual Connections;
  * Feed-Forward Network + GELU faollashtiruvchisi;
  * Output Projection (LM Head) va Next-Token Cross-Entropy Loss;
  * Analitik Backpropagation va parametrlar sonini shaffof hisoblash (`countParameters()`).

### D. Dataset Pipeline va Leakage Prevention
* **Fayl:** [`src/datasetPipeline.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/datasetPipeline.js)
* **Xususiyatlari:**
  * Bo'sh, yaroqsiz va noto'g'ri formatdagi matnlarni tozalash;
  * Normalized SHA256 Hash orqali dublikatlarni yo'qotish;
  * SFT dialog formatiga (`<human>: ...\n<bot>: ...<eos>`) keltirish;
  * Loss Masking: savol tokenlari uchun mask=0, faqat javob tokenlari uchun mask=1;
  * Train (80%), Val (10%), Test (10%) ga deterministik ajratish va cross-contamination yo'qligini tekshirish.

### E. Ishlab Chiqarish Darajasidagi Trening Dvigateli
* **Fayl:** [`src/transformerTrainer.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/transformerTrainer.js)
* **Xususiyatlari:**
  * Train Loss va Validation Loss alohida monitoring qilinadi;
  * Perplexity ($e^{\text{loss}}$) va Token Throughput (tok/s) hisoblanadi;
  * Warmup + Cosine Learning Rate Decay;
  * Early Stopping;
  * Checkpoint Save va Resume: to'xtatilgan epoxadan aynan o'sha nuqtadan davom ettirish (`resumeFromCheckpoint`).

### F. Mustaqil Reasoning & Generalization Benchmark
* **Fayl:** [`tests/reasoningBenchmark.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/tests/reasoningBenchmark.js)
* **Xususiyatlari:**
  * 14 ta mustaqil toifadagi testlar: arifmetika, sabab-oqibat, shartli masala, taqqoslash, inkor, kontekst saqlash, OOV generalizatsiyasi va boshqalar.

### G. Terminal Chatbot CLI & Master Test Runner
* **Fayllar:** [`cli.js`](file:///file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/cli.js), [`tests/test_runner.js`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/tests/test_runner.js)
* **Xususiyatlari:**
  * `npm test` barcha 4 ta test to'plamini to'liq tekshiradi;
  * `node cli.js` foydalanuvchiga terminal orqali model bilan bevosita muloqot qilish imkonini beradi.

---

## 3. AMALGA OSHIRILGAN VALIDATSIYA (VERIFICATION RESULTS)

1. `tests/test_tokenizer.js`:
   * Apostrof normalizatsiyasi: **O'TDI** (5 xil belgi yagona shaklga keltirildi);
   * Round-trip matn tiklanishi: **O'TDI** (100%);
   * OOV so'zlar himoyasi: **O'TDI** (belgilar bo'yicha to'liq tiklandi);
   * Maxsus tokenlar: **O'TDI**.
2. `tests/test_transformer_arch.js`:
   * Parametrlar hisobi: **O'TDI**;
   * Causal Masking: **O'TDI** (Farq: `0.00000000`);
   * Cross-Entropy Loss kamayishi: **O'TDI** (4.15 -> 2.88);
   * Autoregressive generatsiya: **O'TDI**;
   * Checkpoint tiklanish: **O'TDI** (Farq: `0.00000000`).
3. `tests/test_dataset_pipeline.js`:
   * Tozalash va deduplikatsiya: **O'TDI**;
   * 80/10/10 Split: **O'TDI**;
   * Data Leakage: **O'TDI** (0 ta kesishish);
   * SFT Loss mask: **O'TDI**.
4. `tests/test_trainer_resume.js`:
   * LR schedule (Warmup + Cosine): **O'TDI**;
   * Checkpoint saqlash (Epoxa 1-3): **O'TDI**;
   * Checkpointdan tiklash va davom ettirish (Epoxa 4-6): **O'TDI**;
   * Validation loss kamayishi: **O'TDI**.
5. `npm test`:
   * Barcha 4 ta to'plam: **100% MUVAFFAQIYATLI (666 ms)**.
