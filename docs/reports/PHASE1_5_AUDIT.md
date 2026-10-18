# PHASE 1.5 — AUDIT REPORT: ACTUAL LEARNING, MEMORY, RAG, DATASET & REASONING

**Loyihaning holati:** Phase 1 & Phase 1.5 Texnik Auditi  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior ML Engineering Team  
**Ishchi Muhit:** Intel Core i5-2400 (4 cores), 7 GB RAM, NVIDIA GeForce GTX 750 Ti (2 GB VRAM), ~11 GB bo'sh disk  

---

## 1. YAKUNIY XULOSA VA ASOSIY NATIJALAR (EXECUTIVE SUMMARY)

Ushbu audit loyihadagi da'volar va amaldagi kod bazasi o'rtasidagi haqiqiy holatni aniqlash, 10 000 ta namunaga yetkazish strategiyasini ishlab chiqish hamda haqiqiy mustaqil til modelini yaratish yo'lini belgilash uchun o'tkazildi.

| Yo'nalish | Amaldagi Holat | Haqiqiy Texnik Mexanizm |
| :--- | :--- | :--- |
| **Kognitiv Xotira** | Simvolik / JSON | Neyron tarmoq vaznlari o'zgarmaydi. Faktlar `data/memory.json` va PostgreSQL'ga yoziladi. "Hebbian" atamasi matematik emas, metaforik. |
| **RAG & Qidiruv** | 12D Vektor / Heuristik | 12-o'lchamli Skip-gram va xesh-funksiya. Past o'lcham tufayli so'z filtrisiz soxta kosinus yaqinliklar yuzaga keladi. |
| **Haqiqiy Transformer** | Qisman mavjud | `src/transformerModel.js` da Causal Decoder-Only arxitektura bor, ammo `trainStep` da faqat `lm_head` va `wte` yangilanadi (Attention bloklariga gradient bormaydi). |
| **Mavjud Dataset** | 3 059 / 5 855 | `knowledge.json` da **3 059 ta**, Neon DB da **5 855 ta** yozuv bor. 10 000 tagacha **4 145 ta** qolgan. 95%+ qismi oddiy suhbat replikalari. |
| **Mantiqiy Qobiliyat** | 10.0% aniqlik | 50 ta yangi mustaqil mantiqiy testda model **5/50 (10.0%)** natija ko'rsatdi. Reasoning qobiliyati hali shakllanmagan. |
| **Lokal Inference** | 100% lokal | Runtime suhbatda tashqi API (Gemini/OpenRouter) chaqirilmaydi. |

---

## 2. KOGNITIV XOTIRA AUDITI (`src/memory.js`)

### 2.1. Faktlarni Saqlash Formati
Faktlar kognitiv xotiraga quyidagi JSON strukturada yoziladi:
```json
{
  "id": "mvcalga4kvs74",
  "subject": "piyoz",
  "relation": "bu",
  "object": "oshxona sabzavoti",
  "rawText": "Piyoz bu oshxona sabzavoti",
  "timestamp": "2026-10-17T11:07:33.676Z",
  "confidence": 1,
  "usageCount": 1
}
```
Fayl joylashuvi: [data/memory.json](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/memory.json) va Neon DB dagi `ai_memory` jadvali.

### 2.2. Neyron Tarmoq Parametrlari O'zgaradimi?
* **Aniq javob: YO'Q.**
* `memory.extractAndLearn()` yoki `memory.addFact()` chaqirilganda neyron tarmoqning birorta ham og'irligi (`weights`, `embeddings`, `lm_head`) o'zgarmaydi. Hech qanday backpropagation yoki gradient hisobi bajarilmaydi.
* Bu klassik **Knowledge Graph / Symbolic Triple Storage** (Subyekt — Predikat — Obyekt) mexanizmi hisoblanadi.

### 2.3. "Hebbian Plasticity" Atamasining Haqiqati
* Neyron biologiyasi va kompyuter fanida Hebbian o'rganish formulasi quyidagicha:
  $$\Delta w_{ij} = \eta \cdot x_i \cdot x_j$$
  ya'ni neyronlar orasidagi sinaps vazni pre- va post-sinaptik faollik ko'paytmasiga mutanosib oshadi.
* Loyihadagi amaldagi kodda:
  ```javascript
  // src/memory.js (284-qator)
  fact.usageCount = (fact.usageCount || 0) + 1;
  ```
  va `src/db.js` da:
  ```sql
  UPDATE ai_memory SET weight = weight + 0.1, recalled_count = recalled_count + 1 WHERE id = $1;
  ```
