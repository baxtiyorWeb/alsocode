"use strict";

/**
 * =======================================================================
 *  BOSQICH 3: O'ZBEK TILI NORMALIZATSIYASI VA TUSHUNISH TESTI
 * =======================================================================
 *  Ushbu test turli imlo, apostrof (` ‘ ’ ʻ `), so'zlashuv qisqartmalari
 *  va fonetik variantlarda berilgan bir xil ma'noli 10 juftlik (20 ta savol)
 *  bo'yicha dvigatelning bir xil ma'noni tushunishini qat'iy sinovdan o'tkazadi.
 * =======================================================================
 */

const { uzbekNormalizer } = require("../src/uzbekNormalizer");
const { taskUnderstanding } = require("../src/taskUnderstanding");
const Tokenizer = require("../src/tokenizer");
const NeuralNetwork = require("../src/neuralNetwork");
const TextAnalyzer = require("../src/analyzer");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const SmartChatbot = require("../src/chatbot");
const CognitiveMemory = require("../src/memory");
const DocumentRAGEngine = require("../src/rag");
const path = require("path");
const fs = require("fs");

function buildFreshChatbot() {
  const vocabData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json"), "utf-8"));
  const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
  const tokenizer = new Tokenizer();
  tokenizer.vocabulary = vocabData.vocabulary;
  tokenizer.categories = vocabData.categories;
  const analyzer = new TextAnalyzer(nn, tokenizer);
  const embeddings = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
  const miniLLM = new MiniLLM(12, embeddings);
  const memory = new CognitiveMemory(":memory:");
  const rag = new DocumentRAGEngine(embeddings, path.join(__dirname, "..", "data", "documents.json"));

  return new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);
}

