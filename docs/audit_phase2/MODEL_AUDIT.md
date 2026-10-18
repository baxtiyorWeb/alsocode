# PHASE 2 — MODEL & NEURAL ARCHITECTURE AUDIT

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Neyron Tarmoqlar va Modellar Auditi  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior PyTorch/JS Research Engineer  

---

## 1. LOYIHADAGI BARCHA MODELLARNING ARXITEKTURA AUDITI

Loyiha kod bazasida 5 xil model va statistik komponent mavjud:

```
                             LOYIHADAGI MODELLAR
                                      │
   ┌───────────────────┬──────────────┼──────────────┬───────────────────┐
   ▼                   ▼              ▼              ▼                   ▼
Bag-of-Words MLP    MiniLLM      Embeddings    Attention Layers    Causal Transformer
(src/neuralNetwork) (generator)  (embeddings)  (attention.js)     (transformerModel)
Intent Classifier   3-Gram+Prior 12D Skip-gram Untrained Proj      2-Layer Decoder
279,519 Parametr    Statistik    Vektorlar     336 / 576 Parametr  154,639 Parametr
```

---

## 2. HAR BIR MODELNING BATAFSIL MATEMATIK VA KOD TAHLILI

### 2.1. Bag-of-Words Intent Classifier (`src/neuralNetwork.js`)
* **Arxitektura:** 2-qatlamli Feed-Forward Multi-Layer Perceptron (MLP).
  * **Kirish qatlami ($X$):** $11,530$ o'lchamli Bag-of-Words (so'zlarning bor-yo'qligi vektori: 0 yoki 1).
  * **Yashirin qatlam ($H$):** 24 ta neyron, Sigmoid faollashtiruvchisi ($\sigma(z) = \frac{1}{1 + e^{-z}}$).
  * **Chiqish qatlami ($Y$):** 111 ta toifa (Categories), Sigmoid faollashtiruvchisi.
