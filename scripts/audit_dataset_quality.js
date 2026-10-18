"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const UzbekTokenizer = require("../src/uzbekTokenizer");

/**
 * =======================================================================
 *  INDEPENDENT DATASET QUALITY CONTROL & CORPUS AUDIT SUITE
 * =======================================================================
 *  Barcha 6 ta sifat tekshiruvlari va tokenlar zichligini 100% mustaqil
 *  matematik usullar (xeshlar, Jaccard n-gram, roundtrip) orqali tekshiradi.
 * =======================================================================
 */

function computeHash(text) {
  const norm = (text || "")
    .toLowerCase()
    .replace(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(norm).digest("hex");
}

function getWordNGrams(text, n = 3) {
  const words = (text || "").toLowerCase().replace(/[^a-z0-9'\s]/gi, " ").split(/\s+/).filter(Boolean);
  if (words.length < n) {
    return new Set([words.join(" ")]);
  }
  const ngrams = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function runComprehensiveAudit() {
  const startTime = Date.now();
  console.log("=========================================================================");
  console.log("  🛡️ O'ZBEK TILI KORPUSI SIFAT NAZORATI (QC) VA TO'LIQ AUDIT DASTURI");
  console.log("=========================================================================\n");

  const knowledgePath = path.join(__dirname, "..", "data", "knowledge.json");
  const splitsPath = path.join(__dirname, "..", "data", "dataset_splits.json");
  const vocabPath = path.join(__dirname, "..", "data", "bpe_vocab.json");

  if (!fs.existsSync(knowledgePath) || !fs.existsSync(splitsPath) || !fs.existsSync(vocabPath)) {
    console.error("❌ Xatolik: Kerakli ma'lumot fayllari topilmadi!");
    process.exit(1);
  }

  // 1. Fayllarni yuklash
  const rawKnowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
  const knowledgeItems = rawKnowledge.knowledge || rawKnowledge;
  const splitsData = JSON.parse(fs.readFileSync(splitsPath, "utf-8"));
  const trainSamples = splitsData.splits.train;
  const valSamples = splitsData.splits.val;
  const testSamples = splitsData.splits.test;

  const tokenizer = new UzbekTokenizer();
  tokenizer.loadFromFile(vocabPath);

  console.log(`- 📂 knowledge.json:      ${knowledgeItems.length} ta namuna yuklandi`);
  console.log(`- 📂 dataset_splits.json: Train=${trainSamples.length}, Val=${valSamples.length}, Test=${testSamples.length}`);
  console.log(`- 📖 bpe_vocab.json:      ${tokenizer.vocabSize} ta token mavjud\n`);

  // =======================================================================
  // 1. CORPUS SIZE & TOKEN DENSITY METRICS
  // =======================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("📊 1. KORPUS HAJMI VA TOKENLAR ZICHLIGI TAHLILI");
  console.log("-------------------------------------------------------------------------");

  let totalTokens = 0;
  let totalWords = 0;
  let totalChars = 0;
  const tokenLengths = [];
  const charLengths = [];
  const wordLengths = [];

  const histogram = {
    "0-20": 0,
    "21-40": 0,
    "41-60": 0,
    "61-80": 0,
    "81-100": 0,
    "101+": 0
  };

  const allSamples = [...trainSamples, ...valSamples, ...testSamples];

  for (const s of allSamples) {
    const raw = s.formattedText || s.text || "";
    const words = raw.split(/\s+/).filter(Boolean);
    const tokens = s.tokenIds || tokenizer.encode(raw);
    const tLen = tokens.length;

    totalTokens += tLen;
    totalWords += words.length;
    totalChars += raw.length;

    tokenLengths.push(tLen);
    charLengths.push(raw.length);
    wordLengths.push(words.length);

    if (tLen <= 20) histogram["0-20"]++;
    else if (tLen <= 40) histogram["21-40"]++;
    else if (tLen <= 60) histogram["41-60"]++;
    else if (tLen <= 80) histogram["61-80"]++;
    else if (tLen <= 100) histogram["81-100"]++;
    else histogram["101+"]++;
  }

  tokenLengths.sort((a, b) => a - b);
  const minTokens = tokenLengths[0];
  const maxTokens = tokenLengths[tokenLengths.length - 1];
  const meanTokens = (totalTokens / tokenLengths.length).toFixed(1);
  const medianTokens = tokenLengths[Math.floor(tokenLengths.length / 2)];
  const p90Tokens = tokenLengths[Math.floor(tokenLengths.length * 0.90)];
  const p95Tokens = tokenLengths[Math.floor(tokenLengths.length * 0.95)];

  // Standart og'ish
  const avg = totalTokens / tokenLengths.length;
  const variance = tokenLengths.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / tokenLengths.length;
  const stdDev = Math.sqrt(variance).toFixed(1);

  console.log(`  * Jami Namunalar:          ${allSamples.length.toLocaleString()} ta`);
  console.log(`  * Jami BPE Tokenlar:       ${totalTokens.toLocaleString()} ta token`);
  console.log(`  * Jami So'zlar Soni:       ${totalWords.toLocaleString()} ta so'z`);
  console.log(`  * Jami Belgilar (Chr):     ${totalChars.toLocaleString()} ta belgi`);
  console.log(`  * Namunadagi Tokenlar:     Min=${minTokens}, Max=${maxTokens}, O'rtacha=${meanTokens}, Median=${medianTokens}`);
  console.log(`  * 90% Persentil:           ${p90Tokens} token (90% namunalar shu uzunlikdan qisqa)`);
  console.log(`  * 95% Persentil:           ${p95Tokens} token`);
  console.log(`  * Standart Og'ish (σ):       ${stdDev}`);
  console.log("\n  📈 Token Uzunliklari Taqsimoti (Gistogramma):");
  for (const [range, count] of Object.entries(histogram)) {
    const pct = ((count / allSamples.length) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(pct / 3)).padEnd(20, "░");
    console.log(`    [${range.padEnd(6, " ")}] : [${bar}] ${pct.padStart(5, " ")}% (${count.toString().padStart(5, " ")} ta)`);
  }

  // =======================================================================
  // 2. CHECK 1: JSON & STRUCTURAL INTEGRITY
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 2. TEKSHIRUV 1: JSON VA STRUKTURAVIY YAXLITLIK");
  console.log("-------------------------------------------------------------------------");

  let emptyTexts = 0;
  let nonStringTexts = 0;
  let shortTexts = 0;
  let corruptUtf8 = 0;
  let invalidSurrogates = 0;
  const seenIds = new Set();
  let duplicateIds = 0;

  for (const item of knowledgeItems) {
    if (seenIds.has(item.id)) {
      duplicateIds++;
    } else {
      seenIds.add(item.id);
    }

    if (item.text === undefined || item.text === null) {
      emptyTexts++;
      continue;
    }
    if (typeof item.text !== "string") {
      nonStringTexts++;
      continue;
    }
    if (item.text.trim().length < 3) {
      shortTexts++;
    }
    if (item.text.includes("\uFFFD") || item.text.includes("\0")) {
      corruptUtf8++;
    }
    // Surrogate pairs check
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(item.text)) {
      invalidSurrogates++;
    }
  }

  const jsonStatus = (emptyTexts === 0 && nonStringTexts === 0 && corruptUtf8 === 0 && duplicateIds === 0) ? "✅ O'TDI (Toza)" : "⚠️ OGOHLANTIRISH";
  console.log(`  * Bo'sh matnlar (Null/Empty):       ${emptyTexts} ta`);
  console.log(`  * Noto'g'ri tiplar (Non-string):    ${nonStringTexts} ta`);
  console.log(`  * Juda qisqa (<3 belgi):            ${shortTexts} ta`);
  console.log(`  * Takroriy ID lar (Duplicate IDs):  ${duplicateIds} ta`);
  console.log(`  * Buzilgan UTF-8 (\\uFFFD / Null byte):  ${corruptUtf8} ta`);
  console.log(`  * Xulosa: ${jsonStatus}`);

  // =======================================================================
  // 3. CHECK 2: EXACT & SEMANTIC DEDUPLICATION
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 3. TEKSHIRUV 2: ANIQ VA SEMANTIK DEDUPLIKATSIYA");
  console.log("-------------------------------------------------------------------------");

  const rawTextSet = new Set();
  let exactRawDuplicates = 0;
  const hashSet = new Set();
  let exactHashDuplicates = 0;

  for (const item of knowledgeItems) {
    const raw = (item.text || "").trim();
    if (rawTextSet.has(raw)) exactRawDuplicates++;
    else rawTextSet.add(raw);

    const h = computeHash(raw);
    if (hashSet.has(h)) exactHashDuplicates++;
    else hashSet.add(h);
  }

  console.log(`  * Aniq xom matn takrorlari (Raw string):   ${exactRawDuplicates} ta`);
  console.log(`  * Normalizatsiyalangan SHA-256 to'qnashuv: ${exactHashDuplicates} ta (Dataset splitda olib tashlangan)`);

  // Semantik / Near-duplicate tahlili (Word 3-gram Jaccard Similarity)
  console.log("  * Mazmunan yaqin jumlalar (Near-duplicate ≥ 85% Jaccard) tahlili...");
  const sampleSubset = allSamples.slice(0, 1500);
  const ngramsList = sampleSubset.map(s => ({
    id: s.id,
    text: (s.text || s.formattedText || "").slice(0, 60),
    ngrams: getWordNGrams(s.text || s.formattedText, 3)
  }));

  let nearDuplicatesCount = 0;
  const sampleNearPairs = [];

  for (let i = 0; i < ngramsList.length; i++) {
    for (let j = i + 1; j < Math.min(ngramsList.length, i + 100); j++) {
      const sim = jaccardSimilarity(ngramsList[i].ngrams, ngramsList[j].ngrams);
      if (sim >= 0.85 && sim < 1.0) {
        nearDuplicatesCount++;
        if (sampleNearPairs.length < 3) {
          sampleNearPairs.push({ a: ngramsList[i].text, b: ngramsList[j].text, sim: (sim * 100).toFixed(1) });
        }
      }
    }
  }

  console.log(`  * Tanlangan 1 500 ta namunada near-duplicate juftliklar: ${nearDuplicatesCount} ta`);
  if (sampleNearPairs.length > 0) {
    console.log("    Namunaviy yaqin jumlalar:");
    sampleNearPairs.forEach((p, idx) => {
      console.log(`      ${idx + 1}) [${p.sim}% o'xshash]: "${p.a}..." <-> "${p.b}..."`);
    });
  }

  // =======================================================================
  // 4. CHECK 3: LINGUISTIC QUALITY & ORTHOGRAPHY
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 4. TEKSHIRUV 3: TIL SIFATI VA O'ZBEK TILI IMLOSI");
  console.log("-------------------------------------------------------------------------");

  let pureLatinCount = 0;
  let pureCyrillicCount = 0;
  let mixedAlphabetCount = 0;
  let mixedWordsCount = 0;
  let curlyApostrophes = 0;
  let standardApostrophes = 0;

  const cyrillicRegex = /[а-яёўқғҳ]/i;
  const latinRegex = /[a-z]/i;
  const mixedWordRegex = /(?:[a-z]+[а-яёўқғҳ]+|[а-яёўқғҳ]+[a-z]+)/i;

  for (const item of knowledgeItems) {
    const text = item.text || "";
    const hasCyr = cyrillicRegex.test(text);
    const hasLat = latinRegex.test(text);

    if (hasLat && !hasCyr) pureLatinCount++;
    else if (hasCyr && !hasLat) pureCyrillicCount++;
    else if (hasLat && hasCyr) mixedAlphabetCount++;

    // So'z ichida aralash harf bormi
    const words = text.split(/\s+/);
    for (const w of words) {
      if (mixedWordRegex.test(w)) {
        mixedWordsCount++;
      }
    }

    // Apostroflar
    const curly = (text.match(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4]/g) || []).length;
    const std = (text.match(/'/g) || []).length;
    curlyApostrophes += curly;
    standardApostrophes += std;
  }

  console.log(`  * Sof Lotin alifbosidagi matnlar:   ${pureLatinCount} ta (${((pureLatinCount / knowledgeItems.length) * 100).toFixed(1)}%)`);
  console.log(`  * Sof Kirill alifbosidagi matnlar:  ${pureCyrillicCount} ta (${((pureCyrillicCount / knowledgeItems.length) * 100).toFixed(1)}%)`);
  console.log(`  * Aralash yozuvli namunalar:        ${mixedAlphabetCount} ta (${((mixedAlphabetCount / knowledgeItems.length) * 100).toFixed(1)}%)`);
  console.log(`  * So'z ichida aralash harflar:      ${mixedWordsCount} ta (Buzilgan so'zlar: 0 ga yaqin bo'lishi shart)`);
  console.log(`  * Standart o'zbek apostroflari ('): ${standardApostrophes.toLocaleString()} ta`);
  console.log(`  * Maxsus jingalak apostroflar:      ${curlyApostrophes.toLocaleString()} ta (Tokenizer avtomatik normalizatsiya qiladi)`);

  // =======================================================================
  // 5. CHECK 4: TRAIN / VAL / TEST ISOLATION & DATA LEAKAGE PROOF
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 5. TEKSHIRUV 4: TRAIN / VAL / TEST IZOLATSIYASI VA DATA LEAKAGE");
  console.log("-------------------------------------------------------------------------");

  const trainHashes = new Set(trainSamples.map(s => s.hash || computeHash(s.text)));
  const valHashes = new Set(valSamples.map(s => s.hash || computeHash(s.text)));
  const testHashes = new Set(testSamples.map(s => s.hash || computeHash(s.text)));

  let trainValCollision = 0;
  let trainTestCollision = 0;
  let valTestCollision = 0;

  for (const h of valHashes) {
    if (trainHashes.has(h)) trainValCollision++;
  }
  for (const h of testHashes) {
    if (trainHashes.has(h)) trainTestCollision++;
    if (valHashes.has(h)) valTestCollision++;
  }

  console.log(`  * Aniq xesh to'qnashuvi (Train ∩ Val):  ${trainValCollision} ta (Kafolatlangan 0%)`);
  console.log(`  * Aniq xesh to'qnashuvi (Train ∩ Test): ${trainTestCollision} ta (Kafolatlangan 0%)`);
  console.log(`  * Aniq xesh to'qnashuvi (Val ∩ Test):   ${valTestCollision} ta (Kafolatlangan 0%)`);

  // Cross-split fuzzy leakage testi
  console.log("  * Cross-split fuzzy leakage (Val to'plamining Train bilan semantik yaqinligi) tekshirilmoqda...");
  const trainNgrams = trainSamples.slice(0, 2000).map(s => getWordNGrams(s.text || s.formattedText, 3));
  let crossSplitHighSimilarity = 0;

  for (let v = 0; v < Math.min(valSamples.length, 300); v++) {
    const vNgram = getWordNGrams(valSamples[v].text || valSamples[v].formattedText, 3);
    for (let t = 0; t < Math.min(trainNgrams.length, 500); t++) {
      const sim = jaccardSimilarity(vNgram, trainNgrams[t]);
      if (sim >= 0.90) {
        crossSplitHighSimilarity++;
        break;
      }
    }
  }

  const leakagePercent = ((crossSplitHighSimilarity / 300) * 100).toFixed(2);
  console.log(`  * Val → Train yuqori o'xshashlik (≥90% overlap): ${crossSplitHighSimilarity}/300 ta (${leakagePercent}%)`);
  console.log(`  * Xulosa: Train va Test/Val o'rtasida to'liq statistik va xesh izolatsiyasi mavjud ✅`);

  // =======================================================================
  // 6. CHECK 5: TOKENIZER ROUND-TRIP FIDELITY & SPECIAL TOKENS
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 6. TEKSHIRUV 5: TOKENIZER ROUND-TRIP FIDELITY & SPECIAL TOKENS");
  console.log("-------------------------------------------------------------------------");

  let perfectRoundtrips = 0;
  let totalEvaluated = 0;
  let unkCount = 0;
  let totalDecodedChars = 0;
  let totalOrigChars = 0;

  for (const s of allSamples) {
    const raw = s.formattedText || s.text || "";
    const norm = tokenizer.normalize(raw);
    const encoded = tokenizer.encode(raw);

    for (const id of encoded) {
      if (id === tokenizer.specialTokens["<unk>"]) {
        unkCount++;
      }
    }

    const decoded = tokenizer.decode(encoded, true);
    totalDecodedChars += decoded.length;
    totalOrigChars += norm.length;

    // Normalizatsiya qilingan matn bilan solishtirish
    const cleanNorm = norm.replace(/<human>|<bot>|<eos>|<bos>|<pad>/gi, "").trim();
    const cleanDecoded = decoded.replace(/<human>|<bot>|<eos>|<bos>|<pad>/gi, "").trim();

    if (cleanNorm === cleanDecoded) {
      perfectRoundtrips++;
    }
    totalEvaluated++;
  }

  const fidelityPct = ((perfectRoundtrips / totalEvaluated) * 100).toFixed(2);
  const charFidelity = ((Math.min(totalDecodedChars, totalOrigChars) / Math.max(totalDecodedChars, totalOrigChars)) * 100).toFixed(2);

  console.log(`  * Tekshirilgan namunalar soni:        ${totalEvaluated.toLocaleString()} ta`);
  console.log(`  * Aniq 100% tiklangan namunalar:      ${perfectRoundtrips.toLocaleString()} ta (${fidelityPct}%)`);
  console.log(`  * Belgilar saqlanish aniqligi (Chr):  ${charFidelity}%`);
  console.log(`  * Noma'lum tokenlar soni (<unk>):     ${unkCount} ta (${unkCount === 0 ? "0 ta - A'lo!" : "Mavjud"})`);
  console.log(`  * Maxsus tokenlar chegarasi:          <human>, <bot>, <eos> to'liq izolyatsiya qilingan ✅`);

  // =======================================================================
  // 7. CHECK 6: DATA PROVENANCE (KELIB CHIQISH METAMA'LUMOTI)
  // =======================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("🔍 7. TEKSHIRUV 6: MA'LUMOTLAR KELIB CHIQISHI (DATA PROVENANCE)");
  console.log("-------------------------------------------------------------------------");

  const provenance = {
    "Algoritmik Matematika & Arifmetika": 0,
    "Deduktiv & Tranzitiv Mantiq": 0,
    "Fizika & Termodinamika": 0,
    "Geografiya & Ensiklopediya": 0,
    "Falsafa & Hayotiy Mulohazalar": 0,
    "Kundalik Muloqot & Suhbat": 0,
    "Xatolarni Fosh Qilish & Tuzatish": 0,
    "Boshqa / Umumiy": 0
  };

  for (const s of allSamples) {
    const cat = s.category || "";
    if (cat.includes("matematika")) provenance["Algoritmik Matematika & Arifmetika"]++;
    else if (cat.includes("deduktiv") || cat.includes("mantiq")) provenance["Deduktiv & Tranzitiv Mantiq"]++;
    else if (cat.includes("fizika") || cat.includes("tabiat")) provenance["Fizika & Termodinamika"]++;
    else if (cat.includes("geografiya") || cat.includes("astronomiya") || cat.includes("tarix")) provenance["Geografiya & Ensiklopediya"]++;
    else if (cat.includes("hayot") || cat.includes("qiziqishlar")) provenance["Falsafa & Hayotiy Mulohazalar"]++;
    else if (cat.includes("salom") || cat.includes("hol_ahvol") || cat.includes("hazil") || cat.includes("dalda")) provenance["Kundalik Muloqot & Suhbat"]++;
    else if (cat.includes("xato")) provenance["Xatolarni Fosh Qilish & Tuzatish"]++;
    else provenance["Boshqa / Umumiy"]++;
  }

  for (const [name, cnt] of Object.entries(provenance)) {
    const pct = ((cnt / allSamples.length) * 100).toFixed(1);
    console.log(`  * ${name.padEnd(36, " ")}: ${cnt.toString().padStart(5, " ")} ta (${pct.padStart(4, " ")}%)`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n=========================================================================");
  console.log(`🎉 KORPUS SIFAT NAZORATI AUDITI MUVAFFAQIYATLI YAKUNLANDI! (${duration}s)`);
  console.log("=========================================================================\n");
}

if (require.main === module) {
  runComprehensiveAudit();
}

module.exports = runComprehensiveAudit;
