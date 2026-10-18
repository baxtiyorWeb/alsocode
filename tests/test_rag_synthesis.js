"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const DocumentRAGEngine = require("../src/rag");

async function runTest() {
  console.log("=== RAG DEDUKSIYA VA MANTIQIY SINTEZ TESTI BOSHLANDI ===");

  const tempDbPath = path.join(__dirname, "temp_rag_test.json");
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  const rag = new DocumentRAGEngine(null, tempDbPath);

  const testContent = 
    `"Samarqand Texnoparki" 2024-yil Samarqand shahrida tashkil etilgan bo'lib, sun'iy intellekt va robototexnika sohasida startaplarni qo'llab-quvvatlaydi. ` +
    `Texnoparkning bosh koordinatori — Aziz Karimov. ` +
    `2025-yilda texnopark 50 ta yangi IT loyihani moliyalashtirishni rejalashtirgan.`;

  const added = rag.addDocument("Samarqand Texnoparki", testContent, "texnologiya");
  assert.ok(added.chunksCount > 0, "Kamida 1 ta chunk yaratilishi kerak");

  // 1. SHAXS / KIM DEDUKSIYASI
  console.log("▶ 1. Shaxs tahlili ('Aziz Karimov kim?')...");
  const q1 = "Aziz Karimov kim?";
  const res1 = rag.answerQuery(q1);
  console.log("  Javob:", res1.reply);
  assert.strictEqual(res1.deductionType, "identity", "Deduksiya turi 'identity' bo'lishi kerak");
  assert.ok(res1.reply.includes("Aziz Karimov"), "Javobda Aziz Karimov bo'lishi kerak");
  assert.ok(res1.reply.includes("bosh koordinatori"), "Javobda uning roli (bosh koordinatori) bo'lishi kerak");
  assert.ok(!res1.reply.includes("50 ta yangi IT loyiha"), "Boshqa aloqasiz faktlar aralashmasligi kerak");
  console.log("  ✅ 1-test o'tdi!");

  // 2. TASDIQLASH / VERIFIKATSIYA DEDUKSIYASI
  console.log("▶ 2. Tasdiqlash tahlili ('2024-yilda tashkil etilganmi?')...");
  const q2 = "Samarqand Texnoparki 2024-yilda tashkil etilganmi?";
  const res2 = rag.answerQuery(q2);
  console.log("  Javob:", res2.reply);
  assert.strictEqual(res2.deductionType, "verification", "Deduksiya turi 'verification' bo'lishi kerak");
  assert.ok(res2.reply.includes("Ha, to'g'ri"), "Tasdiqlovchi mantiq 'Ha, to'g'ri' bilan boshlanishi kerak");
  console.log("  ✅ 2-test o'tdi!");

  // 3. VAQT / QACHON DEDUKSIYASI
  console.log("▶ 3. Vaqt tahlili ('qachon tashkil etilgan?')...");
  const q3 = "Texnopark qachon tashkil etilgan?";
  const res3 = rag.answerQuery(q3);
  console.log("  Javob:", res3.reply);
  assert.strictEqual(res3.deductionType, "time", "Deduksiya turi 'time' bo'lishi kerak");
  assert.ok(res3.reply.includes("2024-yil"), "Javobda 2024-yil bo'lishi kerak");
  console.log("  ✅ 3-test o'tdi!");

  // 4. MAKON / QAYERDA DEDUKSIYASI
  console.log("▶ 4. Makon tahlili ('qayerda joylashgan?')...");
  const q4 = "Texnopark qayerda joylashgan?";
  const res4 = rag.answerQuery(q4);
  console.log("  Javob:", res4.reply);
  assert.strictEqual(res4.deductionType, "location", "Deduksiya turi 'location' bo'lishi kerak");
  assert.ok(res4.reply.includes("Samarqand"), "Javobda Samarqand bo'lishi kerak");
  console.log("  ✅ 4-test o'tdi!");

  // Tozalash
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  console.log("\n🎉 BARCHA RAG DEDUKSIYA TESTLARI MUVAFFAQIYATLI O'TDI!");
}

runTest().catch((err) => {
  console.error("❌ Testda xatolik:", err);
  process.exit(1);
});
