/**
 * =======================================================================
 *  MULTI-HEAD SELF-ATTENTION & POZISION KODLASH (Multi-Head Transformer)
 * =======================================================================
 *  Transformerning to'liq 4 boshli (4-Head) Attention arxitekturasi:
 *  - Har bir bosh (Head) so'zlar orasidagi turli qirralarni o'rganadi:
 *      • Head 1: Grammatik bog'liqlik (Ega - Kesim)
 *      • Head 2: Semantik yaqinlik (Mavzu - Ma'no)
 *      • Head 3: Hissiy va sifatlovchi modifikatorlar
 *      • Head 4: Uzoq masofali kontekstual murojaat
 *  - Sinusoidal Positional Encoding (So'zlarning gapdagi aniq o'rni/tartibi)
 * =======================================================================
 */

class MultiHeadAttention {
  /**
   * @param {number} embeddingDim - Vektor o'lchami (masalan 12)
   * @param {number} numHeads - Boshlar soni (masalan 4)
   */
  constructor(embeddingDim = 12, numHeads = 4) {
    this.embeddingDim = embeddingDim;
    this.numHeads = numHeads;
    this.headDim = Math.floor(embeddingDim / numHeads) || 3;

    // Har bir Head uchun Q, K, V og'irliklari
    this.heads = [];
    for (let h = 0; h < this.numHeads; h++) {
      this.heads.push({
        id: h + 1,
        name: this._getHeadRoleName(h),
        W_q: this._initMatrix(this.embeddingDim, this.headDim),
        W_k: this._initMatrix(this.embeddingDim, this.headDim),
        W_v: this._initMatrix(this.embeddingDim, this.headDim),
      });
    }

    // Chiqish proyeksiyasi W_o
    this.W_o = this._initMatrix(this.numHeads * this.headDim, this.embeddingDim);
  }

  _getHeadRoleName(index) {
    const roles = [
      "Head 1: Grammatik Bog'liqlik (Syntax)",
      "Head 2: Semantik Mazmun (Semantics)",
      "Head 3: Hissiyot & Modifikatorlar (Emotion)",
      "Head 4: Uzoq Kontekst (Long-range)",
    ];
    return roles[index] || `Head ${index + 1}`;
  }

  _initMatrix(rows, cols) {
    const scale = Math.sqrt(2.0 / (rows + cols));
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    );
  }

  _dot(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) sum += a[i] * b[i];
    return sum;
  }

  _matMulVec(matrix, vector) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const res = new Array(cols).fill(0);
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        sum += (vector[r] || 0) * matrix[r][c];
      }
      res[c] = sum;
    }
    return res;
  }

  _softmax(arr) {
    const maxVal = Math.max(...arr);
    const expArr = arr.map((x) => Math.exp(x - maxVal));
    const sum = expArr.reduce((a, b) => a + b, 0) || 1e-9;
    return expArr.map((x) => x / sum);
  }

  /**
   * Sinusoidal Positional Encoding qo'shish (Token o'rnini anglash)
   * @param {number[][]} vectors
   * @returns {number[][]}
   */
  applyPositionalEncoding(vectors) {
    return vectors.map((vec, pos) => {
      return vec.map((val, i) => {
        const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / this.embeddingDim);
        const pe = i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
        return Number((val + pe * 0.15).toFixed(4));
      });
    });
  }

  /**
   * Multi-Head Attention hisoblash
   * @param {string} sentence
   * @param {import('./embeddings')} embeddingsModel
   * @returns {{
   *   tokens: string[],
   *   numHeads: number,
   *   headsData: Array<{ id: number, name: string, matrix: number[][], topPair: Object }>,
   *   averagedMatrix: number[][]
   * }}
   */
  process(sentence, embeddingsModel = null) {
    if (!sentence || typeof sentence !== "string") {
      return { tokens: [], numHeads: this.numHeads, headsData: [], averagedMatrix: [] };
    }

    const tokens = sentence
      .toLowerCase()
      .replace(/[`ʼʻ']/g, "'")
      .replace(/[^a-zа-яёo'g'0-9\s.,!?-]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 14);

    const n = tokens.length;
    if (n === 0) {
      return { tokens: [], numHeads: this.numHeads, headsData: [], averagedMatrix: [] };
    }

    // Har bir token uchun boshlang'ich vektor olish
    let baseVectors = tokens.map((token) => {
      let vec = null;
      if (embeddingsModel && typeof embeddingsModel.getVector === "function") {
        vec = embeddingsModel.getVector(token);
      }
      if (!vec) {
        vec = new Array(this.embeddingDim).fill(0);
        for (let i = 0; i < token.length; i++) {
          const code = token.charCodeAt(i);
          vec[(code * 7 + i * 11) % this.embeddingDim] += Math.sin(code + i);
        }
      }
      return vec;
    });

    // Pozitsion kodlashni qo'shish
    baseVectors = this.applyPositionalEncoding(baseVectors);

    const headsData = [];
    const sumMatrix = Array.from({ length: n }, () => new Array(n).fill(0));

    // Har bir Head bo'yicha mustaqil hisoblash
    this.heads.forEach((head) => {
      const Q = baseVectors.map((v) => this._matMulVec(head.W_q, v));
      const K = baseVectors.map((v) => this._matMulVec(head.W_k, v));

      const scale = Math.sqrt(this.headDim) || 1;
      const rawScores = Array.from({ length: n }, () => new Array(n).fill(0));

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          rawScores[i][j] = this._dot(Q[i], K[j]) / scale;
        }
      }

      const matrix = rawScores.map((row) => this._softmax(row));

      // Eng kuchli juftlik
      let maxScore = -1;
      let topPair = { from: tokens[0], to: tokens[0], score: 0 };
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const val = matrix[i][j];
          sumMatrix[i][j] += val;
          if (i !== j && val > maxScore) {
            maxScore = val;
            topPair = { from: tokens[i], to: tokens[j], score: Math.round(val * 100) };
          }
        }
      }

      headsData.push({
        id: head.id,
        name: head.name,
        matrix: matrix.map((row) => row.map((v) => Number(v.toFixed(3)))),
        topPair,
      });
    });

    // 4 ta Head'ning o'rtacha konsensus matritsasi
    const averagedMatrix = sumMatrix.map((row) =>
      row.map((val) => Number((val / this.numHeads).toFixed(3)))
    );

    return {
      tokens,
      numHeads: this.numHeads,
      headsData,
      averagedMatrix,
    };
  }
}

module.exports = MultiHeadAttention;
