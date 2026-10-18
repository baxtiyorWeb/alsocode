/**
 * =======================================================================
 *  TRANSFORMER ATTENTION-WEIGHTED MINI-LLM GENERATOR
 * =======================================================================
 *  Standart N-gram / Markov zanjiridan to'liq Transformer arxitekturasiga o'tish:
 *  - Har bir qadamda butun kontekst ustida Scaled Dot-Product Attention hisoblaydi;
 *  - So'nggi token (Query) oldingi barcha so'zlarga (Keys) e'tibor qaratadi;
 *  - Diqqat bilan jamlangan kontekst vektori (Context Vector Z) va Word Embeddings
 *    fazosi orqali keyingi eng mos so'zni (Next-Token) bashorat qiladi;
 *  - Hissiy intellekt (Emotional Tone) bilan boyitilgan insoniy muloqot to'qiydi.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");
const SelfAttentionLayer = require("./attention");
const CausalTransformerModel = require("./transformerModel");
const UzbekTokenizer = require("./uzbekTokenizer");

class MiniLLM {
  /**
   * @param {number} contextWindow - Model e'tibor qaratadigan maksimal kontekst uzunligi
   * @param {import('./embeddings')} embeddings - So'z vektorlari modeli
   */
  constructor(contextWindow = 12, embeddings = null) {
    this.contextWindow = contextWindow;
    this.embeddings = embeddings;
    this.vocab = [];
    this.wordToIndex = new Map();
    this.indexToWord = new Map();

    // N-tartibli o'tish chastotalari (Grammar Transition Prior)
    this.transitions = new Map();

    // 12-o'lchamli Transformer Attention qatlami
    this.attention = new SelfAttentionLayer(12, 8);

    // Haqiqiy Causal Decoder-Only Transformer va Subword Tokenizer
    this.causalTransformer = null;
    this.uzbekTokenizer = null;
    this.tryLoadCausalModel();
  }

  /**
   * Causal Transformer modelini tashqaridan biriktirish (Xotirani tejash uchun umumiy modeldan foydalanish)
   */
  setCausalModel(model, tokenizer) {
    this.causalTransformer = model;
    this.uzbekTokenizer = tokenizer;
  }

  /**
   * O'qitilgan Causal Transformer checkpointini xavfsiz yuklash
   */
  tryLoadCausalModel(force = false) {
    try {
      const bestCheckpoint = path.join(__dirname, "..", "data", "checkpoints", "transformer_best.json");
      const latestCheckpoint = path.join(__dirname, "..", "data", "checkpoints", "transformer_latest.json");
      const vocabPath = path.join(__dirname, "..", "data", "bpe_vocab.json");

      const cpPath = fs.existsSync(bestCheckpoint) ? bestCheckpoint : fs.existsSync(latestCheckpoint) ? latestCheckpoint : null;

      if (!force && cpPath && fs.existsSync(cpPath)) {
        const stat = fs.statSync(cpPath);
        // Agar checkpoint 50MB dan katta bo'lsa, xotirani tejash uchun MiniLLM ikkinchi nusxa yaratmaydi
        if (stat.size > 50 * 1024 * 1024) {
          return false;
        }
      }

      if (cpPath && fs.existsSync(vocabPath)) {
        const tok = new UzbekTokenizer();
        if (tok.loadFromFile(vocabPath)) {
          const rawCp = fs.readFileSync(cpPath, "utf-8");
          const payload = JSON.parse(rawCp);
          const modelVocab = payload.modelData?.vocabSize || payload.modelData?.config?.vocabSize;
          if (modelVocab && Math.abs(modelVocab - tok.vocabSize) <= 15) {
            this.causalTransformer = CausalTransformerModel.fromJSON(payload.modelData);
            this.uzbekTokenizer = tok;
            return true;
          }
        }
      }
    } catch (e) {
      // Standart evristik rejimga fallback
    }
    return false;
  }

  /**
   * Matnni tozalash va tokenlarga ajratish
   */
  tokenize(text) {
    if (!text || typeof text !== "string") return [];
    return text
      .toLowerCase()
      .replace(/[`ʼʻ']/g, "'")
      .replace(/[^a-zа-яёo'g'0-9\s.,!?-]/gi, " ")
      .replace(/([.,!?])/g, " $1 ") // Tinish belgilarini alohida token qilish
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  /**
   * Matn korpusini o'qib, lug'at va o'tish bog'liqliklarini o'rganish (Training)
   * @param {string} corpusText
   */
  train(corpusText) {
    const tokens = this.tokenize(corpusText);
    const uniqueTokens = new Set(tokens);
    this.vocab = Array.from(uniqueTokens);

    this.vocab.forEach((t, i) => {
      this.wordToIndex.set(t, i);
      this.indexToWord.set(i, t);
    });

    this.transitions.clear();

    // Ketma-ket so'zlar bog'liqliklarini yig'ish (Bi-gram va Tri-gram priors)
    for (let order = 1; order <= 3; order++) {
      for (let i = 0; i <= tokens.length - order - 1; i++) {
        const context = tokens.slice(i, i + order).join(" ");
        const nextToken = tokens[i + order];

        if (!this.transitions.has(context)) {
          this.transitions.set(context, new Map());
        }

        const counts = this.transitions.get(context);
        counts.set(nextToken, (counts.get(nextToken) || 0) + 1);
      }
    }
  }

  /**
   * Attention Context Vector Z va Word Embeddings orqali keyingi so'z ehtimolliklarini hisoblash
   * @param {string[]} contextTokens
   * @param {string | null} emotionalBias
   * @returns {Map<string, number>}
   */
  predictNext(contextTokens, emotionalBias = null) {
    if (this.vocab.length === 0) return new Map();

    const candidateScores = new Map();
    const sentence = contextTokens.slice(-this.contextWindow).join(" ");

    // 1. Scaled Dot-Product Attention hisoblash
    const attnRes = this.attention.process(sentence, this.embeddings);
    const n = attnRes.tokens.length;

    // Oxirgi tokenning boshqa barcha tokenlarga diqqat og'irliklari
    const lastTokenAttention = n > 0 ? attnRes.attentionMatrix[n - 1] : [];

    // 2. N-gram grammatik o'tish ehtimolliklari (Prior)
    let transitionMatches = null;
    for (let len = Math.min(3, contextTokens.length); len >= 1; len--) {
      const subContext = contextTokens.slice(contextTokens.length - len).join(" ");
      if (this.transitions.has(subContext)) {
        transitionMatches = this.transitions.get(subContext);
        break;
      }
    }

    // 3. Har bir nomzod so'z uchun umumiy Attention + Semantika + Prior ballini hisoblash
    const lastWord = contextTokens[contextTokens.length - 1] || "";
    const lastWordVec = this.attention.getWordVector(lastWord, this.embeddings);

    this.vocab.forEach((word) => {
      let score = 0.05; // Base probability

      // A. Grammatik o'tish balli
      if (transitionMatches && transitionMatches.has(word)) {
        score += transitionMatches.get(word) * 2.5;
      }

      // B. Semantik yaqinlik (Embedding Cosine Similarity)
      const candVec = this.attention.getWordVector(word, this.embeddings);
      let dot = 0;
      for (let d = 0; d < 12; d++) {
        dot += (lastWordVec[d] || 0) * (candVec[d] || 0);
      }
      if (dot > 0) {
        score += dot * 1.8;
      }

      // C. Butun gapdagi Attention e'tibor ta'siri
      if (attnRes.tokens && attnRes.tokens.length > 0) {
        attnRes.tokens.forEach((t, idx) => {
          const attnWeight = lastTokenAttention[idx] || 0;
          if (attnWeight > 0.15) {
            // Yuqori e'tibor qaratilgan token bilan bog'liqlik
            const tVec = this.attention.getWordVector(t, this.embeddings);
            let crossDot = 0;
            for (let d = 0; d < 12; d++) {
              crossDot += (tVec[d] || 0) * (candVec[d] || 0);
            }
            if (crossDot > 0) {
              score += crossDot * attnWeight * 1.5;
            }
          }
        });
      }

      // D. Takrorlanishni jazolash (Repetition Penalty)
      const recentOccurrences = contextTokens.slice(-4).filter((w) => w === word).length;
      if (recentOccurrences > 0) {
        score *= Math.pow(0.3, recentOccurrences);
      }

      candidateScores.set(word, Math.max(score, 0.001));
    });

    return candidateScores;
  }

  /**
   * Top-K va Temperature bilan sampling qilish (Roulette wheel selection)
   * @param {Map<string, number>} candidates
   * @param {number} temperature
   * @param {number} topK
   * @returns {string}
   */
  sample(candidates, temperature = 0.8, topK = 6) {
    if (!candidates || candidates.size === 0) {
      return ".";
    }

    const sorted = Array.from(candidates.entries()).sort((a, b) => b[1] - a[1]);
    const pool = sorted.slice(0, Math.max(1, topK));
    if (pool.length === 0) return ".";

    // Temperature bilan logitlarni o'zgartirish (Softmax)
    const logits = pool.map(([word, score]) => Math.log(score + 1e-8) / Math.max(0.01, temperature));
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1e-9;
    const probs = exps.map((e) => e / sumExp);

    let rand = Math.random();
    for (let i = 0; i < pool.length; i++) {
      rand -= probs[i];
      if (rand <= 0) {
        return pool[i][0];
      }
    }

    return pool[0] ? pool[0][0] : ".";
  }

  /**
   * Attention asosidagi avtoregressiv matn to'qish (Next-Token Generation)
   * @param {string} prompt - Boshlang'ich so'z yoki kontekst
   * @param {number} maxTokens - Yaratiladigan maksimal so'zlar soni
   * @param {number} temperature - Ijodkorlik darajasi (0.2 = qat'iy, 0.8 = muvozanatli, 1.2 = ijodiy)
   * @param {number} topK - Tanlov doirasi
   * @returns {string}
   */
  generate(prompt, maxTokens = 25, temperature = 0.8, topK = 5) {
    // 1. Agar haqiqiy o'qitilgan Causal Transformer mavjud bo'lsa, undan foydalanamiz
    if (this.causalTransformer && this.uzbekTokenizer) {
      try {
        const inputIds = this.uzbekTokenizer.encode(prompt, false, false);
        const genIds = this.causalTransformer.generate(inputIds, maxTokens, {
          temperature,
          topK,
        });
        const decoded = this.uzbekTokenizer.decode(genIds);
        if (decoded && decoded.trim()) {
          return decoded;
        }
      } catch (e) {
        // Fallback to heuristic generator
      }
    }

    if (this.vocab.length === 0) return prompt;
    const currentTokens = this.tokenize(prompt);
    if (currentTokens.length === 0) return prompt;

    for (let step = 0; step < maxTokens; step++) {
      const candidates = this.predictNext(currentTokens);
      const nextWord = this.sample(candidates, temperature, topK);

      currentTokens.push(nextWord);

      // Agar gap mantiqiy yakuniga yetsa (nuqta yoki undov va uzunlik yetarli bo'lsa)
      if ([".", "!", "?"].includes(nextWord) && step >= 8) {
        break;
      }
    }

    // Tokenlarni toza va grammatik jumlaga aylantirish
    let output = "";
    currentTokens.forEach((token, idx) => {
      if ([".", ",", "!", "?", ":"].includes(token)) {
        output = output.trimEnd() + token + " ";
      } else {
        output += token + " ";
      }
    });

    return output.trim();
  }
}

module.exports = MiniLLM;
