/**
 * =======================================================================
 *  SENIOR TRAINING PIPELINE (GPU ACCELERATED & CPU DUAL-ENGINE)
 * =======================================================================
 *  - Apparat tezlatgichi: NVIDIA CUDA / WebGL GPU orqali yuqori tezlikda o'qitish;
 *  - CPU Rejimi: Sparse BoW optimizatsiyalangan soniyali konvergensiya;
 *  - Moslashuvchan tanlov: CLI flaglari (--gpu, --cpu, --device=gpu/cpu) yoki avto;
 *  - Bilimlarni Neon Serverless Postgres (ai_knowledge) bilan sinxronlash;
 *  - O'rganilgan og'irliklar va lug'atni Neon (ai_model_state) va lokal keshga yozish;
 *  - Early Stopping va aniqlik (Accuracy) testi.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");
const Tokenizer = require("../../src/tokenizer");
const NeuralNetwork = require("../../src/neuralNetwork");
const dbService = require("../../src/db");
const deviceManager = require("../../src/deviceManager");

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min > 0 ? `${min}m ${s}s` : `${s}s`;
}

async function trainKnowledgeBase(trainOptions = {}) {
  // 1. Apparat resursini aniqlash (GPU yoki CPU)
  const resolved = deviceManager.resolveDevice(trainOptions);

  console.log("=========================================================");
  console.log("  1. BILIMLAR BAZASINI TAYYORLASH (NEON & LOKAL)");
  console.log("=========================================================");
  console.log(`- Apparat muhiti: ${resolved.isGPU ? "⚡ GPU TEZLATGICH" : "🖥️ CPU OPTIMAL"}`);
  console.log(`- Qurilma nomi: ${resolved.name}`);
  console.log(`- Tanlov sababi: ${resolved.reason}`);

  // Neon DB ni initsializatsiya qilish
  await dbService.init();

  // Lokal faylni o'qish
  const localKnowledgePath = path.join(__dirname, "../../data", "knowledge.json");
  let knowledgeRaw = fs.readFileSync(localKnowledgePath, "utf-8");
  const localData = JSON.parse(knowledgeRaw);

  // Neon ga faqat baza bo'sh bo'lsagina sinxronlash
  if (dbService.isReady) {
    let currentCount = 0;
    try {
      const countRes = await dbService.query("SELECT COUNT(*) FROM ai_knowledge");
      if (countRes && countRes.rows && countRes.rows[0]) {
        currentCount = parseInt(countRes.rows[0].count, 10);
      }
    } catch (e) {}

    if (currentCount === 0) {
      const seededCount = await dbService.seedKnowledge(localData.knowledge);
      console.log(`- Neon Postgres bazasiga ${seededCount} ta bilim sinxronlandi.`);
    } else {
      console.log(`- Neon Postgres bazasida allaqachon ${currentCount} ta bilim mavjud (Tezkor o'tildi ✅)`);
    }
  }

  // Bilimlar bazasini yuklash (Neon ustuvor, agar bo'lmasa lokal)
  const { categories, knowledge } = await dbService.loadKnowledge();

  console.log(`- Jami faol bilimlar: ${knowledge.length} ta jumla`);
  console.log(`- Kategoriyalar (${categories.length} ta): ${categories.join(", ")}`);

  // Tokenizer (Vocabulary qurish)
  const tokenizer = new Tokenizer();
  tokenizer.fit(knowledge, categories);

  console.log(`- Unikal so'zlar lug'ati (Vocab size): ${tokenizer.vocabulary.length} ta`);

  // Ma'lumotlarni sonli vektorlarga va indekslarga aylantirish
  const dataset = knowledge.map((item) => {
    const words = new Set(tokenizer.tokenize(item.text, true));
    const activeIndices = [];
    tokenizer.vocabulary.forEach((w, idx) => {
      if (words.has(w)) activeIndices.push(idx);
    });

    return {
      input: tokenizer.textToVector(item.text),
      activeIndices,
      target: tokenizer.categoryToOneHot(item.category),
      rawText: item.text,
      category: item.category,
    };
  });

  const inputSize = tokenizer.vocabulary.length;
  const hiddenSize = 24;
  const outputSize = categories.length;
  const learningRate = 0.20;

  const nn = new NeuralNetwork(inputSize, hiddenSize, outputSize, learningRate, {
    device: resolved.device,
  });

  console.log("\n=========================================================");
  console.log(`  2. NEYRON TARMOQNI O'QITISH (${resolved.isGPU ? "⚡ GPU REJIMI" : "🖥️ CPU REJIMI"})`);
  console.log("=========================================================");
  console.log(`- Ma'lumotlar hajmi: ${dataset.length} ta jumla`);
  console.log(`- Kirish neyronlari (Vocab): ${inputSize} ta`);
  console.log(`- Yashirin neyronlar: ${hiddenSize} ta`);
  console.log(`- Chiqish toifalari: ${outputSize} ta`);
  console.log(`- Apparat yadrosi: ${resolved.name}\n`);

  const startTime = Date.now();
  const progressBarWidth = 25;

  if (resolved.isGPU) {
    // ==========================================
    // GPU O'QITISH (GPU.JS / WEBGL / CUDA SHADERS)
    // ==========================================
    const epochs = 120;
    try {
      nn.trainGPU(dataset, {
        epochs,
        batchSize: 64,
        learningRate: 2.5,
        onTick: (epoch, totalEpochs, avgLossVal, tStart) => {
          const isMilestone = epoch % 20 === 0 || epoch === 1 || epoch === totalEpochs;
          const isTick = epoch % 5 === 0 || isMilestone;

          if (isTick) {
            const avgLoss = avgLossVal.toFixed(6);
            const percent = Math.min(100, Math.round((epoch / totalEpochs) * 100));
            const filled = Math.round((percent / 100) * progressBarWidth);
            const bar = "█".repeat(filled).padEnd(progressBarWidth, "░");
            const elapsed = Date.now() - tStart;
            const speed = (epoch / (elapsed / 1000)).toFixed(1);
            const remainingMs = speed > 0 ? ((totalEpochs - epoch) / speed) * 1000 : 0;
            const eta = formatTime(remainingMs);

            const statusLine = `[${bar}] ${percent.toString().padStart(3, " ")}% | Epoxa ${epoch.toString().padStart(3, " ")}/${totalEpochs} | Loss: ${avgLoss} | GPU: ${speed} ep/s | Qolgan: ~${eta}`;

            if (isMilestone) {
              process.stdout.write(`\r${statusLine}\n`);
            } else if (process.stdout.isTTY) {
              process.stdout.write(`\r${statusLine}`);
            }
          }
        },
      });
    } catch (gpuError) {
      console.warn("\n⚠️ GPU o'qitishda xatolik yuz berdi, CPU ga o'tmoqda:", gpuError.message);
      trainOnCPU(nn, dataset, 100, progressBarWidth, startTime);
    }
  } else {
    // ==========================================
    // CPU O'QITISH (SPARSE HIGH-PERFORMANCE SGD)
    // ==========================================
    trainOnCPU(nn, dataset, 100, progressBarWidth, startTime);
  }

  const duration = Date.now() - startTime;
  console.log(`\n🎉 O'qitish muvaffaqiyatli yakunlandi! Jami vaqt: ${formatTime(duration)} (${duration} ms)`);

  // Aniq baholash (Accuracy Test)
  let correctCount = 0;
  for (const sample of dataset) {
    const pred = nn.predict(sample.input);
    const result = tokenizer.vectorToPrediction(pred);
    if (result.category === sample.category) {
      correctCount++;
    }
  }
  const accuracy = ((correctCount / dataset.length) * 100).toFixed(2);
  console.log(`🎯 Real ma'lumotlar bo'yicha aniqlik (Accuracy): ${accuracy}% (${correctCount}/${dataset.length} to'g'ri)`);

  // 6. Saqlash: Neon Postgres va Lokal Kesh
  const modelSavePath = path.join(__dirname, "../../data", "model.json");
  const vocabSavePath = path.join(__dirname, "../../data", "vocab.json");

  // Lokal saqlash
  nn.saveModel(modelSavePath);
  fs.writeFileSync(
    vocabSavePath,
    JSON.stringify(
      {
        vocabulary: tokenizer.vocabulary,
        categories: tokenizer.categories,
      },
      null,
      2
    ),
    "utf-8"
  );

  // Neon Postgres ga saqlash
  if (dbService.isReady) {
    const modelPayload = {
      inputNodes: nn.inputNodes,
      hiddenNodes: nn.hiddenNodes,
      outputNodes: nn.outputNodes,
      learningRate: nn.learningRate,
      device: resolved.device,
      deviceName: resolved.name,
      weightsIH: nn.weightsIH,
      weightsHO: nn.weightsHO,
      biasH: nn.biasH,
      biasO: nn.biasO,
    };
    await dbService.saveModelState(
      "conversational_intent_model",
      modelPayload,
      tokenizer.vocabulary,
      tokenizer.categories,
      {
        device: resolved.device,
        deviceName: resolved.name,
        durationMs: duration,
        accuracy: `${accuracy}%`,
        trainedAt: new Date().toISOString(),
      }
    );
  }

  console.log(`- Model og'irliklari saqlandi: ${modelSavePath} & Neon Postgres`);
  console.log(`- Lug'at saqlandi: ${vocabSavePath}`);
  console.log("=========================================================\n");

  return { nn, tokenizer, accuracy, device: resolved.device, deviceName: resolved.name };
}

function trainOnCPU(nn, dataset, epochs, progressBarWidth, startTime) {
  for (let epoch = 1; epoch <= epochs; epoch++) {
    let totalLoss = 0;
    const shuffled = [...dataset].sort(() => Math.random() - 0.5);

    for (const sample of shuffled) {
      totalLoss += nn.trainSparse(sample.activeIndices, sample.target);
    }

    const avgLossVal = totalLoss / dataset.length;
    const isMilestone = epoch % 25 === 0 || epoch === 1 || epoch === epochs;
    const isTick = epoch % 5 === 0 || isMilestone;

    if (isTick) {
      const avgLoss = avgLossVal.toFixed(6);
      const percent = Math.min(100, Math.round((epoch / epochs) * 100));
      const filled = Math.round((percent / 100) * progressBarWidth);
      const bar = "█".repeat(filled).padEnd(progressBarWidth, "░");
      const elapsed = Date.now() - startTime;
      const speed = (epoch / (elapsed / 1000)).toFixed(1);
      const remainingMs = speed > 0 ? ((epochs - epoch) / speed) * 1000 : 0;
      const eta = formatTime(remainingMs);

      const statusLine = `[${bar}] ${percent.toString().padStart(3, " ")}% | Epoxa ${epoch.toString().padStart(3, " ")}/${epochs} | Loss: ${avgLoss} | CPU: ${speed} ep/s | Qolgan: ~${eta}`;

      if (isMilestone) {
        process.stdout.write(`\r${statusLine}\n`);
      } else if (process.stdout.isTTY) {
        process.stdout.write(`\r${statusLine}`);
      }
    }

    if (avgLossVal < 0.00003 && epoch >= 50) {
      console.log(`\n🎯 [Early Stopping]: Xatolik ${avgLossVal.toFixed(6)} ga tushdi! Model to'liq o'rganib bo'ldi (${epoch}-epoxada yakunlandi).`);
      break;
    }
  }
}

if (require.main === module) {
  trainKnowledgeBase().then(() => {
    dbService.close();
  });
}

module.exports = trainKnowledgeBase;
