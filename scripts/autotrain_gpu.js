#!/usr/bin/env node
"use strict";

/**
 * =======================================================================
 *  MUSTAQIL (BO'LAK) AUTO-TRAIN GPU SKRIPTI
 * =======================================================================
 *  Gemini orqali yangi bilimlarni generatsiya qiladi va to'g'ridan-to'g'ri
 *  GPU (NVIDIA / WebGL) orqali o'qitadi.
 *
 *  Ishga tushirish:
 *    node scripts/autotrain_gpu.js
 *    npm run autotrain:gpu
 * =======================================================================
 */

const runAutoTrain = require("./autoTrainAI");

runAutoTrain({ device: "gpu" }).catch((error) => {
  console.error("GPU Auto-train jarayonida xatolik:", error);
  process.exitCode = 1;
});