* Bu yerda hech qanday neyron sinaps matritsasi yo'q. Faqat sonli hisoblagich (`usageCount++` va `weight += 0.1`) oshiriladi. Shuning uchun "Hebbian Plasticity" bu yerda **metaforik marketing atamasi** sifatida ishlatilgan.

---

## 3. RAG VA SEMANTIK QIDIRUV AUDITI (`src/rag.js`, `src/chatbot.js`)

### 3.1. 12-O'lchamli Vektorlar Qanday Yaratiladi?
[src/rag.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/rag.js) faylidagi `computeTextVector(text)` funksiyasi tekshirildi:
1. Matn so'zlarga ajratiladi.
2. Har bir so'z uchun [src/embeddings.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/embeddings.js) dagi `this.embeddings.getVector(word)` olinadi. Bu vektor 3 000 ta jumlada o'qitilgan 12-o'lchamli Skip-gram modelidir.
3. Agar so'z lug'atda bo'lmasa (OOV):
   ```javascript
   // Deterministic trigonometric hash fallback (rag.js 84-90 qatorlar)
   wordVec = new Array(dim).fill(0);
   for (let i = 0; i < w.length; i++) {
     const code = w.charCodeAt(i);
     wordVec[(code * 7 + i * 11) % dim] += Math.sin(code + i);
   }
   ```
4. Barcha so'z vektorlari qo'shilib, $L_2$ normallashtiriladi.

