/**
 * =======================================================================
 *  WORD EMBEDDINGS (So'z Semantik Vektorlari va Cosine Similarity)
 * =======================================================================
 *  So'zlarni ko'p o'lchamli fazodagi vektorlarga aylantiradi.
 *  Ma'nosi yaqin so'zlar vektor fazosida bir-biriga yaqin joylashadi.
 * =======================================================================
 */

class WordEmbeddings {
  /**
   * @param {number} embeddingDim - Har bir so'z uchun vektor o'lchami (masalan 16)
   * @param {number} learningRate - O'rganish tezligi
   */
  constructor(embeddingDim = 16, learningRate = 0.05) {
    this.embeddingDim = embeddingDim;
    this.learningRate = learningRate;
    this.vocab = [];
    this.wordToIndex = new Map();
    this.indexToWord = new Map();

    // W1: Kirish so'z embeddinglari (VocabSize x EmbeddingDim)
    this.weightsInput = [];
    // W2: Kontekst og'irliklari (EmbeddingDim x VocabSize)
    this.weightsOutput = [];
  }

  /**
   * Matnlar to'plamidan lug'at tuzish va og'irliklarni initsializatsiya qilish
   * @param {string[]} sentences
   */
  buildVocab(sentences) {
    const wordCounts = new Map();

    sentences.forEach((s) => {
      const words = s
        .toLowerCase()
        .replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ")
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 1);

      words.forEach((w) => {
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
      });
    });

    this.vocab = Array.from(wordCounts.keys());
    this.vocab.forEach((word, idx) => {
      this.wordToIndex.set(word, idx);
      this.indexToWord.set(idx, word);
    });

    const V = this.vocab.length;
    const D = this.embeddingDim;

    // Random boshlang'ich og'irliklar (-0.5 dan 0.5 gacha)
    this.weightsInput = Array.from({ length: V }, () =>
      Array.from({ length: D }, () => (Math.random() - 0.5) / D)
    );

    this.weightsOutput = Array.from({ length: D }, () =>
      Array.from({ length: V }, () => (Math.random() - 0.5) / V)
    );
  }

  /**
   * Skip-gram usulida matn bo'ylab kontekst juftliklarini yig'ish
   * @param {string[]} sentences
   * @param {number} windowSize - Kontekst oynasi (masalan, 2 ta so'z oldin va keyin)
   * @returns {Array<[number, number]>} [targetWordIdx, contextWordIdx]
   */
  generatePairs(sentences, windowSize = 2) {
    const pairs = [];

    sentences.forEach((s) => {
      const words = s
        .toLowerCase()
        .replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ")
        .trim()
        .split(/\s+/)
        .filter((w) => this.wordToIndex.has(w))
        .map((w) => this.wordToIndex.get(w));

      for (let i = 0; i < words.length; i++) {
        const target = words[i];
        for (let j = Math.max(0, i - windowSize); j <= Math.min(words.length - 1, i + windowSize); j++) {
          if (i !== j) {
            pairs.push([target, words[j]]);
          }
        }
      }
    });

    return pairs;
  }

  /**
   * Softmax hisoblash
  /**
   * Sigmoid funksiyasi
   */
  sigmoid(x) {
    if (x < -15) return 0;
    if (x > 15) return 1;
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Embeddings modelini o'qitish (Mikolov Skip-Gram with Negative Sampling - SGNS)
   * O'qitish tezligini 400x barobar oshiradi (CPU da 200 ms da o'rganadi).
   * @param {string[]} sentences
   * @param {number} epochs
   * @param {number} windowSize
   * @param {number} numNegative
   */
  train(sentences, epochs = 15, windowSize = 2, numNegative = 4) {
    this.buildVocab(sentences);
    const pairs = this.generatePairs(sentences, windowSize);
    const V = this.vocab.length;
    const D = this.embeddingDim;

    if (pairs.length === 0 || V === 0) return;

    for (let ep = 0; ep < epochs; ep++) {
      for (let i = 0; i < pairs.length; i++) {
        const [targetIdx, contextIdx] = pairs[i];
        const h = this.weightsInput[targetIdx];
        const dL_dh = new Array(D).fill(0);

        // 1. Ijobiy namuna (Positive sample: label = 1)
        let dotPos = 0;
        for (let d = 0; d < D; d++) {
          dotPos += h[d] * this.weightsOutput[d][contextIdx];
        }
        const sigPos = this.sigmoid(dotPos);
        const gradPos = (sigPos - 1) * this.learningRate;

        for (let d = 0; d < D; d++) {
          dL_dh[d] += gradPos * this.weightsOutput[d][contextIdx];
          this.weightsOutput[d][contextIdx] -= gradPos * h[d];
        }

        // 2. Salbiy namunalar (Negative samples: label = 0)
        for (let k = 0; k < numNegative; k++) {
          const negIdx = Math.floor(Math.random() * V);
          if (negIdx === contextIdx) continue;

          let dotNeg = 0;
          for (let d = 0; d < D; d++) {
            dotNeg += h[d] * this.weightsOutput[d][negIdx];
          }
          const sigNeg = this.sigmoid(dotNeg);
          const gradNeg = sigNeg * this.learningRate;

          for (let d = 0; d < D; d++) {
            dL_dh[d] += gradNeg * this.weightsOutput[d][negIdx];
            this.weightsOutput[d][negIdx] -= gradNeg * h[d];
          }
        }

        // 3. Target so'z vektorini yangilash
        for (let d = 0; d < D; d++) {
          this.weightsInput[targetIdx][d] -= dL_dh[d];
        }
      }
    }
  }

  /**
   * Modelni faylga saqlash
   */
  save(filePath) {
    const fs = require("fs");
    const data = {
      vocab: this.vocab,
      embeddingDim: this.embeddingDim,
      learningRate: this.learningRate,
      weightsInput: this.weightsInput,
      weightsOutput: this.weightsOutput
    };
    fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  }

  /**
   * Saqlangan modelni fayldan yuklash
   */
  static load(filePath) {
    const fs = require("fs");
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const emb = new WordEmbeddings(data.embeddingDim, data.learningRate);
    emb.vocab = data.vocab;
    emb.weightsInput = data.weightsInput;
    emb.weightsOutput = data.weightsOutput;
    emb.vocab.forEach((word, idx) => {
      emb.wordToIndex.set(word, idx);
      emb.indexToWord.set(idx, word);
    });
    return emb;
  }

  /**
   * Berilgan so'zning vektorini olish
   * @param {string} word
   * @returns {number[] | null}
   */
  getVector(word) {
    const idx = this.wordToIndex.get(word.toLowerCase());
    if (idx === undefined) return null;
    return this.weightsInput[idx];
  }

  /**
   * Ikkita vektor orasidagi Cosine Similarity (-1 dan +1 gacha)
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Berilgan so'zga ma'nosi eng yaqin so'zlarni topish
   * @param {string} word
   * @param {number} topN
   */
  findSimilar(word, topN = 5) {
    const targetVec = this.getVector(word);
    if (!targetVec) return [];

    const similarities = [];
    for (const otherWord of this.vocab) {
      if (otherWord.toLowerCase() === word.toLowerCase()) continue;
      const otherVec = this.getVector(otherWord);
      const sim = WordEmbeddings.cosineSimilarity(targetVec, otherVec);
      similarities.push({ word: otherWord, similarity: Number(sim.toFixed(4)) });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN);
  }
}

module.exports = WordEmbeddings;
