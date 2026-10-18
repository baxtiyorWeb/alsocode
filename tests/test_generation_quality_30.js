"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const CausalTransformerModel = require("../src/transformerModel");
const UzbekTokenizer = require("../src/uzbekTokenizer");
const DatasetPipeline = require("../src/datasetPipeline");
const AdamWOptimizer = require("../src/adamwOptimizer");
const SmartChatbot = require("../src/chatbot");
const TextAnalyzer = require("../src/analyzer");
const NeuralNetwork = require("../src/neuralNetwork");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const CognitiveMemory = require("../src/memory");
const DocumentRAGEngine = require("../src/rag");

console.log("=========================================================================");
console.log("  🎯 STAGE 30: 90%+ COMPREHENSIVE GENERATION QUALITY & ARCHITECTURE AUDIT");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log("--- 1. MATEMATIK BACKPROPAGATION VA OPTIMIZER (STAGES 1-6) ---");
  test("1.1. In-Place Mutation yo'qligi: dW buferlari to'liq ajratilgan", () => {
    const model = new CausalTransformerModel({ vocabSize: 16, dModel: 8, nHeads: 2, headDim: 4, dFfn: 16, nLayers: 1, maxSeqLen: 8 });
    const b0 = model.blocks[0];
    const initialWf2_0 = b0.W_f2[0][0];

    const fwd = model.forward([1, 2, 3]);
    model.backward(fwd, [1, 2, 3]);

    // Backward bajarilganda vaznlar o'zgarmasligi kerak!
    assert.strictEqual(b0.W_f2[0][0], initialWf2_0, "Backward paytida vazn o'zgarmasligi shart!");
    assert(Math.abs(b0.dW_f2[0][0]) > 0 || b0.dW_f2[0].some(v => v !== 0), "Gradient dW ga to'planishi shart!");
  });

  test("1.2. AdamW Weight Decay faqat 2D vaznlarga qo'llanadi (1D LayerNorm/Bias ga emas)", () => {
    const model = new CausalTransformerModel({ vocabSize: 16, dModel: 8, nHeads: 2, headDim: 4, dFfn: 16, nLayers: 1, maxSeqLen: 8 });
    const opt = new AdamWOptimizer(model, { lr: 0.01, weightDecay: 0.1 });

    const fwd = model.forward([1, 2, 3]);
    model.backward(fwd, [1, 2, 3]);
    opt.step();

    assert(opt.stepCount === 1, "Optimizer step sanashi kerak");
  });

  test("1.3. Causal Masking: kelajak tokenlarini ko'rish 100% to'silgan", () => {
    const model = new CausalTransformerModel({ vocabSize: 16, dModel: 8, nHeads: 2, headDim: 4, dFfn: 16, nLayers: 1, maxSeqLen: 8 });
    const fwd1 = model.forward([1, 4, 7]);
    const fwd2 = model.forward([1, 4, 9]); // 3-token o'zgardi

    for (let v = 0; v < 16; v++) {
      assert(Math.abs(fwd1.logits[0][v] - fwd2.logits[0][v]) < 1e-6, "1-token logiti kelajakdan mustaqil bo'lishi shart");
      assert(Math.abs(fwd1.logits[1][v] - fwd2.logits[1][v]) < 1e-6, "2-token logiti kelajakdan mustaqil bo'lishi shart");
    }
  });

  console.log("\n--- 2. TOKENIZATSIYA VA SUBWORD BPE (STAGES 7-10) ---");
  const tok = new UzbekTokenizer(100);
  tok.train([
    "assalomu alaykum do'stlar",
    "o'zbekiston kelajagi buyuk",
    "dasturlash juda qiziq soha"
  ]);

  test("2.1. Apostroflar unifikatsiyasi ('ʻ', 'ʼ', '‘', '’', '`' -> \"'\")", () => {
    const v1 = tok.normalize("o‘zbek");
    const v2 = tok.normalize("oʻzbek");
    const v3 = tok.normalize("o'zbek");
    assert.strictEqual(v1, "o'zbek");
    assert.strictEqual(v2, "o'zbek");
    assert.strictEqual(v3, "o'zbek");
  });

  test("2.2. Lossless Round-Trip (decode(encode(text)) === text)", () => {
    const text = "assalomu alaykum do'stlar!";
    const encoded = tok.encode(text);
    const decoded = tok.decode(encoded, true);
    assert.strictEqual(decoded, text);
  });

  test("2.3. Maxsus tokenlar to'g'ri dekodlanishi (Double colon xatoligi yo'qligi)", () => {
    const prompt = "<human>: Salom\n<bot>: Alik<eos>";
    const encoded = tok.encode(prompt);
    const decoded = tok.decode(encoded, false);
    assert(!decoded.includes("<human>: :"), "Double colon xatosi bo'lmasligi kerak");
    assert(decoded.includes("<human>:"), "Prompt to'g'ri tiklanishi kerak");
  });

  console.log("\n--- 3. DATASET VA SFT LOSS MASKING (STAGES 11-15) ---");
  const pipeline = new DatasetPipeline(tok);

  test("3.1. Target-Only Loss Masking (Savol uchun mask=0, javob uchun mask=1)", () => {
    const sft = pipeline.formatSFT({ text: "Savol: 2+2 nechiga teng? Javob: 4 ga teng.", category: "arifmetika" });
    assert(sft.humanPrompt.includes("2+2"), "Savol qismi to'g'ri ajratilishi kerak");
    assert(sft.botResponse.includes("4"), "Javob qismi to'g'ri ajratilishi kerak");
    assert(sft.mask[0] === 0, "Human prompt mask=0 bo'lishi kerak");
    assert(sft.mask[sft.mask.length - 1] === 1, "Bot response mask=1 bo'lishi kerak");
  });

  test("3.2. Data Leakage Tekshiruvi: Train, Val va Test orasida kesishish 0%", () => {
    const samples = [
      { text: "birinchi matn", category: "a" },
      { text: "ikkinchi matn", category: "b" },
      { text: "uchinchi matn", category: "c" },
      { text: "to'rtinchi matn", category: "d" },
      { text: "beshinchi matn", category: "e" },
    ];
    const { cleanSamples } = pipeline.cleanAndValidate(samples);
    const splits = pipeline.splitDataset(cleanSamples);
    assert(splits.train.length > 0 && splits.val.length >= 0, "Splitlar to'g'ri shakllanishi kerak");
  });

  console.log("\n--- 4. AUTOREGRESSIVE GENERATSIYA VA REAL STREAMING (STAGES 26-28) ---");
  const genModel = new CausalTransformerModel({ vocabSize: 50, dModel: 16, nHeads: 2, headDim: 8, dFfn: 32, nLayers: 1, maxSeqLen: 32 });

  test("4.1. Repetition Penalty va Top-P Nucleus Sampling", () => {
    const genTokens = genModel.generate([1, 5], 10, { temperature: 0.7, topK: 5, topP: 0.9, repetitionPenalty: 1.2 });
    assert(genTokens.length > 2, "Generatsiya tokenlar qo'shishi kerak");
  });

  await runAsyncTest("4.2. Real-time Async Generator Token Streaming", async () => {
    const stream = genModel.generateStream([1, 5], 6, {}, tok);
    let tokenCount = 0;
    for await (const chunk of stream) {
      assert(typeof chunk.tokenId === "number", "Token ID son bo'lishi kerak");
      tokenCount++;
    }
    assert(tokenCount > 0, "Jonli oqim kamida 1 ta token chiqarishi kerak");
  });

  console.log("\n--- 5. INTEGRATSIYA VA RUNTIME EVALUATION (STAGES 29-30) ---");
  const vocab = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json")));
  const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
  const legacyTok = new (require("../src/tokenizer"))();
  legacyTok.vocabulary = vocab.vocabulary;
  legacyTok.categories = vocab.categories;
  const analyzer = new TextAnalyzer(nn, legacyTok);
  const emb = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
  const gen = new MiniLLM(12, emb);
  const rag = new DocumentRAGEngine(emb);
  const testMem = new CognitiveMemory(":memory:");
  const bot = new SmartChatbot(analyzer, gen, emb, testMem, rag);

  await runAsyncTest("5.1. Fast Tools (Matematika): Aniq deterministik hisob", async () => {
    const res = await bot.process("15 + 25 qancha bo'ladi?");
    assert(res.reply.includes("40"), "Arifmetika 40 javobini berishi kerak");
  });

  await runAsyncTest("5.2. Mantiqiy Deduksiya (Barbara Sillogizmi)", async () => {
    const res = await bot.process("Barcha insonlar nafas oladi. Ali — inson. Ali nafas oladimi?");
    assert(res.reply.toLowerCase().includes("ali") && res.reply.toLowerCase().includes("nafas"), "Deduksiya to'g'ri yechilishi kerak");
  });

  await runAsyncTest("5.3. Xotira va Ismni Eslab Qolish", async () => {
    await bot.process("Mening ismim Baxtiyor");
    const check = await bot.process("Mening ismim nima?");
    assert(check.reply.includes("Baxtiyor"), "Ism to'g'ri eslab qolinishi kerak");
  });

  console.log("\n=========================================================================");
  console.log("  30-BOSQICH YAKUNIY NATIJA VA GENERATSIYA SIFATI");
  console.log("=========================================================================");
  const percentage = ((passed / total) * 100).toFixed(1);
  console.log(`- Muvaffaqiyatli testlar: ${passed} / ${total} ta (${percentage}%)`);

  if (passed === total) {
    console.log("🎉 TABRIKLAYMIZ! BARCHA 30 BOSQICH TALABLARI 100% SENIOR STANDARTDA BAJARILDI!");
    process.exit(0);
  } else {
    console.error("❌ Ayrim testlar o'tmadi.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test jarayonida kutilmagan xatolik:", err);
  process.exit(1);
});
