"use strict";

const fs = require("fs");
const path = require("path");

/**
 * =======================================================================
 *  DATASET BUILDER & EXPANSION UTILITY (v1 -> v2)
 * =======================================================================
 *  Internetdan, bazadan (Neon) yoki qo'lda kiritilgan yangi ma'lumotlarni
 *  tekshirish, normallashtirish, deduplikatsiya qilish va xavfsiz birlashtirish.
 * 
 *  Ishlatish:
 *    node scripts/dataset_builder.js --input=data/raw_crawled/new_samples.json
 *    node scripts/dataset_builder.js --input=my_data.json --output=data/knowledge_v2.json
 *    node scripts/dataset_builder.js --stats
 * =======================================================================
 */

function normalizeUzbek(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[`ʼʻ’‘]/g, "'")
    .replace(/<[^>]*>/g, " ") // HTML teglarini tozalash
    .replace(/[\r\t\v\f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      args[key] = val !== undefined ? val : true;
    }
  }
  return args;
}

function getDatasetStats(items) {
  const catCount = {};
  let totalLength = 0;
  for (const item of items) {
    const cat = item.category || "umumiy";
    catCount[cat] = (catCount[cat] || 0) + 1;
    totalLength += (item.text || "").length;
  }
  return {
    total: items.length,
    categories: Object.keys(catCount).length,
    catCount,
    avgCharLength: items.length > 0 ? Math.round(totalLength / items.length) : 0,
  };
}

function main() {
  const args = parseArgs();
  const defaultBasePath = path.join(__dirname, "..", "data", "knowledge.json");
  const backupDir = path.join(__dirname, "..", "data", "backups");

  console.log("=========================================================================");
  console.log("  📚 UZBEK LLM DATASET BUILDER & EXPANSION PIPELINE (v1 / v2)");
  console.log("=========================================================================\n");

  if (!fs.existsSync(defaultBasePath)) {
    console.error(`❌ Asosiy dataset topilmadi: ${defaultBasePath}`);
    process.exit(1);
  }

  const baseRaw = JSON.parse(fs.readFileSync(defaultBasePath, "utf-8"));
  let baseItems = Array.isArray(baseRaw.knowledge) ? baseRaw.knowledge : (Array.isArray(baseRaw) ? baseRaw : []);

  if (args.stats) {
    const stats = getDatasetStats(baseItems);
    console.log(`📊 Mavjud baza statistikasi (${defaultBasePath}):`);
    console.log(`- Jami namunalar:   ${stats.total} ta`);
    console.log(`- Toifalar soni:    ${stats.categories} ta`);
    console.log(`- O'rtacha uzunlik: ${stats.avgCharLength} belgi`);
    console.log("\nTop toifalar:");
    const sortedCats = Object.entries(stats.catCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [cat, cnt] of sortedCats) {
      console.log(`  * ${cat.padEnd(25, " ")}: ${cnt} ta`);
    }
    return;
  }

  const inputPath = args.input;
  if (!inputPath) {
    console.log("ℹ️ Qo'llanma:");
    console.log("  Yangi ma'lumot qo'shish uchun --input bayrog'ini bering:");
    console.log("  node scripts/dataset_builder.js --input=data/raw_crawled/new_samples.json\n");
    console.log("  Mavjud statistika ko'rish uchun:");
    console.log("  node scripts/dataset_builder.js --stats\n");
    return;
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`❌ Kiritilgan fayl topilmadi: ${resolvedInput}`);
    process.exit(1);
  }

  const newRaw = JSON.parse(fs.readFileSync(resolvedInput, "utf-8"));
  const newItems = Array.isArray(newRaw.knowledge) ? newRaw.knowledge : (Array.isArray(newRaw) ? newRaw : []);

  console.log(`- Asosiy baza:    ${baseItems.length} ta yozuv`);
  console.log(`- Yangi kiruvchi: ${newItems.length} ta yozuv`);

  // Zaxira nusxa yaratish
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `knowledge_backup_${baseItems.length}_${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ knowledge: baseItems }, null, 2), "utf-8");
  console.log(`- 🛡️ Zaxira olindi: ${backupFile}`);

  // Deduplikatsiya va tozalash
  const seenTexts = new Set(baseItems.map(i => normalizeUzbek(i.text).toLowerCase()));
  let addedCount = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  const merged = [...baseItems];

  for (const item of newItems) {
    const rawText = typeof item === "string" ? item : item.text;
    const cleanText = normalizeUzbek(rawText);
    const cat = (item && item.category) ? item.category : "umumiy_bilim";

    if (!cleanText || cleanText.length < 5) {
      skippedInvalid++;
      continue;
    }

    const key = cleanText.toLowerCase();
    if (seenTexts.has(key)) {
      skippedDuplicates++;
      continue;
    }

    seenTexts.add(key);
    merged.push({
      id: merged.length + 1,
      text: cleanText,
      category: cat,
      source: item.source || "user_expansion",
      timestamp: new Date().toISOString()
    });
    addedCount++;
  }

  console.log(`- Qo'shilgan yangi: ${addedCount} ta`);
  console.log(`- Olib tashlangan dublikatlar: ${skippedDuplicates} ta`);
  console.log(`- Yaroqsiz/qisqa: ${skippedInvalid} ta`);
  console.log(`- Yangi umumiy hajm: ${merged.length} ta namuna`);

  const outputPath = args.output ? path.resolve(process.cwd(), args.output) : defaultBasePath;
  fs.writeFileSync(outputPath, JSON.stringify({ knowledge: merged }, null, 2), "utf-8");
  console.log(`\n✔ Yangilangan dataset muvaffaqiyatli saqlandi: ${outputPath}`);
  console.log("Endi o'zingiz xohlagan paytda yangi modelni o'qitish buyrug'ini bera olasiz:");
  console.log(`  npm run train:transformer\n`);
}

if (require.main === module) {
  main();
}

module.exports = { normalizeUzbek, getDatasetStats };
