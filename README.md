# Neural LLM Studio (Pure JavaScript & Node.js)

100% toza JavaScript va Node.js muhitida noldan yaratilgan Neyron Tarmoq, Mini-LLM (Transformer), Kognitiv Xotira va Mantiqiy Mulohaza Yurituvchi Sun'iy Intellekt Tizimi.

Tashqi Python kutubxonalari (PyTorch, TensorFlow) yoki tayyor pre-trained model vaznlarisiz ishlaydi.

---

## 📁 Loyiha Strukturasi

```text
├── data/                       # Ma'lumotlar bazasi va model vaznlari
│   ├── archive_legacy_mlp/     # Eski MLP og'irliklari arxivi
│   ├── backups/                # Ma'lumotlar zaxira nusxalari
│   ├── bpe_vocab.json          # BPE subword tokenizer lug'ati (512 token)
│   ├── dataset_splits.json     # 80/10/10 train/val/test to'plamlari
│   ├── knowledge.json          # 3,059 ta qo'lda saralangan toza bilimlar
│   ├── memory.json             # Kognitiv doimiy xotira (fact & profile)
│   ├── model.json              # Intent klassifikator og'irliklari
│   └── vocab.json              # Intent klassifikator lug'ati
├── docs/                       # Hujjatlar va hisobotlar
│   ├── README_QOLLANMA.txt     # Boshlang'ich qo'llanma
│   ├── audit_phase2/           # Bosqich 2 arxitektura va model auditi
│   └── reports/                # 30 bosqichli sifat va arxitektura hisobotlari
├── public/                     # Veb interfeys (HTML5, Modern CSS, JS)
├── scripts/                    # Yordamchi skriptlar va konveyerlar
│   ├── legacy_mlp/             # Eski MLP o'qitish skriptlari (train, cpu, gpu)
│   ├── runners/                # Windows (.bat) va Linux (.sh) ishga tushiruvchilari
│   ├── autoTrainAI.js          # Bilimlarni avtomatik kengaytirish
│   └── sync_neon_to_local.js   # Neon DB bilan sinxronizatsiya
├── src/                        # Asosiy yadrolar va modullar
│   ├── bpeTokenizer.js         # BPE (Byte-Pair Encoding) subword tokenizer
│   ├── cognitiveMemory.js      # Kognitiv doimiy va sessiya xotirasi
│   ├── datasetPipeline.js      # Ma'lumotlarni saralash va split qilish
│   ├── db.js                   # Neon Serverless Postgres drayveri
│   ├── neuralNetwork.js        # Ko'p qatlamli perseptron (MLP)
│   ├── reasoningEngine.js      # Qat'iy mantiqiy xulosa va deduksiya dvigateli
│   ├── smartChatbot.js         # Dialog menejeri va orkestrator
│   ├── taskUnderstanding.js    # Vazifa va niyatni chuqur tushunish
│   ├── tokenizer.js            # BoW va matn tokenizatori
│   ├── transformerModel.js     # Decoder-only Mini-Transformer arxitekturasi
│   └── transformerTrainer.js   # Mini-Transformer o'qitish va optimizatsiya
├── tests/                      # Avtomatlashtirilgan test to'plamlari
│   ├── audit_reasoning_50.js   # 50 ta mantiqiy mulohaza testi (100% pass)
│   ├── test_generation_quality_30.js # 30 bosqichli sifat auditi
│   ├── test_runner.js          # Regressiya test runner (6 ta asosiy to'plam)
│   └── ...
├── cli.js                      # Terminal interaktiv AI yordamchisi
├── package.json                # Loyiha konfiguratsiyasi va buyruqlari
├── server.js                   # Express + SSE oqimli HTTP server (Web UI)
└── train_transformer.js        # Mini-Transformer o'qitish skripti
```

---

## 🚀 Ishga Tushirish va Buyruqlar

### 1. Veb Interfeysni Ishga Tushirish
```bash
npm start
```
Brauzerda oching: http://localhost:3000

### 2. Terminal (CLI) Interaktiv Rejimi
```bash
npm run cli
```

### 3. Mini-Transformer (LLM) ni O'qitish
```bash
npm run train:transformer
```

### 4. Intent Klassifikatorini O'qitish (Legacy MLP)
```bash
npm run train          # Avtomatik apparat tanlash
npm run train:gpu      # GPU (WebGL / CUDA) orqali
npm run train:cpu      # CPU (Sparse SGD) orqali
```

### 5. Testlarni Ishga Tushirish
```bash
# Asosiy regressiya testlari (6 ta to'plam):
npm test

# 30-bosqichli to'liq sifat va arxitektura auditi:
node tests/test_generation_quality_30.js

# 50 ta mantiqiy mulohaza va deduksiya auditi (100% aniqlik):
node tests/audit_reasoning_50.js
```

---

## ⚙️ Apparat Muhiti va Ma'lumotlar Bazasiga Ulanish
Loyiha `.env` faylida ko'rsatilgan Neon Serverless PostgreSQL bazasi bilan avtomatik sinxronlashadi. Internet mavjud bo'lmaganda yoki lokal rejimda barcha ma'lumotlar `data/` papkasidagi JSON fayllar orqali avtonom ishlaydi.
# alsocode
