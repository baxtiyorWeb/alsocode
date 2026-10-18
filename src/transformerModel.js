"use strict";

const LLM_CONFIG = require("./llmConfig");
const AdamWOptimizer = require("./adamwOptimizer");

/**
 * =======================================================================
 *  FROM-SCRATCH CAUSAL DECODER-ONLY TRANSFORMER (TRANSFORMER-JS v2.0)
 * =======================================================================
 *  Matematik Toza va Izolyatsiyalangan Arxitektura (Zero In-Place Mutation):
 *  - Causal Masking (Kelajak tokenlarni ko'rishni 100% to'sadi);
 *  - Multi-Head Scaled Dot-Product Attention (Q, K, V, O);
 *  - Pre-LayerNorm va Residual Connections;
 *  - FFN (Position-wise Feed-Forward) + GELU faollashtiruvchisi;
 *  - Output Projection (Vocab Logits) va Next-Token Cross-Entropy Loss;
 *  - Alohida Gradient Buferlari (dW, db, dln) va Gradient Accumulation;
 *  - AdamW Optimizatori (Momentum, Variance, Weight Decay, Grad Clipping).
 * =======================================================================
 */

function gelu(x) {
  return 0.5 * x * (1.0 + Math.tanh(Math.sqrt(2.0 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
}

function geluDerivative(x) {
  const k0 = Math.sqrt(2.0 / Math.PI);
  const u = k0 * (x + 0.044715 * Math.pow(x, 3));
  const tanhU = Math.tanh(u);
  const sech2U = 1.0 - tanhU * tanhU;
  const du = k0 * (1.0 + 3 * 0.044715 * x * x);
  return 0.5 * (1.0 + tanhU) + 0.5 * x * sech2U * du;
}

function softmax(arr) {
  let maxVal = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > maxVal) maxVal = arr[i];
  }
  let sumExp = 0;
  const exps = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const e = Math.exp(arr[i] - maxVal);
    exps[i] = e;
    sumExp += e;
  }
  const invSum = 1.0 / (sumExp || 1e-9);
  for (let i = 0; i < arr.length; i++) {
    exps[i] *= invSum;
  }
  return exps;
}

function randomMatrix(rows, cols, scale = null) {
  const s = scale !== null ? scale : Math.sqrt(2.0 / (rows + cols));
  const mat = [];
  for (let r = 0; r < rows; r++) {
    const row = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      row[c] = (Math.random() * 2 - 1) * s;
    }
    mat.push(row);
  }
  return mat;
}

function zerosMatrix(rows, cols) {
  const mat = [];
  for (let r = 0; r < rows; r++) {
    mat.push(new Float32Array(cols));
  }
  return mat;
}

function cloneMatrix(mat) {
  const out = [];
  for (let r = 0; r < mat.length; r++) {
    out.push(new Float32Array(mat[r]));
  }
  return out;
}

class TransformerBlock {
  constructor(dModel, nHeads, headDim, dFfn, blockIndex = 0) {
    this.blockIndex = blockIndex;
    this.dModel = dModel;
    this.nHeads = nHeads;
    this.headDim = headDim;
    this.dFfn = dFfn;

    // 1. Attention Parametrlari va Gradient Buferlari
    this.W_q = randomMatrix(dModel, dModel);
    this.W_k = randomMatrix(dModel, dModel);
    this.W_v = randomMatrix(dModel, dModel);
    this.W_o = randomMatrix(dModel, dModel);

    this.dW_q = zerosMatrix(dModel, dModel);
    this.dW_k = zerosMatrix(dModel, dModel);
    this.dW_v = zerosMatrix(dModel, dModel);
    this.dW_o = zerosMatrix(dModel, dModel);

    // 2. LayerNorm 1 Parametrlari va Gradient Buferlari
    this.ln1_gamma = new Float32Array(dModel).fill(1.0);
    this.ln1_beta = new Float32Array(dModel).fill(0.0);
    this.dln1_gamma = new Float32Array(dModel);
    this.dln1_beta = new Float32Array(dModel);

    // 3. FFN Parametrlari va Gradient Buferlari
    this.W_f1 = randomMatrix(dModel, dFfn);
    this.b_f1 = new Float32Array(dFfn).fill(0.0);
    this.W_f2 = randomMatrix(dFfn, dModel);
    this.b_f2 = new Float32Array(dModel).fill(0.0);

    this.dW_f1 = zerosMatrix(dModel, dFfn);
    this.db_f1 = new Float32Array(dFfn);
    this.dW_f2 = zerosMatrix(dFfn, dModel);
    this.db_f2 = new Float32Array(dModel);

    // 4. LayerNorm 2 Parametrlari va Gradient Buferlari
    this.ln2_gamma = new Float32Array(dModel).fill(1.0);
    this.ln2_beta = new Float32Array(dModel).fill(0.0);
    this.dln2_gamma = new Float32Array(dModel);
    this.dln2_beta = new Float32Array(dModel);
  }

