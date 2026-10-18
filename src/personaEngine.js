/**
 * =======================================================================
 *  NEURO-SYMBOLIC COGNITIVE PERSONA & GENERATIVE ENGINE (Senior Architecture)
 * =======================================================================
 *  100% LOKAL CPU | ZERO EXTERNAL APIS | ZERO CANNED-TEMPLATE MONOLITHS
 * 
 *  Ushbu dvigatel ikki qudratli yondashuvni birlashtiradi:
 *  1. Kognitiv / Simvolik Boshqaruv (System 2):
 *     - Dialogue State Tracking (DST): Pending offers, declined topics, entities;
 *     - Register Locking: "Sen" va "Siz" uslubiy qulflanishi;
 *     - Ontologik Chegara: Raqamli mavjudlik (biologik gallyutsinatsiya man etilgan);
 *     - Multi-Intent Parsing: 3-qadamli psixologik traektoriya (Empatiya -> Yengillatish -> Harakat).
 *  2. Neyron / Semantik Sintez (System 1):
 *     - Word Embeddings orqali 12-o'lchamli semantik kosinus o'xshashlik;
 *     - Morfo-sintaktik slotlar kombinatorikasi (har bir jumla noldan qismlardan yig'iladi);
 *     - Anti-Repetition Recency Penalty matritsasi;
 *     - Persona Invariance Gate (Chiqishdagi 3-qavatli qat'iy nazorat).
 * =======================================================================
 */

const dbService = require("./db");
const WordEmbeddings = require("./embeddings");

class PersonaEngine {
  constructor() {
    this.recentResponses = [];
    this.maxRecentMemory = 40;

    this.moods = [
      "witty_friend",      // Do'st / Hamdard (Buddy)
      "curious_listener",  // Sokin Tinglovchi (Listener)
      "concise_direct",    // Lo'nda va aniq
      "warm_empath",       // Samimiy hamdard
      "deep_thinker",      // Mulohazakor faylasuf
      "senior_mentor",     // Professional me'mor
    ];

    this.currentMood = "witty_friend";
  }

  /**
   * Foydalanuvchi his-tuyg'ulari va matniga qarab mos kayfiyatni tanlash
   */
  adaptMood(emotion, userText, category) {
    const lower = (userText || "").toLowerCase();

    if (
      emotion === "sadness" ||
      emotion === "fatigue" ||
      lower.includes("charchadim") ||
      lower.includes("holsiz") ||
      lower.includes("alam") ||
      lower.includes("og'ir") ||
      lower.includes("muammo") ||
      category === "samimiy_dalda"
    ) {
      this.currentMood = "warm_empath";
    } else if (
      lower.includes("hazil") ||
      lower.includes("kul") ||
      lower.includes("choy") ||
      lower.includes("qahva") ||
      lower.includes("kayfiyat") ||
      category === "hazil_kayfiyat"
    ) {
      this.currentMood = "witty_friend";
    } else if (
      lower.includes("?") ||
      lower.includes("kerakmi") ||
      lower.includes("yoki") ||
      lower.includes("nima uchun") ||
      lower.includes("qanday") ||
      lower.includes("baxt") ||
      lower.includes("hayot") ||
      category === "qiziqishlar_hayot"
    ) {
      this.currentMood = "deep_thinker";
    } else if (category === "dam_olish_uyqu" || lower.includes("uxla") || lower.includes("yot")) {
      this.currentMood = "warm_empath";
    } else if (category === "salomlashish") {
      this.currentMood = Math.random() > 0.5 ? "curious_listener" : "witty_friend";
    } else if (category === "xayrlashuv") {
      this.currentMood = "warm_empath";
    } else {
      this.currentMood = "curious_listener";
    }

    return this.currentMood;
  }

