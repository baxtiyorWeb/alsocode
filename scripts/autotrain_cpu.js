#!/usr/bin/env node
"use strict";

/**
 * =======================================================================
 *  MUSTAQIL (BO'LAK) AUTO-TRAIN CPU SKRIPTI
 * =======================================================================
 *  Gemini orqali yangi bilimlarni generatsiya qiladi va to'g'ridan-to'g'ri
 *  optimallashtirilgan CPU orqali o'qitadi.
 *
 *  Ishga tushirish:
 *    node scripts/autotrain_cpu.js
 *    npm run autotrain:cpu
 * =======================================================================
 */

const runAutoTrain = require("./autoTrainAI");

runAutoTrain({ device: "cpu" }).catch((error) => {
  console.error("CPU Auto-train jarayonida xatolik:", error);
  process.exitCode = 1;
});
