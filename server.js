const http = require("http");
const fs = require("fs");
const path = require("path");

// Server 24/7 barqaror ishlashi uchun xatoliklardan himoya (Server Resilience)
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Server Safe Guard] Kutilmagan xatolik ushlandi (server davom etadi):", err.message);
});
process.on("unhandledRejection", (err) => {
  console.warn("⚠️ [Server Safe Guard] Asinxron xatolik ushlandi (server davom etadi):", err && err.message ? err.message : err);
});

const Tokenizer = require("./src/tokenizer");
const NeuralNetwork = require("./src/neuralNetwork");
const TextAnalyzer = require("./src/analyzer");
const WordEmbeddings = require("./src/embeddings");
const MiniLLM = require("./src/generator");
const SmartChatbot = require("./src/chatbot");
const UzbekMorphology = require("./src/morphology");
const CognitiveMemory = require("./src/memory");
const CodeIntelligenceAgent = require("./src/codeAgent");
const SelfAttentionLayer = require("./src/attention");
const MultiHeadAttention = require("./src/multiHeadAttention");
const DocumentRAGEngine = require("./src/rag");
const CodeSandboxEngine = require("./src/sandbox");
const SessionManager = require("./src/session");
let trainKnowledgeBase = null;
try {
  trainKnowledgeBase = require("./scripts/legacy_mlp/train");
} catch (e) {
  console.warn("⚠️ Legacy train moduli yuklanmadi:", e.message);
}
const dbService = require("./src/db");
const deviceManager = require("./src/deviceManager");

const PORT = 3000;

// =======================================================================
//  MODELLARNI INITSIALIZATSIYA QILISH
// =======================================================================
const modelPath = path.join(__dirname, "data", "model.json");
const vocabPath = path.join(__dirname, "data", "vocab.json");
const knowledgePath = path.join(__dirname, "data", "knowledge.json");
const memoryPath = path.join(__dirname, "data", "memory.json");
const documentsPath = path.join(__dirname, "data", "documents.json");
const sessionsPath = path.join(__dirname, "data", "sessions.json");

const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
const embeddingsPath = path.join(__dirname, "data", "embeddings.json");

// Resilient Model va Vocab yuklash (fayl mavjud bo'lmasa xatosiz avtomatik yaratish)
let vocabData = null;
let nn = null;
try {
  if (fs.existsSync(vocabPath) && fs.existsSync(modelPath)) {
    vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf-8"));
    nn = NeuralNetwork.loadModel(modelPath);
  }
} catch (e) {
  console.warn("⚠️ Boshlang'ich modelni o'qishda ogohlantirish:", e.message);
}

if (!nn || !vocabData) {
  console.log("ℹ️ Boshlang'ich model topilmadi. Avtomatik bazaviy model yaratilmoqda...");
  const tempTokenizer = new Tokenizer();
  tempTokenizer.fit(knowledgeData.knowledge, knowledgeData.categories);
  vocabData = { vocabulary: tempTokenizer.vocabulary, categories: tempTokenizer.categories };
  nn = new NeuralNetwork(tempTokenizer.vocabulary.length, 24, tempTokenizer.categories.length);
  nn.saveModel(modelPath);
  fs.writeFileSync(vocabPath, JSON.stringify(vocabData, null, 2), "utf-8");
}

const tokenizer = new Tokenizer();
tokenizer.vocabulary = vocabData.vocabulary;
tokenizer.categories = vocabData.categories;

let analyzer = new TextAnalyzer(nn, tokenizer);

const allSentences = knowledgeData.knowledge.map((k) => k.text);

// 1. Word Embeddings modelini keshdan o'qish yoki o'qitish
let embeddings = WordEmbeddings.load(embeddingsPath);
if (!embeddings) {
  embeddings = new WordEmbeddings(12, 0.08);
  embeddings.train(allSentences, 15, 2);
  try {
    embeddings.save(embeddingsPath);
  } catch (e) {}
}

// 2. Transformer Attention Mini-LLM Generatorini o'qitish
const miniLLM = new MiniLLM(12, embeddings);
const conversationalCorpus = [
  ...allSentences,
  "Inson va sun'iy intellekt o'rtasidagi samimiy muloqot juda muhim",
  "Har qanday qiyinchilik ortida yangi imkoniyatlar yashiringan",
  "Dasturlash va mantiqiy fikrlash insonning ijodiy qobiliyatini yuksaltiradi",
  "Charchoq paytida bir oz dam olib yangi kuch to'plash kerak",
  "Biz birgalikda do'stona va ajoyib natijalarga erishamiz",
  "Gumanoid robot inson his-tuyg'ularini tushunishi va hurmat qilishi shart",
  "Bugun havo juda ajoyib va quyosh charaqlab turibdi",
].join(". ") + ".";
miniLLM.train(conversationalCorpus);