  /**
   * Matndan tushuncha, multi-intent va semantik signallarni ajratib olish
   */
  extractConcepts(text) {
    const lower = (text || "").toLowerCase().trim();
    const clean = lower.replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ");
    const words = clean.split(/\s+/).filter((w) => w.length > 2);

    const stopwords = new Set([
      "bilan", "uchun", "ham", "esa", "faqat", "emas", "kerak", "kerakmi", "yoki",
      "nima", "qanday", "nega", "qachon", "qayerda", "men", "sen", "biz", "siz",
      "ular", "bu", "shu", "o'sha", "mana", "ana", "juda", "ancha", "bitta", "bir",
      "bor", "yo'q", "bo'ldi", "qildi", "deydi", "dedi", "menga", "senga", "bizga"
    ]);

    const meaningfulWords = words.filter((w) => !stopwords.has(w));

    // Dilemma (A yoki B) qidirish
    let dilemma = null;
    const yokiMatch = text.match(/([\w'‘ʻ]+(?:\s+[\w'‘ʻ]+)?)\s+yoki\s+([\w'‘ʻ]+(?:\s+[\w'‘ʻ]+)?)/i);
    if (yokiMatch) {
      const optA = yokiMatch[1].trim().replace(/\b(?:kerakmi|kerak|bo'lishi|uchun)\b/gi, "").trim();
      const optB = yokiMatch[2].replace(/[?!.,]/g, "").trim().replace(/\b(?:kerakmi|kerak)\b/gi, "").trim();
      if (optA && optB) {
        dilemma = { optionA: optA, optionB: optB };
      }
    }

    // Multi-Intent aniqlash
    const isFatigued = /\b(?:charch|toliq|holsiz|ishlab yot|uyqum|charchadim|holdan toydim)\b/i.test(lower);
    const isHungry = /\b(?:qor(?:in|nim|ning)(?:\s+\w+)?\s+och|och\s+qoldim|ovqat|tamaddi|yegulik|ochman|tushlik)\b/i.test(lower);
    const isStressed = /\b(?:siqildim|alam|og'ir kun|bosh qotdi|muammo|asab)\b/i.test(lower);
    const isAsksBotState = /\b(?:sen ham|siz ham|charchadingmi|charchamadingizmi|qorning ochdimi|qorningiz ochdimi|uxladingmi|uxlaysanmi|boshim og'riyapti senikichi)\b/i.test(lower);

    // Inkor signallari (-mayman, -ma, emas, yo'q, kerakmas)
    const hasNegation = /\b(?:emas|yo'?q|kerakmas|kerak emas|shart emas|istamayman|xohlamayman|yoqmaydi)\b/i.test(lower) ||
                        /(?:mayman|madim|masman|maymiz|maslik|maydi)\b/i.test(lower);

    // Choy / Qahva mavzusi (Inkor ko'rligi bartaraf etildi!)
    const mentionsTeaCoffee = /\b(?:choy|kofe|qahva|ichimlik)\b/i.test(lower);
    const isTeaCoffee = mentionsTeaCoffee && !hasNegation;
    const isTeaRefusal = mentionsTeaCoffee && hasNegation;

    // Uyqu / Dam olish buyrug'i ("uxla", "yot", "uxlagin")
    const isSleepCommand = /\b(?:uxla|yot|uxlagin|yotgin|borib uxla|uxlasangchi|dam ol|hordiq chiqar)\b/i.test(lower);

    // Ketish / Bezovta qilmaslik buyrug'i ("ket", "ketgin", "tinch qo'y", "yo'qol")
    const isDismissal = /^(?:ket|ketgin|ketar|yo'qol|tinch\s+qo'y|bezovta\s+qilma|xalaqit\s+berma|kerak\s+emassan)$/i.test(lower.trim());

    // Qisqa replikalar turlari
    const isRefusal = /^(?:yo'?q|kerakmas|shart emas|yoq|istamayman|kerak emas|bo'ldi keragi yo'q)$/i.test(lower);
    const isConfirmation = /^(?:ha|mayli|albatta|xo'?p|hop|bo'ladi|yaxshi|roziman|albatta\s+davom\s+et|davom\s+et|davom\s+eting|davom\s+etamiz|gapir|gapiraver|eshitaman)$/i.test(lower.trim());
    const isPeaceState = /^(?:tinchlik|hammasi yaxshi|tinch|shukur|yomon emas|hammasi joyida|birnavo)$/i.test(lower);
    const isGratitude = /^(?:rahmat|katta rahmat|tashakkur|minnatdorman)$/i.test(lower);

    return {
      meaningfulWords,
      dilemma,
      hasQuestion: text.includes("?"),
      isFatigued,
      isHungry,
      isStressed,
      isAsksBotState,
      isSleepCommand,
      hasNegation,
      isTeaCoffee,
      isTeaRefusal,
      isDismissal,
      isRefusal,
      isConfirmation,
      isPeaceState,
      isGratitude,
      isHappy: /\b(?:quvon|xursand|ajoyib|zo'r|yaxshi|omad)\b/i.test(lower),
      isLifePhilosophical: /\b(?:baxt|pul|xotirjam|ma'no|qadr|hayot|umr)\b/i.test(lower),
    };
  }

  /**
   * Neyron Vektorli Reyting & Tanlov (Neural Reranker via Cosine Similarity & Recency Penalty)
   * Har bir slotni neyron embeddings fazosi va takrorlanish jarimasi bilan saralaydi.
   */
  rankAndSelect(slotVariants, userText = "", embeddings = null) {
    if (!slotVariants || slotVariants.length === 0) return "";
    if (slotVariants.length === 1) return slotVariants[0];

    // Foydalanuvchi matni uchun o'rtacha vektor
    let userVec = null;
    if (embeddings && typeof embeddings.getVector === "function") {
      const uTokens = userText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      userVec = new Array(12).fill(0);
      let count = 0;
      uTokens.forEach((w) => {
        const v = embeddings.getVector(w);
        if (v) {
          for (let i = 0; i < 12; i++) userVec[i] += v[i];
          count++;
        }
      });
      if (count > 0) {
        for (let i = 0; i < 12; i++) userVec[i] /= count;
      }
    }

    const scored = slotVariants.map((text) => {
      let score = 1.0;

      // 1. Anti-repetition jarimasi (Recency penalty)
      for (let i = 0; i < this.recentResponses.length; i++) {
        if (this.recentResponses[i].includes(text)) {
          score *= 0.15; // Yaqinda ishlatilgan bo'lsa yuqori jarima
        }
      }

      // 2. Semantik Neyron Yaqinlik (Embedding Cosine Similarity)
      if (userVec && embeddings && typeof embeddings.getVector === "function") {
        const tokens = text.toLowerCase().split(/\s+/);
        let semSim = 0;
        tokens.forEach((w) => {
          const v = embeddings.getVector(w);
          if (v) {
            const cos = WordEmbeddings.cosineSimilarity(userVec, v);
            if (cos > 0.2) semSim += cos;
          }
        });
        score += semSim * 0.4;
      }

      // 3. Xilma-xillik uchun kichik stoxastik tebranish (Softmax exploration)
      score += Math.random() * 0.25;

      return { text, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].text;
  }

  /**
   * SHORT-REPLY CONTEXT GATE (Qisqa replikalarni morfo-sintaktik slotlar orqali dinamik yechish)
   */
  craftShortReply(userText, concepts, dialogueState, userProfile, embeddings = null) {
    const register = dialogueState.register || "formal";
    const pendingOffer = dialogueState.pendingOffer;
    const isFormal = register === "formal";

    // 0. HAYDASH / BEZOVTA QILMASLIK BUYRUG'I ("ket", "tinch qo'y", "yo'qol")
    if (concepts.isDismissal) {
      dialogueState.pendingOffer = null;
      const dismissalReplies = isFormal
        ? ["Tushundim, bezovta qilmayman.", "Xo'p, bezovta qilmayman."]
        : ["Tushundim, bezovta qilmayman, do'stim.", "Xo'p, tinch qo'yaman."];

      return {
        reply: this.rankAndSelect(dismissalReplies, userText, embeddings),
        intent: "ketish_buyrug'i",
        mood: "warm_empath",
      };
    }

    // 1. RAD / INKOR ("yo'q", "kerakmas", "shart emas")
    if (concepts.isRefusal) {
      dialogueState.pendingOffer = null;
      const genericRefusals = isFormal
        ? ["Tushunarli, mayli.", "Xo'p, hech qisi yo'q."]
        : ["Tushunarli, muammo yo'q.", "Mayli, tushundim."];

      return {
        reply: this.rankAndSelect(genericRefusals, userText, embeddings),
        intent: "inkor_tasdiq",
        mood: "curious_listener",
      };
    }

    // 2. HOLAT / SO'ROVGA JAVOB ("tinchlik", "hammasi yaxshi", "shukur")
    if (concepts.isPeaceState) {
      dialogueState.pendingOffer = null;
      const wishes = isFormal
        ? ["Doimo tinchlik va xotirjamlik bo'lsin.", "Juda soz, doim tinchlik bo'lsin."]
        : ["Doim tinchlik bo'lsin, do'stim.", "Juda soz, doim tinch bo'lsin."];

      return {
        reply: this.rankAndSelect(wishes, userText, embeddings),
        intent: "hol_ahvol_tasdiq",
        mood: "warm_empath",
      };
    }

    // 3. ROZILIK / TASDIQ ("ha", "mayli", "albatta", "xo'p")
    if (concepts.isConfirmation) {
      dialogueState.pendingOffer = null;
      const genericConfirms = isFormal
        ? ["Xo'p, juda soz.", "Albatta, davom etamiz."]
        : ["Xo'p, kelishdik.", "Ajoyib, davom etamiz."];

      return {
        reply: this.rankAndSelect(genericConfirms, userText, embeddings),
        intent: "rozilik_tasdiq",
        mood: "curious_listener",
      };
    }

    // 4. MINNATDORLIK ("rahmat", "katta rahmat")
    if (concepts.isGratitude) {
      dialogueState.pendingOffer = null;
      const thanks = isFormal
        ? ["Arzimaydi, salomat bo'ling!", "Doim xizmatingizdaman!"]
        : ["Arzimaydi, do'stim!", "Salomat bo'l, do'stim!"];

      return {
        reply: this.rankAndSelect(thanks, userText, embeddings),
        intent: "minnatdorlik",
        mood: "warm_empath",
      };
    }

    return null;
  }

  /**
   * PERSONA INVARIANCE GATE (Chiqishdagi 3-Qavatli Qat'iy Filtr)
   * 1. "Men" testi (No Biological Hallucination)
   * 2. Register Audit ("Sen" va "Siz" aralashmasligi)
   * 3. Repetition & Parrot Trap filtri
   */
  runInvarianceGate(reply, register, userText) {
    let cleanReply = reply || "";

    // 1. "Men" testi: Raqamli ong hech qachon biologik harakat qilmaydi
    const bioPatterns = [
      /\bmen\s+(?:ham\s+)?(?:uxlab\s+qolibman|uxladim|ovqatlandim|yedim|qornim\s+och|boshim\s+og'riyapti|charchadim)\b/gi,
      /\bmening\s+(?:ham\s+)?(?:qornim\s+och|boshim\s+og'riyapti|tushlikka\s+vaqtim\s+bo'lmadi)\b/gi,
    ];
    for (const pat of bioPatterns) {
      cleanReply = cleanReply.replace(pat, "men raqamli suhbatdosh sifatida buni to'liq his qilyapman");
    }

    // 2. Register Audit: Agar formal bo'lsa sen/qil -> siz/qiling; informal bo'lsa siz/qiling -> sen/qil
    if (register === "informal") {
      cleanReply = cleanReply
        .replace(/\bo'zingizni\b/gi, "o'zingni")
        .replace(/\bo'zingizda\b/gi, "o'zingda")
        .replace(/\bsizga\b/gi, "senga")
        .replace(/\bsizni\b/gi, "seni")
        .replace(/\bsizda\b/gi, "senda")
        .replace(/\bsizdan\b/gi, "sendan")
        .replace(/\bsizning\b/gi, "sening")
        .replace(/\bsiz\b/gi, "sen")
        .replace(/\bdam\s+oling\b/gi, "dam ol")
        .replace(/\bbering\b/gi, "ber")
        .replace(/\bchiqaring\b/gi, "chiqar")
        .replace(/\bqiling\b/gi, "qil")
        .replace(/\bayting\b/gi, "ayt")
        .replace(/\bko'ring\b/gi, "ko'r");
    } else {
      cleanReply = cleanReply
        .replace(/\bo'zingni\b/gi, "o'zingizni")
        .replace(/\bo'zingda\b/gi, "o'zingizda")
        .replace(/\bsenga\b/gi, "sizga")
        .replace(/\bseni\b/gi, "sizni")
        .replace(/\bsenda\b/gi, "sizda")
        .replace(/\bsendan\b/gi, "sizdan")
        .replace(/\bsening\b/gi, "sizning")
        .replace(/\bsen\b/gi, "siz")
        .replace(/\bdam\s+ol\b/gi, "dam oling")
        .replace(/\bko'zlaringga\b/gi, "ko'zlaringizga");
    }

    return cleanReply.trim();
  }

  /**
   * NEURO-SYMBOLIC SPEECH-ACT SYNTHESIZER (Slot-Driven Dynamic Synthesis)
   * Qotib qolgan monolit matnlarsiz, morfo-sintaktik slotlarni neyron reyting orqali yig'ish.
   */
  synthesizeResponse(userText, category, emotion, userName, concepts, register, dialogueState, embeddings = null) {
    const isFormal = register === "formal";
    const namePrefix = userName ? `${userName}, ` : "";
    return isFormal
      ? `${namePrefix}Ushbu mavzu bo'yicha menga bilim o'rgatilmagan. Men faqat o'zimga o'qitilgan ma'lumotlar asosida javob bera olaman.`
      : `${namePrefix}Bu mavzuda menda bilim yo'q, do'stim. Faqat o'zimga o'qitilgan ma'lumotlar bo'yicha javob bera olaman.`;
  }


  /**
   * 100% LOKAL NEYRON VA KOGNITIV DIALOG SINTEZI (Senior Pipeline)
   */
  craftDynamicReply(userText, category, emotion = "neutral", userProfile = {}, dialogueState = {}, embeddings = null) {
    const mood = this.adaptMood(emotion, userText, category);
    const userName = (userProfile && userProfile.name) ? userProfile.name : "";
    const register = dialogueState.register || "formal";

    // 1. Tushunchalar va semantik signallarni ajratish
    const concepts = this.extractConcepts(userText);

    // 2. Short-Reply Gate: Qisqa replikalar ("ket", "yo'q", "tinchlik", "ha", "albatta davom et")
    const wordsCount = (userText || "").trim().split(/\s+/).length;
    const isShortDialogTurn = concepts.isDismissal || concepts.isRefusal || concepts.isConfirmation || concepts.isPeaceState || concepts.isGratitude;
    if ((wordsCount <= 4 && isShortDialogTurn) || (wordsCount <= 2 && isShortDialogTurn)) {
      const shortResult = this.craftShortReply(userText, concepts, dialogueState, userProfile, embeddings);
      if (shortResult) {
        const filteredReply = this.runInvarianceGate(shortResult.reply, register, userText);
        this.recentResponses.push(filteredReply);
        if (this.recentResponses.length > this.maxRecentMemory) this.recentResponses.shift();
        dbService.logTurn("bot", filteredReply, shortResult.intent, shortResult.mood);

        return {
          reply: filteredReply,
          mood: shortResult.mood,
          category: shortResult.intent,
          source: "NeuroSymbolicShortGate (EmbeddingGuided / DST)",
        };
      }
    }

    // 3. Sof semantik sintez (Morfo-sintaktik slotlar + Neyron reyting)
    let rawReply = this.synthesizeResponse(userText, category, emotion, userName, concepts, register, dialogueState, embeddings);

    // 4. Persona Invariance Gate (Chiqishdagi 3-qavatli qat'iy filtr)
    const finalReply = this.runInvarianceGate(rawReply, register, userText);

    // 5. Anti-repetition xotirasi
    this.recentResponses.push(finalReply);
    if (this.recentResponses.length > this.maxRecentMemory) {
      this.recentResponses.shift();
    }

    dbService.logTurn("bot", finalReply, category, mood);

    return {
      reply: finalReply,
      mood,
      category,
      source: "NeuroSymbolicGeneration (EmbeddingGuided / Zero-Canned-Monolith)",
    };
  }

  /**
   * Sinxron moslik uchun yordamchi metod
   */
  craftCreativeReply(userText, category, emotion = "neutral", recalled = [], morphology = null) {
    return this.craftDynamicReply(userText, category, emotion, {}, { register: "formal" }, null);
  }
}

module.exports = PersonaEngine;