### 3.2. Cosine Similarity va Soxta Mosliklar Xavfi
* **Muammo:** Vektor o'lchami atigi 12 bo'lgani sababli, ixtiyoriy ikki matnning kosinus o'xshashligi ko'pincha **0.30 — 0.55** oralig'ida chiqadi.
* **Empirik sinov:**
  * Hujjat: `"Astronomiya: Oy — Yer sayyorasining yagona tabiiy yo'ldoshi hisoblanadi."`
  * So'rov: `"Kvant kriptografiyasi qanday ishlaydi?"` (Ushbu hujjatga umuman aloqasiz).
  * Vektorli kosinus o'xshashlik: **0.3577** bo'lib chiqdi (0 so'z mosligi bilan!).
* **Yechim:** Shuning uchun biz `src/chatbot.js` da faqatgina leksik kalit so'z mosligi bo'lgandagina (`matchedWords.length >= 1 && score >= 0.25`) yoki kosinus ball juda yuqori bo'lgandagina (`score >= 0.65`) RAG natijasini qabul qilish shartini kiritdik.

---

## 4. HAQIQIY LLM ARXITEKTURASI AUDITI

Koddagi modellar sinflari to'liq tekshirildi:

```
                            LOYIHADAGI MODELLAR
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
src/neuralNetwork.js           src/generator.js           src/transformerModel.js
(24-neyronli MLP)              (Heuristik N-gram)         (Causal Transformer)
Niyat tasniflagich             Bi/Trigram + Cosine        2 Layer, 4 Head, 64-dim
(Classification)               (Prior + Softmax)          (Autoregressive Decoder)
```

### 4.1. `CausalTransformerModel` Mavjudligi va Tuzilishi
[src/transformerModel.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/transformerModel.js) da haqiqiy **Decoder-Only Transformer** kodi mavjud:
* `wte`: Token Embeddings (VocabSize 396 x dModel 64)
* `wpe`: Learned Positional Embeddings (SeqLen 48 x dModel 64)
* `TransformerBlock`:
  * Pre-LayerNorm (gamma, beta)
  * Multi-Head Attention: 4 heads, $d_k = 16$
  * Causal Mask: `if (j > i) rawScores[j] = -1e9`
  * Residual connection $x_1 = x + \text{attnOut}$
  * FFN: $d_{ffn} = 256$, GELU faollashtiruvchisi bilan
  * Residual connection $x_2 = x_1 + \text{ffnOut}$
* `lm_head`: Proyeksiyalash matritsasi ($64 \times 396$)
* Next-Token Cross-Entropy Loss hisobi.

### 4.2. Muhim Cheklov: Backpropagation Uzilishi
[src/transformerModel.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/transformerModel.js) 504–532 qatorlaridagi `trainStep` funksiyasi tekshirildi:
* Gradientlar `lm_head` bo'yicha hisoblanadi va yangilanadi:
  $$\Delta W_{head} = \text{normX}^T \times dLogits$$
* Shundan so'ng `dNormX` to'g'ridan-to'g'ri `wte` va `wpe` ga uzatiladi:
  ```javascript
  this.wte[token][d] -= learningRate * clipped * 0.5;
  this.wpe[t][d] -= learningRate * clipped * 0.5;
  ```
* **Transformer bloklariga (`W_q`, `W_k`, `W_v`, `W_o`, `W_f1`, `W_f2`) teskari gradient (Backpropagation through layers) hisoblanmagan!**
* **Oqibat:** Transformerning o'rta qatlamlari trening davomida o'zgarishsiz qoladi (tasodifiy vaznlarida muzlab turadi). Model faqat kirish embedding va chiqish proyeksiyasini yangilaydi. Bu modelning nega takroriy tokenlar yaratishining asosiy matematik sababidir.

### 4.3. Checkpoint Saqlash va Qayta Tiklash
* Checkpoint formati: [data/checkpoints/transformer_best.json](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/checkpoints/transformer_best.json)
* Hajmi: ~3.2 MB
* Tiklash mexanizmi: `CausalTransformerModel.fromJSON(cp.modelData)` to'liq va xatosiz ishlaydi.
* Tarix: 12 epoch o'qitilgan, `trainLoss: 4.79`, `valLoss: 5.00`, `valPerplexity: 149.1`.

---

## 5. DATASET INVENTARIZATSIYASI VA 10 000 TA MAQSAD SARI HOLAT

Kod orqali hisoblangan aniq raqamlar:

| Manba | Jami Yozuvlar | Unikal Yozuvlar | Dublikatlar |
| :--- | :--- | :--- | :--- |
| **`data/knowledge.json`** | 3 059 ta | 3 059 ta | 0 ta |
| **Neon PostgreSQL (`ai_knowledge`)** | 5 855 ta | 5 855 ta | 0 ta |
| **Ikkala manba birlashmasi (Union)** | **5 855 ta** | **5 855 ta** | 0 ta |
| **10 000 ta maqsadga nisbatan** | **5 855 / 10 000** | **58.55%** | **4 145 ta qolgan** |

### 5.1. Kategoriyalar Balansi
Mavjud ma'lumotlarning 50% dan ortig'i atigi 5 ta hissiy-suhbat toifasiga to'g'ri keladi:
1. `hol_ahvol`: 407 ta
2. `hazil_kayfiyat`: 381 ta
3. `samimiy_dalda`: 335 ta
4. `qiziqishlar_hayot`: 317 ta
5. `salomlashish`: 147 ta
Qolgan 61 ta kategoriya o'rtacha 25 tadan namunaga ega.

### 5.2. Mantiqiy Fikrlash va Instruction Namunalarining Ulushi
* **Mantiqiy masalalar ulushi:** 0% ga yaqin.
* **Sabab-oqibat masalalari ulushi:** 1% dan kam.
* **Matematik / Algoritmik namunalar:** 0%.
* **Xulosalar:** Mavjud 5 855 ta namuna oddiy kundalik suhbatga moslashtirilgan. Ular bilan model tilning leksik grammatikasini o'rganishi mumkin, lekin deduktiv yoki mantiqiy fikrlashni o'rgana olmaydi.

### 5.3. Train / Validation / Test Taqsimoti
[src/datasetPipeline.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/src/datasetPipeline.js) orqali `data/dataset_splits.json` faylida deterministik bo'linish amalga oshirilgan:
* **Train to'plami:** 2 447 ta (80.0%)
* **Validation to'plami:** 305 ta (10.0%)
* **Test to'plami:** 307 ta (10.0%)
* **Data Leakage nazorati:** SHA-256 xeshlash orqali Train, Val va Test to'plamlari orasida 0 ta kesishish (Data Leakage = 0%).

---

## 6. 50 TA YANGI MUSTAQIL MANTIQIY TEST NATIJALARI

Test to'plami [tests/audit_reasoning_50.js](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/tests/audit_reasoning_50.js) orqali kognitiv xotira va RAG bazasida aynan mavjud bo'lmagan, 6 ta asosiy toifa bo'yicha mustaqil o'tkazildi:

```
                  50 TA MANTIQIY TEST NATIJALARI
                  ┌─────────────────────────────┐
                  │  To'g'ri javoblar:    10.0% │ (5 ta)
                  │  "Bilmayman" (Halol): 20.0% │ (10 ta)
                  │  Noto'g'ri javoblar:  70.0% │ (35 ta)
                  └─────────────────────────────┘
```

### Kategoriya Kesimidagi Aniq Ko'rsatkichlar:

| Toifa | Jami | To'g'ri | Noto'g'ri | "Bilmayman" | Aniqlik |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. Oddiy til va umumiy bilim** | 8 | 1 | 5 | 2 | **12.5%** |
| **B. Sabab va oqibat** | 9 | 0 | 8 | 1 | **0.0%** |
| **C. Deduktiv va munosabatli mantiq** | 9 | 2 | 5 | 2 | **22.2%** |
| **D. Matematika va algoritmik** | 8 | 1 | 3 | 4 | **12.5%** |
| **E. Ko'p bosqichli savol-javob** | 8 | 1 | 7 | 0 | **12.5%** |
| **F. Xatolarni aniqlash** | 8 | 0 | 7 | 1 | **0.0%** |
| **JAMI** | **50** | **5** | **35** | **10** | **10.0%** |

### Test Tahlili:
1. **To'g'ri chiqqan 5 ta holat:**
   - Matematik ifoda: Tool (`MathCalculator`) hisobladi.
   - Deduktiv mantiq: Tasodifiy leksik so'z mosligi orqali bazadagi yaqin jumla to'g'ri keldi.
2. **"Bilmayman" (20.0%):**
   - Model bilmagan narsasiga gallyutsinatsiya qilmasdan halol javob berdi (*"Ushbu mavzu bo'yicha menga bilim o'rgatilmagan"*). Bu noto'g'ri ma'lumot berishdan ancha xavfsiz holat.
3. **Noto'g'ri chiqqan 35 ta holat (70.0%):**
   - Model savoldagi bitta so'z (masalan: `daraxt`, `qor`, `suv`) orqali bazadagi butunlay boshqa mavzudagi gapni olib javob qilib berdi. Chunki generativ mantiqiy mulohaza zanjiri (Chain-of-Thought) emas, faqat leksik retrieval ishlagan.

---

## 7. HARDWARE CHEKLOVLARI VA REALISTIK REJA

Mavjud uskunalar:
* **Protsessor:** Intel Core i5-2400 (4 yadro, AVX qo'llab-quvvatlaydi, AVX2 yo'q)
* **Tezkor xotira:** ~7 GB RAM (Node.js jarayoni uchun maksimal 2-3 GB xavfsiz)
* **Videokarta:** NVIDIA GeForce GTX 750 Ti (GM107, 2 GB VRAM, Compute Capability 5.0)
* **Disk:** ~11 GB bo'sh joy

### Resurslarni Taqsimlash Qoidalari:
1. **Model parametrlar chegarasi:** 2 GB VRAM va 7 GB RAM da 500 million yoki 7 milliard parametrli modelni o'qitish imkonsiz.
2. **Optimal model ko'lami:**
   * Qatlamlar soni: 4 ta
   * Yashirin o'lcham ($d_{model}$): 128
   * Attention boshlari: 4 ta ($d_k = 32$)
   * FFN o'lchami: 512
   * Max Sequence Length: 64 — 128 token
   * Lug'at hajmi (BPE Vocab): 2 048 — 4 096 subword
   * Parametrlar soni: taxminan **1.5 — 2.5 million parametr**
3. Ushbu hajm GTX 750 Ti xotirasiga (~350 MB VRAM) to'liq sig'adi va batch size = 16 yoki 32 bilan yuqori tezlikda o'qiydi.

---

## 8. KEYINGI BOSQICH UCHUN TEXNIK QADAMLAR (ACTION PLAN)

### 1-qadam: Neon DB dagi 2 796 ta yozuvni lokal kesh bilan sinxronlashtirish
Neon DB dagi 5 855 ta unikal yozuvni lokal `data/knowledge.json` ga to'liq eksport qilish va deduplikatsiyadan o'tkazish.

### 2-qadam: 4 145 ta yangi mantiqiy instruction namunalarini yig'ish
Qolgan 4 145 ta namunani oddiy gaplar bilan emas, quyidagi nisbatda yig'ish:
* 1 500 ta — Sabab-oqibat va deduktiv mantiq (A va B munosabatlari, kim katta, kim kichik);
* 1 000 ta — Sodda arifmetika va matnli masalalar (bosqichma-bosqich yechim bilan);
* 1 000 ta — Ko'p shartli vaziyatlar va qadam-baqadam xulosa;
* 645 ta — Xatolarni topish va tuzatish ("Nega bu xato? Chunki...").

### 3-qadam: Transformer Backpropagation qatlamlarini to'liq ochish
`src/transformerModel.js` dagi `trainStep` funksiyasiga LayerNorm, Attention Projections (`W_q, W_k, W_v, W_o`) va FFN (`W_f1, W_f2`) bo'yicha to'liq analitik gradient zanjirini ulash.

### 4-qadam: Toza SFT Pre-training va Mustaqil Lokal Inference
Modelni faqat lokal parametrlar asosida, har qanday tashqi API'larsiz va qattiq shablonlarsiz matn to'qiy oladigan qilib o'qitish va saqlash.
