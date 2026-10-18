const fs = require("fs");
const path = require("path");
const Tokenizer = require("../src/tokenizer");
const NeuralNetwork = require("../src/neuralNetwork");
const TextAnalyzer = require("../src/analyzer");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const SmartChatbot = require("../src/chatbot");
const CognitiveMemory = require("../src/memory");
const DocumentRAGEngine = require("../src/rag");

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
const bot = new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);

(async () => {
  const steps = [
    "qandaysan",
    "men sendan hol ahvol so'radim",
    "men charchamadim",
    "yo'q",
    "nimani tushunding",
    "mening ismim Bobur emas Baxtiyor",
    "mening ismim nima?"
  ];

  for (const step of steps) {
    const t0 = Date.now();
    const res = await bot.process(step);
    const ms = Date.now() - t0;
    console.log(`\nSiz ❯ ${step}`);
    console.log(`[🧠 Vazifa: ${res.intent} | ⚙️ Vosita: ${res.toolUsed} | ⚡ ${ms} ms]`);
    console.log(`AI ❯ ${res.reply}`);
  }
})();
