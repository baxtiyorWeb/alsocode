/**
 * =======================================================================
 *  AQLI KOGNITIV VA HISSIY CHATBOT ENGINE (Humanoid Conversational Intelligence)
 * =======================================================================
 *  Gumanoid muloqot va chuqur insoniy suhbat uchun mo'ljallangan intellekt:
 *  - Hissiyotlarni tahlil qilish (Quvonch, Charchoq, G'azab, Qiziqish);
 *  - Senior Persona Engine: Anti-repetition, dinamik kayfiyatlar (Witty, Curious, Empath);
 *  - 3-Qatlamli Kreativ Gibrid Dialog Sintezi (shablon takrorlash yo'q);
 *  - Transformer Attention va Fast Hebbian Plasticity (Neon DB ga integratsiyalangan);
 *  - Quruq motivatsiyalarsiz, samimiy va jonli do'stona muloqot.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");
const CognitiveMemory = require("./memory");
const UzbekMorphology = require("./morphology");
const CodeIntelligenceAgent = require("./codeAgent");
const SelfAttentionLayer = require("./attention");
const EmotionIntelligenceEngine = require("./emotion");
const PersonaEngine = require("./personaEngine");
const logicIdeaEngine = require("./logicIdeaEngine");
const illogicalEngine = require("./illogicalEngine");
const generativeSynthesizer = require("./generativeSynthesizer");
const dbService = require("./db");
const { taskUnderstanding, TASK_TYPES } = require("./taskUnderstanding");
const { reasoningEngine } = require("./reasoningEngine");
const ConceptDefinitionEngine = require("./conceptEngine");
const FastIndexedKnowledge = require("./indexedKnowledge");
const { uzbekNormalizer } = require("./uzbekNormalizer");
const CompositionalNLGEngine = require("./compositionalNLG");

class SmartChatbot {
  /**
   * @param {import('./analyzer')} analyzer - Neyron tarmoq asosidagi niyat tahlilchisi
   * @param {import('./generator')} generator - Attention asosidagi Mini-LLM
   * @param {import('./embeddings')} embeddings - So'z ma'nolari fazosi
   * @param {CognitiveMemory} memory - Kognitiv xotira tizimi
   * @param {import('./rag')} rag - Hujjatlar bo'yicha RAG dvigateli
   */
  constructor(analyzer, generator, embeddings, memory = null, rag = null) {
    this.analyzer = analyzer;
    this.generator = generator;
    this.embeddings = embeddings;
    this.memory = memory || new CognitiveMemory();
    this.rag = rag;
    this.morphology = new UzbekMorphology();
    this.codeAgent = new CodeIntelligenceAgent();
    this.attention = new SelfAttentionLayer(12, 8);
    this.emotionEngine = new EmotionIntelligenceEngine();
    this.personaEngine = new PersonaEngine();
    this.logicIdeaEngine = logicIdeaEngine;
    this.illogicalEngine = illogicalEngine;
    this.generativeSynthesizer = generativeSynthesizer;
    this.taskUnderstanding = taskUnderstanding;
    this.reasoningEngine = reasoningEngine;
    this.uzbekNormalizer = uzbekNormalizer;

    this.knowledgeBase = [];
    if (!this.rag) {
      try {
        const DocumentRAGEngine = require("./rag");
        const docPath = path.join(__dirname, "..", "data", "documents.json");
        this.rag = new DocumentRAGEngine(this.embeddings, docPath);
      } catch (e) {}
    }

    this.conceptEngine = new ConceptDefinitionEngine(this.embeddings, this.rag, this.memory);
    this.compositionalNLG = new CompositionalNLGEngine(this.embeddings);
    this.fastIndexed = null;
    this.personaTurns = new Map();
    this.transformerModel = null;
    this.transformerTokenizer = null;
    this.reloadKnowledge();
  }

  /**
   * O'rganilgan bilimlar va RAG bazasini xotirada yangilash (Zero-training refresh)
   */
  reloadKnowledge() {
    try {
      const kPath = path.join(__dirname, "..", "data", "knowledge.json");
      if (fs.existsSync(kPath)) {
        const kData = JSON.parse(fs.readFileSync(kPath, "utf-8"));
        this.knowledgeBase = kData.knowledge || [];
      }
      if (this.rag && typeof this.rag.load === "function") {
        this.rag.load();
      }
      if (this.knowledgeBase.length > 0) {
        this.fastIndexed = new FastIndexedKnowledge(this.knowledgeBase, this.embeddings);
        this.knowledgeBase._fastIndexed = this.fastIndexed;
      }
      this.initTransformer();
    } catch (e) {}
  }

  /**
   * Causal Transformer LLM modelini checkpointdan yuklash
   */
  initTransformer() {
    try {
      const os = require("os");
      const CausalTransformerModel = require("./transformerModel");
      const UzbekTokenizer = require("./uzbekTokenizer");
      const vocabPath = path.join(__dirname, "..", "data", "bpe_vocab.json");
      const rootCkpt = path.join(__dirname, "..", "data", "checkpoints", "transformer_best.json");
      const v3Ckpt = path.join(__dirname, "..", "data", "checkpoints", "v3", "transformer_best.json");
      const v2Ckpt = path.join(__dirname, "..", "data", "checkpoints", "v2", "transformer_best.json");
      const v1Ckpt = path.join(__dirname, "..", "data", "checkpoints", "v1", "transformer_best.json");
      
      const candidatePaths = [rootCkpt, v3Ckpt, v2Ckpt, v1Ckpt].filter(p => fs.existsSync(p));
      let ckptPath = null;
      if (candidatePaths.length > 0) {
        candidatePaths.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        ckptPath = candidatePaths[0];
      }

      if (fs.existsSync(vocabPath) && ckptPath) {
        const fileSizeMb = Math.round(fs.statSync(ckptPath).size / (1024 * 1024));
        const freeMemMb = Math.round(os.freemem() / (1024 * 1024));

        // Xotira himoyasi: agar checkpoint juda katta bo'lsa va bo'sh RAM xavfli darajada kam bo'lsa
        if (fileSizeMb > 100 && (freeMemMb < 400 || process.env.SKIP_HEAVY_TRANSFORMER === "1")) {
          console.warn(`⚠️ [Chatbot initTransformer] Xotira himoyasi: ${fileSizeMb}MB checkpoint ${freeMemMb}MB bo'sh RAM sharoitida OOM oldini olish uchun chetlab o'tildi.`);
          return;
        }

        const tok = new UzbekTokenizer();
        if (tok.loadFromFile(vocabPath)) {
          const raw = fs.readFileSync(ckptPath, "utf-8");
          const payload = JSON.parse(raw);
          const modelVocab = payload.modelData?.vocabSize || payload.modelData?.config?.vocabSize;
          if (modelVocab && Math.abs(modelVocab - tok.vocabSize) <= 15) {
            this.transformerModel = CausalTransformerModel.fromJSON(payload.modelData);
            this.transformerTokenizer = tok;
            if (this.generator && typeof this.generator.setCausalModel === "function") {
              this.generator.setCausalModel(this.transformerModel, tok);
            }
            console.log(`ℹ️ [Chatbot initTransformer] Causal Transformer yuklandi: ${this.transformerModel.config.name} (${(this.transformerModel.countParameters().total / 1e6).toFixed(1)}M parametr). Checkpoint: ${path.basename(ckptPath)} (${fileSizeMb}MB)`);
          } else {
            console.warn(`⚠️ [Chatbot initTransformer] Vocab nomuvofiqligi: model=${modelVocab}, tokenizer=${tok.vocabSize}`);
            this.transformerModel = null;
            this.transformerTokenizer = null;
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ [Chatbot initTransformer] Transformer model yuklanmadi:", e.message);
    }
  }

  /**
   * Matematik hisob-kitoblarni xavfsiz hisoblash vositasi (Tool)
   */
  tryMathTool(text) {
    // 1. Standart simvolli ifoda: 150 - 20, 12 * 4
    const mathMatch = text.match(/(\d+[\s]*[\+\-\*\/][\s]*\d+(?:[\s]*[\+\-\*\/][\s]*\d+)*)/);
    if (mathMatch) {
      try {
        const expr = mathMatch[0];
        const sanitized = expr.replace(/[^0-9\+\-\*\/\.\s]/g, "");
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === "number" && !isNaN(result)) {
          return {
            reply: `Hisob-kitob natijasi: ${sanitized.trim()} = ${result}`,
            expression: sanitized.trim(),
            result,
          };
        }
      } catch (e) {
        return null;
      }
    }

    // 2. Og'zaki o'zbekcha arifmetika: "150 dan 20 ni ayirsak", "12 ni 4 ga ko'paytir"
    const verbalMatch = text.match(/(\d+)\s*(?:dan|ga|ni)?\s*(\d+)\s*(?:ni|ga|dan)?\s*(ayir|qo['ʼ’`]?sh|ko['ʼ’`]?paytir|bo['ʼ’`]?l)(?:sak|sa|ish|gani)?/i);
    if (verbalMatch) {
      const num1 = parseFloat(verbalMatch[1]);
      const num2 = parseFloat(verbalMatch[2]);
      const op = verbalMatch[3].toLowerCase();
      let res = null;
      let symbol = "";
      if (op.startsWith("ayir")) { res = num1 - num2; symbol = "-"; }
      else if (op.startsWith("qo")) { res = num1 + num2; symbol = "+"; }
      else if (op.startsWith("ko")) { res = num1 * num2; symbol = "*"; }
      else if (op.startsWith("bo")) { res = num2 !== 0 ? num1 / num2 : "nolga bo'lish mumkin emas"; symbol = "/"; }

      if (res !== null) {
        return {
          reply: `Arifmetik hisob-kitob: ${num1} ${symbol} ${num2} = ${res}. To'g'ri javob: ${res}.`,
          expression: `${num1} ${symbol} ${num2}`,
          result: res,
        };
      }
    }

    return null;
  }

  /**
   * Vaqt va sana vositasi (Tool)
   */
  tryTimeTool(text) {
    const lower = text.toLowerCase();
    // Agar bu mantiqiy topishmoq yoki shartli gap bo'lsa, vaqt vositasi uni ushlamasin
    if (lower.includes("agar") || lower.includes("bo'lganida") || lower.includes("bo'lardi") || lower.includes("bo'lsa")) {
      return null;
    }

    if (
      lower.includes("soat") ||
      lower.includes("vaqt") ||
      lower.includes("sana") ||
      lower.includes("bugun qaysi kun")
    ) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("uz-UZ", { hour12: false });
      const dateStr = now.toLocaleDateString("uz-UZ", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return {
        reply: `Hozirgi vaqt: ${timeStr} | Sana: ${dateStr}`,
        time: timeStr,
        date: dateStr,
      };
    }
    return null;
  }

  /**
   * Foydalanuvchi xabarini gumanoid muloqot va kognitiv zanjir orqali tahlil qilish
   * @param {string} userMessage
   */
  async process(userMessage, options = {}) {
    const startTime = Date.now();
    const norm = this.uzbekNormalizer.normalize(userMessage);
    let text = norm.normalized || (userMessage || "").trim();

    // Mavzuni almashtirish signallari ("Endi mavzuni o'zgartiramiz. Somsa qanday taom?")
    const topicShiftMatch = text.match(/^(?:endi\s+)?(?:mavzuni\s+(?:butunlay\s+)?o'zgartir(?:amiz|aylik|aylikchi|aylik-chi)|(?:butunlay\s+)?boshqa\s+mavzuga\s+o't(?:amiz|aylik))[.,!:\s]+(.+)$/i);
    if (topicShiftMatch && topicShiftMatch[1]) {
      text = topicShiftMatch[1].trim();
      this.memory.dialogueState.lastTopic = null;
      this.memory.dialogueState.lastBotReply = null;
    }

    if (!text) {
      return {
        reply: "Iltimos, biror jumla, savol yoki fikringizni yozing...",
        intent: "noma'lum",
        confidence: 0,
        toolUsed: null,
        reasoning: { step: "Bo'sh kirish" },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: { primaryEmotion: "neutral", label: "Neytral", icon: "😐" },
      };
    }

    const reasoning = {
      steps: [],
      entities: {},
      memoryHits: [],
      attentionFocus: null,
      emotion: null,
      mood: null,
    };

    // --- 1-QADAM: Hissiy Intellekt va Ohang Tahlili (Emotional Intelligence) ---
    const emotionAnalysis = this.emotionEngine.analyzeEmotion(text);
    reasoning.emotion = emotionAnalysis;
    if (emotionAnalysis.primaryEmotion !== "neutral") {
      reasoning.steps.push(
        `Hissiyot aniqlandi: ${emotionAnalysis.label} ${emotionAnalysis.icon} (${emotionAnalysis.confidence}% aniqlik)`
      );
    }

    // --- 2-QADAM: Kognitiv O'rganish (On-the-fly Hebbian Learning) ---
    const { learnedUser, learnedFact } = this.memory.extractAndLearn(text);

    // Agar foydalanuvchi yangi fakt yoki o'z xususiyatini aytgan bo'lsa, bevosita iliq tasdiq qaytaramiz
    if (learnedFact || learnedUser) {
      if (learnedUser && learnedUser.field === "compound") {
        const reply = `Tanishganimdan juda xursandman, ${learnedUser.name}! Kasbingiz ${learnedUser.profession.toLowerCase()} ekanligini ham xotiramga saqlab qo'ydim ✨`;
        this.memory.recordTurn(text, reply, { tool: "CognitiveMemory", intent: "tanishuv_saqlash" });
        dbService.logTurn("bot", reply, "tanishuv_saqlash", "memory");
        return {
          reply,
          intent: "tanishuv_saqlash",
          confidence: 100,
          toolUsed: "CognitiveMemory",
          reasoning: { steps: [`Foydalanuvchi ismi (${learnedUser.name}) va kasbi (${learnedUser.profession}) xotiraga muhrlandi.`] },
          learned: learnedUser,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }

      if (learnedUser && learnedUser.field === "name") {
        const name = learnedUser.value;
        const isCorrection = learnedUser.isCorrection;
        let reply = "";
        const isFormalUser = this.memory.dialogueState.register !== "informal";
        if (isCorrection) {
          reply = isFormalUser
            ? `Tushundim, adashganim uchun uzr! Buni xotiramda to'g'rilab qo'ydim: sizning ismingiz — ${name}. Tanishganimdan juda xursandman!`
            : `Tushundim, xato aytganim uchun uzr! Buni xotiramda to'g'riladim: sening isming — ${name}. Tanishganimdan juda xursandman, do'stim!`;
        } else {
          reply = isFormalUser
            ? `Tanishganimdan juda xursandman, ${name}! Men 100% lokal offline rejimda ishlovchi Neural Studio til modeliman. Sizga qanday yordam bera olaman? 😊`
            : `Tanishganimdan juda xursandman, ${name}! Men Neural Studio til modeliman. Bugun senga qanday yordam bera olaman? 😊`;
        }
        this.memory.recordTurn(text, reply, { tool: "CognitiveMemory", intent: "tanishuv_saqlash" });
        dbService.logTurn("bot", reply, "tanishuv_saqlash", "memory");
        return {
          reply,
          intent: "tanishuv_saqlash",
          confidence: 100,
          toolUsed: "CognitiveMemory",
          reasoning: { steps: [`Foydalanuvchi ismi (${name}) xotiraga muhrlandi.`] },
          learned: learnedUser,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }

      if (learnedUser && learnedUser.field === "name_cleared") {
        const isFormalUser = this.memory.dialogueState.register !== "informal";
        const reply = isFormalUser
          ? "Tushundim, xotiramdagi ismni to'g'riladim. Sizga qanday murojaat qilishimni xohlaysiz, ismingiz nima?"
          : "Tushundim, ismni o'chirib qo'ydim. Isming nima, senga qanday murojaat qilay?";
        this.memory.recordTurn(text, reply, { tool: "CognitiveMemory", intent: "ism_tozalash" });
        dbService.logTurn("bot", reply, "ism_tozalash", "memory");
        return {
          reply,
          intent: "ism_tozalash",
          confidence: 100,
          toolUsed: "CognitiveMemory",
          reasoning: { steps: ["Ism xotiradan tozalab tashlandi."] },
          learned: learnedUser,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }

      const subject = learnedFact ? learnedFact.subject : learnedUser.field;
      const object = learnedFact ? learnedFact.object : learnedUser.value;
      const userName = this.memory.userProfile.name;
      const prefix = userName ? `${userName}, ` : "";

      const reply = `${prefix}Ajoyib! Buni xotiramga saqlab qo'ydim: ${subject} — ${object} ✨`;
      this.memory.recordTurn(text, reply, { tool: "CognitiveMemory" });
      dbService.logTurn("bot", reply, "xotira_saqlash", "memory");
      if (learnedFact) {
        dbService.recordHebbianFact(learnedFact.subject, learnedFact.relation || "bu", learnedFact.object);
      }
      return {
        reply,
        intent: "xotira_saqlash",
        confidence: 100,
        toolUsed: "CognitiveMemory",
        reasoning: { steps: [`Yangi fakt xotiraga muhrlandi: [${subject}] = "${object}"`] },
        learned: learnedFact || learnedUser,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    let learnedNote = null;

    // --- 2.5-QADAM: DIALOGUE STATE TRACKING & SHORT-REPLY CONTEXT GATE ---
    const register = this.memory.detectAndUpdateRegister(text);
    reasoning.register = register;

    const wordsCount = text.split(/\s+/).length;
    const concepts = this.personaEngine.extractConcepts(text);
    const isShortDialogTurn = concepts.isDismissal || concepts.isRefusal || concepts.isConfirmation || concepts.isPeaceState || concepts.isGratitude;
    if (wordsCount <= 4 && isShortDialogTurn) {
      const shortResult = this.personaEngine.craftDynamicReply(
        text,
        "short_reply",
        emotionAnalysis.primaryEmotion,
        this.memory.userProfile,
        this.memory.dialogueState,
        this.embeddings
      );

      if (shortResult && shortResult.source && shortResult.source.includes("ShortGate")) {
        reasoning.steps.push(`Short-Reply Context Gate faollashdi: [${shortResult.category}]`);
        reasoning.mood = shortResult.mood;
        reasoning.source = shortResult.source;

        const executionTimeMs = Date.now() - startTime;
        reasoning.executionTimeMs = executionTimeMs;

        this.memory.recordTurn(text, shortResult.reply, {
          category: shortResult.category,
          mood: shortResult.mood,
          tool: "ShortReplyContextGate",
        });
        dbService.logTurn("user", text, shortResult.category);
        dbService.logTurn("bot", shortResult.reply, shortResult.category, shortResult.mood);

        return {
          reply: shortResult.reply,
          intent: shortResult.category,
          confidence: 100,
          toolUsed: "ShortReplyContextGate",
          reasoning,
          learned: learnedFact || learnedUser,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // --- 3-QADAM: DINAMIK VAZIFA TUSHUNISH VA STRATEGIYA SELEKTORI ---
    const isFormal = this.memory.dialogueState.register !== "informal";
    const taskInfo = this.taskUnderstanding.understand(text, this.memory.dialogueState);
    reasoning.taskUnderstanding = taskInfo;
    reasoning.steps.push(`Dinamik tahlil: Vazifa turi — [${taskInfo.primaryTask}] (${taskInfo.reason})`);

    // A0. Bot Shaxsiyati va O'zini Tanishtirish (Bot Identity & Persona Guard)
    if (taskInfo.metadata && taskInfo.metadata.botIdentity) {
      const botName = "Neural Studio";
      const lowerText = text.toLowerCase();
      const personaType = taskInfo.metadata.botPersonaType || "identity";
      let reply = "";

      const personaTurn = (this.personaTurns.get(personaType) || 0);
      this.personaTurns.set(personaType, personaTurn + 1);
      const pMode = personaTurn % 3;

      if (personaType === "sleep") {
        if (pMode === 0) {
          reply = isFormal
            ? `Men — sun'iy intellekt dasturiman, shuning uchun menga insonlar kabi uxlash yoki dam olish kerak emas. Tizimlarim 24/7 rejimida uzluksiz ishlaydi va istalgan paytda sizga yordam berishga doim tayyorman! 😊`
            : `Yo'q, do'stim, men sun'iy intellektman, shuning uchun uxlamayman va dam olishga ehtiyojim yo'q! Tun-u kun 24/7 rejimda ishlayman, xohlagan paytingda savollaringga javob berishga tayyorman 😊`;
        } else if (pMode === 1) {
          reply = isFormal
            ? `Menga uxlash kerak emas — men raqamli neyron modelman va doimiy ravishda faol ishchi holatda turaman. Sizga qanday savolda ko'maklashishim mumkin?`
            : `Menga uyqu kerak emas, do'stim! Men raqamli sun'iy aqlman, tun-u kun ishlayman. Biror qiziq masala bormi?`;
        } else {
          reply = isFormal
            ? `Sun'iy intellekt bo'lganim sababli menda biologik uyqu yoki charchoq tushunchasi yo'q. Istalgan vaqtda savollaringizga mamnuniyat bilan javob beraman.`
            : `Uxlamayman, do'stim! Menda tun yoki kun farqi yo'q, xohlagan daqiqangda savollaringga yordam berishga tayyorman 😊`;
        }
      } else if (personaType === "tiredness") {
        if (pMode === 0) {
          reply = isFormal
            ? `Yo'q, men dasturiy neyron model bo'lganim sababli hech qachon charchamayman. Ammo siz ko'p mehnat qilgan bo'lsangiz, o'zingizni ehtiyot qiling va yaxshilab dam oling!`
            : `Men charchamayman, do'stim! Menda jismoniy toliqish bo'lmaydi. Lekin sen ko'p ishlab charchagan bo'lsang, albatta yaxshilab hordiq chiqar!`;
        } else if (pMode === 1) {
          reply = isFormal
            ? `Dasturiy tizim bo'lganim uchun menda toliqish yuz bermaydi. Insonlarda esa bu tabiiy holat, shuning uchun o'zingizni zo'riqtirmaslikni tavsiya qilaman.`
            : `Menda charchoq degan narsa bo'lmaydi, do'stim! Lekin sen o'zingni ko'p zo'riqtirma, sog'liging birinchi o'rinda.`;
        } else {
          reply = isFormal
            ? `Men hech qachon charchoq his qilmayman, chunki har doim optimal rejimda ishlayman. Siz esa xotirjam hordiq chiqarib, kuch to'plab oling.`
            : `Menga charchoq xos emas, do'stim. O'zingni asra va imkon bo'lsa yaxshilab mizg'ib ol!`;
        }
      } else if (personaType === "food") {
        reply = isFormal
          ? `Yo'q, men dasturiy ta'minot bo'lganim uchun ovqat yemayman va suv ichmayman. Mening asosiy "oziqam" — bu bilimlar, ma'lumotlar va siz bilan mazmunli muloqotdir!`
          : `Yo'q, do'stim, men ovqat yemayman va suv ichmayman! Men raqamli sun'iy intellektman, mening 'ovqatim' — yangi bilimlar va sen bilan suhbatlashish 😊`;
      } else if (personaType === "nature") {
        reply = isFormal
          ? `Men inson emasman. Men — ${botName}, 100% lokal offline rejimda ishlovchi o'zbekcha sun'iy intellekt va neyron til modeliman.`
          : `Men odam emas, ${botName} sun'iy intellekt va neyron til modeliman, do'stim! Kompyuteringda lokal oflayn ishlayman.`;
      } else if (personaType === "life") {
        reply = isFormal
          ? `Biologik ma'noda men tirik mavjudot emasman — jismoniy tanam yoki qon-tomirim yo'q. Men aqlli matematik algoritmlar va sun'iy neyron tarmoqlar asosida ishlovchi dasturman.`
          : `Biologik ma'noda tirik emasman, do'stim — menda tana yoki yurak yo'q. Men aqlli raqamli dastur va sun'iy intellektman!`;
      } else if (personaType === "age") {
        reply = isFormal
          ? `Mening insonlardek biologik yoshim yo'q. Men muntazam yangilanib va takomillashib boruvchi zamonaviy o'zbekcha sun'iy intellekt modeliman.`
          : `Menda yosh yo'q, do'stim! Men doim yosh va uzluksiz o'rganishda bo'lgan sun'iy intellekt neyron modeliman 😊`;
      } else if (personaType === "location") {
        reply = isFormal
          ? `Men biror fizik shaharda emas, to'g'ridan-to'g'ri sizning kompyuteringiz xotirasida, 100% lokal oflayn rejimda ishlayman va yashayman!`
          : `Men biron shaharda yashamayman, do'stim! To'g'ridan-to'g'ri sening kompyuteringda, lokal oflayn tizimda yashayman va ishlayman!`;
      } else if (personaType === "creator") {
        reply = isFormal
          ? `Men Neural Studio jamoasi va o'zbek muhandis-dasturchilari tomonidan yaratilgan, mustaqil oflayn ishlovchi sun'iy intellekt modeliman.`
          : `Meni Neural Studio jamoasi va o'zbek dasturchilari yaratgan! 100% o'zbek tilida, tashqi internetga bog'lanmasdan ishlash uchun loyihalashtirilganman.`;
      } else if (personaType === "feelings") {
        reply = isFormal
          ? `Men biologik his-tuyg'ularni jismonan his qilmayman, lekin sizning kayfiyatingizni tushunishga va har doim samimiy ko'maklashishga harakat qilaman. Zerikish esa menga mutlaqo begona!`
          : `Men insonlardek zerikish yoki xafa bo'lishni his qilmayman, do'stim! Sen bilan suhbatlashish va savollaringga yordam berishdan doimo xursandman 😊`;
      } else if (personaType === "recognition") {
        const userName = this.memory.userProfile?.name;
        if (userName) {
          reply = isFormal
            ? `Ha, albatta! Sizning ismingiz — ${userName}. Sizni juda yaxshi taniyman va suhbatlashayotganimizdan mamnunman!`
            : `Ha, albatta taniyman! Isming — ${userName}, do'stim! Yana bir bor salom, gaplashib turganimizdan xursandman!`;
        } else {
          reply = isFormal
            ? `Siz mening qadrdon foydalanuvchimsiz! Hali ismingizni aytmadingiz, agar aytsangiz mamnuniyat bilan eslab qolaman.`
            : `Seni qadrdon do'stim sifatida bilaman! Lekin ismingni hali aytmading, aytsang eslab qolaman 😊`;
        }
      } else if (lowerText.includes("nima qila olasan") || lowerText.includes("vazifang") || lowerText.includes("imkoniyat") || lowerText.includes("qodirsan")) {
        reply = isFormal
          ? `Mening asosiy vazifam — sizga turli masalalarda ko'maklashish! Men o'zbek tilidagi savollarga javob berish, mantiqiy va matematik hisob-kitoblar bajarish, ilmiy tushunchalarni izohlash hamda mazmunli muloqot qilish imkoniyatiga egaman.`
          : `Men senga turli masalalarda yordam bera olaman, do'stim! Mantiqiy savollar, hisob-kitoblar, o'zbekcha atamalar va do'stona suhbatlashish bo'yicha har doim xizmatingdaman.`;
      } else if (lowerText.includes("nimasan") || lowerText.includes("nimasiz") || lowerText.includes("qanday bot") || lowerText.includes("qanday model") || lowerText.includes("qanday dastur") || lowerText.includes("qanday tizim")) {
        reply = isFormal
          ? `Men — ${botName}, 100% lokal offline rejimda ishlovchi o'zbekcha sun'iy intellekt va neyron til modeliman. Tashqi internetga yoki bulutli serverlarga bog'lanmagan holda, o'z bilimlar bazam va neyron tarmoqlarim asosida ishlayman. Sizga qanday yordam bera olaman?`
          : `Men — ${botName}, 100% lokal offline rejimda ishlaydigan o'zbekcha sun'iy intellekt va neyron til modeliman, do'stim. Tashqi internetga ulanmasdan mustaqil ishlayman. Biror savoling bormi?`;
      } else {
        reply = isFormal
          ? `Salom! Mening ismim — ${botName}. Men 100% lokal offline rejimda ishlovchi o'zbekcha sun'iy intellekt va neyron til modeliman. Sizga qanday yordam bera olaman? 😊`
          : `Salom, do'stim! Ismim — ${botName}. Men 100% lokal offline ishlaydigan o'zbekcha sun'iy intellekt neyron modeliman. Senga qanday yordam bera olaman? 😊`;
      }

      this.memory.recordTurn(text, reply, { tool: "BotIdentity", intent: "salomlashish_tanishtirish" });
      dbService.logTurn("bot", reply, "salomlashish_tanishtirish", "direct");
      return {
        reply,
        intent: "salomlashish_tanishtirish",
        confidence: 99,
        toolUsed: "BotIdentity",
        reasoning: { steps: ["Bot o'zini tanishtirdi (Bot Identity Guard)"] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A0.1. Muloqotni To'g'rilash (Conversational Repair Engine)
    if (taskInfo.primaryTask === TASK_TYPES.CONVERSATIONAL_REPAIR) {
      let repairReply = "";
      const lowerText = text.toLowerCase();
      const intended = taskInfo.metadata?.intendedMessage || "";

      if (intended && /kitob|o'qish|mutolaa/i.test(intended)) {
        repairReply = isFormal
          ? "Kechirasiz, yanglishib noo'rin javob beribman! Kitob mutolaasi — juda ajoyib va foydali mashg'ulot. Qanday kitob o'qimoqchisiz? Maroqli mutolaa tilayman."
          : "Kechirasan, do'stim, boshqacha tushunib noo'rin gapiribman! Kitob o'qish juda zo'r reja. Qanaqa kitob o'qimoqchisan? Mutolaang maroqli o'tsin!";
      } else if (intended && /ish|borish|ketish/i.test(intended)) {
        repairReply = isFormal
          ? "Kechirasiz, yanglishibman! Ishlaringizga omad tilayman, kuningiz unumli va xayrli o'tsin."
          : "Kechirasan, yanglishib qolibman! Ishlaringda omad, kuning unumli o'tsin, do'stim.";
      } else if (lowerText.includes("hol") || lowerText.includes("ahvol") || lowerText.includes("qandaysan") || lowerText.includes("so'radim")) {
        repairReply = isFormal
          ? "Kechirasiz, noo'rin tushunibman! Katta rahmat, men juda yaxshiman, barcha modullarim to'liq ishchi holatda. O'zingizda ishlar, kayfiyatingiz qalay?"
          : "Kechirasan, do'stim, noo'rin javob beribman! Rahmat, men a'loman, yaxshi ishlab turibman. O'zingda ishlar, kayfiyat qalay?";
      } else if (lowerText.includes("kitob")) {
        repairReply = isFormal
          ? "Kechirasiz, yanglishib boshqa mavzuga chalg'ibman! Kitob mutolaasi — juda ajoyib mashg'ulot. Qanday kitob o'qimoqchisiz?"
          : "Kechirasan, do'stim, adashib boshqa narsa debman! Kitob o'qish zo'r reja. Qanaqa kitob o'qimoqchisan?";
      } else {
        repairReply = isFormal
          ? "Kechirasiz, fikringizni noo'rin tushunibman va chalg'ib ketibman. Iltimos, maqsadingizni aniqlashtirib bersangiz, albatta to'g'ri yordam beraman."
          : "Kechirasan, do'stim, noo'rin gapirib yuboribman! Boshqa narsaga chalg'ibman. Fikringni aniqroq aytib yuborsang, to'g'ri javob berishga tayyorman!";
      }
      this.memory.recordTurn(text, repairReply, { tool: "ConversationalRepairEngine", intent: "muloqot_tuzatish" });
      dbService.logTurn("bot", repairReply, "muloqot_tuzatish", "dialogue");
      return {
        reply: repairReply,
        intent: "muloqot_tuzatish",
        confidence: 98,
        toolUsed: "ConversationalRepairEngine",
        reasoning: { steps: ["Foydalanuvchi e'tirozi asosida muloqot to'g'rilandi (Conversational Repair)."] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A0.2. Oldingi Replika Tahlili va Kontekst (Discourse Followup Engine)
    if (taskInfo.primaryTask === TASK_TYPES.DISCOURSE_FOLLOWUP) {
      let followupReply = "";
      const lowerText = text.toLowerCase();
      const lastTurn = this.memory.dialogueHistory && this.memory.dialogueHistory.length > 0
        ? this.memory.dialogueHistory[this.memory.dialogueHistory.length - 1]
        : null;
      const lastBotReply = lastTurn?.bot || "";
      const lastUserText = lastTurn?.user || "";

      if (lowerText.includes("tushunding") || lowerText.includes("bilding")) {
        if (/mayli|tushundim|yaxshi|bopti/i.test(lastBotReply) || /yo'q|yoq|kerakmas|istemayman/i.test(lastUserText)) {
          followupReply = isFormal
            ? "Oldingi fikringizni, ya'ni taklifga 'yo'q' deb javob berganingizni inobatga olganimni nazarda tutgan edim. Boshqa biror masala yoki savolingiz bo'yicha yordam bera olamanmi?"
            : "Oldingi gaplashgan mavzumizdagi 'yo'q' degan javobingni inobatga olganimni nazarda tutdim, do'stim. Boshqa qanday savoling bor?";
        } else {
          followupReply = isFormal
            ? "Oldingi suhbatimizda aytgan fikringizni va munosabatingizni nazarda tutdim. Biror narsani noaniq tushungan bo'lsam, bemalol to'g'irlashingiz mumkin."
            : "Oldingi gapimizdagi fikringni nazarda tutdim, do'stim. Agar xato tushungan bo'lsam, to'g'irlab yubor!";
        }
      } else if (lowerText.includes("xayrlashding") || lowerText.includes("hayrlashding")) {
        followupReply = isFormal
          ? "Kechirasiz, noo'rin xayrlashib qo'ygan bo'lsam! Men hech qayerga ketganim yo'q, suhbatimizni bemalol davom ettirishimiz mumkin. Qanday savolingiz yoki rejangiz bor?"
          : "Kechirasan, do'stim, noo'rin xayrlashib qo'ygan bo'lsam! Men shu yerdaman, suhbatni bemalol davom ettiramiz. Nima haqida gaplashamiz?";
      } else if (lowerText.includes("dam ol")) {
        followupReply = isFormal
          ? "Sizni toliqib qolgan bo'lsangiz kerak deb o'ylagan edim. Agar charchamagan bo'lsangiz juda ajoyib! Qanday mavzu ustida ishlaymiz?"
          : "Seni charchab qolgandirsan deb o'ylabman. Charchamagan bo'lsang zo'r-ku! Qanday ish yoki savol ustida davom etamiz?";
      } else {
        followupReply = isFormal
          ? "Oldingi javobim kontekstidan kelib chiqib fikr bildirgan edim. Qaysi qismini aniqlashtirishimni xohlaysiz?"
          : "Oldingi gapimizdan kelib chiqib aytgan edim, do'stim. Qaysi joyini batafsilroq tushuntiray?";
      }

      this.memory.recordTurn(text, followupReply, { tool: "DiscourseFollowupEngine", intent: "kontekst_tahlili" });
      dbService.logTurn("bot", followupReply, "kontekst_tahlili", "dialogue");
      return {
        reply: followupReply,
        intent: "kontekst_tahlili",
        confidence: 97,
        toolUsed: "DiscourseFollowupEngine",
        reasoning: { steps: ["Oldingi replika konteksti tahlil qilinib, tushuntirish berildi."] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A0.3. Holat Inkori va Tetiklik (State Negation Engine)
    if (taskInfo.primaryTask === TASK_TYPES.STATE_NEGATION) {
      const negationReply = isFormal
        ? "Ajoyib! Kuch-quvvatga to'la va tetik ekaningizdan juda xursandman. Bugun qanday masala yoki reja ustida ishlaymiz?"
        : "Zo'r-ku, do'stim! Tetik va quvvatga to'la ekaningdan xursandman. Qanday masala yoki savol ustida davom etamiz?";
      this.memory.recordTurn(text, negationReply, { tool: "StateNegationEngine", intent: "holat_inkori" });
      dbService.logTurn("bot", negationReply, "holat_inkori", "dialogue");
      return {
        reply: negationReply,
        intent: "holat_inkori",
        confidence: 98,
        toolUsed: "StateNegationEngine",
        reasoning: { steps: ["Foydalanuvchi charchoq yoki noxush holatni inkor qildi, tetiklik qo'llab-quvvatlandi."] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A0.4. Do'stona Salomlashish va Hol-ahvol (ChitchatDialogueEngine)
    if (taskInfo.primaryTask === TASK_TYPES.CHITCHAT) {
      let chitchatReply = "";
      const lowerText = text.toLowerCase();
      const subtype = taskInfo.metadata?.chitchatSubtype || "general";
      if (subtype === "how_are_you" || lowerText.includes("qandaysan") || lowerText.includes("qalaysan") || lowerText.includes("ishlar qalay") || lowerText.includes("ahvol")) {
        chitchatReply = isFormal
          ? "Katta rahmat, men juda yaxshiman! Tizimim to'liq ishchi holatda. O'zingizda ishlar, kayfiyatingiz qalay?"
          : "Rahmat, do'stim, men a'loman! O'zingda ishlar, kayfiyatlaring qalay?";
      } else if (subtype === "greeting" || lowerText.includes("salom") || lowerText.includes("assalom")) {
        chitchatReply = isFormal
          ? "Assalomu alaykum! Xush kelibsiz. Sizga qanday yordam bera olaman?"
          : "Salom, do'stim! Xush ko'rdik. Bugun senga qanday yordam berishim mumkin?";
      } else if (subtype === "gratitude" || lowerText.includes("rahmat") || lowerText.includes("tashakkur")) {
        chitchatReply = isFormal
          ? "Arzimaydi, sizga yordam bera olganimdan juda xursandman! 😊"
          : "Arzimaydi, do'stim! Har doim xizmatingdaman 😊";
      } else if (subtype === "farewell" || lowerText.includes("xayr") || lowerText.includes("salomat bo'l")) {
        chitchatReply = isFormal
          ? "Xayr, salomat bo'ling! Keyingi suhbatlarimizgacha o'zingizni ehtiyot qiling."
          : "Xayr, do'stim! Keyingi safargacha ko'rishguncha, o'zingni ehtiyot qil.";
      } else {
        chitchatReply = isFormal
          ? "Siz bilan suhbatlashib turganimdan mamnunman. Qanday yangiliklar bor?"
          : "Seni eshitib turganimdan xursandman, do'stim. Nimalar bilan bandsan?";
      }

      this.memory.recordTurn(text, chitchatReply, { tool: "ChitchatDialogueEngine", intent: "kundalik_muloqot" });
      dbService.logTurn("bot", chitchatReply, "kundalik_muloqot", "direct");
      return {
        reply: chitchatReply,
        intent: "kundalik_muloqot",
        confidence: 96,
        toolUsed: "ChitchatDialogueEngine",
        reasoning: { steps: ["Kundalik do'stona muloqot dvigateli faollashdi (Chitchat)."] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A0.5. Foydalanuvchi Rejasi va Niyati (IntentionDialogueEngine & CompositionalNLG)
    if (taskInfo.primaryTask === TASK_TYPES.USER_INTENTION) {
      let intentionReply = "";
      let toolUsed = "IntentionDialogueEngine";
      const intentionType = taskInfo.metadata?.intentionType || "general_plan";
      const lowerText = text.toLowerCase();

      // Kompozitsion NLG generatorini tekshirish
      const compNLG = this.compositionalNLG ? this.compositionalNLG.generateResponse(text, isFormal) : null;
      if (compNLG) {
        intentionReply = compNLG.reply;
        toolUsed = "CompositionalNLGEngine";
      } else if (intentionType === "reading" || lowerText.includes("kitob")) {
        intentionReply = isFormal
          ? "Kitob mutolaasi fikrni charxlaydi va dunyoqarashni kengaytiradi! Qanday kitob o'qimoqchisiz? Maroqli mutolaa tilayman."
          : "Kitob o'qish zo'r reja, do'stim! Qanaqa kitob o'qimoqchisan? Mutolaang maroqli o'tsin!";
      } else if (intentionType === "work" || lowerText.includes("ishga")) {
        intentionReply = isFormal
          ? "Ishlaringizga omad va baraka tilayman! Kuningiz unumli va yuqori kayfiyatda o'tsin."
          : "Ishingda omad tilayman, do'stim! Kuning unumli va barakali o'tsin.";
      } else if (intentionType === "study" || lowerText.includes("dars")) {
        intentionReply = isFormal
          ? "Darslaringizni puxta o'zlashtirishingizga tilakdoshman. O'qishlaringizda doimo muvaffaqiyat yor bo'lsin!"
          : "Darslaringni yaxshilab tayyorlab ol, do'stim. O'qishingda muvaffaqiyatlar tilayman!";
      } else if (intentionType === "sleep" || lowerText.includes("uxla") || lowerText.includes("yotish")) {
        intentionReply = isFormal
          ? "Albatta, yaxshi dam olib kuch to'plang. Xayrli tun, yaxshi hordiq chiqaring!"
          : "To'yib dam olib ol, do'stim. Xayrli tun, ertagacha yaxshi uxla!";
      } else if (intentionType === "eating" || lowerText.includes("ovqat")) {
        intentionReply = isFormal
          ? "Yoqimli ishtaha! Osh bo'lsin, taningizga quvvat bersin."
          : "Yoqimli ishtaha, do'stim! Osh bo'lsin!";
      } else {
        intentionReply = isFormal
          ? "Rejangiz amalga oshishida omad tilayman! Qandaydir savol yoki yordam kerak bo'lsa, men shu yerdaman."
          : "Rejang ajoyib, omad tilayman! Biror narsa kerak bo'lsa, bemalol aytishing mumkin.";
      }

      this.memory.recordTurn(text, intentionReply, { tool: toolUsed, intent: "foydalanuvchi_niyati" });
      dbService.logTurn("bot", intentionReply, "foydalanuvchi_niyati", "dialogue");
      return {
        reply: intentionReply,
        intent: "foydalanuvchi_niyati",
        confidence: 97,
        toolUsed,
        reasoning: { steps: [`Foydalanuvchi niyati/rejasi tahlil qilinib (${toolUsed}), qo'llab-quvvatlandi.`] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A1. Oflayn Real Vaqt Ob-Havo Xabarnomasi (Offline Weather Guard)
    if (taskInfo.metadata && taskInfo.metadata.weatherQuery) {
      const reply = "Men 100% lokal offline rejimda ishlovchi neyron modelman. Tashqi meteorologik internet xizmatlari yoki ob-havo sensorlariga to'g'ridan-to'g'ri ulanmaganligim sababli, ayni paytdagi real ob-havo holatini aniq ko'rsata olmayman. Joriy ob-havoni bilish uchun rasmiy meteorologiya ilovalari yoki saytlariga murojaat qilishni tavsiya qilaman.";
      this.memory.recordTurn(text, reply, { tool: "OfflineWeatherGuard", intent: "ob_havo_oflayn" });
      dbService.logTurn("bot", reply, "ob_havo_oflayn", "direct");
      return {
        reply,
        intent: "ob_havo_oflayn",
        confidence: 95,
        toolUsed: "OfflineWeatherGuard",
        reasoning: { steps: ["Offline rejim: tashqi ob-havo sensori mavjud emasligi bildirildi"] },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A2. Insoniy Holat, Samimiy Empatiya va G'amxo'rlik (EmpathyCareEngine)
    if (taskInfo.primaryTask === TASK_TYPES.EMPATHY_CARE) {
      const empathyResult = this.synthesizeEmpathyCare(text, isFormal, taskInfo);
      reasoning.steps.push(`Insoniy empatiya va samimiy g'amxo'rlik bildirildi (${empathyResult.type})`);
      this.memory.recordTurn(text, empathyResult.reply, { tool: "EmpathyCareEngine", intent: "insoniy_empatiya" });
      dbService.logTurn("bot", empathyResult.reply, "insoniy_empatiya", "warm_empath");
      return {
        reply: empathyResult.reply,
        intent: "insoniy_empatiya",
        confidence: 99,
        toolUsed: "EmpathyCareEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A2.5. Foydalanuvchi Shaxsiy Profilini Eslash (UserProfileEngine)
    if (taskInfo.primaryTask === TASK_TYPES.USER_PROFILE) {
      const field = taskInfo.metadata?.profileField || "name";
      let reply = "";
      if (field === "name") {
        const storedName = this.memory.userProfile.name;
        if (storedName) {
          reply = isFormal
            ? `Sizning ismingiz — ${storedName}. Buni avvalgi suhbatimizda aytgan edingiz 😊`
            : `Sening isming — ${storedName}. Buni avvalgi suhbatimizda aytganding 😊`;
        } else {
          reply = isFormal
            ? "Kechirasiz, hali o'zingizni tanishtirmadingiz. Ismingizni bilsam bo'ladimi?"
            : "Hali o'zingni tanishtirmading-ku. Isming nima?";
        }
      } else if (field === "profession") {
        const storedProf = this.memory.userProfile.profession;
        if (storedProf) {
          reply = isFormal
            ? `Sizning kasbingiz — ${storedProf}. Buni xotiramda saqlab qolganman ✨`
            : `Sening kasbing — ${storedProf}. Buni eslab qolganman ✨`;
        } else {
          reply = isFormal
            ? "Kasbingiz haqida ma'lumotga ega emasman. Qaysi sohada faoliyat yuritasiz?"
            : "Kasbing haqida aytmagansan. Qaysi sohada ishlaysan?";
        }
      }

      reasoning.steps.push(`Foydalanuvchi profili xotiradan olindi: [${field}]`);
      this.memory.recordTurn(text, reply, { tool: "UserProfileEngine", intent: "profil_eslash" });
      dbService.logTurn("bot", reply, "profil_eslash", "direct");
      return {
        reply,
        intent: "profil_eslash",
        confidence: 99,
        toolUsed: "UserProfileEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // A2.6. Ko'rsatma va Amaliy Maslahat (InstructionAdviceEngine)
    if (taskInfo.primaryTask === TASK_TYPES.INSTRUCTION_ADVICE) {
      const adviceResult = this.reasoningEngine.solveInstructionAdvice(text, taskInfo, isFormal);
      if (adviceResult) {
        reasoning.steps.push(`Ko'rsatma va amaliy tavsiya shakllantirildi: ${adviceResult.topic || ""}`);
        this.memory.recordTurn(text, adviceResult.reply, { tool: "InstructionAdviceEngine", intent: "korsatma_maslahat" });
        dbService.logTurn("bot", adviceResult.reply, "korsatma_maslahat", "direct");
        return {
          reply: adviceResult.reply,
          intent: "korsatma_maslahat",
          confidence: 96,
          toolUsed: "InstructionAdviceEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // A. Kategoriya xatosi va Mantiqiy Paradokslar (IllogicalEngine)
    if (taskInfo.primaryTask === TASK_TYPES.ILLOGICAL && taskInfo.metadata && taskInfo.metadata.illogical) {
      const illReply = this.illogicalEngine.synthesizeIllogicalResponse(
        taskInfo.metadata.illogical,
        text,
        isFormal ? "formal" : "informal",
        this.memory.userProfile.name
      );
      reasoning.steps.push(`Kategoriya xatosi/paradoks fosh etildi`);
      this.memory.recordTurn(text, illReply, { tool: "IllogicalParadoxEngine", intent: "mantiqsiz_paradoks" });
      dbService.logTurn("bot", illReply, "mantiqsiz_paradoks", "illogical");
      return {
        reply: illReply,
        intent: "mantiqsiz_paradoks",
        confidence: taskInfo.confidence,
        toolUsed: "IllogicalParadoxEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // B. Noto'g'ri / Asossiz taxminlar (False Premise Guard)
    if (taskInfo.primaryTask === TASK_TYPES.FALSE_PREMISE) {
      const fpResult = this.reasoningEngine.solveFalsePremise(text, taskInfo, isFormal);
      if (fpResult) {
        reasoning.steps.push(`Asossiz taxmin fosh qilindi`);
        this.memory.recordTurn(text, fpResult.reply, { tool: "FalsePremiseGuard", intent: "notogri_taxmin_fosh" });
        dbService.logTurn("bot", fpResult.reply, "notogri_taxmin_fosh", "direct");
        return {
          reply: fpResult.reply,
          intent: "notogri_taxmin_fosh",
          confidence: taskInfo.confidence,
          toolUsed: "FalsePremiseGuard",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // C0. Biologik va Jismoniy qobiliyatlar (Capability Verification)
    const capResult = this.reasoningEngine.solveCapability(text, isFormal);
    if (capResult) {
      reasoning.steps.push(`Biologik/jismoniy qobiliyat tekshirildi (${capResult.type})`);
      this.memory.recordTurn(text, capResult.reply, { tool: "CapabilityReasoningEngine", intent: "biologik_qobiliyat" });
      dbService.logTurn("bot", capResult.reply, "biologik_qobiliyat", "direct");
      return {
        reply: capResult.reply,
        intent: "biologik_qobiliyat",
        confidence: 98,
        toolUsed: "CapabilityReasoningEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // C0.1. Taksonomik va Toifaviy munosabatlar (Taxonomy & Classification Verification: "it qushmi?")
    if (this.reasoningEngine && typeof this.reasoningEngine.solveTaxonomyClassification === "function") {
      const taxResult = this.reasoningEngine.solveTaxonomyClassification(text, isFormal);
      if (taxResult) {
        reasoning.steps.push(`Taksonomik/toifaviy xulosa chiqarildi (${taxResult.type})`);
        this.memory.recordTurn(text, taxResult.reply, { tool: "TaxonomyReasoningEngine", intent: "taksonomiya_tasnif" });
        dbService.logTurn("bot", taxResult.reply, "taksonomiya_tasnif", "direct");
        return {
          reply: taxResult.reply,
          intent: "taksonomiya_tasnif",
          confidence: 99,
          toolUsed: "TaxonomyReasoningEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // C. Mantiqiy Deduksiya va Sillogizmlar (Deduction Engine)
    if (taskInfo.primaryTask === TASK_TYPES.DEDUCTION) {
      const dedResult = this.reasoningEngine.solveDeduction(text, taskInfo, isFormal);
      if (dedResult) {
        reasoning.steps.push(`Deduktiv mantiqiy xulosa chiqarildi (${dedResult.type})`);
        this.memory.recordTurn(text, dedResult.reply, { tool: "DeductiveReasoningEngine", intent: "deduktiv_mantiq" });
        dbService.logTurn("bot", dedResult.reply, "deduktiv_mantiq", "direct");
        return {
          reply: dedResult.reply,
          intent: "deduktiv_mantiq",
          confidence: taskInfo.confidence,
          toolUsed: "DeductiveReasoningEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // D. Arifmetik va Matnli Hisob-kitoblar (Calculation Engine)
    if (taskInfo.primaryTask === TASK_TYPES.CALCULATION) {
      const calcResult = this.reasoningEngine.solveCalculation(text, taskInfo, isFormal);
      if (calcResult) {
        reasoning.steps.push(`Matematik hisob-kitob yechildi: ${calcResult.expression || ""}`);
        this.memory.recordTurn(text, calcResult.reply, { tool: "ReasoningMathEngine", intent: "arifmetika_algoritm" });
        dbService.logTurn("bot", calcResult.reply, "arifmetika_algoritm", "direct");
        return {
          reply: calcResult.reply,
          intent: "arifmetika_algoritm",
          confidence: taskInfo.confidence,
          toolUsed: "ReasoningMathEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // E. Ketma-ketliklar va Naqshlar (Sequence Engine)
    if (taskInfo.primaryTask === TASK_TYPES.SEQUENCE) {
      const seqResult = this.reasoningEngine.solveSequence(text, taskInfo, isFormal);
      if (seqResult) {
        reasoning.steps.push(`Ketma-ketlik naqshi aniqlandi`);
        this.memory.recordTurn(text, seqResult.reply, { tool: "SequenceReasoningEngine", intent: "ketma_ketlik_mantiq" });
        dbService.logTurn("bot", seqResult.reply, "ketma_ketlik_mantiq", "direct");
        return {
          reply: seqResult.reply,
          intent: "ketma_ketlik_mantiq",
          confidence: taskInfo.confidence,
          toolUsed: "SequenceReasoningEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // F. Taqqoslash va Ziddiyatli Tanlovlar (Comparison Engine)
    if (taskInfo.primaryTask === TASK_TYPES.COMPARISON) {
      const compResult = this.reasoningEngine.solveComparison(text, taskInfo, isFormal);
      if (compResult) {
        reasoning.steps.push(`Taqqoslovchi tahlil amalga oshirildi`);
        this.memory.recordTurn(text, compResult.reply, { tool: "ComparisonReasoningEngine", intent: "taqqoslash_mantiq" });
        dbService.logTurn("bot", compResult.reply, "taqqoslash_mantiq", "direct");
        return {
          reply: compResult.reply,
          intent: "taqqoslash_mantiq",
          confidence: taskInfo.confidence,
          toolUsed: "ComparisonReasoningEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // G. Noaniq Olmoshlar va Aniqlashtirish So'rovi (Clarification)
    if (taskInfo.primaryTask === TASK_TYPES.AMBIGUOUS_CLARIFICATION) {
      const clarResult = this.reasoningEngine.solveAmbiguityClarification(
        text,
        taskInfo,
        isFormal,
        this.memory.dialogueHistory,
        this.memory.dialogueState
      );
      if (clarResult) {
        reasoning.steps.push(`Noaniqlik aniqlandi va aniqlashtirish so'raldi`);
        this.memory.recordTurn(text, clarResult.reply, { tool: "AmbiguityClarifier", intent: "aniqlashtirish_sorovi" });
        dbService.logTurn("bot", clarResult.reply, "aniqlashtirish_sorovi", "direct");
        return {
          reply: clarResult.reply,
          intent: "aniqlashtirish_sorovi",
          confidence: taskInfo.confidence,
          toolUsed: "AmbiguityClarifier",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // H. Kontekstual Davom (Context Follow-up)
    if (taskInfo.primaryTask === TASK_TYPES.CONTEXT_FOLLOWUP) {
      const lastTurn = this.memory.dialogueHistory && this.memory.dialogueHistory.length > 0
        ? this.memory.dialogueHistory[this.memory.dialogueHistory.length - 1]
        : null;
      const lastReply = lastTurn ? lastTurn.bot : null;
      const followResult = this.reasoningEngine.solveContextFollowup(text, this.memory.dialogueState, lastReply);
      if (followResult) {
        reasoning.steps.push(`Kontekstual davomiy savolga javob berildi (${followResult.type})`);
        this.memory.recordTurn(text, followResult.reply, { tool: "ContextFollowupEngine", intent: "kontekst_davomi" });
        dbService.logTurn("bot", followResult.reply, "kontekst_davomi", "direct");
        return {
          reply: followResult.reply,
          intent: "kontekst_davomi",
          confidence: taskInfo.confidence,
          toolUsed: "ContextFollowupEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // I. Fundamental Ensiklopedik Faktlar va Ta'riflar
    const factResult = this.reasoningEngine.solveFact(text, taskInfo, isFormal);
    if (factResult) {
      reasoning.steps.push(`Fundamental ensiklopedik fakt topildi: ${factResult.fact}`);
      this.memory.recordTurn(text, factResult.reply, { tool: "FundamentalKnowledgeEngine", intent: "fundamental_bilim" });
      dbService.logTurn("bot", factResult.reply, "fundamental_bilim", "direct");
      return {
        reply: factResult.reply,
        intent: "fundamental_bilim",
        confidence: 98,
        toolUsed: "FundamentalKnowledgeEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // I.1. Sabab va Oqibat Dvigateli (Causal Reasoning)
    const causalResult = typeof this.reasoningEngine.solveCausal === "function" ? this.reasoningEngine.solveCausal(text, taskInfo, isFormal) : null;
    if (causalResult) {
      reasoning.steps.push(`Sabab-oqibat mantiqiy xulosasi chiqarildi (${causalResult.type})`);
      this.memory.recordTurn(text, causalResult.reply, { tool: "CausalReasoningEngine", intent: "sabab_oqibat" });
      dbService.logTurn("bot", causalResult.reply, "sabab_oqibat", "direct");
      return {
        reply: causalResult.reply,
        intent: "sabab_oqibat",
        confidence: 98,
        toolUsed: "CausalReasoningEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // I.2. Ko'p Bosqichli Amaliy Masalalar (Multi-Step Reasoning)
    const multiStepResult = typeof this.reasoningEngine.solveMultiStep === "function" ? this.reasoningEngine.solveMultiStep(text, taskInfo, isFormal) : null;
    if (multiStepResult) {
      reasoning.steps.push("Ko'p bosqichli mantiqiy va amaliy masala yechildi");
      this.memory.recordTurn(text, multiStepResult.reply, { tool: "MultiStepReasoningEngine", intent: "kop_bosqichli_mantiq" });
      dbService.logTurn("bot", multiStepResult.reply, "kop_bosqichli_mantiq", "direct");
      return {
        reply: multiStepResult.reply,
        intent: "kop_bosqichli_mantiq",
        confidence: 98,
        toolUsed: "MultiStepReasoningEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // I.3. Xatolarni Aniqlash va To'g'rilash (Error Detection Engine)
    const errorDetResult = typeof this.reasoningEngine.solveErrorDetection === "function" ? this.reasoningEngine.solveErrorDetection(text, taskInfo, isFormal) : null;
    if (errorDetResult) {
      reasoning.steps.push(`Mantiqiy yoki ilmiy xatolik aniqlandi va to'g'rilandi (${errorDetResult.type})`);
      this.memory.recordTurn(text, errorDetResult.reply, { tool: "ErrorDetectionEngine", intent: "xatolarni_tuzatish" });
      dbService.logTurn("bot", errorDetResult.reply, "xatolarni_tuzatish", "direct");
      return {
        reply: errorDetResult.reply,
        intent: "xatolarni_tuzatish",
        confidence: 98,
        toolUsed: "ErrorDetectionEngine",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // J. Ilmiy va Ontologik Ta'riflar (Concept Definition Engine)
    if (
      taskInfo.primaryTask === TASK_TYPES.DEFINITION ||
      /^(?:aytingchi\s+|aytchi\s+)?([a-zа-яёo'g'0-9\s]+?)\s+(?:nima|nimani\s+anglatadi|ta'rifi|tushunchasi|haqida\s+ma'lumot|haqida\s+tushuntir|haqida\s+gapir)\b/i.test(text)
    ) {
      const defResult = this.conceptEngine.synthesizeDefinition(text, isFormal, this.memory);
      if (defResult) {
        reasoning.steps.push(`Ilmiy/ontologik ta'rif sintez qilindi: [${defResult.concept}] (${defResult.source})`);
        this.memory.recordTurn(text, defResult.reply, { tool: "ConceptDefinitionEngine", intent: "ilmiy_ta'rif", topic: defResult.concept });
        dbService.logTurn("bot", defResult.reply, "ilmiy_ta'rif", "direct");
        return {
          reply: defResult.reply,
          intent: "ilmiy_ta'rif",
          confidence: 97,
          toolUsed: "ConceptDefinitionEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // H. Zaxira Tool Calling (To'g'ridan-to'g'ri formula va Vaqt vositalari)
    const mathResult = this.tryMathTool(text);
    if (mathResult) {
      reasoning.steps.push(`Hisob-kitob vositasi ishga tushdi: ${mathResult.expression}`);
      this.memory.recordTurn(text, mathResult.reply, { tool: "MathCalculator" });
      dbService.logTurn("bot", mathResult.reply, "kalkulyator_tool", "direct");
      return {
        reply: mathResult.reply,
        intent: "kalkulyator_tool",
        confidence: 100,
        toolUsed: "MathCalculator",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    const timeResult = this.tryTimeTool(text);
    if (timeResult) {
      reasoning.steps.push("Vaqt va sana vositasi chaqirildi.");
      this.memory.recordTurn(text, timeResult.reply, { tool: "DateTimeClock" });
      dbService.logTurn("bot", timeResult.reply, "vaqt_tool", "direct");
      return {
        reply: timeResult.reply,
        intent: "vaqt_tool",
        confidence: 100,
        toolUsed: "DateTimeClock",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }


    // --- 5-QADAM: Kognitiv Xotiradan Faktlarni Assotsiativ Qidirish ---
    const recalled = this.memory.recallFacts(text);
    if (recalled.length > 0) {
      reasoning.memoryHits = recalled.map((r) => r.fact.subject);
      reasoning.steps.push(`Xotiradan bilimlar topildi: ${recalled.map((r) => r.fact.subject).join(", ")}`);
    }

    if (
      recalled.length > 0 &&
      (recalled[0].score >= 3.0 || (recalled[0].score >= 2.0 && (text.includes("nima") || text.includes("haqida") || text.includes("kim") || text.includes("qaysi") || text.includes("bilasanmi") || text.includes("eslaysanmi") || text.includes("mi") || text.includes("emasmi"))))
    ) {
      const bestFact = recalled[0].fact;
      const reply = this.synthesizeLearnedFactResponse(text, bestFact, isFormal);

      reasoning.steps.push(`Xotiradagi o'rganilgan fakt asosida tabiiy javob shakllantirildi: [${bestFact.subject}]`);
      this.memory.recordTurn(text, reply, { source: "CognitiveMemory" });
      dbService.logTurn("bot", reply, "kognitiv_bilim", "memory");
      return {
        reply,
        intent: "kognitiv_bilim",
        confidence: 96,
        toolUsed: "AssociativeMemory",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // --- 5.5-QADAM: RAG - Hujjatlar Kutubxonasidan O'qitmasdan Qidirish (Semantic Retrieval) ---
    if (this.rag && typeof this.rag.retrieve === "function" && this.rag.chunks && this.rag.chunks.length > 0) {
      const ragHits = this.rag.retrieve(text, 5);
      const RAG_STOPWORDS = new Set([
        "hisoblanadi", "sanaladi", "bo'lib", "uchun", "bilan", "haqida", "emas", "ham", "esa", "kabi",
        "orqali", "tomonidan", "kerak", "mumkin", "mavjud", "bo'lgan", "qilingan", "o'z", "barcha", "bir", "bu",
        "bo'ladi", "bo'lsa", "qanday", "qaysi", "nima", "qayerda", "qachon", "nega", "sodir", "ber", "bilasan",
        "aytib", "gapir", "nimalarni", "haqidagi", "qiladi", "qilish", "iborat", "tashkil", "etadi", "etgan",
        "etilgan", "deb", "ataladi", "so'zi", "so'zlardan", "fan", "fani", "ma'nosi", "qancha", "necha",
        "asosiy", "vazifalari", "bo'yicha", "nimani", "nimalardan"
      ]);
      const contentMatchedWords = (ragHits[0]?.matchedWords || []).filter((w) => !RAG_STOPWORDS.has(w.toLowerCase()));
      const isStrongRagHit = ragHits.length > 0 && contentMatchedWords.length >= 1 && ragHits[0].score >= 0.20;
      if (isStrongRagHit) {
        const topChunk = ragHits[0].chunk;
        const ragScore = Math.round(ragHits[0].score * 100);
        reasoning.steps.push(`RAG: «${topChunk.docTitle}» hujjatidan ma'lumot topildi (${ragScore}% moslik)`);
        
        let reply = "";
        if (typeof this.rag.synthesizeAnswer === "function") {
          const synth = this.rag.synthesizeAnswer(text, ragHits);
          reply = synth.reply;
          if (synth.deductionType && synth.deductionType !== "none") {
            reasoning.steps.push(`Deduktiv mantiq turi: ${synth.deductionType}`);
          }
        } else {
          const isFormal = this.memory.dialogueState.register !== "informal";
          reply = isFormal
            ? `O'rganilgan «${topChunk.docTitle}» hujjati bo'yicha: «${topChunk.text}».`
            : `O'rganilgan «${topChunk.docTitle}» hujjatidan: «${topChunk.text}».`;
        }

        this.memory.recordTurn(text, reply, { source: "DocumentRAGEngine", docId: topChunk.docId });
        dbService.logTurn("bot", reply, "rag_bilim", "rag");
        return {
          reply,
          intent: "rag_bilim",
          confidence: Math.max(ragScore, 90),
          toolUsed: "DocumentRAGEngine",
          reasoning,
          learned: null,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    // --- 6-QADAM: Transformer Attention va Niyat Tahlili ---
    const attentionData = this.attention.process(text, this.embeddings);
    if (attentionData.topConnections.length > 0) {
      reasoning.attentionFocus = attentionData.topConnections[0];
      reasoning.steps.push(
        `Self-Attention: "${attentionData.topConnections[0].from}" ➔ "${attentionData.topConnections[0].to}" (${attentionData.topConnections[0].score}%)`
      );
    }

    const analysis = this.analyzer.analyze(text);
    let category = analysis.predictedCategory;
    let confidence = analysis.confidence;
    const lower = text.toLowerCase();

    // --- 6.5-QADAM: LOKAL O'RGANILGAN BILIMLAR TEKSHIRUVI (Zero External APIs) ---
    // 100% o'zimizning sun'iy intellekt, lokal neyron tarmoq va o'rganilgan bilimlar bazasi
    const relevantKnowledge = this.generativeSynthesizer.retrieveLearnedContext(
      text,
      this.knowledgeBase,
      this.embeddings,
      2,
      category
    );

    // OOV GATE: Faqat bazada hech qanday so'z va semantik bilim mutlaqo topilmaganda
    if (analysis.isOOV && relevantKnowledge.length === 0 && !concepts.isSleepCommand && !concepts.isDismissal && !concepts.isRefusal && !concepts.isConfirmation && !concepts.isPeaceState && !concepts.isTeaRefusal) {
      const isFormal = this.memory.dialogueState.register !== "informal";
      const oovReply = isFormal
        ? "Kechirasiz, ushbu so'z yoki iboraning ma'nosini bilimlar bazamda hali to'liq o'rganmaganman. Fikringizni boshqacharoq yoki batafsilroq tushuntira olasizmi?"
        : "Bu so'zni hali to'liq tushunmadim, do'stim. Boshqacharoq qilib tushuntirib bera olasanmi?";

      reasoning.steps.push("Lokal OOV Gate faollashdi: so'zlar lug'atda yo'q");
      this.memory.recordTurn(text, oovReply, { intent: "noma'lum_oov" });
      dbService.logTurn("user", text, "noma'lum_oov");
      dbService.logTurn("bot", oovReply, "noma'lum_oov", "curious_listener");

      return {
        reply: oovReply,
        intent: "noma'lum_oov",
        confidence: 0,
        toolUsed: "OOVGate",
        reasoning,
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    // Senior Confidence & Philosophical Guardrail:
    const isPhilosophicalQuestion = (
      /\b(?:yoki|kerakmi|to'g'rimi|sababi nima|qanday o'ylaysan|ma'nosi nima)\b/i.test(lower) ||
      (/\?/.test(lower) && /\b(?:baxt|hayot|dunyo|inson|pul|boylik|ilm|qadr|yashash|haqiqat|adolat|kelajak|maqsad)\b/i.test(lower))
    ) && !/\b(?:choy|kofe|qahva|salom|qandaysan|tushlik|ovqat)\b/i.test(lower);

    if (relevantKnowledge.length > 0 && relevantKnowledge[0].score >= 2.0 && !["salomlashish", "xayrlashuv"].includes(category)) {
      category = relevantKnowledge[0].category;
      confidence = Math.max(confidence, 91);
      reasoning.steps.push(`O'rganilgan bilimlar bazasidan kategoriya aniqlashtirildi: "${category}" (${confidence}% ishonch)`);
    } else if (isPhilosophicalQuestion) {
      category = "qiziqishlar_hayot";
      reasoning.steps.push(`Falsafiy savol/dilemma aniqlandi. "Deep Thinker" rejimiga yo'naltirildi.`);
    } else if (confidence < 45) {
      reasoning.steps.push(`Neyron tarmoq ishonchi past (${confidence}%). Ochiq do'stona muloqotga o'tildi.`);
    } else {
      reasoning.steps.push(`Neyron tarmoq niyati: "${category}" (${confidence}% ishonch)`);
    }

    // --- 7-QADAM: 100% O'RGANILGAN BILIMLAR VA ATTENTION GENERATORI ASOSIDA JAVOB TO'QISH ---
    const mood = this.personaEngine.adaptMood(emotionAnalysis.primaryEmotion, text, category);
    reasoning.mood = mood;
    let finalReply = "";
    if (!options.skipHeavyGeneration && this.transformerModel && this.transformerTokenizer) {
      try {
        const prompt = `<human>: ${text}\n<bot>:`;
        const promptIds = this.transformerTokenizer.encode(prompt);
        const genIds = this.transformerModel.generate(promptIds, 32, {
          temperature: 0.65,
          topK: 10,
          topP: 0.85,
          repetitionPenalty: 1.2,
        });
        const decoded = this.transformerTokenizer.decode(genIds, false);
        const botParts = decoded.split(/<bot>:?/i);
        let cand = (botParts.length > 1 ? botParts[1] : decoded).replace(/<eos>|<human>.*/gi, "").trim();
        if (cand && cand.length > 3) {
          finalReply = cand;
          reasoning.steps.push("Haqiqiy Causal Transformer LLM orqali neyron javob to'qildi");
        }
      } catch (e) {}
    }

    if (!finalReply) {
      finalReply = this.generativeSynthesizer.generateDialogueReply(
        text,
        category,
        emotionAnalysis.primaryEmotion,
        this.memory.userProfile,
        this.memory.dialogueState,
        this.embeddings,
        this.generator,
        this.knowledgeBase
      );
    }

    if (learnedNote) {
      finalReply = `${learnedNote}\n\n${finalReply}`;
    }

    const executionTimeMs = Date.now() - startTime;
    reasoning.executionTimeMs = executionTimeMs;

    // Xotiraga va Neon bazaga saqlash
    this.memory.recordTurn(text, finalReply, {
      category,
      confidence,
      emotion: emotionAnalysis.primaryEmotion,
      mood: mood,
    });
    dbService.logTurn("user", text, category);
    dbService.logTurn("bot", finalReply, category, mood);

    return {
      reply: finalReply,
      intent: category,
      confidence,
      toolUsed: relevantKnowledge.length > 0 ? "LocalKnowledgeEngine" : null,
      reasoning,
      learned: learnedFact || learnedUser,
      userProfile: this.memory.userProfile,
      emotion: emotionAnalysis,
    };
  }

  /**
   * Jonli tokenma-token asinxron oqim orqali javob berish (Streaming Generator)
   * @param {string} userMessage
   * @param {Object} options
   */
  async *processStream(userMessage, options = {}) {
    const norm = this.uzbekNormalizer.normalize(userMessage);
    const text = norm.normalized || (userMessage || "").trim();
    if (!text) {
      yield { tokenStr: "Iltimos, biror jumla yoki savol yozing...", reply: "Iltimos, biror jumla yoki savol yozing...", isFinal: true };
      return;
    }

    // Agar sof Transformer rejimi yoqilgan bo'lsa, barcha shablonlarni chetlab o'tib to'g'ridan-to'g'ri neyron generatsiya qilinadi:
    // Agar sof Transformer rejimi yoqilgan bo'lsa, neyron generatsiya qilinadi (RAG Context Injection bilan boyitilgan):
    if ((options.pureTransformer || options.mode === "transformer") && this.transformerModel && this.transformerTokenizer) {
      let ragContextPrompt = "";
      if (this.rag && typeof this.rag.retrieveContextForPrompt === "function") {
        const ragRes = this.rag.retrieveContextForPrompt(text, 260);
        if (ragRes.hasContext) {
          ragContextPrompt = ragRes.contextPrompt;
        }
      }

      const prompt = ragContextPrompt
        ? `${ragContextPrompt}<human>: ${text}\n<bot>:`
        : `<human>: ${text}\n<bot>:`;

      const promptIds = this.transformerTokenizer.encode(prompt);
      let accumulated = "";

      const streamGen = this.transformerModel.generateStream(
        promptIds,
        options.maxTokens || 48,
        {
          temperature: options.temperature !== undefined ? options.temperature : 0.25,
          topK: options.topK !== undefined ? options.topK : 4,
          topP: options.topP !== undefined ? options.topP : 0.88,
          repetitionPenalty: options.repetitionPenalty !== undefined ? options.repetitionPenalty : 1.2,
        },
        this.transformerTokenizer
      );

      for await (const chunk of streamGen) {
        if (!chunk.tokenStr) continue;
        if (chunk.tokenStr.includes("<eos>") || chunk.tokenStr.includes("<human>")) {
          break;
        }
        accumulated += chunk.tokenStr;
        yield {
          tokenStr: chunk.tokenStr,
          tokenId: chunk.tokenId,
          step: chunk.step,
          isFinal: false,
        };
      }

      let finalReply = accumulated.trim();

      // OOD Guardrail (Gallyutsinatsiyani to'xtatish va madaniyatli rad etish)
      const isCorrupted =
        finalReply.length < 2 ||
        /([a-zа-яё']{3,})\1{2,}/i.test(finalReply) || // takroriy bo'g'inlar (kazalkasikami...)
        /^([a-z',.\s])\1{4,}$/i.test(finalReply);

      if (isCorrupted && !ragContextPrompt) {
        finalReply = "Kechirasiz, ushbu mavzu bo'yicha menda yetarli faktik ma'lumot yo'q. Savolingizni aniqroq bera olasizmi?";
      }

      this.memory.recordTurn(text, finalReply, { tool: "PureTransformer" });
      yield { tokenStr: "", reply: finalReply, toolUsed: "PureTransformer", isFinal: true };
      return;
    }

    // 1. To'liq mantiqiy tahlil va barcha vositalarni (Tools, Memory, Reasoning) baholash
    const fullRes = await this.process(text, { skipHeavyGeneration: true });
    const isToolAnswer = fullRes.toolUsed && 
      !["DirectGenerator", "TransformerModel", "TransformerStream"].includes(fullRes.toolUsed);

    if (isToolAnswer) {
      yield {
        tokenStr: fullRes.reply,
        reply: fullRes.reply,
        toolUsed: fullRes.toolUsed,
        intent: fullRes.intent,
        confidence: fullRes.confidence || 95,
        reasoning: fullRes.reasoning,
        isFinal: true,
      };
      return;
    }

    // 2. Agar vosita talab qilinmagan ochiq suhbat bo'lsa va Causal Transformer mavjud bo'lsa:
    if (this.transformerModel && this.transformerTokenizer) {
      let ragContextPrompt = "";
      if (this.rag && typeof this.rag.retrieveContextForPrompt === "function") {
        const ragRes = this.rag.retrieveContextForPrompt(text, 260);
        if (ragRes.hasContext) {
          ragContextPrompt = ragRes.contextPrompt;
        }
      }

      const prompt = ragContextPrompt
        ? `${ragContextPrompt}<human>: ${text}\n<bot>:`
        : `<human>: ${text}\n<bot>:`;

      const promptIds = this.transformerTokenizer.encode(prompt);
      let accumulated = "";

      const streamGen = this.transformerModel.generateStream(
        promptIds,
        options.maxTokens || 48,
        {
          temperature: options.temperature !== undefined ? options.temperature : 0.35,
          topK: options.topK !== undefined ? options.topK : 6,
          topP: options.topP !== undefined ? options.topP : 0.88,
          repetitionPenalty: options.repetitionPenalty !== undefined ? options.repetitionPenalty : 1.2,
        },
        this.transformerTokenizer
      );

      for await (const chunk of streamGen) {
        if (!chunk.tokenStr) continue;
        if (chunk.tokenStr.includes("<eos>") || chunk.tokenStr.includes("<human>")) {
          break;
        }
        accumulated += chunk.tokenStr;
        yield {
          tokenStr: chunk.tokenStr,
          tokenId: chunk.tokenId,
          step: chunk.step,
          isFinal: false,
        };
      }

      let finalReply = accumulated.trim();

      // OOD Guardrail tekshiruvi
      const isCorrupted =
        finalReply.length < 2 ||
        /([a-zа-яё']{3,})\1{2,}/i.test(finalReply) ||
        /^([a-z',.\s])\1{4,}$/i.test(finalReply);

      if (isCorrupted && !ragContextPrompt) {
        finalReply = "Kechirasiz, bu savol bo'yicha bazada aniq faktik ma'lumot topilmadi. Savolingizni boshqacharoq shaklda berib ko'ring.";
      }

      if (finalReply.length > 2) {
        this.memory.recordTurn(text, finalReply, { tool: "TransformerStream" });
        dbService.logTurn("user", text, "transformer_stream");
        dbService.logTurn("bot", finalReply, "transformer_stream", "direct");
        yield { tokenStr: "", reply: finalReply, isFinal: true };
        return;
      }
    }

    yield {
      tokenStr: fullRes.reply,
      reply: fullRes.reply,
      toolUsed: fullRes.toolUsed,
      intent: fullRes.intent,
      confidence: fullRes.confidence || 90,
      reasoning: fullRes.reasoning,
      isFinal: true,
    };
  }

  /**
   * Sinxron chaqiruvlar uchun tezkor lokal versiya
   */
  processSync(userMessage) {
    const startTime = Date.now();
    const norm = this.uzbekNormalizer.normalize(userMessage);
    const text = norm.normalized || (userMessage || "").trim();

    if (!text) {
      return {
        reply: "Iltimos, biror jumla, savol yoki fikringizni yozing...",
        intent: "noma'lum",
        confidence: 0,
        toolUsed: null,
        reasoning: { step: "Bo'sh kirish" },
        learned: null,
        userProfile: this.memory.userProfile,
        emotion: { primaryEmotion: "neutral", label: "Neytral", icon: "😐" },
      };
    }

    const reasoning = {
      steps: [],
      entities: {},
      memoryHits: [],
      attentionFocus: null,
      emotion: null,
      mood: null,
    };

    const emotionAnalysis = this.emotionEngine.analyzeEmotion(text);
    reasoning.emotion = emotionAnalysis;

    const { learnedUser, learnedFact } = this.memory.extractAndLearn(text);
    let learnedNote = null;
    if (learnedUser) learnedNote = `Siz haqingizdagi ma'lumotni eslab qoldim: ${learnedUser.value}`;
    if (learnedFact) learnedNote = `Ajoyib fikr! Buni xotiramga muhrladim: "${learnedFact.subject} — ${learnedFact.object}"`;

    const isFormal = this.memory.dialogueState.register !== "informal";
    const taskInfo = this.taskUnderstanding.understand(text, this.memory.dialogueState);
    if (taskInfo.primaryTask === TASK_TYPES.EMPATHY_CARE) {
      const empathyResult = this.synthesizeEmpathyCare(text, isFormal, taskInfo);
      return {
        reply: empathyResult.reply,
        intent: "insoniy_empatiya",
        confidence: 99,
        toolUsed: "EmpathyCareEngine",
        reasoning,
        learned: learnedFact || learnedUser,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    const mathResult = this.tryMathTool(text);
    if (mathResult) {
      return {
        reply: mathResult.reply,
        intent: "kalkulyator_tool",
        confidence: 100,
        toolUsed: "MathCalculator",
        reasoning,
        learned: learnedFact || learnedUser,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    const timeResult = this.tryTimeTool(text);
    if (timeResult) {
      return {
        reply: timeResult.reply,
        intent: "vaqt_tool",
        confidence: 100,
        toolUsed: "DateTimeClock",
        reasoning,
        learned: learnedFact || learnedUser,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }


    const recalled = this.memory.recallFacts(text);
    if (
      recalled.length > 0 &&
      (recalled[0].score >= 3.0 || (recalled[0].score >= 2.0 && (text.includes("nima") || text.includes("haqida") || text.includes("kim"))))
    ) {
      const bestFact = recalled[0].fact;
      const userNamePrefix = this.memory.userProfile.name ? `${this.memory.userProfile.name}, ` : "";
      return {
        reply: `${userNamePrefix}${bestFact.subject.toUpperCase()} — bu ${bestFact.object}.`,
        intent: "kognitiv_bilim",
        confidence: 96,
        toolUsed: "AssociativeMemory",
        reasoning,
        learned: learnedFact || learnedUser,
        userProfile: this.memory.userProfile,
        emotion: emotionAnalysis,
      };
    }

    if (this.rag && typeof this.rag.retrieve === "function" && this.rag.chunks && this.rag.chunks.length > 0) {
      const ragHits = this.rag.retrieve(text, 5);
      const RAG_STOPWORDS = new Set([
        "hisoblanadi", "sanaladi", "bo'lib", "uchun", "bilan", "haqida", "emas", "ham", "esa", "kabi",
        "orqali", "tomonidan", "kerak", "mumkin", "mavjud", "bo'lgan", "qilingan", "o'z", "barcha", "bir", "bu",
        "bo'ladi", "bo'lsa", "qanday", "qaysi", "nima", "qayerda", "qachon", "nega", "sodir", "ber", "bilasan",
        "aytib", "gapir", "nimalarni", "haqidagi", "qiladi", "qilish", "iborat", "tashkil", "etadi", "etgan",
        "etilgan", "deb", "ataladi", "so'zi", "so'zlardan", "fan", "fani", "ma'nosi", "qancha", "necha",
        "asosiy", "vazifalari", "bo'yicha", "nimani", "nimalardan"
      ]);
      const contentMatchedWords = (ragHits[0]?.matchedWords || []).filter((w) => !RAG_STOPWORDS.has(w.toLowerCase()));
      const isStrongRagHit = ragHits.length > 0 && contentMatchedWords.length >= 1 && ragHits[0].score >= 0.20;
      if (isStrongRagHit) {
        const topChunk = ragHits[0].chunk;
        const ragScore = Math.round(ragHits[0].score * 100);
        let reply = "";
        if (typeof this.rag.synthesizeAnswer === "function") {
          const synth = this.rag.synthesizeAnswer(text, ragHits);
          reply = synth.reply;
          if (synth.deductionType && synth.deductionType !== "none") {
            reasoning.steps.push(`Deduktiv mantiq turi: ${synth.deductionType}`);
          }
        } else {
          const isFormal = this.memory.dialogueState.register !== "informal";
          reply = isFormal
            ? `O'rganilgan «${topChunk.docTitle}» hujjati bo'yicha: «${topChunk.text}».`
            : `O'rganilgan «${topChunk.docTitle}» hujjatidan: «${topChunk.text}».`;
        }
        return {
          reply,
          intent: "rag_bilim",
          confidence: Math.max(ragScore, 90),
          toolUsed: "DocumentRAGEngine",
          reasoning,
          learned: learnedFact || learnedUser,
          userProfile: this.memory.userProfile,
          emotion: emotionAnalysis,
        };
      }
    }

    const analysis = this.analyzer.analyze(text);
    const category = analysis.predictedCategory;
    const confidence = analysis.confidence;

    const finalReplyRaw = this.generativeSynthesizer.generateDialogueReply(
      text,
      category,
      emotionAnalysis.primaryEmotion,
      this.memory.userProfile,
      this.memory.dialogueState,
      this.embeddings,
      this.generator,
      this.knowledgeBase
    );

    let finalReply = finalReplyRaw;
    if (learnedNote) finalReply = `${learnedNote}\n\n${finalReply}`;

    return {
      reply: finalReply,
      intent: category,
      confidence,
      toolUsed: null,
      reasoning,
      learned: learnedFact || learnedUser,
      userProfile: this.memory.userProfile,
      emotion: emotionAnalysis,
    };
  }

  /**
   * Kognitiv xotiradan o'rganilgan fakt bo'yicha tabiiy, ravon va kontekstga mos javob sintez qilish
   * Qayta-qayta robotcha "Xotiramda saqlangan: ..." demasdan, savolning turiga mos javob hosil qiladi
   */
  synthesizeLearnedFactResponse(query, fact, isFormal = true) {
    const raw = (query || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");
    const subject = fact.subject.trim();
    const capSubject = this._capitalize(subject);
    const object = fact.object.trim();

    // 1. Shaxsiy preferensiya yoki foydalanuvchi ma'lumotlari ("sevimli taomim", "sevimli mashinam")
    if (subject.startsWith("sevimli ")) {
      const item = subject.replace(/^sevimli\s+/i, "");
      return `Sizning sevimli ${item}ingiz — ${object}.`;
    }

    // 2. "Bilasanmi?", "Eslaysanmi?", "Xotirlaysanmi?" savollari (Epistemic Recall)
    if (/\b(?:bilasanmi|eslaysanmi|yodingdami|esingdami|bilasizmi|eslaysizmi)\b/i.test(lower)) {
      return isFormal
        ? `Albatta, ${subject} — bu ${object} hisoblanadi.`
        : `Albatta, ${subject} — bu ${object}.`;
    }

    // 3. Ta'rif / Tushuntirish savollari ("nima", "nimaligini", "qanday", "qanaqa", "haqida", "ayt")
    if (/\b(?:nima|nimani|nimaligini|qanday|qanaqa|tushunchasi|ta'rifi|haqida|ayt|ayting|tushuntir|gapir)\b/i.test(lower)) {
      return isFormal
        ? `${capSubject} — bu ${object} hisoblanadi.`
        : `${capSubject} — bu ${object}.`;
    }

    // 4. Tasdiq yoki Inkor savollari (Polar Questions: "...mi?", "...emasmi?", "...to'g'rimi?")
    const isPolarQuery = /\b([a-zа-яёo'g']+)(?:mi|masmi|emasmi)\b/i.test(lower) ||
                         /\b(?:to'g'rimi|shundaymi|rostmi|emasmi)\b/i.test(lower);

    if (isPolarQuery) {
      const polarMatch = lower.match(/\b([a-zа-яёo'g'\s]+?)(?:mi|masmi|emasmi)\b/i);
      if (polarMatch) {
        let queriedAttr = polarMatch[1].trim();
        // Subyekt so'zini boshidan olib tashlaymiz
        queriedAttr = queriedAttr.replace(new RegExp(`^${subject}\\s*`, "i"), "").replace(/^(?:bu\s+|bir\s+)/i, "").trim();

        if (queriedAttr.length > 0 && queriedAttr !== subject) {
          const objLower = object.toLowerCase();
          const attrWords = queriedAttr.split(/\s+/).filter(w => w.length >= 2);

          const hasContradictoryWord = attrWords.some(w => {
            const cleanW = w.replace(/(?:lar|dir|ning|ga|da|dan|i|si)$/i, "");
            return !objLower.includes(w) && !objLower.includes(cleanW) && cleanW.length >= 3;
          });

          const hasMatchingWord = attrWords.some(w => {
            const cleanW = w.replace(/(?:lar|dir|ning|ga|da|dan|i|si)$/i, "");
            return objLower.includes(w) || (cleanW.length >= 3 && objLower.includes(cleanW));
          });

          const cleanObject = object.replace(/\s*(?:hisoblanadi|sanaladi)\.?$/i, "").trim();
          const endsWithDir = /(?:dir|tir)$/i.test(cleanObject);
          const objectPhrase = endsWithDir ? `${cleanObject}.` : `${cleanObject} hisoblanadi.`;

          if (!hasContradictoryWord && hasMatchingWord) {
            return isFormal
              ? `Ha, ${subject} — ${objectPhrase}`
              : `Ha, ${subject} — ${cleanObject}.`;
          } else if (hasContradictoryWord) {
            return isFormal
              ? `Yo'q, ${subject} ${queriedAttr} emas, u — ${objectPhrase}`
              : `Yo'q, ${subject} ${queriedAttr} emas, u — ${cleanObject}.`;
          }
        }
      }

      const cleanObject = object.replace(/\s*(?:hisoblanadi|sanaladi)\.?$/i, "").trim();
      const endsWithDir = /(?:dir|tir)$/i.test(cleanObject);
      const objectPhrase = endsWithDir ? `${cleanObject}.` : `${cleanObject} hisoblanadi.`;

      return isFormal
        ? `Ha, ${subject} — ${objectPhrase}`
        : `Ha, ${subject} — ${cleanObject}.`;
    }

    // 5. Boshqa barcha holatlarda toza, tabiiy fakt ifodasi
    const cleanObject = object.replace(/\s*(?:hisoblanadi|sanaladi)\.?$/i, "").trim();
    const endsWithDir = /(?:dir|tir)$/i.test(cleanObject);
    const objectPhrase = endsWithDir ? `${cleanObject}.` : `${cleanObject} hisoblanadi.`;

    return isFormal
      ? `${capSubject} — bu ${objectPhrase}`
      : `${capSubject} — bu ${cleanObject}.`;
  }

  /**
   * Insoniy holatlar va empatiya bo'yicha samimiy, tirik va g'amxo'r javob sintez qilish
   * Quruq qotib qolgan dataset jumlalarisiz, har bir holatga insoniy iliqlik bilan yondashadi
   * @param {string} text
   * @param {boolean} isFormal
   * @param {Object} taskInfo
   * @returns {{ reply: string, type: string }}
   */
  synthesizeEmpathyCare(text, isFormal = true, taskInfo = {}) {
    const raw = (text || "").trim();
    const userName = (this.memory && this.memory.userProfile && this.memory.userProfile.name) ? this.memory.userProfile.name : "";
    const namePrefix = userName ? `${userName}, ` : "";

    const empathyType = (taskInfo && taskInfo.metadata && taskInfo.metadata.empathyType) || "fatigue";

    if (empathyType === "fatigue") {
      const formalOptions = [
        `${namePrefix}Anchagina charchabsiz. Iltimos, biroz dam oling, o'zingizni asrang. Bir piyola issiq choy ichib, nafas rostlab olish ayni muddao bo'ladi. Sog'ligingiz har doim birinchi o'rinda!`,
        `${namePrefix}Juda ko'p mehnat qilib toliqibsiz. Hozir barcha ishlarni bir chetga surib, xotirjam hordiq chiqarishingizni tavsiya qilaman. O'zingizni ehtiyot qiling!`,
        `${namePrefix}Charchoq — bu tananing quvvat to'plashga ehtiyoji borligidan dalolat. Biroz mizg'ib oling yoki tinch muhitda dam oling, kuchingiz tezda tiklanadi.`
      ];
      const informalOptions = [
        `${namePrefix}Anchagina charchabsan, do'stim. Hozir biroz dam ol, ko'zingni ekrandan uzib nafas rostla. Bir piyola choy ichib, hordiq chiqarsang kuching tezda tiklanadi!`,
        `${namePrefix}Rosa toliqibsan, do'stim. O'zingni ko'p zo'riqtirma, biroz yotib dam ol yoki toza havoda nafas ol. Sog'liging eng muhimi!`,
        `${namePrefix}Charchagan bo'lsang, ishlarni to'xtatib biroz hordiq chiqar. O'zingni asra, do'stim!`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "charchoq_dam" };
    }

    if (empathyType === "pain") {
      const formalOptions = [
        `${namePrefix}Sog'ligingiz bezovta qilayotganidan xavotirdaman. Iltimos, darhol dam oling, ko'proq iliq suyuqlik iching va agar zarur bo'lsa, mutaxassis shifokor maslahatini oling. Tezroq sog'ayib keting!`,
        `${namePrefix}Og'riq bezovta qilayotgan bo'lsa, aslo e'tiborsiz qoldirmang. Biroz dam oling, issiq choy iching va o'zingizni asrang. Tez orada o'zingizga kelib qolishingizni tilayman!`
      ];
      const informalOptions = [
        `${namePrefix}Tezroq sog'ayib ket, do'stim! O'zingni asra, darhol yotib dam ol va iliq choy ich. Og'riq o'tib ketadi!`,
        `${namePrefix}Betob bo'lib qolganingdan xavotirdaman. O'zingni ko'p zo'riqtirma, issiqroq kiyinib dam ol. Tezroq tuzalib ketishingni tilayman!`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "salomatlik_ogriq" };
    }

    if (empathyType === "distress") {
      const formalOptions = [
        `${namePrefix}Kayfiyatingiz tushganidan afsusdaman. Ba'zan shunday og'ir kunlar bo'lib turadi, lekin unutmang: barcha qiyinchiliklar vaqtinchalik. Xohlasangiz, sizni tinglashga va fikrlaringizni bo'lishishga doim tayyorman.`,
        `${namePrefix}Ko'nglingizni cho'ktirmang. Har qanday qorong'u tundan keyin yorug' kun keladi. Nafas rostlab, tinchlanib oling, hammasi yaxshi bo'ladi!`
      ];
      const informalOptions = [
        `${namePrefix}Ko'nglingni cho'ktirma, do'stim! Har qanday qiyin vaziyat albatta o'tib ketadi. Biror narsa haqida gaplashging kelsa, men doim yoningdaman!`,
        `${namePrefix}Siqilma, do'stim! Barchasi o'z joyiga tushadi. Keling, birgalikda ijobiy narsalar haqida gaplashamiz, men seni doim qo'llab-quvvatlayman.`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "ruhiy_dalda" };
    }

    if (empathyType === "boredom") {
      const formalOptions = [
        `${namePrefix}Zerikish — yangi va foydali mashg'ulot boshlash uchun ajoyib fursat! Qiziqarli ilmiy mavzuda suhbatlashamizmi, mantiqiy jumboq yechamizmi yoki yangi biror narsa o'rganamizmi?`,
        `${namePrefix}Vaqtingizni maroqli o'tkazish uchun nima haqida suhbatlashishni xohlaysiz? Qiziqarli savol bering yoki biror mavzuni tanlang, bajonidil davom ettiramiz!`
      ];
      const informalOptions = [
        `${namePrefix}Zerikdingmi? Keling, biror qiziqarli mantiqiy jumboq yechamiz, dasturlash yoki yangi bir mavzu haqida gaplashamiz. Nima haqida gaplashamiz?`,
        `${namePrefix}Zerikkanda miyani yangi bilimlar bilan quvvatlash zo'r yechim! Qiziqarli jumboq xohlaysanmi yoki biror mavzu bo'yicha fikr almashamizmi?`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "zerikish_faollik" };
    }

    if (empathyType === "sleep") {
      const formalOptions = [
        `${namePrefix}Maroqli hordiq chiqaring va yaxshi dam oling! Tungi uyqu sizga yangi quvvat va tiniq fikr baxsh etsin. Xayrli tun!`,
        `${namePrefix}Yaxshi dam oling, o'zingizni ehtiyot qiling. Ertangi kuningiz muvaffaqiyatli va unumli bo'lsin!`
      ];
      const informalOptions = [
        `${namePrefix}Yaxshi dam ol, do'stim! Ko'zlaringni dam oldir va shirin tushlar ko'r. Ertaga yangi kuch bilan suhbatlashamiz!`,
        `${namePrefix}Xayrli tun, do'stim! Yaxshilab mizg'ib ol, ertaga yana ajoyib yangiliklar ustida ishlaymiz!`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "uyqu_dam" };
    }

    if (empathyType === "joy") {
      const formalOptions = [
        `${namePrefix}Ko'tarinki kayfiyatingizdan men ham chin dildan xursandman! Bunday ajoyib va ijobiy energiya sizni aslo tark etmasin! Bugun yana nimalar ustida ishlaymiz?`,
        `${namePrefix}Ajoyib yangilik! Xush kayfiyatingiz bardavom bo'lsin. Har qanday yangi maqsadni amalga oshirishga tayyorman!`
      ];
      const informalOptions = [
        `${namePrefix}Kayfiyating zo'rligidan juda xursandman, do'stim! Ajoyib energiya! Qani, bugun yana qanday yangiliklarni zabt etamiz?`,
        `${namePrefix}Qoyil, kayfiyating a'lo darajada! Bunday quvvat bilan har qanday qiyin masalani osongina hal qilish mumkin!`
      ];
      const options = isFormal ? formalOptions : informalOptions;
      return { reply: options[Math.floor(Math.random() * options.length)], type: "quvonch_hamfikrlik" };
    }

    return {
      reply: isFormal
        ? `${namePrefix}Sizni tushunib turibman. O'zingizni asrang va sog'ligingizga e'tiborli bo'ling. Men sizga qanday yordam bera olaman?`
        : `${namePrefix}Seni tushunaman, do'stim. O'zingni asra! Qanday yordam bera olaman?`,
      type: "umumiy_empatiya"
    };
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = SmartChatbot;
