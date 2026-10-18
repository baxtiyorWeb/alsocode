# PHASE 2 — DATASET & KNOWLEDGE BASE AUDIT

**Loyiha:** Neural Studio — Dynamic Intelligence & Universal Question Answering Engine  
**Bosqich:** Phase 2 Ma'lumotlar Bazasi va Korpus Auditi  
**Sana:** 2026-10-17  
**Muallif:** Principal LLM Architect & Senior Data Engineer  

---

## 1. DATASET RESURSLARI VA STATISTIKASI

Loyiha ma'lumotlar bazasi va fayllari to'liq tahlil qilindi:

| Fayl | Hajmi | Yozuvlar Soni | Maqsadi | Sifat Bahosi |
|:---|:---:|:---:|:---|:---:|
| [`data/knowledge.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/knowledge.json) | 2.35 MB | **10,000 ta** | Asosiy bilimlar bazasi va suhbat korpusi | To'liq unikal (0 dublikat) |
| [`data/dataset_splits.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/dataset_splits.json) | 35.7 MB | **9,995 ta** | Train / Val / Test bo'lingan to'plam | 0.0% Data Leakage |
| [`data/documents.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/documents.json) | 721 B | **1 ta hujjat** | RAG semantik qidiruv kutubxonasi | Juda kam (faqat 1 ta astronomiya hujjati) |
| [`data/memory.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/memory.json) | 1.08 KB | **4 ta fakt** | Kognitiv xotira va foydalanuvchi profili | Subyekt-predikat-obyekt |
| [`data/bpe_vocab.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/bpe_vocab.json) | 30.1 KB | **399 subword** | BPE Tokenizer lug'ati | Subword birliklar |
| [`data/vocab.json`](file:///home/user/Downloads/Telegram%20Desktop/llm_training_package/data/vocab.json) | 216 KB | **11,530 so'z** | Butun so'zli BoW lug'ati | So'zlar va affikslar |

---

## 2. KATEGORIYALAR TAQSIMOTI VA DISBALANS TAHLILI

`data/knowledge.json` da jami **116 ta kategoriya** mavjud. 10 000 ta namuna quyidagi asosiy bloklarga ajratilgan:

```
                          DATASET BLOKLARI TAQSIMOTI
  ┌───────────────────────────────────────────────────┬──────────────┐
  │ Blok Nomi                                         │ Soni  (Foiz) │
  ├───────────────────────────────────────────────────┼──────────────┤
  │ 1. Kundalik muloqot va ijtimoiy suhbat             │ 5,855 (58.6%)│
  │ 2. Arifmetika va algoritmik fikrlash              │ 1,000 (10.0%)│
  │ 3. Ko'p bosqichli mantiqiy masalalar              │ 1,000 (10.0%)│
  │ 4. Xatolarni topish, tushuntirish va tuzatish     │   945 (9.45%)│
  │ 5. Deduktiv mantiq (Sillogizmlar, munosabatlar)   │   600 (6.0%) │
  │ 6. Sabab va oqibat tahlili                        │   600 (6.0%) │
  ├───────────────────────────────────────────────────┼──────────────┤
  │ JAMI                                              │ 10,000 (100%)│
  └───────────────────────────────────────────────────┴──────────────┘
```

### Top 15 ta eng yirik kategoriyalar:
1. `arifmetika_algoritm`: 1,000 ta (10.0%)
2. `kop_bosqichli_mantiq`: 1,000 ta (10.0%)
3. `xatolarni_tuzatish`: 945 ta (9.45%)
4. `deduktiv_mantiq`: 600 ta (6.0%)
5. `sabab_va_oqibat`: 600 ta (6.0%)
6. `hol_ahvol`: 407 ta (4.07%)
7. `hazil_kayfiyat`: 381 ta (3.81%)
8. `samimiy_dalda`: 335 ta (3.35%)
9. `qiziqishlar_hayot`: 317 ta (3.17%)
10. `salomlashish`: 147 ta (1.47%)
11. `ish_faoliyat`: 112 ta (1.12%)
12. `dasturlash_va_kod`: 95 ta (0.95%)
13. `kitoblar_haqida`: 84 ta (0.84%)
14. `texnologiya_va_hayot`: 78 ta (0.78%)
15. `milliy_taomlar`: 72 ta (0.72%)
*(Qolgan 101 ta toifada o'rtacha 20 tadan 35 tagacha namunalar mavjud)*.

---

## 3. DATASET FORMATI VA SINXRONIZATSIYA TAHLILI

### 3.1. Sintetik Reasoning Namunalarining Strukturasi
Phase 1 va 1.5 da yaratilgan 4 145 ta mantiqiy namuna quyidagi qat'iy formatda yozilgan:

```json
{
  "text": "Matematik masala: Ali do'kondan 2 ta olma (har biri 3000 so'mdan) va 3 ta kitob (har biri 3000 so'mdan) sotib oldi. U jami necha so'm to'ladi? Qadam-baqadam yechish: 1) 2 ta olma narxi: 2 * 3000 = 6000 so'm. 2) 3 ta kitob narxi: 3 * 3000 = 9000 so'm. 3) Jami summa: 6000 + 9000 = 15000 so'm. To'g'ri javob: 15000 so'm.",
  "category": "arifmetika_algoritm"
}
```

### 3.2. Nima sababdan Retrieval bu matnlarni buzib chiqarmoqda?
* **Asosiy muammo:** Datasetdagi yozuv bitta uzun monolit matn (`"text"`) sifatida saqlangan. Uning ichida `Savol:`, `Qadam-baqadam yechish:`, `Mantiqiy tushuntirish:` va `To'g'ri javob:` qismlari bitta stringga birlashtirilgan.
* Qidiruv mexanizmi (`generativeSynthesizer.js`) savoldagi "olma" yoki "kitob" so'zini topganda, faqat "To'g'ri javob" ni emas, **barcha savol va qadamlarni boshidan oxirigacha ko'chirib, foydalanuvchiga tashlab bermoqda**.
* **Yechim:** Ma'lumotlarni qidirishda savolni tushunish va faqat to'g'ri xulosa qismini ajratib oluvchi `Answer Extractor` parsing qatlami kiritilishi shart.

---

## 4. DETERMINISTIK SPLIT VA DATA LEAKAGE NAZORATI

`src/datasetPipeline.js` orqali yaratilgan `data/dataset_splits.json` fayli tekshirildi:

* **Random PRNG:** Mulberry32 PRNG (deterministik, qayta takrorlanuvchi).
* **Random Seed:** 42.
* **Xeshlash algoritmi:** SHA-256 (matn normalizatsiyasidan so'ng).
* **Train to'plami:** 7,996 ta namuna (80.0%).
* **Validation to'plami:** 999 ta namuna (10.0%).
* **Test to'plami:** 1,000 ta namuna (10.0%).
* **Data Leakage tekshiruvi:**
  $$\text{Train} \cap \text{Val} = \emptyset, \quad \text{Train} \cap \text{Test} = \emptyset, \quad \text{Val} \cap \text{Test} = \emptyset$$
  Kesishish soni: **0 ta (0.0% leakage)**.

---

## 5. TIL VA ORFO-MORFOLOGIK SIFAT

1. **Apostroflar variantliligi:**
   O'zbek tilida 4 xil apostrof belgisi uchraydi:
   - Standart probel apostrofi: `'` (U+0027)
   - O'zbekcha teskari tutuq: `ʻ` (U+02BB)
   - Tipografik apostrof: `’` (U+2019)
   - Aksent: `` ` `` (U+0060)
   Datasetda bu belgilar qisman aralashgan. Masalan: `O'zbekiston` va `Oʻzbekiston`. Qidiruv vaqtida ularni yagona kanonik shaklga keltirish talab etiladi.
2. **Grammatik qo'shimchalar (Agglutination):**
   O'zbek tili agglyutinativ bo'lgani sababli, `poytaxt`, `poytaxti`, `poytaxtida`, `poytaxtimiz` kabi so'zlar leksik qidiruvda alohida so'z deb qabul qilingan. Affikslarni qirquvchi morfologik lemmatizator qidiruvga to'liq ulanishi zarur.