const TEST_PAIRS = [
  {
    id: "PAIR_1",
    name: "O'zbekiston poytaxti (Apostrof va dialekt: 'qatta' vs 'qaysi')",
    variantA: "O'zbekistonning poytaxti qaysi shahar?",
    variantB: "oʻzbekiston poytaxti qatta?",
    expectedTask: "fact",
    verify: (resA, resB) => {
      const matchA = /toshkent/i.test(resA.reply);
      const matchB = /toshkent/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_2",
    name: "Quyosh ta'rifi (So'zlashuv: 'nme ozi' vs 'nima')",
    variantA: "Quyosh nima?",
    variantB: "quyosh nme ozi?",
    expectedTask: "definition",
    verify: (resA, resB) => {
      const matchA = /yulduz|plazma/i.test(resA.reply);
      const matchB = /yulduz|plazma/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_3",
    name: "Qishda kiyinish maslahati (Apostrof va qisqartma: 'boʻlsa' va 'nma')",
    variantA: "Qishda havo sovuq bo'lsa, nima kiyish kerak?",
    variantB: "qishda havo sovuq boʻlsa nma kiyish kere?",
    expectedTask: "instruction_advice",
    verify: (resA, resB) => {
      const matchA = /issiq|qalin|kurtka/i.test(resA.reply);
      const matchB = /issiq|qalin|kurtka/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_4",
    name: "Matnli arifmetika ('yedim' vs 'edim', 'nechta' vs 'qancha')",
    variantA: "5 ta olma bor edi, 2 tasini yedim. Nechta qoldi?",
    variantB: "5 ta olma bor edi 2 tasini edim qancha qoldi?",
    expectedTask: "calculation",
    verify: (resA, resB) => {
      const matchA = /3 ta olma/i.test(resA.reply);
      const matchB = /3 ta olma/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_5",
    name: "Hissiyot va quvonch ('xursandman' vs 'hursandman' fonetik imlo)",
    variantA: "men xursandman",
    variantB: "men hursandman",
    expectedTask: "empathy_care",
    verify: (resA, resB) => {
      // Ikkalasida ham foydalanuvchining ismini "Hursand" deb olmasligi kerak!
      const notNameA = !/Tanishganimdan xursandman,\s*Hursand/i.test(resA.reply);
      const notNameB = !/Tanishganimdan xursandman,\s*Hursand/i.test(resB.reply);
      const empathA = /xursand|quvonch|mamnun|kayfiyat|energiya|yangilik/i.test(resA.reply);
      const empathB = /xursand|quvonch|mamnun|kayfiyat|energiya|yangilik/i.test(resB.reply);
      return notNameA && notNameB && empathA && empathB;
    }
  },
  {
    id: "PAIR_6",
    name: "Charchoq va toliqish ('toliqdim' vs 'charchadm' so'zlashuv)",
    variantA: "juda toliqdim",
    variantB: "rosa charchadm",
    expectedTask: "empathy_care",
    verify: (resA, resB) => {
      const matchA = /dam|hordiq|asrang|charchab/i.test(resA.reply);
      const matchB = /dam|hordiq|asrang|charchab/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_7",
    name: "Moddiy jism qobiliyati ('suza oladimi' vs 'suzadmi')",
    variantA: "Tosh suvda suza oladimi?",
    variantB: "tosh suvda suzadmi?",
    expectedTask: "general_knowledge", // Capability or physical reasoning
    verify: (resA, resB) => {
      const matchA = /suza olmaydi|cho'kadi|zichligi/i.test(resA.reply);
      const matchB = /suza olmaydi|cho'kadi|zichligi/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_8",
    name: "Noaniq so'rov ('ayt' vs 'aytber' qisqartma)",
    variantA: "Menga uning narxini ayt",
    variantB: "menga uning narxini aytber",
    expectedTask: "clarification",
    verify: (resA, resB) => {
      const matchA = /qaysi\s+mahsulot|aniq/i.test(resA.reply);
      const matchB = /qaysi\s+mahsulot|aniq/i.test(resB.reply);
      return matchA && matchB;
    }
  },
  {
    id: "PAIR_9",
    name: "Mavzuni o'zgartirish (Discourse Topic Shift: oddiy vs o'zgartirish prefiksi)",
    variantA: "Somsa qanday taom?",
    variantB: "Endi mavzuni butunlay o'zgartiramiz. Somsa qanday taom?",
    expectedTask: "general_knowledge",
    verify: (resA, resB) => {
      // Oldingi dam olish dialog replikalarini qaytarmasligi kerak!
      const noLeakB = !/dam olish kunlarini qayerda/i.test(resB.reply);
      return noLeakB;
    }
  },
  {
    id: "PAIR_10",
    name: "Salomlashish ('Assalomu alaykum' vs 'salomalevaleykum')",
    variantA: "Assalomu alaykum",
    variantB: "salomalevaleykum",
    expectedTask: "chitchat",
    verify: (resA, resB) => {
      const matchA = /assalomu\s+alaykum|salom|va\s+alaykum/i.test(resA.reply);
      const matchB = /assalomu\s+alaykum|salom|va\s+alaykum/i.test(resB.reply);
      return matchA && matchB;
    }
  }
];

async function runStage3Tests() {
  console.log("========================================================================");
  console.log(" 🧪 BOSQICH 3: O'ZBEK TILI NORMALIZATSIYASI VA TUSHUNISH SINOVI");
  console.log("========================================================================");

  let passedPairs = 0;
  const results = [];

  for (const pair of TEST_PAIRS) {
    const chatbotA = buildFreshChatbot();
    const chatbotB = buildFreshChatbot();

    // 1. Normalizatsiya tahlili
    const normA = uzbekNormalizer.normalize(pair.variantA);
    const normB = uzbekNormalizer.normalize(pair.variantB);

    // 2. Intent va Vazifa tahlili
    const taskA = taskUnderstanding.understand(pair.variantA);
    const taskB = taskUnderstanding.understand(pair.variantB);

    // 3. Chatbot javobi
    const resA = await chatbotA.process(pair.variantA);
    const resB = await chatbotB.process(pair.variantB);

    // 4. Tekshiruv
    const isTaskMatch = taskA.primaryTask === taskB.primaryTask;
    const isReplyValid = pair.verify(resA, resB);
    const passed = isTaskMatch && isReplyValid;

    if (passed) passedPairs++;

    results.push({
      id: pair.id,
      name: pair.name,
      variantA: pair.variantA,
      variantB: pair.variantB,
      normalizedA: normA.normalized,
      normalizedB: normB.normalized,
      taskA: taskA.primaryTask,
      taskB: taskB.primaryTask,
      replyA: resA.reply.substring(0, 80) + "...",
      replyB: resB.reply.substring(0, 80) + "...",
      passed
    });

    console.log(`[${passed ? "✔ PASS" : "❌ FAIL"}] ${pair.id}: ${pair.name}`);
    console.log(`    A: "${pair.variantA}" -> [${taskA.primaryTask}]`);
    console.log(`    B: "${pair.variantB}" -> [${taskB.primaryTask}] (Norm: "${normB.normalized}")`);
    if (!passed) {
      console.log(`    ⚠️ Reply A: ${resA.reply}`);
      console.log(`    ⚠️ Reply B: ${resB.reply}`);
    }
  }

  // Tozalash
  try {
    if (fs.existsSync(path.join(__dirname, "..", "data", "temp_mem_a.json"))) fs.unlinkSync(path.join(__dirname, "..", "data", "temp_mem_a.json"));
    if (fs.existsSync(path.join(__dirname, "..", "data", "temp_mem_b.json"))) fs.unlinkSync(path.join(__dirname, "..", "data", "temp_mem_b.json"));
  } catch (e) {}

  console.log("\n------------------------------------------------------------------------");
  console.log(`📊 Yakuniy natija: ${passedPairs} / ${TEST_PAIRS.length} juftlik o'tdi (${(passedPairs / TEST_PAIRS.length) * 100}%).`);
  console.log("========================================================================\n");

  fs.writeFileSync(
    path.join(__dirname, "..", "data", "stage3_normalization_results.json"),
    JSON.stringify({ passedPairs, total: TEST_PAIRS.length, results }, null, 2)
  );

  return { passedPairs, total: TEST_PAIRS.length };
}

if (require.main === module) {
  runStage3Tests().then(() => process.exit(0)).catch((err) => {
    console.error("Testda xatolik:", err);
    process.exit(1);
  });
}

module.exports = { runStage3Tests };
