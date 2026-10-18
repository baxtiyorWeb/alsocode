/**
 * =======================================================================
 *  SELF-ATTENTION (O'Z-O'ZIGA DIQQAT) VA TRANSFORMER QATLAMI
 * =======================================================================
 *  Zamonaviy Katta Til Modellari (GPT-4, LLaMA, Claude) ning asosi:
 *  - Har bir token (so'z) boshqa barcha so'zlar bilan qanday semantik
 *    bog'langanini Scaled Dot-Product Attention orqali hisoblaydi.
 *  - Formula: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V
 *  - Heatmap (issiqlik xaritasi) matritsasini yaratadi.
 * =======================================================================
 */

class SelfAttentionLayer {
  /**
   * @param {number} embeddingDim - Har bir so'zning vektor o'lchami (d_model)
   * @param {number} keyDim - Query va Key proyeksiyalari o'lchami (d_k)
   */
  constructor(embeddingDim = 12, keyDim = 8) {
    this.embeddingDim = embeddingDim;
    this.keyDim = keyDim;

    // Q (Query), K (Key), V (Value) proyeksiyalash vaznlari matritsalari
    this.W_q = this._initMatrix(this.embeddingDim, this.keyDim);
    this.W_k = this._initMatrix(this.embeddingDim, this.keyDim);
    this.W_v = this._initMatrix(this.embeddingDim, this.embeddingDim);
  }

  _initMatrix(rows, cols) {
    const scale = Math.sqrt(2.0 / (rows + cols));
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    );
  }

  _matrixMultiplyVector(matrix, vector) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = new Array(cols).fill(0);

    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        sum += (vector[r] || 0) * matrix[r][c];
      }
      result[c] = sum;
    }
    return result;
  }

  _dotProduct(vecA, vecB) {
    let sum = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      sum += vecA[i] * vecB[i];
    }
    return sum;
  }

  _softmax(arr) {
    const maxVal = Math.max(...arr);
    const expArr = arr.map((x) => Math.exp(x - maxVal));
    const sumExp = expArr.reduce((a, b) => a + b, 0) || 1e-9;
    return expArr.map((x) => x / sumExp);
  }

  /**
   * So'z uchun deterministik yoki embedding asosidagi vektor hosil qilish
   * @param {string} word
   * @param {import('./embeddings')} embeddingsModel
   * @returns {number[]}
   */
  getWordVector(word, embeddingsModel = null) {
    if (embeddingsModel && typeof embeddingsModel.getVector === "function") {
      const vec = embeddingsModel.getVector(word);
      if (vec && vec.length > 0) return vec;
    }

    // Hash orqali deterministik embedding yaratish (Fallback)
    const vec = new Array(this.embeddingDim).fill(0);
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const idx = (charCode * 7 + i * 13) % this.embeddingDim;
      vec[idx] += Math.sin(charCode + i) * 0.5;
    }
    // Normallashtirish
    const norm = Math.sqrt(this._dotProduct(vec, vec)) || 1;
    return vec.map((v) => v / norm);
  }

  /**
   * Matn bo'yicha Self-Attention matritsasini hisoblash
   * @param {string} sentence
   * @param {import('./embeddings')} embeddingsModel
   * @returns {{
   *   tokens: string[],
   *   attentionMatrix: number[][],
   *   topConnections: Array<{ from: string, to: string, score: number }>,
   *   contextRepresentations: number[][]
   * }}
   */
  process(sentence, embeddingsModel = null) {
    if (!sentence || typeof sentence !== "string") {
      return { tokens: [], attentionMatrix: [], topConnections: [], contextRepresentations: [] };
    }

    const tokens = sentence
      .toLowerCase()
      .replace(/[`ʼʻ']/g, "'")
      .replace(/[^a-zа-яёo'g'0-9\s.,!?-]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 16); // Vizualizatsiya uchun qulay uzunlik

    if (tokens.length === 0) {
      return { tokens: [], attentionMatrix: [], topConnections: [], contextRepresentations: [] };
    }

    const n = tokens.length;
    const vectors = tokens.map((t) => this.getWordVector(t, embeddingsModel));

    // 1. Q, K, V vektorlarini hisoblash
    const Q = vectors.map((v) => this._matrixMultiplyVector(this.W_q, v));
    const K = vectors.map((v) => this._matrixMultiplyVector(this.W_k, v));
    const V = vectors.map((v) => this._matrixMultiplyVector(this.W_v, v));

    // 2. Scaled Dot-Product (Q * K^T / sqrt(d_k))
    const scaleFactor = Math.sqrt(this.keyDim) || 1;
    const rawScores = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dot = this._dotProduct(Q[i], K[j]);
        rawScores[i][j] = dot / scaleFactor;
      }
    }

    // 3. Har bir satr bo'yicha Softmax (Attention Weights Matritsasi)
    const attentionMatrix = rawScores.map((row) => this._softmax(row));

    // 4. Kontekst vektorlarini (Z = Attention * V) sintez qilish
    const contextRepresentations = [];
    for (let i = 0; i < n; i++) {
      const z = new Array(this.embeddingDim).fill(0);
      for (let j = 0; j < n; j++) {
        const weight = attentionMatrix[i][j];
        for (let d = 0; d < this.embeddingDim; d++) {
          z[d] += weight * (V[j][d] || 0);
        }
      }
      contextRepresentations.push(z);
    }

    // 5. Eng kuchli e'tibor qaratilgan juftliklarni aniqlash (o'z-o'zidan tashqari)
    const topConnections = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          topConnections.push({
            from: tokens[i],
            to: tokens[j],
            score: Number((attentionMatrix[i][j] * 100).toFixed(1)),
          });
        }
      }
    }

    topConnections.sort((a, b) => b.score - a.score);

    return {
      tokens,
      attentionMatrix: attentionMatrix.map((row) => row.map((v) => Number(v.toFixed(3)))),
      topConnections: topConnections.slice(0, 6),
      contextRepresentations,
    };
  }
}

module.exports = SelfAttentionLayer;