  /**
   * Blok gradient buferlarini tozalash
   */
  zeroGrad() {
    const D = this.dModel;
    const F = this.dFfn;

    for (let r = 0; r < D; r++) {
      this.dW_q[r].fill(0.0);
      this.dW_k[r].fill(0.0);
      this.dW_v[r].fill(0.0);
      this.dW_o[r].fill(0.0);
      this.dW_f1[r].fill(0.0);
    }
    for (let f = 0; f < F; f++) {
      this.dW_f2[f].fill(0.0);
    }

    this.db_f1.fill(0.0);
    this.db_f2.fill(0.0);
    this.dln1_gamma.fill(0.0);
    this.dln1_beta.fill(0.0);
    this.dln2_gamma.fill(0.0);
    this.dln2_beta.fill(0.0);
  }

  /**
   * Pre-LayerNorm forward
   */
  layerNorm(x, gamma, beta) {
    const T = x.length;
    const D = this.dModel;
    const out = [];
    const cache = [];

    for (let t = 0; t < T; t++) {
      let mean = 0;
      for (let d = 0; d < D; d++) mean += x[t][d];
      mean /= D;

      let variance = 0;
      for (let d = 0; d < D; d++) {
        const diff = x[t][d] - mean;
        variance += diff * diff;
      }
      variance /= D;
      const stdInv = 1.0 / Math.sqrt(variance + 1e-5);

      const normRow = new Float32Array(D);
      const xHat = new Float32Array(D);
      for (let d = 0; d < D; d++) {
        xHat[d] = (x[t][d] - mean) * stdInv;
        normRow[d] = xHat[d] * gamma[d] + beta[d];
      }
      out.push(normRow);
      cache.push({ mean, variance, stdInv, xHat });
    }
    return { out, cache };
  }

  /**
   * Pre-LayerNorm analitik teskari differensiali (vaznlarga tegilmaydi)
   */
  layerNormBackward(dY, cache, gamma, dGamma, dBeta) {
    const T = dY.length;
    const D = this.dModel;
    const dX = [];

    for (let t = 0; t < T; t++) {
      const { stdInv, xHat } = cache[t];
      const dX_row = new Float32Array(D);

      let sum_dxhat = 0;
      let sum_dxhat_xhat = 0;
      const dxhat = new Float32Array(D);

      for (let d = 0; d < D; d++) {
        const dy = dY[t][d];
        dGamma[d] += dy * xHat[d];
        dBeta[d] += dy;

        const dxh = dy * gamma[d];
        dxhat[d] = dxh;
        sum_dxhat += dxh;
        sum_dxhat_xhat += dxh * xHat[d];
      }

      const invD = 1.0 / D;
      for (let d = 0; d < D; d++) {
        const grad = (stdInv * invD) * (D * dxhat[d] - sum_dxhat - xHat[d] * sum_dxhat_xhat);
        dX_row[d] = grad;
      }
      dX.push(dX_row);
    }
    return dX;
  }

