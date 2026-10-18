"use strict";

const LLM_CONFIG = require("../src/llmConfig");

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

class TestTransformerBlock {
  constructor(dModel, nHeads, headDim, dFfn) {
    this.dModel = dModel;
    this.nHeads = nHeads;
    this.headDim = headDim;
    this.dFfn = dFfn;

    this.ln1_gamma = new Float32Array(dModel).fill(1.0);
    this.ln1_beta = new Float32Array(dModel).fill(0.0);

    this.W_q = randomMatrix(dModel, dModel);
    this.W_k = randomMatrix(dModel, dModel);
    this.W_v = randomMatrix(dModel, dModel);
    this.W_o = randomMatrix(dModel, dModel);

    this.W_f1 = randomMatrix(dModel, dFfn);
    this.b_f1 = new Float32Array(dFfn).fill(0.0);
    this.W_f2 = randomMatrix(dFfn, dModel);
    this.b_f2 = new Float32Array(dModel).fill(0.0);

    this.ln2_gamma = new Float32Array(dModel).fill(1.0);
    this.ln2_beta = new Float32Array(dModel).fill(0.0);
  }

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

  layerNormBackward(dY, cache, gamma, beta, lr) {
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
        const gGrad = Math.max(-1.0, Math.min(1.0, dy * xHat[d]));
        const bGrad = Math.max(-1.0, Math.min(1.0, dy));
        gamma[d] -= lr * gGrad * 0.1;
        beta[d] -= lr * bGrad * 0.1;

        const dxh = dy * gamma[d];
        dxhat[d] = dxh;
        sum_dxhat += dxh;
        sum_dxhat_xhat += dxh * xHat[d];
      }

      const invD = 1.0 / D;
      for (let d = 0; d < D; d++) {
        const grad = (stdInv * invD) * (D * dxhat[d] - sum_dxhat - xHat[d] * sum_dxhat_xhat);
        dX_row[d] = Math.max(-1.0, Math.min(1.0, grad));
      }
      dX.push(dX_row);
    }
    return dX;
  }

  forward(x) {
    const T = x.length;
    const D = this.dModel;
    const H = this.nHeads;
    const Dh = this.headDim;

    const { out: xNorm1, cache: ln1Cache } = this.layerNorm(x, this.ln1_gamma, this.ln1_beta);

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

    const x1 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        x1[t][d] = x[t][d] + attnProj[t][d];
      }
    }

    const { out: xNorm2, cache: ln2Cache } = this.layerNorm(x1, this.ln2_gamma, this.ln2_beta);

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

    const x2 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        x2[t][d] = x1[t][d] + ffnOut[t][d];
      }
    }

    return {
      output: x2,
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
      },
    };
  }

  backward(dOut, cache, lr) {
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
      ffnHidden
    } = cache;

    // 1. Residual 2: x2 = x1 + ffnOut
    const dx1 = cloneMatrix(dOut);
    const dFfnOut = dOut;

    // 2. FFN W_f2 va b_f2 gradientlari
    const dFfnHidden = zerosMatrix(T, this.dFfn);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        const dy = dFfnOut[t][d];
        this.b_f2[d] -= lr * Math.max(-1.0, Math.min(1.0, dy));
        for (let f = 0; f < this.dFfn; f++) {
          const grad = ffnHidden[t][f] * dy;
          this.W_f2[f][d] -= lr * Math.max(-1.0, Math.min(1.0, grad));
          dFfnHidden[t][f] += dy * this.W_f2[f][d];
        }
      }
    }

    // 3. FFN GELU va W_f1, b_f1
    const dXNorm2 = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let f = 0; f < this.dFfn; f++) {
        const dAct = dFfnHidden[t][f] * geluDerivative(ffnSums[t][f]);
        this.b_f1[f] -= lr * Math.max(-1.0, Math.min(1.0, dAct));
        for (let d = 0; d < D; d++) {
          const grad = xNorm2[t][d] * dAct;
          this.W_f1[d][f] -= lr * Math.max(-1.0, Math.min(1.0, grad));
          dXNorm2[t][d] += dAct * this.W_f1[d][f];
        }
      }
    }

    // 4. Pre-LayerNorm 2 orqali x1 ga uzatish
    const dLn2_in = this.layerNormBackward(dXNorm2, ln2Cache, this.ln2_gamma, this.ln2_beta, lr);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        dx1[t][d] += dLn2_in[t][d];
      }
    }

    // 5. Residual 1: x1 = x + attnProj
    const dx = cloneMatrix(dx1);
    const dAttnProj = dx1;

    // 6. W_o gradientlari
    const dConcatHeads = zerosMatrix(T, D);
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        const dy = dAttnProj[t][i];
        for (let j = 0; j < D; j++) {
          const grad = concatHeads[t][j] * dy;
          this.W_o[j][i] -= lr * Math.max(-1.0, Math.min(1.0, grad));
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

      // Softmax backward
      for (let i = 0; i < T; i++) {
        let sum_p_dp = 0;
        for (let j = 0; j <= i; j++) {
          sum_p_dp += hAttn[i][j] * dHAttn[i][j];
        }
        for (let j = 0; j <= i; j++) {
          const dRaw = hAttn[i][j] * (dHAttn[i][j] - sum_p_dp);
          // Scaled dot product
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
          this.W_q[j][i] -= lr * Math.max(-1.0, Math.min(1.0, xVal * dq));
          this.W_k[j][i] -= lr * Math.max(-1.0, Math.min(1.0, xVal * dk));
          this.W_v[j][i] -= lr * Math.max(-1.0, Math.min(1.0, xVal * dv));
          dXNorm1[t][j] += dq * this.W_q[j][i] + dk * this.W_k[j][i] + dv * this.W_v[j][i];
        }
      }
    }

    // 9. Pre-LayerNorm 1 orqali dx ga uzatish
    const dLn1_in = this.layerNormBackward(dXNorm1, ln1Cache, this.ln1_gamma, this.ln1_beta, lr);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        dx[t][d] += dLn1_in[t][d];
      }
    }

    return dx;
  }
}

// Sinov
const block = new TestTransformerBlock(16, 2, 8, 32);
const x = randomMatrix(4, 16);
const fwd = block.forward(x);
const dOut = randomMatrix(4, 16);

const wq_before = block.W_q[0][0];
const wf1_before = block.W_f1[0][0];
const dx = block.backward(dOut, fwd.cache, 0.01);

console.log("Block Backward Test:");
console.log("- dx shape:", dx.length, "x", dx[0].length);
console.log("- W_q before:", wq_before, "after:", block.W_q[0][0], "diff:", block.W_q[0][0] - wq_before);
console.log("- W_f1 before:", wf1_before, "after:", block.W_f1[0][0], "diff:", block.W_f1[0][0] - wf1_before);
console.log("- Non-zero updates confirmed:", (block.W_q[0][0] !== wq_before && block.W_f1[0][0] !== wf1_before));
