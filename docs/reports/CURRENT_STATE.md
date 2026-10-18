# AUDIT HISOBOTI: CURRENT_STATE.md
**Loyiha:** O'zbekcha Shaxsiy LLM (From-Scratch Uzbek Language Model)  
**Sana:** 2026-10-17  
**Muhandislik Jamoasi:** Principal LLM Architect, Senior ML Research Engineer, Principal PyTorch/JS Engineer, Senior NLP Engineer, Senior Data Engineer, MLOps/Infra Engineer, Inference Engineer, Software Architect, QA/Eval Engineer, AI Security & Reliability Engineer.

---

## 1. MAVJUD HOLAT XULOSASI (EXECUTIVE SUMMARY)

Loyiha repository'si to'liq o'rganildi. Repository hozirda sof **Node.js (JavaScript / CommonJS)** texnologik stakida yaratilgan. Tizimda qator mustaqil neyron va evristik modullar mavjud, biroq nomlash va e'lon qilingan maqomlar bilan kodning haqiqiy imkoniyatlari o'rtasida jiddiy nomuvofiqliklar aniqlandi:

1. **Til modeli holati:** Loyihada hozircha o'zbek tilida keyingi tokenni bashorat qiluvchi (next-token autoregressive) **haqiqiy Decoder-only Transformer LLM mavjud emas**.
2. **Mavjud neyron tarmoq:** `src/neuralNetwork.js` va `data/model.json` da saqlangan tarmoq til modeli emas, balki kiritilgan gapni 36–111 ta niyat toifasiga (intent classification) ajratuvchi **2 qatlamli oddiy Feed-Forward MLP (Bag-of-Words)** dir.
3. **Mavjud generator:** `src/generator.js` (`MiniLLM`) Transformer orqali emas, balki **2-gram va 3-gram chastotalar jadvali** (Markov transition priors) hamda 16 o'lchamli Skip-gram so'z vektorlarining kosinus o'xshashligini qo'shish bilan ishlaydigan evristik mexanizmdir.
4. **Attention mexanizmi:** `src/attention.js` va `src/multiHeadAttention.js` tasodifiy initsializatsiya qilingan ($W_q, W_k, W_v$) vaznlarga ega bo'lib, **hech qachon o'qitilmagan (backpropagation/gradient hisobi yo'q)** va faqat veb-interfeysda chiroyli issiqlik xaritasi (heatmap) chizish uchun ishlatiladi.
5. **Javob berish mexanizmi:** `src/chatbot.js` va `src/generativeSynthesizer.js` javobni so'zma-so'z neyron tarmoq orqali to'qimaydi, balki `knowledge.json` dagi 3,000+ ta jumlalardan kosinus yaqinligi bo'yicha qidirib topadi, 1-shaxsni 2-shaxsga o'zgartiradi (POV shift: *"charchadim"* ➔ *"anchagina charchabsiz"*), hamda qat'iy andozalar orqali javob tuzadi.
6. **Tashqi API holati:** `src/chatbot.js` ichidagi barcha tashqi AI chaqiruvlari muvaffaqiyatli uzilgan, inference 100% lokal ishlaydi. Tashqi API (`aiGateway.js`) faqat ma'lumotlar to'plash (`scripts/autoTrainAI.js`) va Neon DB'ga yozish uchun alohida jarayonda qoldirilgan.

---

## 2. 12 TA ASOSIY AUDIT SAVOLIGA KOD DALILLARI BILAN JAVOBLAR

### 1. Hozir haqiqiy neural language model bormi yoki loyiha faqat jumlalarni saqlash va qidirish bilan cheklanganmi?
* **Javob:** Haqiqiy neural autoregressive language model **YO'Q**.
* **Kod dalili:**
  * [`src/chatbot.js:401-407`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/chatbot.js#L401-L407): Javob yaratish `this.generativeSynthesizer.retrieveLearnedContext(...)` orqali bazadan tayyor jumlalarni qidirish bilan boshlanadi.
  * [`src/generativeSynthesizer.js:32-90`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/generativeSynthesizer.js#L32-L90): `shiftPOV` funksiyasi regex almashtirishlar orqali grammatik shaxsni o'zgartiradi (`"charchadim"` -> `"anchagina charchabsiz"`).
  * [`src/generator.js:54-80`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/generator.js#L54-L80): `MiniLLM.train()` faqat n-gram chastotalarini hisoblaydi (`this.transitions.set(context, counts)`).

### 2. Agar model mavjud bo‘lsa, u qanday arxitekturaga ega?
* **Javob:** Ikki xil modul mavjud:
  1. *Niyat tasniflagichi (Intent Classifier):* 2 qatlamli Multi-Layer Perceptron (MLP). Kirish: Bag-of-Words (11,530 o'lcham). Yashirin qatlam: 24 neyron (Sigmoid). Chiqish: 111 ta toifa (Sigmoid).
  2. *Matn generatori (MiniLLM):* 3-tartibli N-gram statistik chastotalar jadvali + 12-o'lchamli tasodifiy proyeksiyali Self-Attention matritsasi.

### 3. Modelning jami va trainable parameter soni qancha?
* **Javob:**
  * **Haqiqiy o'qitiladigan parametrlar (`data/model.json`):**
    * $W_{IH}$: $24 \times 11,530 = 276,720$
    * $B_H$: $24$
    * $W_{HO}$: $111 \times 24 = 2,664$
    * $B_O$: $111$
    * **Jami trainable parametrlar:** **279,519 ta** (faqat tasniflagich uchun).
  * **Attention qatlami (`src/attention.js`):**
    * $W_q (12 \times 8) = 96$, $W_k (12 \times 8) = 96$, $W_v (12 \times 12) = 144$.
    * Jami: **336 ta parametr** — **barchasi o'qitilmagan (untrained)**.
  * **MultiHeadAttention (`src/multiHeadAttention.js`):**
    * 4 heads $\times 3 \times (12 \times 3) = 432$, $W_o (12 \times 12) = 144$.
    * Jami: **576 ta parametr** — **barchasi o'qitilmagan (untrained)**.
  * **Word Embeddings (`src/embeddings.js`):**
    * $V \times 16$ kirish va $16 \times V$ chiqish. $V \approx 4,000$ bo'lganda $\approx 128,000$ parametr.

### 4. Vocabulary hajmi qancha?
* **Javob:**
  * `data/vocab.json` faylida: **11,530 ta so'z** (so'zlar va ularning morfologik o'zaklari aralashgan holda).
  * `data/knowledge.json` dagi xom matnlardagi unikal so'zlar: **3,450 – 4,100 ta**.

### 5. Tokenizer so‘zlarni qanday tokenlarga ajratadi?
* **Javob:** Butun so'zli (whitespace + regex) tokenizatsiya.
* **Kod dalili:** [`src/tokenizer.js:20-42`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/tokenizer.js#L20-L42):
  * `text.toLowerCase().replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ").trim().split(/\s+/)`
  * O'zbek tili affikslari `UzbekMorphology.lemmatize` orqali ajratilib, umumiy massivga qo'shiladi.
* **Cheklov:** BPE (Byte-Pair Encoding), WordPiece yoki Unigram subword tokenizatsiyasi mavjud emas. Yangi qo'shimcha olgan har qanday o'zbekcha so'z OOV (Out-Of-Vocabulary) ga aylanadi. Maxsus tokenlar (`<pad>`, `<bos>`, `<eos>`, `<unk>`) yo'q.

### 6. Model next-token prediction vazifasida haqiqatan o‘qitilyaptimi?
* **Javob:** **YO'Q.**
* **Kod dalili:** [`train.js:78-98`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/train.js#L78-L98) va [`train.js:235-238`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/train.js#L235-L238):
  * `sample.input = tokenizer.textToVector(item.text)` (Bag-of-Words vektori).
  * `sample.target = tokenizer.categoryToOneHot(item.category)` (toifa vektori).
  * Causal language modeling (kirish: $w_1 \dots w_t$, target: $w_2 \dots w_{t+1}$), causal attention mask va Cross-Entropy loss mavjud emas.

### 7. Loss kamayishini kuzatish mumkinmi?
* **Javob:**
  * Niyat tasniflagichi bo'yicha: **HA.** `train.js` da MSE loss har epoxada hisoblanadi va $\sim 0.08$ dan $\le 0.00003$ gacha pasayadi.
  * Next-token til modeli bo'yicha: **YO'Q**, chunki til modelining o'zi o'qitilmayapti.

### 8. Model checkpoint’ni saqlab, undan qayta davom ettira oladimi?
* **Javob:** **QISMAN VA NOCHOR.**
* **Kod dalili:** `train.js:180-221`: Modelning faqat statik og'irliklari (`weightsIH`, `weightsHO`, `biasH`, `biasO`) `data/model.json` va Neon DB'ga yoziladi.
* **Kamchilik:** Optimizer holati (momentum, learning rate, gradientlar), joriy qadam (global step), epoxa raqami, random generator holati saqlanmaydi. Trening to'xtab qolsa, davom ettirib bo'lmaydi — noldan boshlanadi.

### 9. Inference vaqtida tashqi model yoki API ishlatiladimi?
* **Javob:** **YO'Q (100% lokal).**
* **Kod dalili:** `src/chatbot.js` faylidagi barcha tashqi AI API (`aiGateway`, `tryCognitiveLLMGateway`) chaqiruvlari to'liq olib tashlangan va izolyatsiya qilingan. Model faqat lokal xotira, leksik qidiruv va lokal kodlar bilan ishlaydi.

### 10. 2500 ta ma’lumot qanday formatda va qanday sifat nazorati bilan saqlangan?
* **Javob:**
  * Hozirda `data/knowledge.json` da **3,059 ta** yozuv mavjud (fon rejimida ishlayotgan generator hisobiga soni oshgan).
  * Format: Oddiy JSON ob'yektlari: `[ { "text": "...", "category": "..." }, ... ]`.
  * Sifat holati: Jumlalarning 95% dan ortig'i qisqa iboralar (1-6 so'z). Ko'p bosqichli mantiqiy fikrlash (reasoning chains), dialog konteksti (multi-turn dialogues), savol-javob juftliklari deyarli yo'q.
  * Toifalar: 66 ta toifa. Ba'zi toifalarda 300+ ta jumla, ba'zilarida esa 20-25 ta jumla (kuchli disbalans mavjud).

### 11. Trening va validatsiya ma’lumotlari bir-biriga aralashib ketganmi?
* **Javob:** **HA, 100% MA’LUMOTLAR ARALASHGAN (DATA LEAKAGE).**
* **Kod dalili:** [`train.js:165-173`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/train.js#L165-L173):
  * Model 100% ma'lumotlarda o'qitiladi.
  * Aniqlik (Accuracy) testi esa aynan shu o'qitilgan to'plamning o'zida tekshiriladi: `for (const sample of dataset) { pred = nn.predict(sample.input); ... }`.
  * Mustaqil Validation to'plami (Train/Val split) mutlaqo mavjud emas! Generalization o'lchanmaydi.

### 12. Lokal kompyuterning RAM, VRAM va disk cheklovlari qanday?
* **Operatsion tizim:** Linux Ubuntu (Kernel 7.0.0-34-generic x86_64).
* **CPU:** Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz (4 yadro, 4 ip, Sandy Bridge).
* **RAM:** Jami **7.2 GiB** (shundan faqat $\sim 2.5\text{ GiB}$ bo'sh, Swap 19 GiB bo'lib 2.3 GiB ishlatilmoqda).
* **Disk bo'sh joyi:** `/dev/sdb2` bo'limida 109 GB dan 93 GB band — **faqat 11 GB (10%) bo'sh joy qolgan!**
* **GPU va VRAM:** **NVIDIA GeForce GTX 750 Ti (GM107)**, VRAM: **2048 MiB (2 GB)**.
  * Hozirda desktop jarayonlari (Xwayland, gnome-shell) $\sim 526\text{ MiB}$ band qilgan. Bo'sh VRAM: $\approx 1.5\text{ GiB}$.
  * Compute Capability: 5.0 (Maxwell).
* **Dasturiy muhit:**
  * Node.js: **v22.23.2**, npm: **10.9.8**.
  * Python: **3.14.4**, lekin `torch` (PyTorch) o'rnatilmagan.
  * Muhim texnik eslatma: Python 3.14 uchun PyTorch rasmiy barqaror prebuilt g'ildiraklari (wheels) mavjud emas, shuningdek zamonaviy PyTorch CUDA relizlari Compute Capability 5.0 (GTX 750 Ti) ni qo'llab-quvvatlashni to'xtatgan.
  * `gpu.js` esa WebGL shaderlari orqali GTX 750 Ti da ishlay oladi.

---

## 3. ANIQLANGAN XATOLAR VA ARXITEKTURA NOMUVOFIQLIKLARI

1. **`package.json` dagi buzilgan buyruqlar:**
   * `"test": "node index.js"` va `"cli": "node cli.js"` yozilgan, biroq `index.js` va `cli.js` fayllari loyihada mavjud emas. `npm test` buyrug'i darhol xato bilan to'xtaydi.
2. **Attention qatlamida o'lik kod va o'qitilmaslik:**
   * `src/multiHeadAttention.js` dagi $W_o$ (Output projection) matritsasi initsializatsiya qilinadi, lekin `process()` da hech qachon ishlatilmaydi.
   * Attention og'irliklari tasodifiy sonlar bo'yicha qoladi. Causal masking (kelajak tokenlarni yopish) yo'q.
3. **Subword tokenizatsiyasining yo'qligi:**
   * O'zbek tili kabi agglyutinativ tilda har bir so'z o'nlab grammatik shakllarga ega. Faqat butun so'zlarni saqlash sababli lug'at hajmi 11,500 dan oshib ketgan, ammo baribir oddiy so'z o'zgarishlarida OOV yuzaga keladi.
4. **Mantiqiy zanjir (Reasoning) va Ta'lim ma'lumotlarining yo'qligi:**
   * Hozirgi dataset faqat hissiy va kundalik suhbat iboralaridan iborat. Hech qanday hisob-kitob, mantiq, qadam-baqadam yechimlar datasetga kiritilmagan.

---

## 4. XAVFLAR VA CHEKLOVLAR (RISK ASSESSMENT)

| Xavf | Ehtimollik | Ta'siri | Bartaraf etish chorasi |
| :--- | :---: | :---: | :--- |
| **Xotira to'lishi (RAM OOM)** | Yuqori | Kritik | 7 GB RAM va 2 GB VRAM mavjud. Model parametrlarini $1\text{M} - 5\text{M}$ oralig'ida saqlash, kichik batch size (8-16) va sequence length (32-64) dan foydalanish. |
| **Disk to'lishi** | O'rta | Yuqori | Diskda faqat 11 GB bo'sh joy bor. Gigabaytlab og'ir checkpointlar yozmaslik, faqat best validation checkpointni saqlash. |
| **PyTorch / Python 3.14 & GTX 750 Ti nomuvofiqligi** | Yuqori | O'rta | Python 3.14 va sm_50 arxitekturasi rasmiy PyTorch CUDA bilan mos emas. Loyiha asosiy pipeline'ini sof, yuqori tezlikdagi JavaScript Float32Array neyron arxitekturasida amalga oshirish va mavjud veb-server bilan 100% uzviy bog'lash. |
| **Overfitting va Data Leakage** | Yuqori | Yuqori | Qat'iy Train (80%) / Validation (10%) / Test (10%) split joriy etish. Validation loss monitoring va Early Stopping o'rnatish. |

---

## 5. XULOSA VA USTUVOR VAZIFALAR

Audit natijasiga ko'ra, mavjud loyiha ajoyib niyat tasniflagichi va suhbat vositalariga ega, biroq mustaqil o'zbekcha LLM bo'lishi uchun quyidagi 4 ta fundamental arxitektura komponenti noldan yaratilishi yoki tubdan yangilanishi shart:
1. **O'zbek tili uchun mos subword/BPE tokenizatori** (`<pad>`, `<bos>`, `<eos>`, `<unk>` tokenlari bilan).
2. **Haqiqiy Causal Decoder-Only Transformer neyron modeli** (Token Embeddings, Positional Encoding, Multi-Head Causal Masked Attention, Residuals, LayerNorm, FFN, Output Logits).
3. **Next-Token Prediction o'qitish pipeline'i** (Cross-Entropy Loss, Gradient Descent/Adam, Train/Val Split, Checkpoint Resume).
4. **Mustaqil baholash (Evaluation) to'plami va avtomatik testlar**.
