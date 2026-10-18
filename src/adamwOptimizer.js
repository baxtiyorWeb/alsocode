"use strict";

/**
 * =======================================================================
 *  ANALYTICAL ADAMW OPTIMIZER FOR PURE JS TRANSFORMER (ADAMW-JS)
 * =======================================================================
 *  - Birinchi tartibli moment (m - momentum, beta1 = 0.9);
 *  - Ikkinchi tartibli moment (v - variance, beta2 = 0.999);
 *  - Bias correction: m_hat = m / (1 - beta1^t), v_hat = v / (1 - beta2^t);
 *  - Decoupled Weight Decay (Loshchilov & Hutter, 2019):
 *    w = w - lr * (m_hat / (sqrt(v_hat) + eps) + weightDecay * w);
 *  - Gradient norm clipping (portlash va tebranishlardan himoya);
 *  - 1D parametrlar (bias, LayerNorm gamma/beta) uchun weight decay qilinmaydi.
 * =======================================================================
 */

class AdamWOptimizer {
  /**
   * @param {Object} model - CausalTransformerModel
   * @param {Object} options
   */
  constructor(model, options = {}) {
    this.model = model;
    this.lr = options.lr !== undefined ? options.lr : 0.001;
    this.beta1 = options.beta1 !== undefined ? options.beta1 : 0.9;
    this.beta2 = options.beta2 !== undefined ? options.beta2 : 0.999;
    this.eps = options.eps !== undefined ? options.eps : 1e-8;
    this.weightDecay = options.weightDecay !== undefined ? options.weightDecay : 0.01;
    this.gradClip = options.gradClip !== undefined ? options.gradClip : 1.0;
    this.stepCount = 0;

    // Har bir parametr uchun m va v momentlarini saqlash xaritasi
    this.states = new Map();
  }

  /**
   * Massiv yoki matritsa uchun bo'sh moment buferlarini yaratish
   */
  _getOrCreateState(key, shape, isMatrix = false) {
    if (!this.states.has(key)) {
      if (isMatrix) {
        const [rows, cols] = shape;
        const m = [];
        const v = [];
        for (let r = 0; r < rows; r++) {
          m.push(new Float32Array(cols));
          v.push(new Float32Array(cols));
        }
        this.states.set(key, { m, v, isMatrix: true, rows, cols });
      } else {
        const len = shape[0];
        this.states.set(key, {
          m: new Float32Array(len),
          v: new Float32Array(len),
          isMatrix: false,
          len,
        });
      }
    }
    return this.states.get(key);
  }

  /**
   * Barcha gradient buferlarini nolga tenglash
   */
  zeroGrad() {
    if (this.model && typeof this.model.zeroGrad === "function") {
      this.model.zeroGrad();
    }
  }

  /**
   * Global gradient normasi bo'yicha qirqish (Gradient Clipping)
   */
  clipGradients(maxNorm = 1.0) {
    let totalNormSq = 0;
    const allGrads = this.model.getAllGradients();

    for (const g of allGrads) {
      if (g.isMatrix) {
        for (let r = 0; r < g.rows; r++) {
          const row = g.grad[r];
          for (let c = 0; c < g.cols; c++) {
            totalNormSq += row[c] * row[c];
          }
        }
      } else {
        for (let i = 0; i < g.len; i++) {
          totalNormSq += g.grad[i] * g.grad[i];
        }
      }
    }

    const totalNorm = Math.sqrt(totalNormSq);
    if (totalNorm > maxNorm && totalNorm > 1e-9) {
      const scale = maxNorm / totalNorm;
      for (const g of allGrads) {
        if (g.isMatrix) {
          for (let r = 0; r < g.rows; r++) {
            const row = g.grad[r];
            for (let c = 0; c < g.cols; c++) {
              row[c] *= scale;
            }
          }
        } else {
          for (let i = 0; i < g.len; i++) {
            g.grad[i] *= scale;
          }
        }
      }
    }
    return totalNorm;
  }