  /**
   * Blok bo'yicha oldinga uzatish (Forward Pass)
   */
  forward(x) {
    const T = x.length;
    const D = this.dModel;
    const H = this.nHeads;
    const Dh = this.headDim;

    // 1. Pre-LayerNorm 1
    const { out: xNorm1, cache: ln1Cache } = this.layerNorm(x, this.ln1_gamma, this.ln1_beta);

    // 2. Q, K, V hisoblash
    const Q = zerosMatrix(T, D);
    const K = zerosMatrix(T, D);
    const V = zerosMatrix(T, D);

    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        let sq = 0, sk = 0, sv = 0;
        for (let j = 0; j < D; j++) {
          const val = xNorm1[t][j];
          sq += val * this.W_q[j][i];
          sk += val * this.W_k[j][i];
          sv += val * this.W_v[j][i];
        }
        Q[t][i] = sq;
        K[t][i] = sk;
        V[t][i] = sv;
      }
    }

    // 3. Multi-Head Causal Attention
    const scale = 1.0 / Math.sqrt(Dh);
    const headOutputs = [];
    const attnWeights = [];

    for (let h = 0; h < H; h++) {
      const hOffset = h * Dh;
      const hAttn = [];

      for (let i = 0; i < T; i++) {
        const rawScores = new Float32Array(T);
        for (let j = 0; j < T; j++) {
          if (j > i) {
            rawScores[j] = -1e9;
          } else {
            let dot = 0;
            for (let d = 0; d < Dh; d++) {
              dot += Q[i][hOffset + d] * K[j][hOffset + d];
            }
            rawScores[j] = dot * scale;
          }
        }
        hAttn.push(softmax(rawScores));
      }
      attnWeights.push(hAttn);

      const hOut = zerosMatrix(T, Dh);
      for (let i = 0; i < T; i++) {
        for (let d = 0; d < Dh; d++) {
          let sum = 0;
          for (let j = 0; j <= i; j++) {
            sum += hAttn[i][j] * V[j][hOffset + d];
          }
          hOut[i][d] = sum;
        }
      }
      headOutputs.push(hOut);
    }

    // 4. Boshlarni birlashtirish va W_o
    const concatHeads = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let h = 0; h < H; h++) {
        const hOffset = h * Dh;
        for (let d = 0; d < Dh; d++) {
          concatHeads[t][hOffset + d] = headOutputs[h][t][d];
        }
      }
    }

    const attnProj = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        let sum = 0;
        for (let j = 0; j < D; j++) {
          sum += concatHeads[t][j] * this.W_o[j][i];
        }
        attnProj[t][i] = sum;
      }
    }

    // 5. Residual 1
    const x1 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        x1[t][d] = x[t][d] + attnProj[t][d];
      }
    }

    // 6. Pre-LayerNorm 2
    const { out: xNorm2, cache: ln2Cache } = this.layerNorm(x1, this.ln2_gamma, this.ln2_beta);

    // 7. FFN
    const ffnSums = zerosMatrix(T, this.dFfn);
    const ffnHidden = zerosMatrix(T, this.dFfn);
    for (let t = 0; t < T; t++) {
      for (let f = 0; f < this.dFfn; f++) {
        let sum = this.b_f1[f];
        for (let d = 0; d < D; d++) {
          sum += xNorm2[t][d] * this.W_f1[d][f];
        }
        ffnSums[t][f] = sum;
        ffnHidden[t][f] = gelu(sum);
      }
    }

    const ffnOut = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        let sum = this.b_f2[d];
        for (let f = 0; f < this.dFfn; f++) {
          sum += ffnHidden[t][f] * this.W_f2[f][d];
        }
        ffnOut[t][d] = sum;
      }
    }

    // 8. Residual 2
    const output = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        output[t][d] = x1[t][d] + ffnOut[t][d];
      }
    }

    return {
      output,
      cache: {
        x,
        xNorm1,
        ln1Cache,
        Q,
        K,
        V,
        attnWeights,
        concatHeads,
        attnProj,
        x1,
        xNorm2,
        ln2Cache,
        ffnSums,
        ffnHidden,
        ffnOut,
        T,
      },
    };
  }

  /**
   * Blok bo'yicha to'liq analitik Backpropagation (Vaznlar muzlatilgan holda dW buferlariga yig'iladi)
   * @param {Float32Array[]} dOut - Chiqish gradienti
   * @param {Object} cache - Forward pass keshi
   * @returns {Float32Array[]} dx - Kirish x bo'yicha analitik gradient
   */
  backward(dOut, cache) {
    const T = dOut.length;
    const D = this.dModel;
    const H = this.nHeads;
    const Dh = this.headDim;
    const scale = 1.0 / Math.sqrt(Dh);

    const {
      x,
      xNorm1,
      ln1Cache,
      Q,
      K,
      V,
      attnWeights,
      concatHeads,
      x1,
      xNorm2,
      ln2Cache,
      ffnSums,
      ffnHidden,
    } = cache;

    // 1. Residual 2: output = x1 + ffnOut
    const dx1 = cloneMatrix(dOut);
    const dFfnOut = dOut;

    // 2. FFN 2-chiziqli qatlam (W_f2 va b_f2) gradientlari
    const dFfnHidden = zerosMatrix(T, this.dFfn);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        const dy = dFfnOut[t][d];
        this.db_f2[d] += dy;
        for (let f = 0; f < this.dFfn; f++) {
          this.dW_f2[f][d] += ffnHidden[t][f] * dy;
          // DIQQAT: W_f2 O'ZGARMASDAN ishlatiladi (Analitik zanjir to'g'ri saqlanadi)
          dFfnHidden[t][f] += dy * this.W_f2[f][d];
        }
      }
    }

    // 3. FFN GELU va 1-chiziqli qatlam (W_f1 va b_f1)
    const dXNorm2 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let f = 0; f < this.dFfn; f++) {
        const dAct = dFfnHidden[t][f] * geluDerivative(ffnSums[t][f]);
        this.db_f1[f] += dAct;
        for (let d = 0; d < D; d++) {
          this.dW_f1[d][f] += xNorm2[t][d] * dAct;
          dXNorm2[t][d] += dAct * this.W_f1[d][f];
        }
      }
    }

    // 4. Pre-LayerNorm 2 orqali x1 ga differensial uzatish
    const dLn2_in = this.layerNormBackward(dXNorm2, ln2Cache, this.ln2_gamma, this.dln2_gamma, this.dln2_beta);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        dx1[t][d] += dLn2_in[t][d];
      }
    }

    // 5. Residual 1: x1 = x + attnProj
    const dx = cloneMatrix(dx1);
    const dAttnProj = dx1;

    // 6. Attention Proyeksiya (W_o) gradientlari
    const dConcatHeads = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        const dy = dAttnProj[t][i];
        for (let j = 0; j < D; j++) {
          this.dW_o[j][i] += concatHeads[t][j] * dy;
          dConcatHeads[t][j] += dy * this.W_o[j][i];
        }
      }
    }

    // 7. Multi-Head Attention Q, K, V gradientlari
    const dQ = zerosMatrix(T, D);
    const dK = zerosMatrix(T, D);
    const dV = zerosMatrix(T, D);

    for (let h = 0; h < H; h++) {
      const hOffset = h * Dh;
      const hAttn = attnWeights[h];

      const dHOut = zerosMatrix(T, Dh);
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < Dh; d++) {
          dHOut[t][d] = dConcatHeads[t][hOffset + d];
        }
      }

      // dV va dAttn
      const dHAttn = zerosMatrix(T, T);
      for (let i = 0; i < T; i++) {
        for (let d = 0; d < Dh; d++) {
          const dho = dHOut[i][d];
          for (let j = 0; j <= i; j++) {
            dV[j][hOffset + d] += dho * hAttn[i][j];
            dHAttn[i][j] += dho * V[j][hOffset + d];
          }
        }
      }

      // Causal Softmax backward
      for (let i = 0; i < T; i++) {
        let sum_p_dp = 0;
        for (let j = 0; j <= i; j++) {
          sum_p_dp += hAttn[i][j] * dHAttn[i][j];
        }
        for (let j = 0; j <= i; j++) {
          const dRaw = hAttn[i][j] * (dHAttn[i][j] - sum_p_dp);
          for (let d = 0; d < Dh; d++) {
            dQ[i][hOffset + d] += scale * dRaw * K[j][hOffset + d];
            dK[j][hOffset + d] += scale * dRaw * Q[i][hOffset + d];
          }
        }
      }
    }

    // 8. Q, K, V chiziqli proyeksiyalari gradientlari
    const dXNorm1 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        const dq = dQ[t][i];
        const dk = dK[t][i];
        const dv = dV[t][i];
        for (let j = 0; j < D; j++) {
          const xVal = xNorm1[t][j];
          this.dW_q[j][i] += xVal * dq;
          this.dW_k[j][i] += xVal * dk;
          this.dW_v[j][i] += xVal * dv;

          dXNorm1[t][j] += dq * this.W_q[j][i] + dk * this.W_k[j][i] + dv * this.W_v[j][i];
        }
      }
    }

    // 9. Pre-LayerNorm 1 orqali dx ga differensial uzatish
    const dLn1_in = this.layerNormBackward(dXNorm1, ln1Cache, this.ln1_gamma, this.dln1_gamma, this.dln1_beta);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        dx[t][d] += dLn1_in[t][d];
      }
    }

    return dx;
  }
}

