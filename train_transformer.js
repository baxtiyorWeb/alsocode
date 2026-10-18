#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const LLM_CONFIG = require("./src/llmConfig");
const UzbekTokenizer = require("./src/uzbekTokenizer");
const DatasetPipeline = require("./src/datasetPipeline");
const CausalTransformerModel = require("./src/transformerModel");
const TransformerTrainer = require("./src/transformerTrainer");

/**
 * =======================================================================
 *  EXECUTABLE TRAINING PIPELINE: FROM-SCRATCH UZBEK TRANSFORMER LLM (v1 / v2)
 * =======================================================================
 *  - 100% Sof JavaScript va Node.js da Causal Next-Token Prediction;
 *  - O'zbek tili BPE Subword Tokenizatori (True Subwords Merges);
 *  - Intellektual SFT Savol-Javob va Target Loss Masking (0 data leakage);
 *  - Alohida Gradient Buferlari (Zero In-Place Mutation);
 *  - Analitik AdamW Optimizatori (Momentum, Variance, Weight Decay);
 *  - Cosine LR Annealing, Early Stopping va Checkpoint Resume;
 *  - Jonli Token Oqimi (Real-time Generation Test).
 * =======================================================================
 */

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      args[key] = val !== undefined ? (isNaN(val) ? val : Number(val)) : true;
    }
  }
  return args;
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min > 0 ? `${min}m ${s}s` : `${s}s`;
}

