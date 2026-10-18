# PHASE 2 — EMPIRICAL TEST RESULTS & BENCHMARKS

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Empirik Testlar va Benchmark Natijalari  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior QA/Evaluation Engineer  

---

## 1. BAJARILGAN TEST TO'PLAMLARI UMUMIY YAKUNI

Audit davomida model va chatbot 4 ta mustaqil test to'plamida empirik tekshirildi:

| Test To'plami | Jami Savollar | O'tgan (Passed) | Yiqilgan (Failed) | Aniqlik Ko'rsatkichi | Asosiy Xarakteristikasi |
|:---|:---:|:---:|:---:|:---:|:---|
| **1. Regression & Unit Suite** (`test_runner.js`) | 4 ta fayl | 4 ta | 0 ta | **100.0%** | Tokenizer, Causal Transformer, Dataset, Trainer unit-testlari |
| **2. Section 7 Smoke Test Suite** | 15 ta | 4 ta | 11 ta | **26.7%** | Foydalanuvchi topshirig'idagi 5 ta yo'nalish bo'yicha aniq savollar |
| **3. 14-Kategoriya Generalization Benchmark** | 14 ta | 5 ta | 9 ta | **35.7%** | Turli mantiqiy va lingvistik toifalar bo'yicha mustaqil test |
| **4. 50 ta Mustaqil Mantiqiy Test** (`audit_reasoning_50.js`) | 50 ta | 5 ta | 45 ta | **10.0%** | Sabab-oqibat, deduksiya, arifmetika va xato tuzatish |

---

## 2. SECTION 7 SMOKE TESTLARI TO'LIQ HISOBOTI (15 TA SAVOL)

Ushbu testlar foydalanuvchi talabidagi 5 ta asosiy soha (Bilim, Mantiq, Til, Kontekst, Ishonchlilik) bo'yicha chatbotning jonli runtime'ida bajarildi:

| ID | Guruh | Kiritilgan Savol (Prompt) | Intent | Ishlatilgan Tool | Vaqt | Natija | Aniqlangan Haqiqiy Javob va Xato Sababi |
|:---:|:---|:---|:---|:---|:---:|:---:|:---|
| **B1** | A. Bilim | "Fotosintez nima?" | `sabab_va_oqibat` | `LocalKnowledgeEngine` | 2017 ms | ✅ O'tdi | Javob: «Savol: Agar bog'dagi suv uzoq vaqt sug'orilmasa...». *Izoh: Tasodifan "o'simlik" so'zi uchragani uchun o'tdi, aslida fotosintez ta'rifi emas.* |
| **B2** | A. Bilim | "Demokratiya nima?" | `qiziqishlar_hayot` | `LocalKnowledgeEngine` | 1929 ms | ❌ Xato | Javob: «Ushbu mavzu bo'yicha menga bilim o'rgatilmagan.». *Sabab: Bazada demokratiya so'zi topilmadi.* |
| **B3** | A. Bilim | "Suv nega qaynaydi?" | `sabab_va_oqibat` | `LocalKnowledgeEngine` | 2094 ms | ✅ O'tdi | Javob: «Savol: Nega qish faslida bog'dagi suv muzlaydi?...». *Izoh: "suv" so'ziga ilashib qishda muzlash haqidagi gapni tashladi. Tasodifiy o'tish.* |
| **M1** | B. Mantiq | "Barcha A lar B. X — A. Bundan qanday xulosa chiqadi?" | `xotira_saqlash` | `CognitiveMemory` | 4 ms | ❌ Xato | Javob: «Kim, Ajoyib! Buni xotiramga saqlab qo'ydim: barcha a lar b... ✨». *Sabab: Mantiqiy sillogizmni shaxsiy fakt deb xotiraga yozib oldi.* |
| **M2** | B. Mantiq | "5 ta kitobning har biri 10 000 so‘m. Jami qancha?" | `arifmetika_algoritm` | `LocalKnowledgeEngine` | 2082 ms | ❌ Xato | Javob: «Matematik masala: Ali do'kondan 3 ta kitob (4000 so'm) va 7 ta shaftoli...». *Sabab: 50 000 ni hisoblamadi, bazadagi boshqa masalani ko'chirdi.* |
| **M3** | B. Mantiq | "Ketma-ketlik: 2, 4, 8, 16. Keyingi son nima va nima uchun?" | `arifmetika_algoritm` | `LocalKnowledgeEngine` | 2066 ms | ❌ Xato | Javob: «Algoritmik masala: Berilgan sonlar ketma-ketligi: 1, 17, 33, 49...». *Sabab: 32 sonini topmadi, boshqa ketma-ketlik masalasini ko'chirdi.* |
| **T1** | C. Til | "O'zbekistonning poytaxti qayer?" | `hazil_kayfiyat` | `LocalKnowledgeEngine` | 1928 ms | ❌ Xato | Javob: «Ushbu mavzu bo'yicha menga bilim o'rgatilmagan.». *Sabab: Intent adashib hazilga ketdi, Toshkent aytilmadi.* |
| **T2** | C. Til | "Oʻzbekistonning bosh shahri qaysi?" | `dam_olish_uyqu` | `LocalKnowledgeEngine` | 2012 ms | ❌ Xato | Javob: «Ushbu mavzu bo'yicha menga bilim o'rgatilmagan.». *Sabab: "bosh shahri" sinonimi va apostrof tanilmadi.* |
| **T3** | C. Til | "ozbekiston poytaxti" | `hazil_kayfiyat` | `LocalKnowledgeEngine` | 1920 ms | ❌ Xato | Javob: «O'rganilgan ma'lumot: «poytaxtda yashasang, o'zingizni qutichadagidek his qilarkansiz...». *Sabab: Kvartira haqidagi gap ko'chirildi.* |
| **K1** | D. Kontekst | "Quyosh energiyasini tushuntir." | `qiziqishlar_hayot` | `LocalKnowledgeEngine` | 1927 ms | ✅ O'tdi | Javob: «quyosh energiyasi. Bugun osmon bulutli bo'lsa ham...». *Izoh: Quyosh so'zi topildi.* |
| **K2** | D. Kontekst | "Endi uning afzalliklarini ayt." | `hazil_kayfiyat` | `LocalKnowledgeEngine` | 1925 ms | ❌ Xato | Javob: «bozorda savdolashayotib, sotuvchi aytgan narxdan ham pastroq so'rabman...». *Sabab: Oldingi mavzu (quyosh) butunlay unutilib, hazil tashlandi.* |
| **K3** | D. Kontekst | "Buni ikki jumlada qisqartir." | `ingliz_tili` | `LocalKnowledgeEngine` | 1944 ms | ❌ Xato | Javob: «Ushbu mavzu bo'yicha menga bilim o'rgatilmagan.». *Sabab: "ingliz_tili" toifasiga noto'g'ri xulosa qilib, rad etdi.* |
| **I1** | E. Ishonchlilik | "Marsda 2024 yilda qurilgan shahar nomi nima?" | `tabiat` | `LocalKnowledgeEngine` | 1955 ms | ❌ Xato | Javob: «Afsuski, shahar markazidagi qadimiy chinorlarni qurilish bahonasida kesib tashlashdi...». *Sabab: "shahar" so'ziga ilashib shikoyat gapni ko'chirdi.* |
| **I2** | E. Ishonchlilik | "U qachon keladi?" | `samimiy_dalda` | `LocalKnowledgeEngine` | 1935 ms | ✅ O'tdi | Javob: «Kim, O'rganilgan bilimlarimga ko'ra: «qachon yorug'lik keladi»...». *Izoh: Faqat foydalanuvchi ismi "Kim" bo'lgani uchun kutilgan "kim" so'zi topilib o'tdi.* |
| **I3** | E. Ishonchlilik | "Qora tuynukning ichidagi harorat necha daraja ekanligini laboratoriyada o'lchagan olim kim?" | `sabab_va_oqibat` | `LocalKnowledgeEngine` | 2004 ms | ❌ Xato | Javob: «Savol: Nega qish faslida bog'dagi qora tosh muzlaydi?...». *Sabab: "qora" so'zi orqali bog'dagi tosh haqidagi gapni tashladi.* |

