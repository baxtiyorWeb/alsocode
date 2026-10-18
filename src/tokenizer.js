const UzbekMorphology = require("./morphology");

/**
 * Matn bilan ishlash moduli (NLP Preprocessing, Stemming & Vectorization)
 * Matnni tozalash, o'zakka keltirish va raqamlar (vektorlar) tiliga o'tkazish uchun xizmat qiladi.
 */
class Tokenizer {
  constructor() {
    this.vocabulary = [];
    this.categories = [];
    this.morphology = new UzbekMorphology();
  }

  /**
   * Matnni tozalash va tokenlarga ajratish
   * @param {string} text
   * @param {boolean} withLemmas - O'zbek tili morfologiyasiga ko'ra o'zaklarni ham qo'shish
   * @returns {string[]}
   */
  tokenize(text, withLemmas = true) {
    if (!text || typeof text !== "string") return [];
    const rawTokens = text
      .toLowerCase()
      .replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (!withLemmas) return rawTokens;

    // Har bir so'zning o'zini ham, lemmatizatsiya qilingan o'zagini ham qo'shamiz
    const tokens = [];
    rawTokens.forEach((w) => {
      tokens.push(w);
      const lemma = this.morphology.lemmatize(w).lemma;
      if (lemma && lemma !== w && lemma.length >= 2) {
        tokens.push(lemma);
      }
    });

    return tokens;
  }

  /**
   * Berilgan matnlar to'plamidan barcha unikal so'zlar lug'atini (Vocabulary) hosil qilish
   * @param {Array<{text: string, category: string}>} data
   * @param {string[]} categories
   */
  fit(data, categories) {
    this.categories = [...categories];
    const wordSet = new Set();

    data.forEach((item) => {
      const words = this.tokenize(item.text, true);
      words.forEach((w) => wordSet.add(w));
    });

    this.vocabulary = Array.from(wordSet);
  }

  /**
   * Matnni Bag-of-Words (vektor) ga aylantirish.
   * Lug'atdagi har bir so'z uchun agar u matnda (yoki uning lemmalarida) bo'lsa 1, bo'lmasa 0 qo'yiladi.
   * @param {string} text
   * @returns {number[]}
   */
  textToVector(text) {
    const words = new Set(this.tokenize(text, true));
    return this.vocabulary.map((vocabWord) => (words.has(vocabWord) ? 1 : 0));
  }

  /**
   * Kategoriyani One-Hot vektorga aylantirish.
   * @param {string} category
   * @returns {number[]}
   */
  categoryToOneHot(category) {
    return this.categories.map((c) => (c === category ? 1 : 0));
  }

  /**
   * Chiqish vektoridan eng yuqori ehtimolli kategoriyani va foizini aniqlash
   * @param {number[]} outputVector
   * @returns {{ category: string, confidence: number, probabilities: Object }}
   */
  vectorToPrediction(outputVector) {
    let maxVal = -Infinity;
    let bestIndex = 0;
    const probabilities = {};

    const sum = outputVector.reduce((a, b) => a + Math.max(Number(b) || 0, 0.0001), 0) || 1;

    outputVector.forEach((val, idx) => {
      const cat = this.categories[idx] || `cat_${idx}`;
      const safeVal = Math.max(Number(val) || 0, 0);
      const percent = ((safeVal / sum) * 100).toFixed(1);
      probabilities[cat] = Number(percent) || 0;

      if (val > maxVal) {
        maxVal = val;
        bestIndex = idx;
      }
    });

    const chosenCat = this.categories[bestIndex] || "noma'lum";
    return {
      category: chosenCat,
      confidence: probabilities[chosenCat] || 0,
      probabilities,
    };
  }
}

module.exports = Tokenizer;
