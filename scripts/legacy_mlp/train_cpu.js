#!/usr/bin/env node
"use strict";

/**
 * =======================================================================
 *  MUSTAQIL (BO'LAK) CPU O'QITISH SKRIPTI
 * =======================================================================
 *  Ushbu skript qo'shimcha flaglarsiz to'g'ridan-to'g'ri optimallashgan
 *  Sparse-vektor algoritmi yordamida protsessorda (CPU) o'qitadi.
 *
 *  Ishga tushirish:
 *    node train_cpu.js
 *    npm run train:cpu
 *    train_cpu.bat (Windows uchun)
 * =======================================================================
 */

const trainKnowledgeBase = require("./train");
const dbService = require("../../src/db");

async function main() {
  console.log("\n=======================================================");
  console.log("🖥️  [CPU Dvigateli]: Maxsus CPU o'qitish rejimi ishga tushdi");
  console.log("=======================================================\n");

  try {
    const result = await trainKnowledgeBase({ device: "cpu" });
    console.log(`\n✅ [CPU]: Model ${result.accuracy}% aniqlik bilan muvaffaqiyatli saqlandi!`);
    process.exitCode = 0;
  } catch (err) {
    console.error("\n❌ [CPU O'qitishda xatolik]:", err.message || err);
    process.exitCode = 1;
  } finally {
    if (dbService && typeof dbService.close === "function") {
      await dbService.close();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
