"use strict";

const assert = require("assert");
const UzbekTokenizer = require("../src/uzbekTokenizer");

console.log("==================================================");
console.log("  RUNNING UZBEK TOKENIZER UNIT TESTS");
console.log("==================================================");

const sampleTexts = [
  "Assalomu alaykum! Ishlaringiz qanday ketyapti?",
  "O'zbekiston kelajagi buyuk davlat.",
  "Bugun g'alaba bizniki bo'ladi.",
  "Ko'nglingiz to'q bo'lsin, barchasi yaxshi bo'ladi.",
  "Charchoq paytida bir piyola ko'k choy ichish foydali.",
  "123 + 456 = 579 hisob-kitob to'g'ri bajarildi.",
  "O‘zbekcha, oʻrtoq, g‘ayrat, g’urur, o`tin apostroflari."
];

const tokenizer = new UzbekTokenizer(300);
tokenizer.train(sampleTexts);

console.log(`- Tokenizer o'qitildi. Lug'at hajmi: ${tokenizer.vocabSize} ta token.`);
assert(tokenizer.vocabSize >= 50, "Vocab size yetarli emas");

// 1. Apostrof unifikatsiyasi testi
const apostropheVariants = [
  "o'rmon",
  "o‘rmon",
  "oʻrmon",
  "o’rmon",
  "o`rmon",
];
const normalizedSet = new Set(apostropheVariants.map((w) => tokenizer.normalize(w)));
console.log(`- Apostrof variantlari normalizatsiya qilindi: ${Array.from(normalizedSet).join(", ")}`);
assert.strictEqual(normalizedSet.size, 1, "Barcha apostrof variantlari bitta yagona shaklga kelishi shart");
assert.strictEqual(Array.from(normalizedSet)[0], "o'rmon");
console.log("  ✅ Test 1: Apostrof normalizatsiyasi muvaffaqiyatli o'tdi.");

// 2. Encode va Decode Round-trip testi
for (const original of sampleTexts) {
  const encoded = tokenizer.encode(original);
  assert(Array.isArray(encoded) && encoded.length > 0, "Encode massiv qaytarishi kerak");
  const decoded = tokenizer.decode(encoded);
  const normOriginal = tokenizer.normalize(original);
  assert.strictEqual(decoded, normOriginal, `Roundtrip xatosi:\nKutilgan: "${normOriginal}"\nOlingan:  "${decoded}"`);
}
console.log("  ✅ Test 2: Barcha namunaviy matnlar bo'yicha 100% Round-trip fidelity tasdiqlandi.");

// 3. OOV (Out-Of-Vocabulary) himoya testi
const unseenWord = "falakiyotshunosligimizdagilardandir";
const unseenEncoded = tokenizer.encode(unseenWord);
assert(unseenEncoded.length > 0, "Noma'lum so'z bo'sh qaytmasligi kerak");
const unseenDecoded = tokenizer.decode(unseenEncoded);
assert.strictEqual(unseenDecoded, unseenWord, "Noma'lum so'z belgilarga ajralib to'liq tiklanishi shart");
console.log(`  ✅ Test 3: Unseen so'z ("${unseenWord}") OOV bo'lmasdan 100% tiklandi: "${unseenDecoded}"`);

// 4. Maxsus tokenlar testi
const sftPrompt = "<human>: Salom qalaysiz?<bot>: Rahmat, yaxshiman!<eos>";
const sftEncoded = tokenizer.encode(sftPrompt);
assert(sftEncoded.includes(tokenizer.specialTokens["<human>"]), "<human> tokeni mavjud bo'lishi kerak");
assert(sftEncoded.includes(tokenizer.specialTokens["<bot>"]), "<bot> tokeni mavjud bo'lishi kerak");
assert(sftEncoded.includes(tokenizer.specialTokens["<eos>"]), "<eos> tokeni mavjud bo'lishi kerak");
console.log("  ✅ Test 4: Maxsus tokenlar (<human>, <bot>, <eos>) to'g'ri joylashtirildi.");

// 5. Generatsiyadagi so'zlar birikishi va sintetik teglardan tozalash testi (Detokenization & Space Healing)
const glitchedOutput = "salomin 20in 20in osh yor hozirin 89 (#53)";
const cleanedOutput = UzbekTokenizer.cleanDetokenizedText(glitchedOutput);
console.log(`- Glitched text: "${glitchedOutput}"`);
console.log(`- Cleaned text:  "${cleanedOutput}"`);
assert.strictEqual(cleanedOutput, "salom in 20 in 20 in osh yor hozirin 89", "So'zlar to'g'ri ajralishi va (#53) o'chirilishi shart");
assert(!cleanedOutput.includes("(#"), "Sintetik (#...) teglari qolmasligi shart");
assert(!cleanedOutput.includes("20in"), "Raqam va so'z birikmasligi shart");
console.log("  ✅ Test 5: Subword Boundary & Space Healing muvaffaqiyatli o'tdi.");

console.log("\n🎉 BARCHA TOKENIZER TESTLARI 100% MUVAFFAQQ QILINDI!\n");