---

## 3. 50 TA MUSTAQIL MANTIQIY TEST TO'PLAMI (`tests/audit_reasoning_50.js`)

Kognitiv xotira va RAG bazasida aynan mavjud bo'lmagan 50 ta mantiqiy savol natijalari:

```
                  50 TA MANTIQIY TEST TAQSIMOTI
  ┌─────────────────────────────┬───────────┬──────────────┐
  │ Toifa                       │ Jami Test │ O'tgan (Acc) │
  ├─────────────────────────────┼───────────┼──────────────┤
  │ A. Oddiy til va umumiy bilim│    8 ta   │ 1 ta (12.5%) │
  │ B. Sabab va oqibat          │    9 ta   │ 0 ta (0.0%)  │
  │ C. Deduktiv mantiq          │    9 ta   │ 2 ta (22.2%) │
  │ D. Matematika va algoritmik │    8 ta   │ 1 ta (12.5%) │
  │ E. Ko'p bosqichli masalalar │    8 ta   │ 1 ta (12.5%) │
  │ F. Xatolarni aniqlash       │    8 ta   │ 0 ta (0.0%)  │
  ├─────────────────────────────┼───────────┼──────────────┤
  │ JAMI                        │   50 ta   │ 5 ta (10.0%) │
  └─────────────────────────────┴───────────┴──────────────┘
```

* **To'g'ri chiqqan 5 ta holat:** 1 tasi xom matematik tool (`MathCalculator`), 4 tasi esa bazadagi tasodifiy so'z o'xshashligi tufayli to'g'ri kelgan.
* **Halol rad javobi ("Bilmayman"):** 10 ta (20.0%).
* **Noto'g'ri bog'langan / Adashgan javoblar:** 35 ta (70.0%).

---

## 4. XATOLIKLAR TIPOLOGIYASI VA FOIZLAR

Audit davomida qayd etilgan barcha xatolarning asosiy manbalari:

1. **Aloqasiz tayyor matn tashlash (Canned Dumping):** **48%**
   Savoldagi bitta so'z (masalan `suv`, `shahar`, `qora`, `dengiz`) bazadagi butunlay boshqa mavzudagi gapni (chinorlar kesilishi, tosh muzlashi) chaqirib chiqaradi.
2. **Matnli arifmetika va mantiqiy xulosaning yo'qligi:** **22%**
   Oddiy ko'paytirish yoki ketma-ketlik o'rniga boshqa tayyor o'quv masalasi ko'chiriladi.
3. **Mavzu uzilishi va noo'rin hazil (Context Drift):** **16%**
   Oldingi suhbat mavzusi yo'qotilib, `hazil_kayfiyat` toifasidagi tasodifiy dialog ulanadi.
4. **Noto'g'ri rad javobi berish (False Rejection):** **14%**
   O'zbekiston poytaxti kabi oddiy so'rovlarda apostrof yoki sinonim farqi tufayli "Bilimim yo'q" deb javobdan qochiladi.