class CausalTransformerModel {
  /**
   * @param {Object} config
   */
  constructor(config = LLM_CONFIG.model) {
    this.config = { ...LLM_CONFIG.model, ...config };
    this.vocabSize = this.config.vocabSize;
    this.dModel = this.config.dModel;
    this.nHeads = this.config.nHeads;
    this.headDim = Math.floor(this.dModel / this.nHeads);
    this.dFfn = this.config.dFfn;
    this.nLayers = this.config.nLayers;
    this.maxSeqLen = this.config.maxSeqLen;

    // 1. Token Embeddings: [Vocab x dModel]
    this.wte = randomMatrix(this.vocabSize, this.dModel, 0.02);
    this.dwte = zerosMatrix(this.vocabSize, this.dModel);

    // 2. Learned Positional Embeddings: [maxSeqLen x dModel]
    this.wpe = randomMatrix(this.maxSeqLen, this.dModel, 0.02);
    this.dwpe = zerosMatrix(this.maxSeqLen, this.dModel);

    // 3. Transformer Bloklari
    this.blocks = [];
    for (let i = 0; i < this.nLayers; i++) {
      this.blocks.push(new TransformerBlock(this.dModel, this.nHeads, this.headDim, this.dFfn, i));
    }

    // 4. Final LayerNorm
    this.ln_f_gamma = new Float32Array(this.dModel).fill(1.0);
    this.ln_f_beta = new Float32Array(this.dModel).fill(0.0);
    this.dln_f_gamma = new Float32Array(this.dModel);
    this.dln_f_beta = new Float32Array(this.dModel);

    // 5. Output Projection (LM Head): [dModel x Vocab]
    this.lm_head = randomMatrix(this.dModel, this.vocabSize, 0.02);
    this.dlm_head = zerosMatrix(this.dModel, this.vocabSize);

    // 6. AdamW Optimizatori
    this.optimizer = new AdamWOptimizer(this, {
      lr: LLM_CONFIG.training.learningRate || 0.003,
      weightDecay: LLM_CONFIG.training.weightDecay || 0.01,
      gradClip: LLM_CONFIG.training.gradClipNorm || 1.0,
    });
  }

  /**
   * Barcha gradient buferlarini nolga tenglash
   */
  zeroGrad() {
    for (let v = 0; v < this.vocabSize; v++) {
      this.dwte[v].fill(0.0);
    }
    for (let s = 0; s < this.maxSeqLen; s++) {
      this.dwpe[s].fill(0.0);
    }
    for (let d = 0; d < this.dModel; d++) {
      this.dlm_head[d].fill(0.0);
    }
    this.dln_f_gamma.fill(0.0);
    this.dln_f_beta.fill(0.0);

    for (let l = 0; l < this.nLayers; l++) {
      this.blocks[l].zeroGrad();
    }
  }

