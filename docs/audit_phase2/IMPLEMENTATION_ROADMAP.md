# PHASE 2 — IMPLEMENTATION ROADMAP: DYNAMIC INTELLIGENCE & UNIVERSAL ENGINE

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Bosqichma-bosqich Qurish va Integratsiya Rejasi  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior Engineering Lead  

---

## 1. STRATEGIK YONDASHUV VA PRINSIPLAR

Mavjud arxitekturani buzmasdan, auditda aniqlangan zaifliklarni bartaraf etuvchi va universal savol-javob qobiliyatini beruvchi bosqichma-bosqich reja:

```
                            BOSQICHLAR ZANJIRI
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.1: Poydevor va Savol Tushunish (Task Understanding)          │
│ • Savol maqsadi, ob'yektlar va talab qilingan formatni aniqlash         │
│ • Xotiradagi interception xatosini tuzatish (savolni fakt deb saqlamaslik)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.2: Dinamik Mantiq va Hisob Dvigateli (Reasoning & Strategy)    │
│ • Tabiiy tildagi arifmetika (5 ta kitob 10 000 so'm -> 50 000)          │
│ • Deduktiv mantiq (Barcha A lar B. X — A -> X ham B)                    │
│ • Ketma-ketlik va paradokslar (illogicalEngine ni jonlantirish)         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.3: Yuqori Tezlikdagi Qidiruv va Extract-and-Synthesize        │
│ • Inverted Index (qidiruvni 2000 ms dan 20 ms ga tushirish)             │
│ • O'zbekcha apostrof va morfologik affikslarni kanonik normalizatsiya   │
│ • Butun matnni tashlash o'rniga faqat kerakli javob qismini ajratish   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.4: Dialog Konteksti va Mavzu Zanjiri (Topic Tracker)         │
│ • "Quyosh energiyasi" -> "Endi afzalliklarini ayt" bog'lanishini tiklash│
│ • Noo'rin hazil va shikoyatlar aralashishining oldini olish             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.5: Verifier Gate va Halol Noaniqlik (Honesty & Quality)       │
│ • Noma'lum va to'qima savollarga halol javob berish                     │
│ • Javobni dalil bilan solishtirish (Answer-to-Evidence check)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BOSQICH 2.6: Mustaqil 100+ Test Benchmark va Yakuniy Qabul              │
│ • 100 ta turli toifadagi savol bo'yicha to'liq avtomatik tekshiruv      │
│ • Tashqi AI API'siz 100% lokal ishlash kafolati                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. HAR BIR BOSQICHNING TEXNIK TAFSILOTLARI

### Bosqich 2.1: Poydevor va Dinamik Savol Tushunish (`src/taskUnderstanding.js`)
* **Maqsad:** Foydalanuvchi so'rovini faqat bitta BoW toifasiga siqmasdan, uning ko'p o'lchovli xususiyatlarini aniqlash.
* **Bajariladigan ishlar:**
  1. `src/taskUnderstanding.js` modulini yaratish:
     - `taskType`: `definition` (ta'rif), `calculation` (hisob-kitob), `deduction` (mantiqiy xulosa), `comparison` (taqqoslash), `temporal` (vaqt/ketma-ketlik), `factoid` (aniq fakt), `multi_step` (ko'p bosqichli), `clarification` (noaniq).
     - `formatRequest`: `concise` (qisqa), `detailed` (batafsil), `step_by_step` (bosqichma-bosqich).
     - `entities`: kiritilgan ob'yektlar va sonlar.
  2. `src/chatbot.js` da `memory.extractAndLearn` chaqiruvidan oldin so'roq va sillogizm filtrini o'rnatish (`?`, `—`, `agar`, `barcha` bo'lsa xotiraga yozmaslik).
* **Qabul qilish mezoni:** "Barcha A lar B..." savoli xotiraga yozilmaydi, `deduction` vazifasi sifatida tushuniladi.
* **Rollback:** `chatbot.js` dagi xotira filtri shartini olib tashlash.

---

### Bosqich 2.2: Dinamik Mantiq va Hisob Dvigateli (`src/reasoningEngine.js`)
* **Maqsad:** Mantiqiy, arifmetik va ketma-ketlik so'rovlarini tayyor gap ko'chirmasdan to'g'ri yechish.
* **Bajariladigan ishlar:**
  1. Tabiiy tildagi arifmetik masalalarni yechish qatlami:
     - "X ta [predmet] har biri Y so'm" -> $X \times Y$.
     - "X ta bor edi, Y tasini berdi/sotdi" -> $X - Y$.
     - "X ta bor edi, Y ta qo'shildi" -> $X + Y$.
  2. Deduktiv sillogizmlarni yechish qatlami:
     - "Barcha A lar B. X — A." -> "X — B (X ham B hisoblanadi)".
     - "A B dan katta. B C dan katta." -> "Eng kattasi A, eng kichigi C".
  3. Ketma-ketliklar qatlami:
     - Geometrik ($2, 4, 8, 16 \implies 32$), arifmetik ($5, 10, 15 \implies 20$), hafta kunlari, fasllar.
  4. O'lik modul `src/illogicalEngine.js` ni faollashtirish (Kategoriya xatolari: "Uchburchak necha kilo?").
* **Qabul qilish mezoni:** "5 ta kitob har biri 10 000 so'm" so'roviga 50 000 so'm to'g'ri chiqadi.
* **Rollback:** Mantiqiy modulni izolyatsiya qilish.

---

### Bosqich 2.3: Yuqori Tezlikdagi Qidiruv va Extract-and-Synthesize
* **Maqsad:** 10 000 ta gapni 2000 ms emas, 15-30 ms da qidirish va faqat to'g'ri javobni ajratish.
* **Bajariladigan ishlar:**
  1. `src/indexedKnowledge.js`:
     - Barcha 10 000 ta yozuv uchun Inverted Index (Map<Word, Set<ID>>) yaratish.
     - O'zbekcha apostroflarni (`'`, `ʻ`, `’`, `` ` ``) bitta standart apostrofga keltirish.
     - Leksik affikslarni qirqish (`poytaxti`, `poytaxtimiz` -> `poytaxt`).
  2. `AnswerExtractor`:
     - Agar topilgan bilimda `To'g'ri javob: [X]` yoki `Mantiqiy tushuntirish: [Y]` bo'lsa, butun savolni emas, aynan $X$ va $Y$ qismini ajratib javobga qo'yish.
