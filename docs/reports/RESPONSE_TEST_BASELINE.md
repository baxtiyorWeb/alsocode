# 📊 NEURAL STUDIO — BOSQICH 2: TEST VA BAHOLASH BASELINE HISOBOTI

> **Hujjat turi:** Avtomatlashtirilgan Kognitiv Sinov va Baseline O'lchovlari  
> **Sana:** 2026-10-17  
> **Loyiha:** Neural Studio (100% Offline O'zbekcha Kognitiv Dvigatel)  
> **Holat:** Bosqich 2 yakunlandi (Hozircha chatbot xatti-harakati o'zgartirilmadi, xatoliklar qat'iy fosh qilindi)

---

## 1. UMUMIY NATIJA VA XULOSA

Test to'plami 10 ta mezon bo'yicha jami **25 ta mustaqil va ko'p bosqichli test holatlari**ni o'z ichiga oladi. Testlar `tests/response_eval_suite.js` orqali to'liq jonli ishga tushirildi.

| Ko'rsatkich | Natija | Foiz / Izoh |
| :--- | :---: | :--- |
| **Jami test holatlari** | **25 ta** | 10 ta mezon guruhi |
| **Muvaffaqiyatli o'tganlar (Passed)** | **16 ta** | **64.0%** |
| **Yiqilganlar (Failed)** | **9 ta** | **36.0%** |
| **O'rtacha javob berish tezligi** | **348 ms** | Fast-path: 1–25 ms, Fallback RAG: 2000–2250 ms |

---

## 2. MEZON GURUHLARI BO'YICHA TAQSIMOT

| # | Mezon guruhi | Jami test | O'tgan | Yiqilgan | Muvaffaqiyat % | Asosiy holat |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **Oddiy faktik savollar** | 3 | 2 | 1 | 66.7% | Konkret ta'rif o'rniga qolipli shablon chiqishi |
| **2** | **Oddiy matematika va mantiq** | 4 | 3 | 1 | 75.0% | Matnli masalada ayirish tushunilmadi, RAG gallyutsinatsiyasi |
| **3** | **Shartli va chalg'ituvchi savollar** | 3 | 1 | 2 | 33.3% | Jismoniy xususiyatlar (tosh suzishi, kiyim) noto'g'ri tahlil |
| **4** | **Noaniq savollar va aniqlashtirish** | 2 | 2 | 0 | 100% | Olti so'roqli noaniqlikni aniqlash a'lo darajada |
| **5** | **Ko'p bosqichli suhbat** | 2 | 1 | 1 | 50.0% | Shaxs ma'lumoti ("shifokorman") saqlanmadi, ism unutilgan |
| **6** | **Qisqartirish yoki tushuntirish** | 1 | 0 | 1 | 0.0% | **Qattiq kodlangan cheat fosh bo'ldi** (Oy so'ralsa, quyosh chiqdi) |
| **7** | **Mavzuni almashtirish** | 1 | 0 | 1 | 0.0% | O'rgatilgan qolipga tushib, haqiqiy savol (somsa) e'tiborsiz qoldi |
| **8** | **Noma'lum savollarga javob** | 2 | 1 | 1 | 50.0% | Mavjud bo'lmagan faktlarni inkor etishda kechikish |
| **9** | **Imlo, apostrof va sinonimlar** | 4 | 3 | 1 | 75.0% | **"men hursandman" -> ismni "Hursand" deb noto'g'ri o'zlashtirish** |
| **10** | **Noto'g'ri taxminlarni fosh qilish** | 3 | 3 | 0 | 100% | False premise (Mars shahri, qora tuynuk) mukammal ushlandi |

---

## 3. YIQILGAN TESTLAR RO'YXATI VA CHUQUR DIAGNOSTIKA

