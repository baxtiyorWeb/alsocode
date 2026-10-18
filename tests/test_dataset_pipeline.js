"use strict";

const assert = require("assert");
const DatasetPipeline = require("../src/datasetPipeline");
const UzbekTokenizer = require("../src/uzbekTokenizer");

console.log("==================================================");
console.log("  RUNNING DATASET PIPELINE & SPLIT TESTS");
console.log("==================================================");

const tokenizer = new UzbekTokenizer(250);
const pipeline = new DatasetPipeline(tokenizer);

// 1. Mock ma'lumotlar bilan tozalash va dublikat testi
const mockRaw = [
  { text: "Assalomu alaykum", category: "salomlashish" },
  { text: "  assalomu   alaykum  ", category: "salomlashish" }, // Near duplicate
  { text: "assalomu alaykum", category: "salomlashish" }, // Exact duplicate
  { text: "   ", category: "bosh" }, // Empty
  { text: null, category: "null_item" }, // Invalid
  { text: "Bugun havo juda yaxshi", category: "ob_havo" },
  { text: "Choy ichasizmi?", category: "hol_ahvol" },
  { text: "choy ichasizmi?", category: "hol_ahvol" }, // Duplicate
  { text: "Men dasturlashni o'rganayapman", category: "dasturlash_va_kod" },
];

const cleanRes = pipeline.cleanAndValidate(mockRaw);
console.log(`- Tozalash natijasi: ${cleanRes.cleanSamples.length} ta qoldi, ${cleanRes.duplicateCount} ta dublikat, ${cleanRes.rejectedCount} ta yaroqsiz.`);
assert.strictEqual(cleanRes.cleanSamples.length, 4, "Faqat 4 ta unikal namuna qolishi kerak");
assert.strictEqual(cleanRes.duplicateCount, 3, "3 ta dublikat aniqlanishi kerak");
assert.strictEqual(cleanRes.rejectedCount, 2, "2 ta yaroqsiz (bo'sh/null) tashlab yuborilishi kerak");
console.log("  ✅ Test 1: Tozalash va deduplikatsiya 100% to'g'ri ishladi.");

// 2. Deterministik Split va Data Leakage testi
const dummyList = [];
for (let i = 0; i < 100; i++) {
  dummyList.push({
    text: `Namunaviy test jumlasi raqam ${i}`,
    hash: `hash_${i}`,
    category: "test",
  });
}

const splits = pipeline.splitDataset(dummyList, 42);
console.log(`- Split natijalari: Train=${splits.train.length}, Val=${splits.val.length}, Test=${splits.test.length}`);
assert.strictEqual(splits.train.length, 80, "Train to'plami 80 ta bo'lishi kerak");
assert.strictEqual(splits.val.length, 10, "Val to'plami 10 ta bo'lishi kerak");
assert.strictEqual(splits.test.length, 10, "Test to'plami 10 ta bo'lishi kerak");

// 3. Kesishish (Data Leakage) yo'qligini tekshirish
const trainSet = new Set(splits.train.map((s) => s.hash));
const valSet = new Set(splits.val.map((s) => s.hash));
const testSet = new Set(splits.test.map((s) => s.hash));

for (const h of valSet) {
  assert(!trainSet.has(h), `Data Leakage! Train va Val ikkalasida mavjud: ${h}`);
}
for (const h of testSet) {
  assert(!trainSet.has(h), `Data Leakage! Train va Test ikkalasida mavjud: ${h}`);
  assert(!valSet.has(h), `Data Leakage! Val va Test ikkalasida mavjud: ${h}`);
}
console.log("  ✅ Test 2: Train/Val/Test o'rtasida 0% Data Leakage kafolatlandi.");

// 4. SFT Formati va Loss Mask testi
const sftSample = pipeline.formatSFT({
  normalizedText: "anchagina charchadim, dam olmoqchiman",
  category: "hol_ahvol",
});

console.log(`- SFT Shakli:\n${sftSample.formattedText}`);
assert(sftSample.formattedText.includes("<human>:"), "SFT da <human> tegi bo'lishi kerak");
assert(sftSample.formattedText.includes("<bot>:"), "SFT da <bot> tegi bo'lishi kerak");
assert(sftSample.formattedText.endsWith("<eos>"), "SFT <eos> bilan yakunlanishi kerak");
assert(sftSample.mask.includes(0), "Savol tokenlari uchun mask=0 bo'lishi shart");
assert(sftSample.mask.includes(1), "Javob tokenlari uchun mask=1 bo'lishi shart");
console.log("  ✅ Test 3: SFT Formati va Loss Mask to'g'ri shakllandi.");

// 4. Sintetik markerlar (#...) ni tozalash va Vocab Guard testi
const synthRaw = [
  { text: "Ozon qatlami stratosferada joylashgan (#0)", category: "tabiat" },
  { text: "Ozon qatlami stratosferada joylashgan (#1)", category: "tabiat" },
  { text: "Ozon qatlami stratosferada joylashgan (#2)", category: "tabiat" },
];
const synthClean = pipeline.cleanAndValidate(synthRaw);
assert.strictEqual(synthClean.cleanSamples.length, 1, "Sintetik (#...) li dublikatlar 1 ta unikal namunaga qisqarishi kerak");
assert.strictEqual(synthClean.duplicateCount, 2, "2 ta sintetik dublikat tutilishi kerak");
assert(!synthClean.cleanSamples[0].text.includes("(#"), "Namuna matnidan (#...) olib tashlanishi shart");

const mockInvalidSplits = {
  summary: { vocabSize: 512 },
  splits: { train: [], val: [], test: [] },
};
const valMismatch = pipeline.validateSplits(mockInvalidSplits);
assert.strictEqual(valMismatch.valid, false, "Mos kelmaydigan vocab hajmi rad etilishi kerak");
console.log("  ✅ Test 4: Sintetik (#...) deduplikatsiyasi va Vocab Guard to'liq tasdiqlandi.");

console.log("\n🎉 BARCHA DATASET PIPELINE TESTLARI 100% MUVAFFAQ QILINDI!\n");
