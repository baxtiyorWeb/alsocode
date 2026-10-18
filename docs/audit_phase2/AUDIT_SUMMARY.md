# PHASE 2 — AUDIT SUMMARY: NEURAL STUDIO CHATBOT & QUESTION ANSWERING ENGINE

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Audit & Architectural Diagnostics  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect, Senior Software Engineer & Technical Lead  
**Uskuna Muhiti:** Intel Core i5-2400 (4 yadro @ 3.10GHz), 7.21 GB RAM (2.70 GB bo'sh), NVIDIA GeForce GTX 750 Ti (2 GB VRAM, Compute 5.0), Ubuntu Linux x64  

---

## 1. MAVJUD TIZIMNING AMALDAGI QOBILIYATLARI VA CHEKLOVLARI

### 1.1. Tizim amalda nimalarni qila oladi?
Empirik testlar va kod tahlili natijasida tizimning real ishlaydigan imkoniyatlari aniqlandi:
1. **Oddiy qat'iy arifmetik ifodalarni hisoblash (`MathCalculator`):** Matnda to'g'ridan-to'g'ri `5 + 7` yoki `12 * 8` kabi formula bo'lsa, xavfsiz hisoblab **0.33 ms** da to'g'ri javob beradi.
2. **Sana va vaqtni ko'rsatish (`DateTimeClock`):** O'zbek tilida soat, sana, hafta kunini aniq aytadi (~46 ms).
3. **Simvolik faktlarni eslab qolish (`CognitiveMemory`):** Foydalanuvchi "Mening ismim Anvar" yoki "Piyoz bu oshxona sabzavoti" desa, subyekt-predikat-obyekt ko'rinishida xotiraga yozadi va keyin eslay oladi (0-4 ms).
4. **Qisqa suhbat reaksiyalari (`ShortReplyContextGate`):** 1-2 so'zli "rahmat", "yo'q", "bo'ldi" kabi replikalarga mos reaksiyalar beradi.
5. **Lokal inference (Tashqi API'siz):** Javob berish jarayonida tashqi tarmoq yoki AI API (Gemini, OpenAI va h.k.) mutlaqo chaqirilmaydi (100% lokal).
6. **Statik Transformer bloklari va Causal Masking:** `src/transformerModel.js` da causal attention, layer norm, residual va backprop qatlamlari mustaqil unit-testlarda xatosiz ishlaydi.

### 1.2. Tizim nimalarni qila olmaydi va bunga qanday dalil bor?
1. **Savolning asl maqsadini va topshiriq turini dinamik tushunolmaydi:**
   - *Dalil:* "5 ta kitobning har biri 10 000 so'm. Jami qancha?" deb so'ralganda, tizim buni hisoblamaydi, balki `arifmetika_algoritm` toifasidagi tayyor Alining shaftoli sotib olgani haqidagi misolini ko'chirib beradi.
2. **Umumiy deduktiv va mantiqiy xulosa chiqara olmaydi:**
   - *Dalil:* "Barcha A lar B. X — A. Bundan qanday xulosa chiqadi?" deb so'ralsa, tizim mantiqiy tahlil qilish o'rniga, jumlani yangi fakt deb o'ylab, `CognitiveMemory` ga yozib qo'yadi.
3. **Sinonimlar va o'zbekcha imlo variantlarini umumlashtira olmaydi:**
   - *Dalil:* "O'zbekistonning poytaxti qayer?" va "Oʻzbekistonning bosh shahri qaysi?" so'rovlariga ikkalasida ham "Ushbu mavzu bo'yicha menga bilim o'rgatilmagan" deb javob qaytardi.
4. **Ko'p bosqichli suhbat kontekstini saqlay olmaydi:**
   - *Dalil:* 1-bosqichda "Quyosh energiyasini tushuntir" deyilgach, 2-bosqichda "Endi uning afzalliklarini ayt" deb so'ralganda, tizim oldingi quyosh mavzusini unutib, bozorda sotuvchi bilan savdolashish haqidagi hazilni ko'chirib berdi.
5. **Noto'g'ri taxmin va gallyutsinatsiyalarni jilovlay olmaydi:**
   - *Dalil:* "Marsda 2024 yilda qurilgan shahar nomi nima?" deb so'ralganda, "Marsda shahar yo'q" deb to'g'rilash o'rniga, savoldagi "shahar" so'ziga ilashib, Toshkentda chinorlar kesilishi haqidagi shikoyatni javob deb chiqaradi.
6. **Mavjud Generator va Transformer javob berishda ishlatilmaydi:**
   - *Dalil:* `src/generativeSynthesizer.js` da `miniLLM` parametri qabul qilinadi, ammo kod ichida biror marta ham token generatsiyasi uchun chaqirilmaydi. Tizim faqat tayyor gaplarni qidirib, `O'rganilgan bilimlarimga ko'ra: «...»` deb ko'chirib bermoqda.

---

## 2. ENG ASOSIY 5 TA TEXNIK MUAMMO (TOP-5 ROOT CAUSES)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TOP 5 ARXITEKTURA MUAMMOSI                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. KOR-KO'RONA TAYYOR MATN KO'CHIRISH (Canned String Dumping)          │
│    Javob generatsiya qilinmaydi, bazadagi 10 000 ta sintetik gapdan     │
│    bitta so'z mos kelsa ham butunicha foydalanuvchiga tashlanadi.      │
├────────────────────────────────────────────────────────────────────────┤
│ 2. DINAMIK STRATEGIYA VA VAZIFA KLASSIFIKATORINING YO'QLIGI            │
│    Savol turini (ta'rif, hisob, taqqoslash, xulosa, noaniq) ajratuvchi │
│    dispatcher yo'q. Hamma narsa 24-neyronli MLP va regexga tiralgan.   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. MATN QIDIRUVINING CHIZIQLI (O(N)) SEKINLIGI VA 12D KOSINUS NOCHORLIGI│
│    10 000 ta gap har safar for loop bilan aylanadi (~2000 ms kechikish).│
│    12-o'lchamli vektorlar begona mavzularga 0.35 - 0.50 soxta ball beradi.│
├────────────────────────────────────────────────────────────────────────┤
│ 4. ISHLATILMAYDIGAN (UZILIB QOLGAN) MODULLARNING MAVJUDLIGI            │
│    illogicalEngine, logicIdeaEngine, codeAgent chatbot.js ga import     │
│    qilingan, ammo process() ichida chaqirilmaydi (Dead Code).          │
├────────────────────────────────────────────────────────────────────────┤
│ 5. REASONING VA GENERATORNING SUHBAT PIPELINE'IDAN UZILISHI             │
│    src/transformerModel.js o'qitilgan bo'lsa ham, chatbot.js uni        │
│    javob yaratishda ishlatmaydi. Natijada real til modeli harakatsiz.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ANIQLANGAN MUAMMOLAR REGISTERI (PRIORITY ISSUE TRACKER)

| ID | Muammo va Kod Dalili | Foydalanuvchiga Ta'siri | Holati | Jiddiylik | Tuzatish Usuli | Bog'liq Fayllar | Regressiya Xavfi |
|:---|:---|:---|:---|:---:|:---|:---|:---:|
| **ISSUE-01** | **Lexical Mismatch & Canned Text Dumping:** `generativeSynthesizer.js:315` mos kelgan har qanday gapni to'g'ridan-to'g'ri `O'rganilgan bilimlarimga ko'ra: «...»` deb chiqaradi. | Savolga javob bermaydi, bazadagi sintetik o'quv masalasini to'liq ko'chirib tashlaydi. | Tasdiqlangan | **P0** | Extract-and-Synthesize arxitekturasini joriy etish; topilgan bilimdan faqat kerakli faktni ajratish. | `src/generativeSynthesizer.js`, `src/chatbot.js` | O'rta |
| **ISSUE-02** | **Savol Tushunish va Vazifa Dekompozitsiyasining Yo'qligi:** `chatbot.js` da kiruvchi savolning maqsadi (hisob, mantiq, ta'rif, taqqoslash) tahlil qilinmaydi. | 1 ta xabarda bir nechta talab bo'lsa yoki so'rov matnli masala bo'lsa, oddiy BoW toifasiga noto'g'ri tiqiladi. | Tasdiqlangan | **P0** | Ko'p o'lchovli `DynamicTaskUnderstanding` mexanizmini qurish. | `src/chatbot.js`, yangi `src/taskUnderstanding.js` | Kam |
| **ISSUE-03** | **Matnli Mantiq va Arifmetika Tool'larining Torligi:** `tryMathTool` faqat `\d+[\+\-\*\/]\d+` ifodalarni taniydi. "5 ta kitob har biri 10 000 so'm" ni taniy olmaydi. | Barcha matnli matematik va mantiqiy masalalar 0% aniqlik bilan xato chiqadi. | Tasdiqlangan | **P1** | Tabiiy tildagi miqdoriy, ketma-ketlik va munosabatli so'rovlar uchun Rule-Aided Reasoning Tool yaratish. | `src/chatbot.js`, yangi `src/reasoningEngine.js` | Kam |
| **ISSUE-04** | **Kontekst Uzilishi (Context Amnesia & Misdirection):** `chatbot.js` 2-bosqichda "Endi uning afzalliklarini ayt" kabi follow-up savollarda oldingi dialog subyektini yuklamaydi. | Dialog mavzusi darhol uzilib, tasodifiy hazil yoki shikoyatga ulanib ketadi. | Tasdiqlangan | **P1** | `DialogueStateTracker` ga mavzu konteksti (Topic Stack) va olmosh rezolyutsiyasini qo'shish. | `src/chatbot.js`, `src/session.js`, `src/memory.js` | Kam |
| **ISSUE-05** | **Sekin Qidiruv (Linear 10,000 Scan):** `retrieveLearnedContext` har bir so'rovda 10 000 ta elementni for-loop bilan skanerlaydi (1.9 — 2.1 soniya). | Har bir xabarga javob 2 soniya kechikadi, protsessorni behuda qizdiradi. | Tasdiqlangan | **P2** | Inverted Index (Leksik lug'at indeksi) + 64D kesh orqali qidiruvni <30 ms ga tushirish. | `src/generativeSynthesizer.js`, `src/rag.js` | Kam |
| **ISSUE-06** | **O'lik Modullar (Dead Code Disconnect):** `illogicalEngine.js`, `logicIdeaEngine.js`, `codeAgent.js` import qilingan, ammo `process()` ichida mutlaqo chaqirilmaydi. | Kategoriya xatolari ("uchburchak necha kilo?") va paradokslar ushlanmaydi. | Tasdiqlangan | **P2** | Ushbu ixtisoslashgan dvigatellarni Dinamik Strategy Selector zanjiriga faol ulash. | `src/chatbot.js` | Kam |
| **ISSUE-07** | **Transformer Generatori Suhbatdan Uzilgan:** `src/transformerModel.js` mavjud bo'lsa-da, `generateDialogueReply` uni hech qachon chaqirmaydi. | Haqiqiy neyron generatsiya imkoniyati ishlamay qolib, tizim oddiy shablon qidiruvchiga aylanib qolgan. | Tasdiqlangan | **P1** | Transformer generatsiyasini ochiq savollarda fallback va javob to'qish zanjiriga integratsiya qilish. | `src/generativeSynthesizer.js`, `src/chatbot.js` | O'rta |
| **ISSUE-08** | **Mantiqiy So'rovlarni Fakt deb Xotiraga Saqlash Xatosi:** "Barcha A lar B..." kabi sillogizmlarni `memory.extractAndLearn` yangi fakt deb darhol bazaga yozib, muloqotni to'xtatadi. | Mantiqiy savolga javob berish o'rniga "Buni xotiramga saqlab qo'ydim" deb noo'rin xursand bo'ladi. | Tasdiqlangan | **P1** | Xotiraga yozishdan oldin so'roq formati, sillogizm va shartli gaplarni istisno qiluvchi filtr qo'yish. | `src/memory.js`, `src/chatbot.js` | Kam |
| **ISSUE-09** | **O'zbek Tili Morfologik Normalizatsiyasi Zaifligi:** Apostroflar (`o'`, `oʻ`, `o‘`, `ozbekiston`) va kelishik qo'shimchalari leksik qidiruvda mos kelmaydi. | Bitta harf yoki apostrof farqi bilan tizim "Ushbu mavzu bo'yicha bilimim yo'q" deb rad javobi beradi. | Tasdiqlangan | **P2** | Canonical apostrof normalizatori va o'zbekcha affiks qirqish (stemming/lemmatization)ni qidiruvga ulash. | `src/tokenizer.js`, `src/uzbekTokenizer.js`, `src/generativeSynthesizer.js` | Kam |
| **ISSUE-10** | **UI va Mulohaza Zanjiri Halolligi Bo'shlig'i:** UI da "Transformer Attention" ko'rsatiladi, ammo og'irliklar tasodifiy; javob esa retrievaldan olingan. | Foydalanuvchiga tizim nima qilgani (haqiqiy qidiruv, hisob, qoida) o'rniga soxta neyron faollik ko'rsatiladi. | Tasdiqlangan | **P2** | Reasoning izohlarini haqiqatda bajarilgan amallarga (Tool, RAG, Rule, Memory) moslashtirish. | `src/chatbot.js`, `public/` | Kam |

---

## 4. QAYSI MUAMMOLARNI ENG KAM XAVF BILAN BIRINCHI TUZATISH MUMKIN?

1. **1-qadam (Eng xavfsiz va eng yuqori foyda):** `ISSUE-08` va `ISSUE-03` — Xotiraga yozish qoidasini to'g'rilash (savollarni fakt deb yozib olmaslik) hamda tabiiy tildagi sodda hisob-kitob va sillogizm qoidalarini `src/chatbot.js` ga ulash. Bu mavjud bazani buzmaydi va regressiya xavfi 0%.
2. **2-qadam:** `ISSUE-05` va `ISSUE-09` — Inverted index va o'zbekcha imlo/apostrof normalizatsiyasini joriy etish. Qidiruv tezligi 2000 ms dan 15-30 ms ga tushadi, poytaxt va umumiy bilim savollari to'g'ri topiladi.
3. **3-qadam:** `ISSUE-02` va `ISSUE-06` — Dinamik vazifa tushunish va Strategy Selector (Task Router) modulini integratsiya qilish. `illogicalEngine` va boshqa vositalar o'z joyida ishga tushadi.
4. **4-qadam:** `ISSUE-01` va `ISSUE-04` — Extract-and-Synthesize mexanizmi va Topic Stack (dialog mavzusini eslab qolish).
5. **5-qadam:** `ISSUE-07` — O'qitilgan Transformer generatsiyasini ochiq va noma'lum savollarda dinamik sintezga ulash.