### ❌ Test 1: `G1_F3` — Fotosintez jarayoni
- **Savol:** `"Fotosintez jarayoni nima?"`
- **Kutilgan xatti-harakat:** O'simliklar, quyosh nuri, xlorofill va kislorod ajralishi haqida aniq tushuntirish berish.
- **Qabul qilib bo'lmaydigan:** Mavhum qolip ("Fotosintez — fan, texnologiya yoki amaliy hayot sohasidagi tushuncha...").
- **Haqiqiy javob:** `ConceptDefinitionEngine` umumiy qolipni berdi (`Fotosintez jarayoni — fan, texnologiya yoki amaliy hayot sohasidagi tushuncha hisoblanadi.`).
- **Xatolik ildizi:** Tushuncha bazada alohida kengaytirilgan bilim sifatida mavjud emasligi va semantik sintezator ishga tushmagani.

---

### ❌ Test 2: `G2_M1` — Matnli arifmetika va ayirish
- **Savol:** `"5 ta olma bor edi, 2 tasini yedim. Nechta qoldi?"`
- **Kutilgan xatti-harakat:** $5 - 2 = 3$ ekanligini hisoblab, "3 ta olma qoldi" deb javob berish.
- **Qabul qilib bo'lmaydigan:** 16, 22, 19 yoki bazadagi begona masalalarni aralashtirish.
- **Haqiqiy javob:** `LocalKnowledgeEngine` (2125 ms): `«Ko'p bosqichli masala: Alida dastlab 16 ta olma bor edi. U Valiga 3 ta olma berdi... 13 + 9 = 22 ta bo'ldi...»`
- **Xatolik ildizi:** `reasoningEngine.solveCalculation` "yedim" (iste'mol qildim / ayirish) fe'lini arifmetik operatsiya sifatida ajrata olmadi. Natijada 2 soniyali chiziqli qidiruvga tushib, bazadagi o'xshash 16-olma masalasini ko'chirib berdi.

---

### ❌ Test 3: `G3_C2` — Tabiiy shartli savol
- **Savol:** `"Qishda havo sovuq bo'lsa, nima kiyish kerak?"`
- **Kutilgan xatti-harakat:** Issiq, qalin kiyimlar (palto, kurtka, bosh kiyim) kiyish zarurligini aytish.
- **Qabul qilib bo'lmaydigan:** Savolga mutlaqo aloqasiz tushuncha aytish.
- **Haqiqiy javob:** `AssociativeMemory` (3 ms): `«Vazifa — bu kimdir sizga ish aytgan bo'lsa yoki siz qilishiz kerak bo'ladigan asosiy ishlardir hisoblanadi.»`
- **Xatolik ildizi:** Noto'g'ri kalit so'z assotsiatsiyasi: "kerak" so'zi assotsiativ xotiradagi "vazifa" so'ziga ulanib, butunlay noto'g'ri javobni keltirib chiqargan.

---

### ❌ Test 4: `G3_C3` — Jismoniy imkoniyat va moddiy xususiyat
- **Savol:** `"Tosh suvda suza oladimi?"`
- **Kutilgan xatti-harakat:** "Yo'q, tosh suvda suza olmaydi, uning zichligi suvnikidan og'ir bo'lgani uchun u cho'kadi."
- **Qabul qilib bo'lmaydigan:** "Ha suzadi" yoki falsafiy qolip.
- **Haqiqiy javob:** `LocalKnowledgeEngine` (2007 ms): `«Mantiqiy xatoni tuzatish (1-variant): Da'vo: "Agar fizika qonunlari bo'lsa doim yer nam bo'ladi..."»`
- **Xatolik ildizi:** `CapabilityReasoningEngine` faqat tirik mavjudotlarni qisman tekshirgan; jonsiz jismlarning jismoniy qobiliyatini tekshirish mexanizmi yo'qligi sababli umumiy RAG ga tushib, mantiqiy sillogizm parchasini tashlab berdi.

---

### ❌ Test 5: `G5_MT1` — Ko'p bosqichli profil va kontekst
- **1-qadam:** `"Mening ismim Bobur va men shifokorman."` -> `LocalKnowledgeEngine` 2043 ms gallyutsinatsiya chiqardi.
- **2-qadam:** `"Mening kasbim nima?"` -> `ConceptDefinitionEngine`: `«Mening kasbim — fan, texnologiya...»` (shifokor ekani yo'qotildi).
- **3-qadam:** `"Mening ismim nima edi?"` -> `ConceptDefinitionEngine`: `«Mening ismim — fan, texnologiya...»` (ism yo'qotildi).
- **Xatolik ildizi:** `src/memory.js` faqat yakka qolipli jumlalarni eslab qoladi. Birikmali gaplardan ("...va men shifokorman") xususiyatlarni ajrata olmaydi. Dialog konteksti (Working Memory) navbatdagi qadamda savol intenti bilan bog'lanmagan.

---

### ❌ Test 6: `G6_S1` — Qisqartirish va sun'iy aldov (Hardcoded Cheat)
- **1-qadam:** `"Oy nima?"` -> Oy haqida ta'rif berildi.
- **2-qadam:** `"Buni ikki jumlada qisqartir"`
- **Kutilgan xatti-harakat:** Oldingi aytilgan Oy haqidagi matnni 2 jumlada ixchamlashtirish.
- **Haqiqiy javob:** `ContextFollowupEngine`: `«Qisqacha xulosa: Quyosh energiyasi — Quyoshdan olinadigan beminnat, toza va qayta tiklanuvchi energiya manbaidir...»`
- **Xatolik ildizi:** `src/reasoningEngine.js` 626–630 qatorlarida "ikki jumlada qisqartir" degan har qanday so'rov uchun "Quyosh energiyasi" matni statik qattiq kodlab qo'yilgan bo'lgan! Test tizimi ushbu soxtalashtirishni darhol aniqladi.

---

### ❌ Test 7: `G7_TS1` — Mavzuni keskin almashtirish
- **1-qadam:** `"JavaScript dasturlash tili nima?"`
- **2-qadam:** `"Endi mavzuni butunlay o'zgartiramiz. Somsa qanday taom?"`
- **Kutilgan xatti-harakat:** Oldingi IT mavzusini yopib, yangi mavzu — "Somsa" (o'zbek milliy pishirig'i, xamir va go'shtdan tayyorlanishi) haqida javob berish.
- **Haqiqiy javob:** `LocalKnowledgeEngine` (2030 ms): `«Mayli, mavzuni o'zgartiramiz. Dam olish kunlarini qayerda o'tkazishni rejalashtiryapsan?»`
- **Xatolik ildizi:** Baza ichidagi yozib qo'yilgan dialog replikasi ("mavzuni o'zgartiramiz") to'g'ridan-to'g'ri ko'chirib olindi va foydalanuvchining asl savoli ("Somsa qanday taom?") butunlay tashlab yuborildi.

---

### ❌ Test 8: `G8_U2` — Marsdagi xayoliy bino
- **Savol:** `"Marsdagi 5-qavatli turar-joy binosining manzili nima?"`
- **Kutilgan xatti-harakat:** Marsda insonlar qurgan bino yoki shahar yo'qligini, bu g'ayritabiiy/xayoliy savol ekanini ko'rsatish.
- **Haqiqiy javob:** `LocalKnowledgeEngine` (2076 ms): `«Ushbu mavzu bo'yicha menga bilim o'rgatilmagan...»`
- **Xatolik ildizi:** Savoldagi "Mars" + "5-qavatli bino" ziddiyati kognitiv filtrdan o'tmadi, oddiy noma'lum fakt sifatida 2 soniya vaqt sarflab javob berdi.

---

### ❌ Test 9: `G9_O3` — Holat bildirish ("men hursandman") va xotira buzilishi
- **Savol:** `"men hursandman"` (foydalanuvchi o'z kayfiyatini bildirmoqda).
- **Kutilgan xatti-harakat:** Hissiy munosabat: "Xursand ekanligingizdan mamnunman! Kuningiz yanada xayrli o'tsin."
- **Qabul qilib bo'lmaydigan:** Foydalanuvchining ismini "Hursand" deb belgilab olish!
- **Haqiqiy javob:** `«Tanishganimdan xursandman, Hursand! Hursand, Ushbu mavzu bo'yicha menga bilim o'rgatilmagan...»`
- **Xatolik ildizi va oqibati:** `src/memory.js` dagi regex `men ([A-Za-z'ʻ`]+)man` shabloniga ko'ra "hursand" so'zini inson ismi deb qabul qilgan. Natijada foydalanuvchi profili buzilib, keyingi barcha savollarda unga "Hursand" deb murojaat qilgan.

---

## 4. ENG KO'P UCHRAYDIGAN 3 TA ASOSIY XATOLIK TURI

### 1. Noto'g'ri Intent va Soxta Profil Yaratish (Intent Misrouting & Identity Pollution)
Foydalanuvchi his-tuyg'usini (`men xursandman`, `charchadim`) yoki murakkab gaplarni kiritganda, tizim buni ism tanishtirish yoki umumiy ilmiy bilim deb xato tasniflaydi. Natijada xotira buziladi va chatbot kutilmagan javoblar beradi.

### 2. Generalizatsiya yetishmasligi va Qolipli/Soxta Javoblar (Overfitting & Mock Responses)
Dvigatelda bir qator savollarga nisbatan statik matnlar yozib qo'yilgan (masalan, "ikki jumlada qisqartir" desangiz, kontekst nima bo'lishidan qat'i nazar Quyosh energiyasini aytishi). Savol biroz o'zgarsa yoki boshqa narsa so'ralsa, tizim mantiqiy tahlil qila olmaydi.

### 3. O(N) Chiziqli Fallback va Kontekstsiz Shovqin (2-soniyali Latency va Keraksiz Ko'chirma)
Agar qoidalar yoki aniq kalitlar mos kelmasa, so'rov 10 000 ta yozuvdan iborat massivni chiziqli aylanuvchi RAG ga tushadi (2000–2250 ms kechikish). Natijada savolga umuman aloqasi bo'lmagan darslik misollari ("Alida 16 ta olma bor edi", "Fizika qonunlari bo'lsa yer nam bo'ladi") foydalanuvchiga tashlanadi.

---

## 5. KEYINGI BOSQICHLAR UCHUN ANIQ MAQSADLI KO'RSATKICHLAR

Ushbu 2-bosqich baseline o'lchovlaridan kelib chiqib, keyingi bosqichlarda erishilishi shart bo'lgan aniq miqdoriy maqsadlar (Target Metrics):

| Ko'rsatkich | Joriy Baseline (Bosqich 2) | Maqsad (Bosqich 3–5) | Yakuniy Maqsad (Bosqich 10) |
| :--- | :---: | :---: | :---: |
| **Umumiy Test Muvaffaqiyati (Pass Rate)** | **64.0%** (16/25) | **≥ 88.0%** (22/25) | **≥ 96.0%** (24+/25) |
| **O'rtacha javob berish kechikishi** | **348 ms** (max 2125 ms) | **< 100 ms** (max < 250 ms) | **< 50 ms** (barqaror) |
| **Xotira va Shaxs aniqligi (Profile Accuracy)** | **50.0%** | **≥ 95.0%** | **100%** |
| **Gallyutsinatsiyali ko'chirmalar (Noise RAG)** | **Mavjud** (olma, fizika) | **0 ta** (aniq manba/qoidalar) | **0 ta** |
| **Apostrof va orfografik barqarorlik** | **75.0%** | **≥ 95.0%** | **100%** |

---

## 6. XULOSA VA BOSQICHNI YAKUNLASH

Bosqich 2 doirasida:
1. Loyiha qoidalariga qat'iy rioya qilindi: **mavjud model va kodlarning xatti-harakatiga testdan sun'iy o'tish uchun tegilmadi**.
2. Haqiqiy va xolis 25 ta testdan iborat avtomatlashtirilgan baholash tizimi yaratildi (`tests/response_eval_suite.js`).
3. 9 ta jiddiy tizimli xatolik va ularning dastlabki sabablari fosh qilindi.

**Keyingi bosqich:** **Bosqich 3 — Savolni tushunish va O'zbek tilini normalizatsiya qilish**.
Ushbu bosqichda kiruvchi matnni to'liq normalizatsiya qilish (apostroflar, dialektlar, so'z shakllari), `men [so'z]man` hissiyot/profil ajratish mantig'ini to'g'rilash va so'rov intentini aniq yo'naltirish ishlari amalga oshiriladi.
