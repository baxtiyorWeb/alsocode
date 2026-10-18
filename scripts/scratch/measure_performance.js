"use strict";

const os = require("os");
const process = require("process");
const fs = require("fs");
const path = require("path");

console.log("=== HARDWARE & ENVIRONMENT INFO ===");
console.log("OS:", os.type(), os.release(), os.arch());
console.log("CPUs:", os.cpus().length, "x", os.cpus()[0].model);
console.log("Total RAM:", (os.totalmem() / 1024 / 1024 / 1024).toFixed(2), "GB");
console.log("Free RAM:", (os.freemem() / 1024 / 1024 / 1024).toFixed(2), "GB");
console.log("Node version:", process.version);

const memBefore = process.memoryUsage();
const t0 = process.hrtime.bigint();

const Tokenizer = require("../src/tokenizer");
const NeuralNetwork = require("../src/neuralNetwork");
const TextAnalyzer = require("../src/analyzer");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const SmartChatbot = require("../src/chatbot");
const CognitiveMemory = require("../src/memory");
const DocumentRAGEngine = require("../src/rag");

const tModulesLoaded = process.hrtime.bigint();

const vocabPath = path.join(__dirname, "..", "data", "vocab.json");
const modelPath = path.join(__dirname, "..", "data", "model.json");
const embPath = path.join(__dirname, "..", "data", "embeddings.json");
const docPath = path.join(__dirname, "..", "data", "documents.json");
const memPath = path.join(__dirname, "..", "data", "memory.json");
const knowPath = path.join(__dirname, "..", "data", "knowledge.json");

const tDataStart = process.hrtime.bigint();
const vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf-8"));
const nn = NeuralNetwork.loadModel(modelPath);
const tokenizer = new Tokenizer();
tokenizer.vocabulary = vocabData.vocabulary;
tokenizer.categories = vocabData.categories;
const analyzer = new TextAnalyzer(nn, tokenizer);
const embeddings = WordEmbeddings.load(embPath);
const miniLLM = new MiniLLM(12, embeddings);
const memory = new CognitiveMemory(memPath);
const rag = new DocumentRAGEngine(embeddings, docPath);
const chatbot = new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);
const tDataEnd = process.hrtime.bigint();

const memAfterLoad = process.memoryUsage();

console.log("\n=== LOADING PERFORMANCE ===");
console.log("Module require time:", Number(tModulesLoaded - t0) / 1e6, "ms");
console.log("Model & data load time:", Number(tDataEnd - tDataStart) / 1e6, "ms");
console.log("Total setup time:", Number(tDataEnd - t0) / 1e6, "ms");
console.log("RSS before load:", (memBefore.rss / 1024 / 1024).toFixed(2), "MB");
console.log("RSS after load:", (memAfterLoad.rss / 1024 / 1024).toFixed(2), "MB");
console.log("Heap used after load:", (memAfterLoad.heapUsed / 1024 / 1024).toFixed(2), "MB");
console.log("Heap total after load:", (memAfterLoad.heapTotal / 1024 / 1024).toFixed(2), "MB");

async function testLatencies() {
  const testPrompts = [
    "Salom, qandaysiz?",
    "Fotosintez nima?",
    "Suv nega qaynaydi?",
    "5 + 7 nechiga teng?",
    "Bugun soat necha bo'ldi?",
    "Mening ismim Bobur",
    "Mening ismim kim edi?",
    "Toshkent qayerda joylashgan?",
    "Kitob o'qish foydalimi?",
    "Xayr, salomat bo'ling"
  ];

  console.log("\n=== INFERENCE LATENCY BENCHMARK (10 QUERIES) ===");
  const times = [];
  for (const q of testPrompts) {
    const start = process.hrtime.bigint();
    const res = await chatbot.process(q);
    const end = process.hrtime.bigint();
    const durMs = Number(end - start) / 1e6;
    times.push(durMs);
    console.log(`Prompt: "${q.padEnd(30)}" -> ${durMs.toFixed(2)} ms (Intent: ${res.intent}, Tool: ${res.toolUsed || "None"})`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`\nLatency Summary: Min = ${min.toFixed(2)} ms, Avg = ${avg.toFixed(2)} ms, Max = ${max.toFixed(2)} ms`);

  const memAfterInference = process.memoryUsage();
  console.log("Heap used after 10 queries:", (memAfterInference.heapUsed / 1024 / 1024).toFixed(2), "MB");
  console.log("RSS after 10 queries:", (memAfterInference.rss / 1024 / 1024).toFixed(2), "MB");
}

testLatencies();