  /**
   * Optimizer uchun barcha parametrlar va ularning gradient buferlari ro'yxati
   */
  getAllParametersWithGrads() {
    const list = [
      { id: "wte", data: this.wte, grad: this.dwte, isMatrix: true, shape: [this.vocabSize, this.dModel], decay: true },
      { id: "wpe", data: this.wpe, grad: this.dwpe, isMatrix: true, shape: [this.maxSeqLen, this.dModel], decay: true },
      { id: "ln_f_gamma", data: this.ln_f_gamma, grad: this.dln_f_gamma, isMatrix: false, shape: [this.dModel], decay: false },
      { id: "ln_f_beta", data: this.ln_f_beta, grad: this.dln_f_beta, isMatrix: false, shape: [this.dModel], decay: false },
      { id: "lm_head", data: this.lm_head, grad: this.dlm_head, isMatrix: true, shape: [this.dModel, this.vocabSize], decay: true },
    ];

    for (let l = 0; l < this.nLayers; l++) {
      const b = this.blocks[l];
      list.push(
        { id: `b${l}_W_q`, data: b.W_q, grad: b.dW_q, isMatrix: true, shape: [this.dModel, this.dModel], decay: true },
        { id: `b${l}_W_k`, data: b.W_k, grad: b.dW_k, isMatrix: true, shape: [this.dModel, this.dModel], decay: true },
        { id: `b${l}_W_v`, data: b.W_v, grad: b.dW_v, isMatrix: true, shape: [this.dModel, this.dModel], decay: true },
        { id: `b${l}_W_o`, data: b.W_o, grad: b.dW_o, isMatrix: true, shape: [this.dModel, this.dModel], decay: true },
        { id: `b${l}_ln1_gamma`, data: b.ln1_gamma, grad: b.dln1_gamma, isMatrix: false, shape: [this.dModel], decay: false },
        { id: `b${l}_ln1_beta`, data: b.ln1_beta, grad: b.dln1_beta, isMatrix: false, shape: [this.dModel], decay: false },
        { id: `b${l}_W_f1`, data: b.W_f1, grad: b.dW_f1, isMatrix: true, shape: [this.dModel, this.dFfn], decay: true },
        { id: `b${l}_b_f1`, data: b.b_f1, grad: b.db_f1, isMatrix: false, shape: [this.dFfn], decay: false },
        { id: `b${l}_W_f2`, data: b.W_f2, grad: b.dW_f2, isMatrix: true, shape: [this.dFfn, this.dModel], decay: true },
        { id: `b${l}_b_f2`, data: b.b_f2, grad: b.db_f2, isMatrix: false, shape: [this.dModel], decay: false },
        { id: `b${l}_ln2_gamma`, data: b.ln2_gamma, grad: b.dln2_gamma, isMatrix: false, shape: [this.dModel], decay: false },
        { id: `b${l}_ln2_beta`, data: b.ln2_beta, grad: b.dln2_beta, isMatrix: false, shape: [this.dModel], decay: false }
      );
    }
    return list;
  }

  /**
   * Gradient clipping uchun faqat gradientlar ro'yxati
   */
  getAllGradients() {
    return this.getAllParametersWithGrads().map((p) => ({
      grad: p.grad,
      isMatrix: p.isMatrix,
      rows: p.isMatrix ? p.shape[0] : null,
      cols: p.isMatrix ? p.shape[1] : null,
      len: !p.isMatrix ? p.shape[0] : null,
    }));
  }

  /**
   * Parametrlar sonini shaffof hisoblash
   */
  countParameters() {
    let total = 0;
    const tokenEmb = this.vocabSize * this.dModel;
    const posEmb = this.maxSeqLen * this.dModel;
    total += tokenEmb + posEmb;

    let perBlock = 0;
    const attnParams = 4 * (this.dModel * this.dModel);
    const ln1Params = 2 * this.dModel;
    const ffnParams = (this.dModel * this.dFfn + this.dFfn) + (this.dFfn * this.dModel + this.dModel);
    const ln2Params = 2 * this.dModel;

    perBlock = attnParams + ln1Params + ffnParams + ln2Params;
    total += perBlock * this.nLayers;

    const finalLn = 2 * this.dModel;
    const headParams = this.dModel * this.vocabSize;
    total += finalLn + headParams;

    return {
      total,
      trainable: total,
      tokenEmbeddings: tokenEmb,
      posEmbeddings: posEmb,
      transformerLayers: perBlock * this.nLayers,
      lmHead: headParams,
    };
  }

  /**
   * Oldinga uzatish (Forward Pass)
   * @param {number[]} tokenIds
   * @returns {{ logits: Float32Array[], lastLogits: Float32Array, cache: Object }}
   */
  forward(tokenIds) {
    const T = Math.min(tokenIds.length, this.maxSeqLen);
    const D = this.dModel;
    const V = this.vocabSize;

    // 1. Embeddings: wte[id] + wpe[pos]
    const x = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      const id = tokenIds[t];
      const validId = id >= 0 && id < V ? id : LLM_CONFIG.specialTokens.UNK;
      for (let d = 0; d < D; d++) {
        x[t][d] = this.wte[validId][d] + this.wpe[t][d];
      }
    }

    // 2. Transformer Bloklari
    let currentX = x;
    const blockCaches = [];
    for (let l = 0; l < this.nLayers; l++) {
      const res = this.blocks[l].forward(currentX);
      currentX = res.output;
      blockCaches.push(res.cache);
    }

    // 3. Final LayerNorm
    const normX = zerosMatrix(T, D);
    const finalLnCache = [];
    for (let t = 0; t < T; t++) {
      let mean = 0;
      for (let d = 0; d < D; d++) mean += currentX[t][d];
      mean /= D;

      let variance = 0;
      for (let d = 0; d < D; d++) {
        const diff = currentX[t][d] - mean;
        variance += diff * diff;
      }
      variance /= D;
      const stdInv = 1.0 / Math.sqrt(variance + 1e-5);

      const row = new Float32Array(D);
      const xHat = new Float32Array(D);
      for (let d = 0; d < D; d++) {
        xHat[d] = (currentX[t][d] - mean) * stdInv;
        row[d] = xHat[d] * this.ln_f_gamma[d] + this.ln_f_beta[d];
      }
      normX[t] = row;
      finalLnCache.push({ mean, variance, stdInv, xHat });
    }

