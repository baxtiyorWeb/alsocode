"use strict";

const readline = require("readline");
const path = require("path");
const fs = require("fs");
const SmartChatbot = require("./src/chatbot");
const TextAnalyzer = require("./src/analyzer");
const NeuralNetwork = require("./src/neuralNetwork");
const Tokenizer = require("./src/tokenizer");
const WordEmbeddings = require("./src/embeddings");
const MiniLLM = require("./src/generator");
const CognitiveMemory = require("./src/memory");
const DocumentRAGEngine = require("./src/rag");

/**
 * =======================================================================
 *  LOCAL CLI INTERFACE WITH REAL-TIME TOKEN STREAMING (TERMINAL CHATBOT)
 * =======================================================================
 *  Neural Studio - 2.1 Bosqich: Task Understanding & Reasoning Engine
 *  - 100% Lokal Offline Rejim
 *  - Tokenma-token jonli oqim (Real-time Token-by-Token Streaming)
 *  - Intellektual vositalar va niyatlar diagnostikasi
 * =======================================================================
 */

// ANSI Ranglar va Formatlash
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  red: "\x1b[31m",
};

/**
 * Tokenlar va so'zlarni ajratuvchi oqimli tokenizer
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForStreaming(text) {
  if (!text) return [];
  // So'zlar, tinish belgilari va bo'shliqlarni alohida tokenlar sifatida saqlaydi
  const tokenRegex = /(\r\n|\n|\r|[^\s\w]+|\w+|\s+)/gu;
  const matches = text.match(tokenRegex);
  return matches || [text];
}

/**
 * Javobni terminalga tokenma-token kechikish bilan chiqarish (Streaming)
 * @param {string} text
 * @param {number} baseDelayMs
 */