* **Qabul qilish mezoni:** "O'zbekistonning poytaxti qayer?" va "ozbekiston poytaxti" so'rovlariga ikkalasiga ham 30 ms ichida "Toshkent" javobi beriladi.
* **Rollback:** Eski chiziqli qidiruvga o'tish imkoni saqlanadi.

---

### Bosqich 2.4: Dialog Konteksti va Mavzu Zanjiri (Topic Tracker)
* **Maqsad:** Ko'p bosqichli suhbatda oldingi mavzuni yo'qotmaslik.
* **Bajariladigan ishlar:**
  1. `dialogueState.topicStack` qo'shish: oxirgi 3 ta muloqotning asosiy subyekti (masalan: `quyosh energiyasi`, `kitob mutolaasi`).
  2. Follow-up savollar ("Endi uning afzalliklarini ayt", "Buni ikki jumlada qisqartir", "Nega?") kelganda `topicStack[0]` orqali qidiruv o'tkazish.
  3. Context Drift Filter: agar savol oldingi mavzuga bog'liq bo'lsa, `hazil_kayfiyat` yoki shaxsiy shikoyat replikalarini butunlay bloklash.
* **Qabul qilish mezoni:** "Quyosh energiyasini tushuntir" -> "Endi afzalliklarini ayt" zanjirida sotuvchi bilan hazil emas, quyosh energiyasining afzalliklari aytiladi.

---

### Bosqich 2.5: Verifier Gate va Halol Noaniqlik (Honesty & Quality)
* **Maqsad:** Noto'g'ri taxmin va bilmagan savollarga gallyutsinatsiya qilmasdan halol javob berish.
* **Bajariladigan ishlar:**
  1. False Premise Detection: agar savolda isbotlanmagan fakt bo'lsa ("Marsda 2024 yilda qurilgan shahar nomi nima?"), mavjud manbalar bo'yicha Marsda shahar yo'qligini aniq bildirish.
  2. Answer-to-Evidence Matcher: qaytarilayotgan javob savol berilgan obyektga haqiqatan tegishlimi yoki yo'qligini tekshirish (masalan: qora tuynuk haqidagi savolga bog'dagi qora tosh haqidagi javob bloklanadi).
* **Qabul qilish mezoni:** "Marsda 2024 yilda qurilgan shahar nomi nima?" so'roviga chinorlar kesilishi haqidagi gap chiqmaydi, "Marsda hali shahar qurilmagan" deb javob beriladi.

---

### Bosqich 2.6: Mustaqil 100+ Test Benchmark va Yakuniy Qabul
* **Maqsad:** 100 ta turli xil yangi va kutilmagan savollar bo'yicha sifatni baholash.
* **Bajariladigan ishlar:**
  1. `tests/phase2_benchmark_100.js` faylini yaratish (100 ta savol, 10 ta toifa).
  2. Barcha testlarni to'liq ishga tushirish, javoblar sifati, kechikish va xatoliklarni qayd etish.
  3. `PHASE2_DYNAMIC_ENGINE_REPORT.md` ni yangilash va yakuniy qabulga taqdim etish.
