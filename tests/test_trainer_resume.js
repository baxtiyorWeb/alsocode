"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CausalTransformerModel = require("../src/transformerModel");
const UzbekTokenizer = require("../src/uzbekTokenizer");
const TransformerTrainer = require("../src/transformerTrainer");

console.log("==================================================");
console.log("  RUNNING TRANSFORMER TRAINER & RESUME TESTS");
console.log("==================================================");

const checkpointDir = "./data/test_checkpoints";
if (fs.existsSync(checkpointDir)) {
  fs.rmSync(checkpointDir, { recursive: true, force: true });
}

const config = {
  vocabSize: 80,
  dModel: 32,
  nHeads: 4,
  headDim: 8,
  dFfn: 128,
  nLayers: 2,
  maxSeqLen: 32,
};

const model = new CausalTransformerModel(config);
const tokenizer = new UzbekTokenizer(config.vocabSize);

// Test namunalarini tayyorlash
const mockTrain = [
  { tokenIds: [1, 10, 15, 20, 2], mask: [0, 0, 1, 1, 1] },
  { tokenIds: [1, 12, 18, 25, 2], mask: [0, 0, 1, 1, 1] },
  { tokenIds: [1, 14, 22, 28, 2], mask: [0, 0, 1, 1, 1] },
  { tokenIds: [1, 16, 24, 30, 2], mask: [0, 0, 1, 1, 1] },
];

const mockVal = [
  { tokenIds: [1, 10, 15, 20, 2], mask: [0, 0, 1, 1, 1] },
  { tokenIds: [1, 14, 22, 28, 2], mask: [0, 0, 1, 1, 1] },
];

const trainer = new TransformerTrainer(model, tokenizer, {
  epochs: 4,
  learningRate: 0.005,
  checkpointDir,
  evalIntervalEpochs: 1,
});

// 1. Learning Rate Schedule testi
const lr0 = trainer.getLearningRate(0, 100);
const lr10 = trainer.getLearningRate(10, 100); // Warmup cho'qqisi
const lr90 = trainer.getLearningRate(90, 100); // Cosine decay pastlashi

console.log(`- LR schedule: step 0 = ${lr0.toFixed(6)}, step 10 = ${lr10.toFixed(6)}, step 90 = ${lr90.toFixed(6)}`);
assert(lr10 > lr0, "Warmup bosqichida LR o'sishi kerak");
assert(lr90 < lr10, "Cosine decay bosqichida LR pasayishi kerak");
console.log("  ✅ Test 1: Warmup va Cosine Decay jadvali to'g'ri ishladi.");

// 2. Dastlabki 3 epoxa o'qitish (Simulated Phase 1)
trainer.config.epochs = 3;
const run1 = trainer.train(mockTrain, mockVal, (log) => {
  if (log.epoch) {
    console.log(`  [Bosqich 1] Epoxa ${log.epoch}: Train Loss=${log.trainLoss}, Val Loss=${log.valLoss}`);
  }
});

assert.strictEqual(trainer.currentEpoch, 3, "Joriy epoxa 3 bo'lishi kerak");
assert(fs.existsSync(path.join(checkpointDir, "transformer_latest.json")), "Latest checkpoint saqlangan bo'lishi kerak");
assert(fs.existsSync(path.join(checkpointDir, "transformer_best.json")), "Best checkpoint saqlangan bo'lishi kerak");
console.log("  ✅ Test 2: Dastlabki 3 epoxa yakunlandi va checkpointlar saqlandi.");

// 3. Trening to'xtatilib, yangi ob'yekt orqali qayta davom ettirish (Resume Test)
console.log("\n- Trening to'xtatildi deb hisoblanadi. Yangi trainer ob'yektidan tiklash boshlandi...");
const newModel = new CausalTransformerModel(config);
const resumedTrainer = new TransformerTrainer(newModel, tokenizer, {
  epochs: 6, // 3-epoxadan 6-epoxagacha davom ettirish
  learningRate: 0.005,
  checkpointDir,
  evalIntervalEpochs: 1,
});

const resumeSuccess = resumedTrainer.resumeFromCheckpoint("latest");
assert(resumeSuccess, "Checkpointdan tiklash muvaffaqiyatli bo'lishi kerak");
console.log(`- Tiklangan holat: Epoxa=${resumedTrainer.currentEpoch}, Step=${resumedTrainer.globalStep}, BestValLoss=${resumedTrainer.bestValLoss.toFixed(4)}`);
assert.strictEqual(resumedTrainer.currentEpoch, 3, "Tiklangan epoxa aynan 3 bo'lishi shart");

// 4. Qayta tiklangan holatdan davom ettirish (Epoxa 4 dan 6 gacha)
const run2 = resumedTrainer.train(mockTrain, mockVal, (log) => {
  if (log.epoch) {
    console.log(`  [Resume davomi] Epoxa ${log.epoch}: Train Loss=${log.trainLoss}, Val Loss=${log.valLoss}`);
  }
});

assert.strictEqual(resumedTrainer.currentEpoch, 6, "Trening to'liq 6-epoxagacha yetishi kerak");
console.log("  ✅ Test 3: Checkpointdan resume 100% muvaffaqiyatli davom ettirildi!");

// Tozalash
if (fs.existsSync(checkpointDir)) {
  fs.rmSync(checkpointDir, { recursive: true, force: true });
}

console.log("\n🎉 BARCHA TRAINER VA RESUME TESTLARI 100% MUVAFFAQ QILINDI!\n");