  /**
   * 1 qadam AdamW yangilanishini amalga oshirish
   * @param {number|null} customLr - Maxsus learning rate (masalan LR scheduler dan)
   */
  step(customLr = null) {
    this.stepCount++;
    const lr = customLr !== null ? customLr : this.lr;
    const b1 = this.beta1;
    const b2 = this.beta2;
    const eps = this.eps;
    const wd = this.weightDecay;

    // Bias correction koeffitsientlari
    const biasCorrection1 = 1.0 - Math.pow(b1, this.stepCount);
    const biasCorrection2 = 1.0 - Math.pow(b2, this.stepCount);

    // Gradientlarni qirqish
    if (this.gradClip > 0) {
      this.clipGradients(this.gradClip);
    }

    const params = this.model.getAllParametersWithGrads();

    for (const p of params) {
      const state = this._getOrCreateState(p.id, p.shape, p.isMatrix);
      const applyDecay = p.decay !== false && p.isMatrix; // Faqat 2D og'irliklarga weight decay

      if (p.isMatrix) {
        const rows = p.shape[0];
        const cols = p.shape[1];
        const data = p.data;
        const grad = p.grad;
        const m = state.m;
        const v = state.v;

        for (let r = 0; r < rows; r++) {
          const dRow = data[r];
          const gRow = grad[r];
          const mRow = m[r];
          const vRow = v[r];

          for (let c = 0; c < cols; c++) {
            const g = gRow[c];

            // 1. Birinchi va ikkinchi momentlarni yangilash
            const newM = b1 * mRow[c] + (1.0 - b1) * g;
            const newV = b2 * vRow[c] + (1.0 - b2) * g * g;
            mRow[c] = newM;
            vRow[c] = newV;

            // 2. Yangilanish qadami
            const denom = Math.sqrt(newV / biasCorrection2) + eps;
            const update = (newM / biasCorrection1) / denom;

            // 3. Vaznni yangilash + Decoupled Weight Decay
            if (applyDecay) {
              dRow[c] -= lr * (update + wd * dRow[c]);
            } else {
              dRow[c] -= lr * update;
            }
          }
        }
      } else {
        // 1D parametrlar (bias, LayerNorm gamma va beta)
        const len = p.shape[0];
        const data = p.data;
        const grad = p.grad;
        const m = state.m;
        const v = state.v;

        for (let i = 0; i < len; i++) {
          const g = grad[i];

          const newM = b1 * m[i] + (1.0 - b1) * g;
          const newV = b2 * v[i] + (1.0 - b2) * g * g;
          m[i] = newM;
          v[i] = newV;

          const denom = Math.sqrt(newV / biasCorrection2) + eps;
          const update = (newM / biasCorrection1) / denom;

          if (applyDecay) {
            data[i] -= lr * (update + wd * data[i]);
          } else {
            data[i] -= lr * update;
          }
        }
      }
    }
  }

  /**
   * Optimizer holatini eksport qilish
   */
  toJSON() {
    const serializedStates = {};
    for (const [key, val] of this.states.entries()) {
      if (val.isMatrix) {
        serializedStates[key] = {
          isMatrix: true,
          m: val.m.map((r) => Array.from(r)),
          v: val.v.map((r) => Array.from(r)),
        };
      } else {
        serializedStates[key] = {
          isMatrix: false,
          m: Array.from(val.m),
          v: Array.from(val.v),
        };
      }
    }
    return {
      stepCount: this.stepCount,
      lr: this.lr,
      states: serializedStates,
    };
  }

  /**
   * Optimizer holatini tiklash
   */
  fromJSON(data) {
    if (!data) return;
    this.stepCount = data.stepCount || 0;
    this.lr = data.lr || this.lr;
    if (data.states) {
      for (const [key, val] of Object.entries(data.states)) {
        if (val.isMatrix) {
          this.states.set(key, {
            isMatrix: true,
            rows: val.m.length,
            cols: val.m[0].length,
            m: val.m.map((r) => new Float32Array(r)),
            v: val.v.map((r) => new Float32Array(r)),
          });
        } else {
          this.states.set(key, {
            isMatrix: false,
            len: val.m.length,
            m: new Float32Array(val.m),
            v: new Float32Array(val.v),
          });
        }
      }
    }
  }
}

module.exports = AdamWOptimizer;
