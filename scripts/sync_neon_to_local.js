"use strict";

const fs = require("fs");
const path = require("path");
const dbService = require("../src/db");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("uz-UZ")
    .replace(/[.,!?;:'"«»()[\]{}…—–-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function syncNeonToLocal() {
  console.log("=========================================================================");
  console.log("  1-QADAM: NEON POSTGRESQL MA'LUMOTLARINI LOKAL KESH BILAN SINXRONLASH");
  console.log("=========================================================================\n");

  const localKnowledgePath = path.join(__dirname, "..", "data", "knowledge.json");
  const backupDir = path.join(__dirname, "..", "data", "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. Mavjud lokal faylni o'qish
  if (!fs.existsSync(localKnowledgePath)) {
    throw new Error(`Lokal fayl topilmadi: ${localKnowledgePath}`);
  }

  const localRaw = fs.readFileSync(localKnowledgePath, "utf-8");
  const localData = JSON.parse(localRaw);
  const localItems = Array.isArray(localData.knowledge) ? localData.knowledge : [];

  console.log(`- 📂 Mavjud lokal knowledge.json hajmi: ${localItems.length} ta yozuv`);

  // 2. To'liq zaxira nusxa yaratish
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `knowledge_backup_${localItems.length}_${timestamp}.json`);
  fs.writeFileSync(backupPath, localRaw, "utf-8");
  console.log(`- 🛡️ To'liq zaxira nusxasi yaratildi: ${backupPath}`);

  // 3. Neon DB ga ulanish
  console.log("- 🌐 Neon PostgreSQL bazasiga ulanilmoqda...");
  const dbOk = await dbService.init();
  if (!dbOk || !dbService.isReady) {
    throw new Error("Neon PostgreSQL bazasiga ulanib bo'lmadi!");
  }

  // 4. Neon'dagi barcha ma'lumotlarni tortib olish
  const countRes = await dbService.query("SELECT COUNT(*) FROM ai_knowledge");
  const totalDbCount = parseInt(countRes.rows[0].count, 10);
  console.log(`- 📊 Neon PostgreSQL dagi jami yozuvlar: ${totalDbCount} ta`);

  const dbRowsRes = await dbService.query("SELECT id, text, category FROM ai_knowledge ORDER BY id ASC");
  const dbRows = dbRowsRes.rows;

  // 5. Birlashtirish va deduplikatsiya
  const normalizedSeen = new Set();
  const mergedKnowledge = [];

  // Avval mavjud 3059 ta lokal yozuvni 100% kafolatli saqlaymiz
  let localPreserved = 0;
  for (const item of localItems) {
    if (!item || !item.text) continue;
    const cleanText = String(item.text).trim();
    const norm = normalizeText(cleanText);
    if (!norm) continue;

    if (!normalizedSeen.has(norm)) {
      normalizedSeen.add(norm);
      mergedKnowledge.push({
        text: cleanText,
        category: item.category || "umumiy",
      });
      localPreserved++;
    }
  }

  console.log(`- ✅ Saqlab qolingan dastlabki lokal yozuvlar: ${localPreserved} ta`);

  // Endi Neon'dan yangi yozuvlarni qo'shamiz
  let newlyAddedFromNeon = 0;
  let skippedDuplicates = 0;

  for (const row of dbRows) {
    if (!row || !row.text) continue;
    const cleanText = String(row.text).trim();
    const norm = normalizeText(cleanText);
    if (!norm) continue;

    if (normalizedSeen.has(norm)) {
      skippedDuplicates++;
    } else {
      normalizedSeen.add(norm);
      mergedKnowledge.push({
        text: cleanText,
        category: row.category || "umumiy",
      });
      newlyAddedFromNeon++;
    }
  }

  console.log(`- ➕ Neon bazasidan yangi qo'shilgan yozuvlar: ${newlyAddedFromNeon} ta`);
  console.log(`- ↪ Takroriy bo'lgani uchun o'tkazib yuborilgan: ${skippedDuplicates} ta`);
  console.log(`- 🎯 Birlashgan umumiy unikal bilimlar soni: ${mergedKnowledge.length} ta`);

  // Kategoriyalarni yig'ish
  const categories = [...new Set(mergedKnowledge.map((item) => item.category))];
  console.log(`- 🏷️ Jami kategoriyalar soni: ${categories.length} ta`);

  // 6. data/knowledge.json ga atomik yozish
  const finalPayload = {
    metadata: {
      version: "2.0-synchronized",
      updatedAt: new Date().toISOString(),
      originalLocalCount: localItems.length,
      neonDbCount: totalDbCount,
      newlyAddedFromNeon,
      totalCount: mergedKnowledge.length,
      categoryCount: categories.length,
    },
    categories,
    knowledge: mergedKnowledge,
  };

  const tempPath = `${localKnowledgePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(finalPayload, null, 2), "utf-8");
  fs.renameSync(tempPath, localKnowledgePath);

  console.log(`\n🎉 1-QADAM MUVAFFAQIYATLI YAKUNLANDI!`);
  console.log(`- Yangilangan fayl: ${localKnowledgePath}`);
  console.log(`- Jami bilimlar: ${mergedKnowledge.length} ta (Eski ${localItems.length} ta + Yangi ${newlyAddedFromNeon} ta)`);

  // Poolni yopish
  if (dbService.pool) {
    await dbService.pool.end();
  }

  return {
    originalCount: localItems.length,
    newlyAdded: newlyAddedFromNeon,
    totalCount: mergedKnowledge.length,
    categoriesCount: categories.length,
    backupPath,
  };
}

if (require.main === module) {
  syncNeonToLocal()
    .then((res) => {
      console.log("\nSinxronizatsiya ma'lumotlari:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n🛑 Xatolik yuz berdi:", err);
      process.exit(1);
    });
}

module.exports = syncNeonToLocal;
