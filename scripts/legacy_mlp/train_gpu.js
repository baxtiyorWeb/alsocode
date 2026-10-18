#!/usr/bin/env node
"use strict";

/**
 * =======================================================================
 *  MUSTAQIL (BO'LAK) GPU O'QITISH SKRIPTI
 * =======================================================================
 *  Ushbu skript qo'shimcha flaglarsiz to'g'ridan-to'g'ri NVIDIA / WebGL
 *  apparat tezlatgichidan (GPU) foydalanib neyron tarmoqni o'qitadi.
 *
 *  Ishga tushirish:
 *    node train_gpu.js
 *    npm run train:gpu
 *    train_gpu.bat (Windows uchun)
 * =======================================================================
 */

const trainKnowledgeBase = require("./train");
const dbService = require("../../src/db");

async function main() {
  console.log("\n=======================================================");
  console.log("🚀 [GPU Dvigateli]: Maxsus GPU o'qitish rejimi ishga tushdi");
  console.log("=======================================================\n");

  try {
    const result = await trainKnowledgeBase({ device: "gpu" });
    console.log(`\n✅ [GPU]: Model ${result.accuracy}% aniqlik bilan muvaffaqiyatli saqlandi!`);
    process.exitCode = 0;
  } catch (err) {
    console.error("\n❌ [GPU O'qitishda xatolik]:", err.message || err);
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