    // 4. LM Head (Logits)
    const logits = zerosMatrix(T, V);
    for (let t = 0; t < T; t++) {
      for (let v = 0; v < V; v++) {
        let sum = 0;
        for (let d = 0; d < D; d++) {
          sum += normX[t][d] * this.lm_head[d][v];
        }
        logits[t][v] = sum;
      }
    }

    return {
      logits,
      lastLogits: logits[T - 1],
      cache: {
        tokenIds: tokenIds.slice(0, T),
        T,
        x,
        blockCaches,
        finalLayerOut: currentX,
        normX,
        finalLnCache,
      },
    };
  }

  /**
   * Final LayerNorm teskari differensiali
   */
  finalLayerNormBackward(dY, cache) {
    const T = dY.length;
    const D = this.dModel;
    const dX = [];

    for (let t = 0; t < T; t++) {
      const { stdInv, xHat } = cache[t];
      const dX_row = new Float32Array(D);

      let sum_dxhat = 0;
      let sum_dxhat_xhat = 0;
      const dxhat = new Float32Array(D);

      for (let d = 0; d < D; d++) {
        const dy = dY[t][d];
        this.dln_f_gamma[d] += dy * xHat[d];
        this.dln_f_beta[d] += dy;

        const dxh = dy * this.ln_f_gamma[d];
        dxhat[d] = dxh;
        sum_dxhat += dxh;
        sum_dxhat_xhat += dxh * xHat[d];
      }

      const invD = 1.0 / D;
      for (let d = 0; d < D; d++) {
        const grad = (stdInv * invD) * (D * dxhat[d] - sum_dxhat - xHat[d] * sum_dxhat_xhat);
        dX_row[d] = grad;
      }
      dX.push(dX_row);
    }
    return dX;
  }

  /**
   * Ketma-ketlik bo'yicha to'liq teskari differensial (Gradient Accumulation qo'llab-quvvatlaydi)
   * Vaznlar yangilanmaydi, gradientlar dW buferlariga to'planadi.
   * @param {Object} fwd - forward() natijasi
   * @param {number[]} tokenIds - Kirish tokenlari
   * @param {number[]} mask - Ixtiyoriy loss mask
   * @param {number} scale - Batch bo'yicha masshtab koeffitsienti
   * @returns {{ loss: number, perplexity: number }}
   */
  backward(fwd, tokenIds, mask = null, scale = 1.0) {
    const T = fwd.cache.T;
    const D = this.dModel;
    const V = this.vocabSize;
    const logits = fwd.logits;
    const { normX, finalLnCache, blockCaches } = fwd.cache;

    if (T < 2) return { loss: 0, perplexity: 1 };

    let totalLoss = 0;
    let validTokens = 0;
    const dLogits = zerosMatrix(T - 1, V);

    // 1. Cross-Entropy Loss va Logits gradienti
    for (let t = 0; t < T - 1; t++) {
      const targetToken = tokenIds[t + 1];
      const validTarget = targetToken >= 0 && targetToken < V ? targetToken : LLM_CONFIG.specialTokens.UNK;
      const probRow = softmax(logits[t]);

      const targetProb = Math.max(probRow[validTarget], 1e-12);
      const tokenLoss = -Math.log(targetProb);

      const weight = mask && mask[t + 1] !== undefined ? mask[t + 1] : 1.0;

      if (weight > 0) {
        totalLoss += tokenLoss * weight;
        validTokens += weight;

        for (let v = 0; v < V; v++) {
          const indicator = v === validTarget ? 1.0 : 0.0;
          dLogits[t][v] = (probRow[v] - indicator) * weight;
        }
      }
    }

    if (validTokens === 0) return { loss: 0, perplexity: 1 };

    const avgLoss = totalLoss / validTokens;
    const perplexity = Math.min(Math.exp(avgLoss), 9999.0);
    const gradNormFactor = (scale / validTokens);

    // 2. LM Head gradienti va dNormX
    const dNormX = zerosMatrix(T, D);
    for (let t = 0; t < T - 1; t++) {
      for (let v = 0; v < V; v++) {
        const dL = dLogits[t][v] * gradNormFactor;
        if (Math.abs(dL) < 1e-12) continue;

        for (let d = 0; d < D; d++) {
          this.dlm_head[d][v] += normX[t][d] * dL;
          dNormX[t][d] += dL * this.lm_head[d][v];
        }
      }
    }

    // 3. Final LayerNorm orqali gradient uzatish
    let dBlockOut = this.finalLayerNormBackward(dNormX, finalLnCache);

    // 4. Barcha Transformer bloklari orqali orqaga uzatish
    for (let l = this.nLayers - 1; l >= 0; l--) {
      dBlockOut = this.blocks[l].backward(dBlockOut, blockCaches[l]);
    }

    // 5. Token va Positional Embedding gradientlari
    for (let t = 0; t < T; t++) {
      const token = tokenIds[t];
      if (token >= 0 && token < this.vocabSize) {
        for (let d = 0; d < D; d++) {
          const g = dBlockOut[t][d];
          this.dwte[token][d] += g;
          if (t < this.maxSeqLen) {
            this.dwpe[t][d] += g;
          }
        }
      }
    }

    return { loss: avgLoss, perplexity };
  }

  /**
   * Yagona namunada o'qitish (Backward + AdamW Step)
   * Mavjud chaqiruvchilar bilan 100% mos keladi.
   * @param {number[]} tokenIds
   * @param {number} learningRate
   * @param {number[]} mask
   */
  trainStep(tokenIds, learningRate = 0.001, mask = null) {
    if (tokenIds.length < 2) return { loss: 0, perplexity: 1 };

    this.zeroGrad();
    const fwd = this.forward(tokenIds);
    const result = this.backward(fwd, tokenIds, mask, 1.0);
    this.optimizer.step(learningRate);
    return result;
  }

  /**
   * Mini-batch yoki jamlangan ketma-ketliklar bo'yicha o'qitish (Gradient Accumulation)
   * @param {Array<{ tokenIds: number[], mask?: number[] }>} batch
   * @param {number} learningRate
   */
  trainBatch(batch, learningRate = 0.001) {
    if (!batch || batch.length === 0) return { loss: 0, perplexity: 1 };

    this.zeroGrad();
    const batchSize = batch.length;
    let sumLoss = 0;
    let sumPpl = 0;
    let count = 0;

    for (const item of batch) {
      if (item.tokenIds.length < 2) continue;
      const fwd = this.forward(item.tokenIds);
      const res = this.backward(fwd, item.tokenIds, item.mask, 1.0 / batchSize);
      sumLoss += res.loss;
      sumPpl += res.perplexity;
      count++;
    }

    if (count > 0) {
      this.optimizer.step(learningRate);
      return {
        loss: sumLoss / count,
        perplexity: sumPpl / count,
      };
    }
    return { loss: 0, perplexity: 1 };
  }

  /**
   * Autoregressive Token Generation (Top-K, Top-P, Temperature, Repetition Penalty)
   * @param {number[]} promptTokenIds
   * @param {number} maxNewTokens
   * @param {Object} options
   */
  generate(promptTokenIds, maxNewTokens = 32, options = {}) {
    const temp = options.temperature !== undefined ? options.temperature : (LLM_CONFIG.generation.temperature || 0.7);
    const topK = options.topK !== undefined ? options.topK : (LLM_CONFIG.generation.topK || 12);
    const topP = options.topP !== undefined ? options.topP : (LLM_CONFIG.generation.topP || 0.9);
    const repPenalty = options.repetitionPenalty !== undefined ? options.repetitionPenalty : 1.15;
    const eosId = options.eosTokenId !== undefined ? options.eosTokenId : LLM_CONFIG.specialTokens.EOS;

    const tokens = [...promptTokenIds];

    for (let step = 0; step < maxNewTokens; step++) {
      if (tokens.length >= this.maxSeqLen) break;

      const fwd = this.forward(tokens);
      const logits = new Float32Array(fwd.lastLogits);

      // Repetition penalty
      if (repPenalty > 1.0) {
        const seenTokens = new Set(tokens);
        for (const token of seenTokens) {
          if (token >= 0 && token < this.vocabSize) {
            if (logits[token] > 0) logits[token] /= repPenalty;
            else logits[token] *= repPenalty;
          }
        }
      }

      const scaledLogits = new Float32Array(this.vocabSize);
      for (let i = 0; i < this.vocabSize; i++) {
        scaledLogits[i] = logits[i] / (temp || 1.0);
      }

      const probs = softmax(scaledLogits);

      const indexed = [];
      for (let i = 0; i < this.vocabSize; i++) {
        indexed.push({ id: i, prob: probs[i] });
      }
      indexed.sort((a, b) => b.prob - a.prob);

      // Top-K Filtering
      const k = Math.min(topK, indexed.length);
      let topCandidates = indexed.slice(0, k);

      // Top-P (Nucleus) Filtering
      if (topP < 1.0 && topCandidates.length > 1) {
        let cumSum = 0;
        const nucleus = [];
        for (const cand of topCandidates) {
          nucleus.push(cand);
          cumSum += cand.prob;
          if (cumSum >= topP) break;
        }
        topCandidates = nucleus;
      }

      let topSum = 0;
      for (let i = 0; i < topCandidates.length; i++) topSum += topCandidates[i].prob;

      const r = Math.random() * topSum;
      let cumulative = 0;
      let nextToken = topCandidates[0].id;

      for (let i = 0; i < topCandidates.length; i++) {
        cumulative += topCandidates[i].prob;
        if (r <= cumulative) {
          nextToken = topCandidates[i].id;
          break;
        }
      }

      tokens.push(nextToken);
      if (nextToken === eosId) {
        break;
      }
    }

    return tokens;
  }

  /**
   * Jonli tokenma-token asinxron generator (Real-time Token Streaming)
   * @param {number[]} promptTokenIds
   * @param {number} maxNewTokens
   * @param {Object} options
   * @param {Object} tokenizer - UzbekTokenizer (decode uchun)
   */
  async *generateStream(promptTokenIds, maxNewTokens = 32, options = {}, tokenizer = null) {
    const temp = options.temperature !== undefined ? options.temperature : (LLM_CONFIG.generation.temperature || 0.7);
    const topK = options.topK !== undefined ? options.topK : (LLM_CONFIG.generation.topK || 12);
    const topP = options.topP !== undefined ? options.topP : (LLM_CONFIG.generation.topP || 0.9);
    const repPenalty = options.repetitionPenalty !== undefined ? options.repetitionPenalty : 1.15;
    const eosId = options.eosTokenId !== undefined ? options.eosTokenId : LLM_CONFIG.specialTokens.EOS;

    const tokens = [...promptTokenIds];

    for (let step = 0; step < maxNewTokens; step++) {
      if (tokens.length >= this.maxSeqLen) break;

      const fwd = this.forward(tokens);
      const logits = new Float32Array(fwd.lastLogits);

      if (repPenalty > 1.0) {
        const seenTokens = new Set(tokens);
        for (const token of seenTokens) {
          if (token >= 0 && token < this.vocabSize) {
            if (logits[token] > 0) logits[token] /= repPenalty;
            else logits[token] *= repPenalty;
          }
        }
      }

      const scaledLogits = new Float32Array(this.vocabSize);
      for (let i = 0; i < this.vocabSize; i++) {
        scaledLogits[i] = logits[i] / (temp || 1.0);
      }

      const probs = softmax(scaledLogits);
      const indexed = [];
      for (let i = 0; i < this.vocabSize; i++) {
        indexed.push({ id: i, prob: probs[i] });
      }
      indexed.sort((a, b) => b.prob - a.prob);

      const k = Math.min(topK, indexed.length);
      let topCandidates = indexed.slice(0, k);

      if (topP < 1.0 && topCandidates.length > 1) {
        let cumSum = 0;
        const nucleus = [];
        for (const cand of topCandidates) {
          nucleus.push(cand);
          cumSum += cand.prob;
          if (cumSum >= topP) break;
        }
        topCandidates = nucleus;
      }

      let topSum = 0;
      for (let i = 0; i < topCandidates.length; i++) topSum += topCandidates[i].prob;

      const r = Math.random() * topSum;
      let cumulative = 0;
      let nextToken = topCandidates[0].id;

      for (let i = 0; i < topCandidates.length; i++) {
        cumulative += topCandidates[i].prob;
        if (r <= cumulative) {
          nextToken = topCandidates[i].id;
          break;
        }
      }

      tokens.push(nextToken);
      const isEos = nextToken === eosId;
      const tokenStr = tokenizer ? tokenizer.decode([nextToken], true) : null;
      yield {
        tokenId: nextToken,
        tokenStr,
        step,
        isEos,
      };

      if (isEos) {
        break;
      }
    }
  }

  /**
   * Checkpoint saqlash
   */
  toJSON() {
    return {
      config: this.config,
      vocabSize: this.vocabSize,
      dModel: this.dModel,
      nHeads: this.nHeads,
      headDim: this.headDim,
      dFfn: this.dFfn,
      nLayers: this.nLayers,
      maxSeqLen: this.maxSeqLen,
      wte: this.wte.map((row) => Array.from(row)),
      wpe: this.wpe.map((row) => Array.from(row)),
      ln_f_gamma: Array.from(this.ln_f_gamma),
      ln_f_beta: Array.from(this.ln_f_beta),
      lm_head: this.lm_head.map((row) => Array.from(row)),
      blocks: this.blocks.map((b) => ({
        W_q: b.W_q.map((row) => Array.from(row)),
        W_k: b.W_k.map((row) => Array.from(row)),
        W_v: b.W_v.map((row) => Array.from(row)),
        W_o: b.W_o.map((row) => Array.from(row)),
        ln1_gamma: Array.from(b.ln1_gamma),
        ln1_beta: Array.from(b.ln1_beta),
        W_f1: b.W_f1.map((row) => Array.from(row)),
        b_f1: Array.from(b.b_f1),
        W_f2: b.W_f2.map((row) => Array.from(row)),
        b_f2: Array.from(b.b_f2),
        ln2_gamma: Array.from(b.ln2_gamma),
        ln2_beta: Array.from(b.ln2_beta),
      })),
      optimizer: this.optimizer.toJSON(),
    };
  }

  /**
   * Checkpointdan tiklash
   */
  static fromJSON(data) {
    const model = new CausalTransformerModel(data.config);
    model.wte = data.wte.map((r) => new Float32Array(r));
    model.wpe = data.wpe.map((r) => new Float32Array(r));
    model.ln_f_gamma = new Float32Array(data.ln_f_gamma);
    model.ln_f_beta = new Float32Array(data.ln_f_beta);
    model.lm_head = data.lm_head.map((r) => new Float32Array(r));

    model.blocks = data.blocks.map((bd, idx) => {
      const b = new TransformerBlock(model.dModel, model.nHeads, model.headDim, model.dFfn, idx);
      b.W_q = bd.W_q.map((r) => new Float32Array(r));
      b.W_k = bd.W_k.map((r) => new Float32Array(r));
      b.W_v = bd.W_v.map((r) => new Float32Array(r));
      b.W_o = bd.W_o.map((r) => new Float32Array(r));
      b.ln1_gamma = new Float32Array(bd.ln1_gamma);
      b.ln1_beta = new Float32Array(bd.ln1_beta);
      b.W_f1 = bd.W_f1.map((r) => new Float32Array(r));
      b.b_f1 = new Float32Array(bd.b_f1);
      b.W_f2 = bd.W_f2.map((r) => new Float32Array(r));
      b.b_f2 = new Float32Array(bd.b_f2);
      b.ln2_gamma = new Float32Array(bd.ln2_gamma);
      b.ln2_beta = new Float32Array(bd.ln2_beta);
      return b;
    });

    if (data.optimizer) {
      model.optimizer.fromJSON(data.optimizer);
    }

    return model;
  }
}

module.exports = CausalTransformerModel;