* **Parametrlar soni (Koddagi aniq hisob):**
  * $W_{IH}$ (Input-to-Hidden): $11,530 \times 24 = 276,720$
  * $B_H$ (Hidden Bias): $24$
  * $W_{HO}$ (Hidden-to-Output): $24 \times 111 = 2,664$
  * $B_O$ (Output Bias): $111$
  * **Jami parametrlar:** **279,519 ta** (barchasi o'qitilgan, `data/model.json` da saqlangan).
* **Vazifasi:** Kiruvchi matnni 111 ta kategoriya nomidan biriga tasniflash.
* **Kritik cheklov:** Bag-of-Words so'zlar tartibini, inkorlarni ("Marsda shahar yo'q" vs "Marsda shahar") va sintaksisni inobatga olmaydi. "Marsda 2024 yilda qurilgan shahar nomi nima?" so'rovida "shahar" so'zini ko'rib, uni xato tarzda `tabiat` toifasiga joylashtirdi. Next-token yoki matn generatsiyasini o'rganmaydi.

---

### 2.2. MiniLLM Generator (`src/generator.js`)
* **Arxitektura:** 3-tartibli N-gram statistik o'tishlar jadvali (Markov transition table) + tasodifiy Self-Attention proyeksiyasi.
* **Lug'at:** `data/vocab.json` dagi unikal so'zlar.
* **Ishlash mexanizmi:**
  1. Oxirgi 1-3 ta so'z bo'yicha bazada uchragan keyingi so'zlar chastotasini hisoblaydi (`this.transitions`).
  2. 12-o'lchamli vektorlar bilan kosinus o'xshashlikni qo'shadi.
  3. Softmax va Temperature ($T = 0.8$) orqali tanlaydi.
* **Amaldagi holati:** **CHATBOTDAN UZILGAN.** `src/generativeSynthesizer.js` ga uzatilgan, lekin `generateDialogueReply` da biror marta ham chaqirilmaydi. Faqat veb-serverning alohida `/api/generate` endpointida ishlaydi.

---

### 2.3. Word Embeddings (`src/embeddings.js`)
* **Arxitektura:** 12-o'lchamli Skip-gram neyron so'z vektorlari.
* **Parametrlar:** $V \times 12$ kirish va $12 \times V$ chiqish matritsalari ($V \approx 4,000 \implies \approx 96,000$ parametr).
* **Trening:** `data/knowledge.json` dagi jumlalar ustida o'qitilgan, `data/embeddings.json` da saqlangan (~2 MB).
* **Kritik muammo (12D Dimensionality Bottleneck):**
  * Vektor o'lchami atigi 12 bo'lgani sababli, semantik fazo juda zich va tor.
  * Ixtiyoriy ikki aloqasiz matnning kosinus o'xshashligi deyarli doim **0.30 — 0.55** oralig'ida chiqadi.
  * Shu sababli, "Kvant kriptografiyasi nima?" so'rovi "Oy Yerning yo'ldoshi" matniga 0.357 ball olib, noto'g'ri RAG natijasi sifatida ulanib ketadi.

---

### 2.4. Standalone Attention Modullari (`src/attention.js` va `src/multiHeadAttention.js`)
* **Arxitektura:**
  * `src/attention.js`: $d_{model} = 12$, $d_k = 8$. $W_q (12 \times 8) = 96$, $W_k (12 \times 8) = 96$, $W_v (12 \times 12) = 144$. Jami: **336 parametr**.
  * `src/multiHeadAttention.js`: 4 heads, $d_k = 3$, $W_o (12 \times 12) = 144$. Jami: **576 parametr**.
* **Haqiqiy holati:**
  * **O'QITILMAGAN (UNTRAINED).** Matritsalar `Math.random() * 0.2 - 0.1` bilan tasodifiy to'ldirilgan.
  * Hech qanday loss yoki backpropagation mavjud emas.
  * Chatbotda faqat veb-interfeysda chiroyli "Self-Attention heatmap" ko'rsatish uchun ishlatiladi.

---

### 2.5. Causal Decoder-Only Transformer (`src/transformerModel.js`)
* **Arxitektura:** Haqiqiy zamonaviy GPT uslubidagi Causal Decoder-Only Transformer.
  * **Qatlamlar soni ($N$):** 2 ta Transformer Decoder bloki.
  * **Model o'lchami ($d_{model}$):** 64.
  * **Attention boshlari ($n_{heads}$):** 4 ta ($d_k = 16$).
  * **FFN o'lchami ($d_{ffn}$):** 256 (GELU faollashtiruvchisi bilan).
  * **Maksimal kontekst ($maxSeqLen$):** 48 token.
  * **Lug'at hajmi ($vocabSize$):** 399 subword (BPE Tokenizer orqali).
  * **Normallashtirish:** Pre-LayerNorm (har bir blok kirishida).
  * **Causal Mask:** Kelajak tokenlarini yopish (`if (j > i) rawScores = -1e9`).
* **Parametrlar soni (Hisoblangan va kod orqali tasdiqlangan):**
  1. Token Embeddings (`wte`): $399 \times 64 = 25,536$
  2. Positional Embeddings (`wpe`): $48 \times 64 = 3,072$
  3. Transformer bloklari (2 ta):
     - LayerNorm 1: $64 + 64 = 128$
     - Attention ($W_q, W_k, W_v, W_o + bias$): $4 \times (64 \times 64 + 64) = 16,640$
     - LayerNorm 2: $64 + 64 = 128$
     - FFN ($W_{f1}: 64 \times 256 + 256 = 16,640; W_{f2}: 256 \times 64 + 64 = 16,448$): $33,088$
     - 1 ta blok jami: $49,984$ parametr $\times 2 = \mathbf{99,968}$
  4. Final LayerNorm: $64 + 64 = 128$
  5. Language Model Head (`lm_head`): $64 \times 399 = 25,536$; Bias: $399 \implies 25,935$
  * **JAMI TRAINABLE PARAMETRLAR:** **154,639 ta (~154K parametr)**.
* **Trening va Backpropagation Holati:**
  * Next-Token Prediction va Cross-Entropy Loss to'liq ishlaydi.
  * `TransformerBlock.backward(...)` analitik gradient zanjiriga ega va barcha qatlamlarni (Attention $W_q, W_k, W_v, W_o$, FFN $W_{f1}, W_{f2}$, LayerNorm $\gamma, \beta$) yangilaydi (`tests/test_transformer_arch.js` da tasdiqlangan).
  * Checkpoint: `data/checkpoints/transformer_best.json` mavjud (12 epoch, Train Loss: 4.79, Val Loss: 5.00, Perplexity: 149.1).
* **Kritik cheklov:** Model kichik ($154\text{K}$) va lug'at atigi 399 token bo'lgani sababli, erkin murakkab jumlalar tuzishda so'zlarni takrorlash ehtimoli bor. Eng muhimi, **chatbot bu modelni suhbatda ishlatmayapti**.

---

## 3. MODELLARNING YAKUNIY TAQQOSLASH JADVALI

| Model Komponenti | Texnologiya | Trainable Parametr | Haqiqatan O'qitilganmi? | Runtime Inference'da Ishlatiladimi? | Vazifasi |
|:---|:---|:---:|:---:|:---:|:---|
| **`neuralNetwork.js`** | 2-qatlamli MLP | 279,519 | HA (Loss $\le 0.0003$) | HA (Chatbot asosiy klassifikatori) | Savolni 111 ta toifadan biriga tasniflash |
| **`generator.js`** | 3-Gram + Softmax | ~15,000 | HA (Chastotalar jadvali) | YO'Q (Chatbotdan uzilgan) | Next-word prior hisoblash |
| **`embeddings.js`** | Skip-gram Vektor | ~96,000 | HA (Cosine similarity) | HA (Chatbot qidiruvida) | So'z ma'nolari fazosi |
| **`attention.js`** | Self-Attention | 336 | **YO'Q (Random weights)** | HA (Faqat UI vizualizatsiyasi) | UI heatmap chizish |
| **`multiHeadAttention.js`** | 4-Head Attention | 576 | **YO'Q (Random weights)** | YO'Q (Faqat test API) | Standalone test |
| **`transformerModel.js`** | Causal Decoder Transformer | 154,639 | HA (Loss 4.79, 12 epoch) | **YO'Q (Chatbotdan uzilgan)** | Autoregressive Next-Token |