// 3. Kognitiv va Avtonom Dvigatellar
const memory = new CognitiveMemory(memoryPath);
const morphology = new UzbekMorphology();
const codeAgent = new CodeIntelligenceAgent();
const attention = new SelfAttentionLayer(12, 8);
const multiHeadAttention = new MultiHeadAttention(12, 4);
const ragEngine = new DocumentRAGEngine(embeddings, documentsPath);
const sandbox = new CodeSandboxEngine(2000);
const sessionManager = new SessionManager(sessionsPath);

// 4. Smart Humanoid Chatbotni tayyorlash (RAG ulangan)
const chatbot = new SmartChatbot(analyzer, miniLLM, embeddings, memory, ragEngine);

// =======================================================================
//  HTTP SERVER (PURE NODE.JS - ZERO DEPENDENCIES)
// =======================================================================
const server = http.createServer((req, res) => {
  // CORS va Preflight sarlavhalari
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Private-Network": "true",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Statik fayllarni uzatish (public/)
  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    let filePath = path.join(
      __dirname,
      "public",
      url.pathname === "/" ? "index.html" : url.pathname
    );
    const ext = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };

    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
  }

  // Xavfsiz JSON javob yuboruvchi (Headers Sent xatosidan 100% himoya)
  const sendJSON = (statusCode, data) => {
    if (!res.headersSent) {
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    }
  };

  // POST so'rovlari uchun tanani o'qish yordamchisi (Async xavfsiz)
  const readBody = (callback) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const json = JSON.parse(body || "{}");
        await callback(json);
      } catch (err) {
        sendJSON(400, { error: "Noto'g'ri JSON format yoki so'rov xatosi: " + err.message });
      }
    });
  };

  // --- API ROUTELARI ---

  // 1. GET /api/info - Tizim va arxitektura ma'lumotlari
  if (req.method === "GET" && url.pathname === "/api/info") {
    const hw = deviceManager.getHardwareInfo();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        inputNodes: nn.inputNodes,
        hiddenNodes: nn.hiddenNodes,
        outputNodes: nn.outputNodes,
        device: nn.device || "cpu",
        deviceName: nn.deviceName || (hw.hasGPU ? hw.gpuName : "CPU Optimized"),
        hardware: hw,
        categories: tokenizer.categories,
        vocabSize: tokenizer.vocabulary.length,
        vocabSample: tokenizer.vocabulary.slice(0, 25),
        memoryFactsCount: memory.facts.length,
        documentsCount: ragEngine.documents.length,
        chunksCount: ragEngine.chunks.length,
        userProfile: memory.userProfile,
      })
    );
    return;
  }

  // 2. POST /api/analyze - Neyron tarmoq va morfologiya tahlili
  if (req.method === "POST" && url.pathname === "/api/analyze") {
    readBody((data) => {
      const text = data.text || "";
      const vector = tokenizer.textToVector(text);
      const forwardPass = nn.feedforward(vector);
      const prediction = tokenizer.vectorToPrediction(forwardPass.finalOutputs);
      const lemmas = morphology.lemmatizeSentence(text);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          text,
          lemmas,
          activeInputIndices: vector
            .map((v, i) => (v === 1 ? i : -1))
            .filter((i) => i !== -1),
          hiddenActivations: forwardPass.hiddenOutputs,
          outputActivations: forwardPass.finalOutputs,
          category: prediction.category,
          confidence: prediction.confidence,
          probabilities: prediction.probabilities,
        })
      );
    });
    return;
  }

  // 3. POST /api/chat - Aqlli Kognitiv & Hissiy Chatbot
  if (req.method === "POST" && url.pathname === "/api/chat") {
    readBody(async (data) => {
      try {
        const message = data.message || "";
        const sessionId = data.sessionId || null;
        const result = await chatbot.process(message);

        // Seansga yozish
        sessionManager.addMessage(sessionId, { sender: "user", text: message });
        sessionManager.addMessage(sessionId, { sender: "bot", text: result.reply, metadata: result });

        sendJSON(200, result);
      } catch (err) {
        sendJSON(500, { error: "Chatbot ishlovida xatolik: " + err.message });
      }
    });
    return;
  }

  // 3.1 POST /api/chat/stream - Real-time SSE Token Streaming Chat
  if (req.method === "POST" && url.pathname === "/api/chat/stream") {
    readBody(async (data) => {
      const message = data.message || "";
      const sessionId = data.sessionId || null;

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      let clientAborted = false;
      res.on("close", () => {
        if (!res.writableEnded) {
          clientAborted = true;
        }
      });

      try {
        sessionManager.addMessage(sessionId, { sender: "user", text: message });
        let accumulatedReply = "";
        let finalMetadata = null;

        for await (const chunk of chatbot.processStream(message)) {
          if (clientAborted || res.writableEnded) break;
          if (chunk.tokenStr) {
            accumulatedReply += chunk.tokenStr;
          }
          if (chunk.reply) {
            accumulatedReply = chunk.reply;
          }
          if (chunk.isFinal) {
            finalMetadata = chunk;
          }
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        if (accumulatedReply) {
          sessionManager.addMessage(sessionId, {
            sender: "bot",
            text: accumulatedReply,
            metadata: finalMetadata || {},
          });
        }

        if (!res.writableEnded) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
      } catch (err) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message, isFinal: true })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    });
    return;
  }

  // 4. POST /api/generate - Causal Transformer LLM matn to'qish
  if (req.method === "POST" && url.pathname === "/api/generate") {
    readBody((data) => {
      const prompt = data.prompt || "dasturlash";
      const temperature = parseFloat(data.temperature) || 0.7;
      const maxTokens = parseInt(data.maxTokens, 10) || 30;

      let generatedText = "";
      if (chatbot.transformerModel && chatbot.transformerTokenizer) {
        const inputIds = chatbot.transformerTokenizer.encode(prompt);
        const outIds = chatbot.transformerModel.generate(inputIds, maxTokens, {
          temperature,
          topK: 12,
          topP: 0.9,
          repetitionPenalty: 1.15,
        });
        generatedText = chatbot.transformerTokenizer.decode(outIds, false);
      } else {
        generatedText = miniLLM.generate(prompt, maxTokens, temperature);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ prompt, generatedText, temperature, maxTokens })
      );
    });
    return;
  }

  // 4.1 POST /api/generate/stream - Causal Transformer LLM Real-Time Token Streaming
  if (req.method === "POST" && url.pathname === "/api/generate/stream") {
    readBody(async (data) => {
      const prompt = data.prompt || "dasturlash";
      const temperature = parseFloat(data.temperature) || 0.7;
      const maxTokens = parseInt(data.maxTokens, 10) || 30;

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      let clientAborted = false;
      res.on("close", () => {
        if (!res.writableEnded) {
          clientAborted = true;
        }
      });

      try {
        if (chatbot.transformerModel && chatbot.transformerTokenizer) {
          const inputIds = chatbot.transformerTokenizer.encode(prompt);
          const streamGen = chatbot.transformerModel.generateStream(
            inputIds,
            maxTokens,
            {
              temperature,
              topK: 12,
              topP: 0.9,
              repetitionPenalty: 1.15,
            },
            chatbot.transformerTokenizer
          );

          for await (const chunk of streamGen) {
            if (clientAborted || res.writableEnded) break;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } else {
          const text = miniLLM.generate(prompt, maxTokens, temperature);
          res.write(`data: ${JSON.stringify({ tokenStr: text, isFinal: true })}\n\n`);
        }

        if (!res.writableEnded) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
      } catch (err) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message, isFinal: true })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    });
    return;
  }

  // 5. POST /api/embeddings - Cosine Similarity qidiruvi
  if (req.method === "POST" && url.pathname === "/api/embeddings") {
    readBody((data) => {
      const word = data.word || "";
      const similar = embeddings.findSimilar(word, 6);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ word, similar, allWords: embeddings.vocab })
      );
    });
    return;
  }

  // 6. GET /api/memory - Xotira, profil va faktlar
  if (req.method === "GET" && url.pathname === "/api/memory") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(memory.getStats()));
    return;
  }

  // 7. POST /api/memory/learn - Hebbian jonli fakt o'rgatish
  if (req.method === "POST" && url.pathname === "/api/memory/learn") {
    readBody((data) => {
      const { subject, relation, object } = data;
      if (!subject || !object) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "subject va object maydonlari majburiy" })
        );
      }
      const fact = memory.addFact(subject, relation || "bu", object);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, fact, totalFacts: memory.facts.length }));
    });
    return;
  }

  // 8. POST /api/attention - Scaled Dot-Product Attention Heatmap
  if (req.method === "POST" && url.pathname === "/api/attention") {
    readBody((data) => {
      const text = data.text || "Sun'iy intellekt dasturlash kelajagini o'zgartiradi";
      const attentionResult = attention.process(text, embeddings);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(attentionResult));
    });
    return;
  }

  // 8.1 POST /api/attention/multihead - 4-Head Multi-Head Attention tahlili
  if (req.method === "POST" && url.pathname === "/api/attention/multihead") {
    readBody((data) => {
      const text = data.text || "Sun'iy intellekt dasturlash kelajagini o'zgartiradi";
      const multiResult = multiHeadAttention.process(text, embeddings);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(multiResult));
    });
    return;
  }

  // 9. POST /api/code/analyze - Sintaksis tahlil
  if (req.method === "POST" && url.pathname === "/api/code/analyze") {
    readBody((data) => {
      const code = data.code || "";
      const analysis = codeAgent.analyzeCode(code);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(analysis));
    });
    return;
  }

  // 10. POST /api/code/snippet - Kod shablonlari
  if (req.method === "POST" && url.pathname === "/api/code/snippet") {
    readBody((data) => {
      const topic = data.topic || "server";
      const snippet = codeAgent.getSnippet(topic);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snippet));
    });
    return;
  }

  // 11. POST /api/sandbox/run - Kodni izolyatsiyalangan muhitda yurgizish
  if (req.method === "POST" && url.pathname === "/api/sandbox/run") {
    readBody((data) => {
      const code = data.code || "";
      const runResult = sandbox.execute(code);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(runResult));
    });
    return;
  }

  // 12. POST /api/sandbox/debug - Kodni avtomatik tuzatish (Self-Healing Debugger)
  if (req.method === "POST" && url.pathname === "/api/sandbox/debug") {
    readBody((data) => {
      const { code, error } = data;
      const healed = sandbox.selfHeal(code || "", error || "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(healed));
    });
    return;
  }

  // 13. RAG HUJJATLAR APILARI
  // GET /api/rag/docs
  if (req.method === "GET" && url.pathname === "/api/rag/docs") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ragEngine.getStats()));
    return;
  }

  function cleanPdfText(rawText) {
    if (!rawText) return "";
    let text = rawText;
    text = text.replace(/[\u2018\u2019\u02BB\u02BC\`]/g, "'");
    text = text.replace(/[«»""„“]/g, '"');
    text = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "");
    text = text.replace(/([a-zA-Zа-яА-ЯёЁo'g']+)[\-\u2010\u2013]\s*\n\s*([a-zA-Zа-яА-ЯёЁo'g']+)/g, "$1$2");

    // Kitob oxiridagi mundarijani (TOC) tozalash
    const mundarijaIdx = text.search(/\n\s*mundarija\b/i);
    if (mundarijaIdx !== -1) {
      text = text.substring(0, mundarijaIdx);
    }
    text = text.replace(/\.{3,}\s*\d+/g, "");
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*(\d+-§\.)/gi, "\n\n$1");
    text = text.replace(/\n\s*(\d+-MAVZU)/gi, "\n\n$1");
    text = text.replace(/\n\s*([IVXLCDM]+-BOB)/gi, "\n\n$1");
    text = text.replace(/([^\n])\n([^\n0-9])/g, "$1 $2");
    return text.trim();
  }

  // POST /api/rag/parse-file
  if (req.method === "POST" && url.pathname === "/api/rag/parse-file") {
    readBody(async (data) => {
      const { fileBase64, filename } = data;
      try {
        if (!fileBase64) throw new Error("Fayl ma'lumoti topilmadi");
        const { PDFParse } = require("pdf-parse");
        const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
        const buf = Buffer.from(cleanB64, "base64");
        const parser = new PDFParse(new Uint8Array(buf));
        const pdfRes = await parser.getText();
        const cleaned = cleanPdfText(pdfRes.text || "");
        if (!cleaned) throw new Error("PDF fayldan matn ajratib bo'lmadi");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, text: cleaned, length: cleaned.length }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/rag/upload
  if (req.method === "POST" && url.pathname === "/api/rag/upload") {
    readBody(async (data) => {
      let { title, content, category, fileBase64, isPdf } = data;
      try {
        if ((isPdf || (title && title.toLowerCase().endsWith(".pdf"))) && fileBase64) {
          const { PDFParse } = require("pdf-parse");
          const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(cleanB64, "base64");
          const parser = new PDFParse(new Uint8Array(buf));
          const pdfRes = await parser.getText();
          content = cleanPdfText(pdfRes.text || "");
        }

        if (!content || !content.trim()) {
          throw new Error("Hujjat matni bo'sh yoki PDF dan matn ajratib bo'lmadi");
        }

        const added = ragEngine.addDocument(title, content, category || "qo'llanma");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, doc: added }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/rag/query
  if (req.method === "POST" && url.pathname === "/api/rag/query") {
    readBody((data) => {
      const query = data.query || "";
      const result = ragEngine.answerQuery(query);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // DELETE /api/rag/delete
  if (req.method === "DELETE" && url.pathname === "/api/rag/delete") {
    readBody((data) => {
      const docId = data.docId;
      if (docId) ragEngine.deleteDocument(docId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // 13.5 POST /api/knowledge/add - Yangi bilim qo'shish (Zero-training On-the-fly Ingestion)
  if (req.method === "POST" && url.pathname === "/api/knowledge/add") {
    readBody((data) => {
      const { text, category } = data;
      if (!text || typeof text !== "string") {
        return sendJSON(400, { error: "text maydoni majburiy" });
      }
      try {
        const cat = category || "umumiy";
        const kPath = path.join(__dirname, "data", "knowledge.json");
        let kData = { categories: [], knowledge: [] };
        if (fs.existsSync(kPath)) {
          kData = JSON.parse(fs.readFileSync(kPath, "utf-8"));
        }
        if (!kData.categories.includes(cat)) {
          kData.categories.push(cat);
        }
        kData.knowledge.push({ text: text.trim(), category: cat });
        fs.writeFileSync(kPath, JSON.stringify(kData, null, 2), "utf-8");
        chatbot.reloadKnowledge();
        sendJSON(200, {
          success: true,
          message: "Yangi bilim bazaga qo'shildi va qayta o'qitishsiz xotiraga yuklandi!",
          totalKnowledge: kData.knowledge.length,
        });
      } catch (err) {
        sendJSON(500, { error: err.message });
      }
    });
    return;
  }

  // 14. SEANSLAR APILARI
  // GET /api/sessions
  if (req.method === "GET" && url.pathname === "/api/sessions") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ sessions: sessionManager.sessions, activeId: sessionManager.activeSessionId }));
    return;
  }

  // POST /api/sessions/new
  if (req.method === "POST" && url.pathname === "/api/sessions/new") {
    readBody((data) => {
      const session = sessionManager.createSession(data.title || "Yangi Suhbat");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(session));
    });
    return;
  }

  // GET /api/sessions/export
  if (req.method === "GET" && url.pathname === "/api/sessions/export") {
    const sessId = url.searchParams.get("id");
    const md = sessionManager.exportMarkdown(sessId);
    res.writeHead(200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="chat-export.md"',
    });
    res.end(md);
    return;
  }

  // 15. POST /api/train - Modelni qayta o'qitish (GPU va CPU rejimlarini qo'llab-quvvatlaydi)
  if (req.method === "POST" && url.pathname === "/api/train") {
    readBody(async (data) => {
      try {
        if (!trainKnowledgeBase) {
          return sendJSON(500, { error: "O'qitish moduli mavjud emas." });
        }
        const reqDevice = data.device || (data.gpu ? "gpu" : (data.cpu ? "cpu" : "auto"));
        const trainResult = await trainKnowledgeBase({ device: reqDevice });
        if (trainResult && trainResult.nn && trainResult.tokenizer) {
          nn = trainResult.nn;
          tokenizer.vocabulary = trainResult.tokenizer.vocabulary;
          tokenizer.categories = trainResult.tokenizer.categories;
          analyzer = new TextAnalyzer(nn, trainResult.tokenizer);
          chatbot.analyzer = analyzer;
        }

        sendJSON(200, {
          success: true,
          message: `Neyron tarmoq [${trainResult.deviceName || trainResult.device}] orqali qayta o'qitildi!`,
          device: trainResult.device,
          deviceName: trainResult.deviceName,
          accuracy: trainResult.accuracy,
          vocabSize: tokenizer.vocabulary.length,
          categories: tokenizer.categories,
        });
      } catch (e) {
        sendJSON(500, { error: "O'qitishda xatolik: " + e.message });
      }
    });
    return;
  }

  sendJSON(404, { error: "Endpoint topilmadi" });
});

if (require.main === module) {
  dbService
    .init()
    .catch((e) => console.error("DB init warning:", e.message))
    .finally(() => {
      server.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`  SUN'IY INTELLEKT VEB-PLATFORMASI ISHGA TUSHDI!`);
        console.log(`  Boshqaruv paneli: http://localhost:${PORT}`);
        console.log(`  Neon Serverless Postgres: Ulangan ✅`);
        console.log(`======================================================\n`);
      });
    });
}

server.sessionManager = sessionManager;

module.exports = server;