async function runTraining(options = {}) {
  const cliArgs = parseArgs();
  const mergedOptions = { ...cliArgs, ...options };
  const targetVersion = mergedOptions.version || "v1";
  const verConfig = LLM_CONFIG.getVersionConfig(targetVersion);

  console.log("=========================================================================");
  console.log(`  🚀 O'ZBEKCHA SHAXSIY LLM (${verConfig.name.toUpperCase()}) TRENINGI`);
  console.log("=========================================================================");
  console.log(`  ✔ Versiya:            [${targetVersion.toUpperCase()}]`);
  console.log(`  ✔ Anti-Overfitting:    AdamW Weight Decay + Target Loss Masking + Early Stopping`);
  console.log(`  ✔ 100% Sof JavaScript: Tashqi API yoki kutubxonalarsiz noldan arxitektura`);
  console.log("-------------------------------------------------------------------------\n");

  const knowledgePath = mergedOptions.knowledge || path.resolve(__dirname, verConfig.data.knowledgePath);
  const splitsPath = mergedOptions.splits || path.resolve(__dirname, verConfig.data.splitsPath);
  const vocabPath = mergedOptions.vocab || path.resolve(__dirname, verConfig.data.vocabPath);
  const checkpointDir = mergedOptions.checkpointDir || path.resolve(__dirname, verConfig.training.checkpointDir);

  if (!fs.existsSync(checkpointDir)) {
    fs.mkdirSync(checkpointDir, { recursive: true });
  }

  // 1. DATASETNI YUKLASH VA BPE LUG'ATINI O'QITISH
  console.log("--- 1. BPE TOKENIZATOR VA LUG'ATNI SHAKLLANTIRISH ---");
  if (!fs.existsSync(knowledgePath)) {
    throw new Error(`Knowledge bazasi topilmadi: ${knowledgePath}`);
  }
  const rawData = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
  const rawItems = rawData.knowledge || rawData;
  console.log(`- Baza hajmi: ${rawItems.length} ta yozuv`);

  const targetVocabSize = mergedOptions.vocabSize || verConfig.model.vocabSize || 512;
  const tokenizer = new UzbekTokenizer(targetVocabSize);
  
  if (fs.existsSync(vocabPath) && !mergedOptions.retrainVocab) {
    tokenizer.loadFromFile(vocabPath);
    console.log(`- Mavjud BPE Subword Lug'at yuklandi: ${tokenizer.vocabSize} ta token`);
  } else {
    const step = Math.max(1, Math.floor(rawItems.length / 3000));
    const trainingTexts = [];
    for (let i = 0; i < rawItems.length; i += step) {
      trainingTexts.push(rawItems[i].text);
    }
    tokenizer.train(trainingTexts);
    console.log(`- BPE Subword Lug'at muvaffaqiyatli o'qitildi: ${tokenizer.vocabSize} ta token`);
    tokenizer.saveToFile(vocabPath);
  }
  console.log(`- Lug'at joylashuvi: ${vocabPath}\n`);

  // 2. DATASET PIPELINE VA LEAKAGE FILTERI
  console.log("--- 2. DATASET PIPELINE VA INTELLEKTUAL SFT FORMATI ---");
  const pipeline = new DatasetPipeline(tokenizer);
  let train, val, test, summary;
  if (fs.existsSync(splitsPath) && !mergedOptions.rebuildSplits) {
    const cached = JSON.parse(fs.readFileSync(splitsPath, "utf-8"));
    const valRes = pipeline.validateSplits(cached);
    if (!valRes.valid) {
      console.warn(`⚠️ [Vocab Mismatch Guard] ${valRes.reason}. Splits qayta shakllantirilmoqda...`);
      mergedOptions.rebuildSplits = true;
    } else {
      train = cached.splits.train;
      val = cached.splits.val;
      test = cached.splits.test;
      summary = cached.summary;
      console.log(`- Mavjud tayyor Dataset Splits yuklandi: ${summary.cleanTotal} ta namuna`);
    }
  }

  if (!train || mergedOptions.rebuildSplits) {
    const prepResult = pipeline.preparePipeline(knowledgePath, splitsPath);
    train = prepResult.splits.train;
    val = prepResult.splits.val;
    test = prepResult.splits.test;
    summary = prepResult.summary;
  }

  if (mergedOptions.maxSamples && Number(mergedOptions.maxSamples) > 0) {
    const limit = Number(mergedOptions.maxSamples);
    train = train.slice(0, limit);
    console.log(`- ⚡ Tezkor Rejim (--maxSamples): faqat ${train.length} ta train namunasi o'qitiladi.`);
  }

  console.log(`- Toza namunalar:     ${summary.cleanTotal} ta (${summary.duplicatesRemoved} ta dublikat olib tashlandi)`);
  console.log(`- Train to'plami:     ${train.length} ta (ishlatilayotgan)`);
  console.log(`- Validation to'plami:${summary.valCount} ta (10%)`);
  console.log(`- Test to'plami:      ${summary.testCount} ta (10%)`);
  console.log(`- Target Loss Masking: 100% faol (savolga loss=0, javobga loss=1)\n`);

  // 3. MODEL INTSITSIALIZATSIYASI
  console.log("--- 3. MODEL ARXITEKTURASI VA PARAMETRLAR ---");
  const modelConfig = {
    ...verConfig.model,
    vocabSize: tokenizer.vocabSize,
    dModel: mergedOptions.dModel || verConfig.model.dModel,
    nHeads: mergedOptions.nHeads || verConfig.model.nHeads,
    headDim: (mergedOptions.dModel || verConfig.model.dModel) / (mergedOptions.nHeads || verConfig.model.nHeads),
    dFfn: (mergedOptions.dModel || verConfig.model.dModel) * 4,
    nLayers: mergedOptions.nLayers || verConfig.model.nLayers,
    maxSeqLen: mergedOptions.maxSeqLen || verConfig.model.maxSeqLen,
  };

  const model = new CausalTransformerModel(modelConfig);
  const params = model.countParameters();
  console.log(`- Model nomi:         ${modelConfig.name}`);
  console.log(`- Qatlamlar soni:     ${modelConfig.nLayers} ta Transformer Decoder Block`);
  console.log(`- Attention boshlari: ${modelConfig.nHeads} ta (Head Dim: ${modelConfig.headDim})`);
  console.log(`- Hidden Dimension:   ${modelConfig.dModel}`);
  console.log(`- FFN Dimension:      ${modelConfig.dFfn}`);
  console.log(`- Jami parametrlar:   ${params.total.toLocaleString()} ta (${(params.total / 1000).toFixed(1)}k)`);
  console.log(`- Optimizator:        Analitik AdamW (Decoupled Weight Decay & Grad Clip)\n`);

  // 4. TRENING SIKLI (TRAINING LOOP)
  console.log("--- 4. TRENING VA MONITORING ---");
  const epochs = mergedOptions.epochs || verConfig.training.epochs || 8;
  const batchSize = mergedOptions.batchSize || verConfig.training.batchSize || 8;
  const trainer = new TransformerTrainer(model, tokenizer, {
    epochs,
    batchSize,
    learningRate: mergedOptions.lr || verConfig.training.learningRate || 0.003,
    minLearningRate: mergedOptions.minLr || verConfig.training.minLearningRate || 0.0003,
    checkpointDir,
    evalIntervalEpochs: 1,
    earlyStoppingPatience: mergedOptions.patience || verConfig.training.earlyStoppingPatience || 4,
  });

  const progressBarWidth = 20;
  const startTime = Date.now();

  const trainRes = trainer.train(train, val, (log) => {
    if (log.stepProgress) {
      const msg = `  ⏳ [Epoxa ${log.epoch}/${log.epochs}] Qadam ${log.step}/${log.totalStepsInEpoch} (${log.percent}%) | Loss: ${log.currentLoss} | LR: ${log.lr} | ${log.throughput} tok/s`;
      if (process.stdout.isTTY && !process.env.COLAB_GPU) {
        process.stdout.write(`${msg}   \r`);
      } else {
        console.log(msg);
      }
      return;
    }

    if (log.message) {
      console.log(`\n${log.message}`);
      return;
    }

    const percent = Math.min(100, Math.round((log.epoch / epochs) * 100));
    const filled = Math.round((percent / 100) * progressBarWidth);
    const bar = "█".repeat(filled).padEnd(progressBarWidth, "░");
    const valLossStr = log.valLoss !== null ? log.valLoss.toFixed(4) : "—";
    const valPplStr = log.valPerplexity !== null ? log.valPerplexity.toFixed(1) : "—";
    const bestMarker = log.isBest ? " 🌟 [BEST]" : "";

    console.log(`\n[${bar}] ${percent.toString().padStart(3, " ")}% | Epoxa ${log.epoch.toString().padStart(2, " ")}/${epochs} | Train Loss: ${log.trainLoss} | Val Loss: ${valLossStr} (PPL: ${valPplStr}) | Tezlik: ${log.throughputTokensPerSec} tok/s${bestMarker}`);
  });

  console.log(`\n🎉 Trening muvaffaqiyatli yakunlandi! Jami vaqt: ${formatTime(trainRes.durationMs)}`);
  console.log(`- Eng yaxshi Val Loss: ${trainer.bestValLoss.toFixed(4)} (Perplexity: ${Math.exp(trainer.bestValLoss).toFixed(2)})`);
  console.log(`- Checkpointlar saqlandi: ${checkpointDir}/\n`);

  // Default transformer_best.json ga ham nusxa olish (agar asosiy v1 bo'lsa)
  const bestCkptSource = path.join(checkpointDir, "transformer_best.json");
  const mainCkptDest = path.join(__dirname, "data", "checkpoints", "transformer_best.json");
  if (fs.existsSync(bestCkptSource)) {
    try {
      fs.copyFileSync(bestCkptSource, mainCkptDest);
      console.log(`- Asosiy model aktivlashtirildi: ${mainCkptDest}`);
    } catch (e) {}
  }

  // 5. AUTOREGRESSIVE GENERATSIYA SINOVI
  console.log("--- 5. LOKAL NEYRON MATN TO'QISH (INFERENCE SMOKE TEST) ---");
  const bestLoaded = trainer.resumeFromCheckpoint("best");
  const activeModel = bestLoaded ? trainer.model : model;

  const testPrompts = [
    "<human>: Salom, qandaysiz?\n<bot>:",
    "<human>: Dasturlash nima?\n<bot>:",
    "<human>: Toshkent qayerda?\n<bot>:",
  ];

  for (const p of testPrompts) {
    const inputIds = tokenizer.encode(p);
    const genIds = activeModel.generate(inputIds, 25, {
      temperature: 0.6,
      topK: 8,
      topP: 0.85,
      repetitionPenalty: 1.2,
    });
    const outputText = tokenizer.decode(genIds, false);
    console.log(`Savol:  "${p.replace(/\n/g, " ")}"`);
    console.log(`Javob:  "${outputText.replace(/\n/g, " ")}"`);
    console.log("-------------------------------------------------------------------------");
  }

  console.log("\n✅ Trening va avtonom matn to'qish tekshiruvi to'liq yakunlandi!\n");
}

if (require.main === module) {
  runTraining().catch((err) => {
    console.error("Trening jarayonida kutilmagan xatolik:", err);
    process.exit(1);
  });
}

module.exports = runTraining;
