/**
 * Matn tahlilchisi (Text Analyzer)
 * Tokenizer va Neyron Tarmoqni birlashtirib, yangi matnlarni tahlil qiladi.
 */
class TextAnalyzer {
  /**
   * @param {import('./neuralNetwork')} neuralNetwork
   * @param {import('./tokenizer')} tokenizer
   */
  constructor(neuralNetwork, tokenizer) {
    this.nn = neuralNetwork;
    this.tokenizer = tokenizer;
  }

  /**
   * Berilgan matnni tahlil qilish va xulosa chiqarish
   * @param {string} text
   */
  analyze(text) {
    const inputVector = this.tokenizer.textToVector(text);

    // Lug'atda topilgan so'zlar soni
    const wordCount = inputVector.reduce((sum, val) => sum + val, 0);

    // OOV (Out-of-Vocabulary) / Zero-Vector Trap himoyasi:
    // Agar kiritilgan matndagi birorta so'z ham lug'atda bo'lmasa, X=0 bo'ladi.
    // Neyron tarmoqning bias qiymatiga aldanib noo'rin kategoriya chiqarishini oldini olamiz!
    if (wordCount === 0) {
      return {
        text,
        knownWordsCount: 0,
        isOOV: true,
        predictedCategory: "noma'lum",
        confidence: 0,
        probabilities: {},
      };
    }

    const rawPrediction = this.nn.predict(inputVector);
    const result = this.tokenizer.vectorToPrediction(rawPrediction);

    return {
      text,
      knownWordsCount: wordCount,
      isOOV: false,
      predictedCategory: result.category,
      confidence: result.confidence,
      probabilities: result.probabilities,
    };
  }
}

module.exports = TextAnalyzer;