async function streamResponse(text, baseDelayMs = 12) {
  const tokens = tokenizeForStreaming(text);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    process.stdout.write(token);

    // Tabiiy pauzalar: gap oxiri yoki yangi satrda biroz ko'proq kutish
    let delay = baseDelayMs;
    if (token === "\n" || token === "\r\n") {
      delay = baseDelayMs * 2.5;
    } else if (/[.?!;]/.test(token)) {
      delay = baseDelayMs * 3;
    } else if (/[,:]/.test(token)) {
      delay = baseDelayMs * 1.8;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  process.stdout.write("\n");
}

async function startCli() {
  console.clear();
  console.log(`${COLORS.cyan}${COLORS.bold}========================================================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}  🧠 NEURAL STUDIO — O'ZBEKCHA LLM INTELLIGENCE (CLI STREAMING REJIMI)${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}========================================================================${COLORS.reset}`);
  console.log(`  ${COLORS.green}✔${COLORS.reset} 100% Lokal Offline Rejim (Tashqi API-siz)`);
  console.log(`  ${COLORS.green}✔${COLORS.reset} Bosqich 2.1: Dinamik Vazifa Tushunish va Mantiqiy Deduksiya`);
  console.log(`  ${COLORS.green}✔${COLORS.reset} Jonli Tokenma-Token Javob Berish Oqimi (Streaming)`);
  console.log(`  ${COLORS.gray}• Buyruqlar: 'rejim', 'yukla <fayl>', 'o\\'rgan <mavzu>:<matn>', 'tozala', 'status', 'exit'${COLORS.reset}`);
  console.log(`${COLORS.cyan}------------------------------------------------------------------------${COLORS.reset}\n`);

  const modelPath = path.join(__dirname, "data", "model.json");
  const vocabPath = path.join(__dirname, "data", "vocab.json");
  const embeddingsPath = path.join(__dirname, "data", "embeddings.json");
  const documentsPath = path.join(__dirname, "data", "documents.json");

  let tokenizer = new Tokenizer();
  let nn = null;

  if (fs.existsSync(vocabPath) && fs.existsSync(modelPath)) {
    const vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf-8"));
    tokenizer.vocabulary = vocabData.vocabulary;
    tokenizer.categories = vocabData.categories;
    nn = NeuralNetwork.loadModel(modelPath);
    process.stdout.write(`[${COLORS.green}OK${COLORS.reset}] Neyron model yuklandi (${tokenizer.categories.length} toifa, ${Object.keys(tokenizer.vocabulary).length} so'z)\n`);
  } else {
    console.warn("⚠️ Model fayllari topilmadi. Avval 'npm run train' yoki 'npm run train:transformer' ni bajaring.");
    process.exit(1);
  }

  // Embeddings yuklash
  let embeddings = null;
  if (fs.existsSync(embeddingsPath)) {
    embeddings = WordEmbeddings.load(embeddingsPath);
    process.stdout.write(`[${COLORS.green}OK${COLORS.reset}] Semantik vektor fazosi yuklandi (WordEmbeddings)\n`);
  } else {
    embeddings = new WordEmbeddings(12, 0.08);
  }

  // RAG va generator
  const rag = new DocumentRAGEngine(embeddings, documentsPath);
  rag.load();

  const analyzer = new TextAnalyzer(nn, tokenizer);
  const generator = new MiniLLM(12, embeddings);
  const memory = new CognitiveMemory();
  const chatbot = new SmartChatbot(analyzer, generator, embeddings, memory, rag);

  if (chatbot.transformerModel) {
    process.stdout.write(`[${COLORS.green}OK${COLORS.reset}] Causal Transformer LLM yuklandi (${chatbot.transformerModel.nLayers} qatlam, ${chatbot.transformerTokenizer.vocabSize} token)\n`);
  }
  process.stdout.write(`[${COLORS.green}OK${COLORS.reset}] Barcha mantiqiy va kognitiv dvigatellar tayyor!\n\n`);

  // Standart faol rejim: Gibrid Rejim (Transformer + Mantiqiy vositalar + RAG + Tushunchalar)
  let isTransformerMode = false;

  console.log(`${COLORS.cyan}ℹ️ Hozirgi faol rejim: ${COLORS.bold}${isTransformerMode ? "🧠 Sof Causal Transformer LLM (Faqat neyron to'qish)" : "⚙️ Gibrid Rejim (Transformer + Mantiqiy Vositalar + RAG)"}${COLORS.reset}`);
  console.log(`${COLORS.gray}• Faqat sof neyron tarmoqning o'zini sinash uchun 'rejim' deb yozing.${COLORS.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${COLORS.bold}${COLORS.green}Siz ❯ ${COLORS.reset}`,
  });

  rl.prompt();

  let isProcessing = false;

  rl.on("line", async (line) => {
    if (isProcessing) return;
    const input = line.trim();

    if (input.toLowerCase() === "rejim" || input.toLowerCase() === "mode") {
      isTransformerMode = !isTransformerMode;
      console.log(`\n${COLORS.cyan}🔄 Rejim almashtirildi: ${COLORS.bold}${isTransformerMode ? "🧠 Sof Causal Transformer LLM (O'qitilgan neyron to'qish)" : "⚙️ Gibrid Rejim (Transformer + Yordamchi Vositalar)"}${COLORS.reset}\n`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit" || input.toLowerCase() === "chiqish") {
      console.log(`\n${COLORS.yellow}Suhbat yakunlandi. Salomat bo'ling!${COLORS.reset}\n`);
      rl.close();
      process.exit(0);
    }

    if (input.toLowerCase() === "tozala" || input.toLowerCase() === "clear") {
      console.clear();
      console.log(`${COLORS.cyan}${COLORS.bold}Neural Studio Terminali Tozalandi.${COLORS.reset}\n`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase().startsWith("yukla ") || input.toLowerCase().startsWith("load ")) {
      const targetPath = input.replace(/^(?:yukla|load)\s+/i, "").trim().replace(/['"]/g, "");
      if (!fs.existsSync(targetPath)) {
        console.log(`\n${COLORS.red}❌ Fayl topilmadi: ${targetPath}${COLORS.reset}\n`);
      } else {
        const fileContent = fs.readFileSync(targetPath, "utf-8").trim();
        const docTitle = path.basename(targetPath, path.extname(targetPath));
        const res = rag.addDocument(docTitle, fileContent, "foydalanuvchi_hujjati");
        console.log(`\n${COLORS.green}✔ Yangi hujjat RAG tizimiga yuklandi va indekslandi!${COLORS.reset}`);
        console.log(`  📄 Nomi: «${res.title}»`);
        console.log(`  🧩 Bo'laklar (Chunks): ${res.chunksCount} ta`);
        console.log(`  📚 RAG bazasida jami: ${rag.chunks.length} ta bilim bo'lagi`);
        console.log(`${COLORS.cyan}Endi ushbu fayl bo'yicha xohlagan savolingizni berishingiz mumkin!${COLORS.reset}\n`);
      }
      rl.prompt();
      return;
    }

    if (input.toLowerCase().startsWith("o'rgan ") || input.toLowerCase().startsWith("organ ")) {
      const rawText = input.replace(/^(?:o'rgan|organ)\s+/i, "").trim();
      const parts = rawText.split(/:\s*/);
      let docTitle = "Yangi Bilim";
      let docContent = rawText;
      if (parts.length > 1) {
        docTitle = parts[0].trim();
        docContent = parts.slice(1).join(": ").trim();
      }
      const res = rag.addDocument(docTitle, docContent, "tezkor_bilim");
      console.log(`\n${COLORS.green}✔ Yangi bilim bazaga muvaffaqiyatli qo'shildi!${COLORS.reset}`);
      console.log(`  📄 Mavzu: «${res.title}» (${res.chunksCount} ta bo'lak)`);
      console.log(`${COLORS.cyan}Model ushbu faktni darhol eslab qoldi va savollarda foydalanadi.${COLORS.reset}\n`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "status") {
      console.log(`\n${COLORS.bold}--- TIZIM HOLATI VA XOTIRA ---${COLORS.reset}`);
      console.log(`Foydalanuvchi: ${memory.userProfile.name || "Noma'lum"}`);
      console.log(`Suhbat qadamlari (turns): ${memory.dialogueState.turnsCount}`);
      console.log(`Faol mavzu: ${memory.dialogueState.lastTopic || "Yo'q"}`);
      console.log(`Eslab qolingan faktlar: ${memory.facts.length} ta`);
      if (memory.facts.length > 0) {
        memory.facts.forEach((f, idx) => {
          console.log(`  ${idx + 1}. [${f.subject}] -> ${f.value}`);
        });
      }
      console.log(`Mantiqiy vositalar: Active (Math, Syllogism, Sequence, Comparison, Guard)`);
      console.log(`--------------------------------\n`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "yordam" || input.toLowerCase() === "help") {
      console.log(`\n${COLORS.bold}--- FOYDALI SAVOLLAR NAMUNALARI ---${COLORS.reset}`);
      console.log(`1. Mantiq: "Barcha A lar B. X — A. Bundan qanday xulosa chiqadi?"`);
      console.log(`2. Arifmetika: "5 ta kitobning har biri 10 000 so'm. Jami qancha?"`);
      console.log(`3. Ketma-ketlik: "Ketma-ketlik: 2, 4, 8, 16. Keyingi son nima?"`);
      console.log(`4. Fakt / Bilim: "Demokratiya nima?", "O'zbekistonning poytaxti qayer?"`);
      console.log(`5. Ilmiy haqiqat / Fosh: "Marsda qurilgan shahar nomi nima?"`);
      console.log(`6. Dasturlash: "JavaScriptda massivni qanday saralash mumkin?"`);
      console.log(`-----------------------------------\n`);
      rl.prompt();
      return;
    }

    if (!input) {
      rl.prompt();
      return;
    }

    isProcessing = true;
    try {
      const startTime = Date.now();
      process.stdout.write(`\n${COLORS.bold}${COLORS.cyan}AI ❯ ${COLORS.reset}`);
      let fullReply = "";
      let toolUsed = null;
      let intent = null;

      for await (const chunk of chatbot.processStream(input, { pureTransformer: isTransformerMode })) {
        if (chunk.toolUsed) toolUsed = chunk.toolUsed;
        if (chunk.intent) intent = chunk.intent;

        if (chunk.tokenStr) {
          process.stdout.write(chunk.tokenStr);
          fullReply += chunk.tokenStr;
        } else if (chunk.reply && !fullReply) {
          process.stdout.write(chunk.reply);
          fullReply = chunk.reply;
        }
      }
      process.stdout.write("\n");

      const elapsedMs = Date.now() - startTime;
      console.log(
        `${COLORS.gray}[⚙️ Vosita: ${COLORS.magenta}${toolUsed || "TransformerStream"}${COLORS.gray} | ` +
        `⚡ ${elapsedMs} ms]${COLORS.reset}\n`
      );

    } catch (e) {
      console.error(`\n${COLORS.red}Xatolik yuz berdi:${COLORS.reset}`, e.message);
    } finally {
      isProcessing = false;
      rl.prompt();
    }
  });
}

if (require.main === module) {
  startCli();
}

module.exports = {
  tokenizeForStreaming,
  streamResponse,
  startCli,
};
