/**
 * =======================================================================
 *  GPU-ACCELERATED NEURAL NETWORK ENGINE (WebGL / NVIDIA CUDA Shaders)
 * =======================================================================
 *  Aparati darajasidagi yuqori tezlikdagi neyron tarmoq o'qitish moduli:
 *  - HeadlessGL / WebGL va GPU.js orqali parallel shaderlar yaratadi;
 *  - Matritsa ko'paytirish, aktivatsiya va orqaga tarqalish (Backpropagation)
 *    to'liq GPU video-xotirasi (VRAM) va hisoblash yadrolarida bajariladi;
 *  - Mini-Batch parallelizatsiyasi orqali minglab vaznlar bir paytda yangilanadi;
 *  - O'rganilgan og'irliklar CPU NeuralNetwork bilan 100% mos va almashinuvchan.
 * =======================================================================
 */

const { GPU } = require("gpu.js");
const deviceManager = require("./deviceManager");

class GpuNeuralNetwork {
  /**
   * @param {number} inputNodes - Lug'at o'lchami (kirish neyronlari)
   * @param {number} hiddenNodes - Yashirin qatlam neyronlari soni
   * @param {number} outputNodes - Chiqish toifalari soni
   * @param {Object} options - Qo'shimcha sozlamalar (batchSize, learningRate)
   */
  constructor(inputNodes, hiddenNodes, outputNodes, options = {}) {
    this.inputNodes = inputNodes;
    this.hiddenNodes = hiddenNodes;
    this.outputNodes = outputNodes;
    this.batchSize = options.batchSize || 64;
    this.learningRate = options.learningRate || 2.0;

    this.gpu = null;
    this.kernels = null;
    this.isReady = false;

    this._initGPU();
  }

  _initGPU() {
    try {
      this.gpu = new GPU({ mode: "gpu" });

      const I = this.inputNodes;
      const H = this.hiddenNodes;
      const O = this.outputNodes;
      const B = this.batchSize;

      // 1. Forward Hidden Kernel: [H, B]
      const forwardHidden = this.gpu.createKernel(function (X, W_ih, biasH, I_dim) {
        let sum = biasH[this.thread.x];
        for (let i = 0; i < I_dim; i++) {
          sum += X[this.thread.y][i] * W_ih[this.thread.x][i];
        }
        return 1 / (1 + Math.exp(-sum));
      }).setOutput([H, B]);

      // 2. Forward Output Kernel: [O, B]
      const forwardOutput = this.gpu.createKernel(function (Hidden, W_ho, biasO, H_dim) {
        let sum = biasO[this.thread.x];
        for (let h = 0; h < H_dim; h++) {
          sum += Hidden[this.thread.y][h] * W_ho[this.thread.x][h];
        }
        return 1 / (1 + Math.exp(-sum));
      }).setOutput([O, B]);

      // 3. Output Delta Kernel: [O, B]
      const calcOutputDelta = this.gpu.createKernel(function (Targets, Outputs) {
        const t = Targets[this.thread.y][this.thread.x];
        const o = Outputs[this.thread.y][this.thread.x];
        return (t - o) * o * (1 - o);
      }).setOutput([O, B]);

      // 4. Hidden Delta Kernel: [H, B]
      const calcHiddenDelta = this.gpu.createKernel(function (OutputDelta, W_ho, Hidden, O_dim) {
        let err = 0;
        for (let o = 0; o < O_dim; o++) {
          err += OutputDelta[this.thread.y][o] * W_ho[o][this.thread.x];
        }
        const h = Hidden[this.thread.y][this.thread.x];
        return err * h * (1 - h);
      }).setOutput([H, B]);

      // 5. Update Weights HO Kernel: [H, O]
      const updateWeightsHO = this.gpu.createKernel(function (W_ho, OutputDelta, Hidden, B_dim, stepSize) {
        let grad = 0;
        for (let b = 0; b < B_dim; b++) {
          grad += OutputDelta[b][this.thread.y] * Hidden[b][this.thread.x];
        }
        return W_ho[this.thread.y][this.thread.x] + grad * stepSize;
      }).setOutput([H, O]);

      // 6. Update Weights IH Kernel: [I, H]
      const updateWeightsIH = this.gpu.createKernel(function (W_ih, HiddenDelta, X, B_dim, stepSize) {
        let grad = 0;
        for (let b = 0; b < B_dim; b++) {
          grad += HiddenDelta[b][this.thread.y] * X[b][this.thread.x];
        }
        return W_ih[this.thread.y][this.thread.x] + grad * stepSize;
      }).setOutput([I, H]);

      this.kernels = {
        forwardHidden,
        forwardOutput,
        calcOutputDelta,
        calcHiddenDelta,
        updateWeightsHO,
        updateWeightsIH,
      };

      this.isReady = true;
    } catch (err) {
      console.warn("⚠️ GPU initsializatsiyasida ogohlantirish:", err.message);
      this.isReady = false;
      this.destroy();
    }
  }

  /**
   * Datasetni paketlarga (batches) ajratish
   */
  _prepareBatches(dataset) {
    const N = dataset.length;
    const B = this.batchSize;
    const I = this.inputNodes;
    const O = this.outputNodes;
    const numBatches = Math.ceil(N / B);
    const batches = [];

    for (let b = 0; b < numBatches; b++) {
      const start = b * B;
      const end = Math.min(start + B, N);
      const actualSize = end - start;
      const xBatch = [];
      const tBatch = [];

      for (let i = 0; i < B; i++) {
        if (i < actualSize) {
          xBatch.push(dataset[start + i].input);
          tBatch.push(dataset[start + i].target);
        } else {
          // Oxirgi paketni 0 lar bilan to'ldirish (padding)
          xBatch.push(new Array(I).fill(0));
          tBatch.push(new Array(O).fill(0));
        }
      }

      batches.push({ xBatch, tBatch, actualSize });
    }

    return batches;
  }

  /**
   * GPU orqali to'liq ma'lumotlar to'plamini o'qitish (Full GPU Training Pipeline)
   * @param {Array<{input: number[], target: number[]}>} dataset
   * @param {Object} options - { epochs, learningRate, initialWeights, onTick }
   */
  train(dataset, options = {}) {
    if (!this.isReady) {
      throw new Error("GPU dvigateli tayyor emas yoki tizimda GPU qo'llab-quvvatlanmadi.");
    }

    const epochs = options.epochs || 120;
    const lr = options.learningRate || this.learningRate;
    const onTick = options.onTick || null;
    const I = this.inputNodes;
    const H = this.hiddenNodes;
    const O = this.outputNodes;
    const B = this.batchSize;
    const stepSize = lr / B;

    // Boshlang'ich vaznlar (agar berilmagan bo'lsa tasodifiy)
    let W_ih = options.initialWeights && options.initialWeights.weightsIH
      ? options.initialWeights.weightsIH
      : Array.from({ length: H }, () => Array.from({ length: I }, () => (Math.random() * 2 - 1) * 0.15));

    let W_ho = options.initialWeights && options.initialWeights.weightsHO
      ? options.initialWeights.weightsHO
      : Array.from({ length: O }, () => Array.from({ length: H }, () => (Math.random() * 2 - 1) * 0.15));

    let biasH = options.initialWeights && options.initialWeights.biasH
      ? [...options.initialWeights.biasH]
      : Array.from({ length: H }, () => 0);

    let biasO = options.initialWeights && options.initialWeights.biasO
      ? [...options.initialWeights.biasO]
      : Array.from({ length: O }, () => 0);

    const batches = this._prepareBatches(dataset);
    const startTime = Date.now();
    let finalLoss = 1.0;

    for (let ep = 1; ep <= epochs; ep++) {
      let epochLoss = 0;
      let sampleCount = 0;

      for (const batch of batches) {
        // 1. GPU Forward Pass
        const H_out = this.kernels.forwardHidden(batch.xBatch, W_ih, biasH, I);
        const Y_out = this.kernels.forwardOutput(H_out, W_ho, biasO, H);

        // 2. GPU Loss & Gradient hisoblash
        const d_out = this.kernels.calcOutputDelta(batch.tBatch, Y_out);
        const d_hid = this.kernels.calcHiddenDelta(d_out, W_ho, H_out, O);

        // 3. GPU Matritsa Og'irliklarini yangilash
        W_ho = this.kernels.updateWeightsHO(W_ho, d_out, H_out, B, stepSize);
        W_ih = this.kernels.updateWeightsIH(W_ih, d_hid, batch.xBatch, B, stepSize);

        // 4. Bias qiymatlarini yangilash (vektor qo'shish)
        for (let o = 0; o < O; o++) {
          let bSum = 0;
          for (let i = 0; i < batch.actualSize; i++) bSum += d_out[i][o];
          biasO[o] += bSum * stepSize;
        }
        for (let h = 0; h < H; h++) {
          let bSum = 0;
          for (let i = 0; i < batch.actualSize; i++) bSum += d_hid[i][h];
          biasH[h] += bSum * stepSize;
        }

        // Loss hisobi (faqat monitoring uchun har bir necha epoxada)
        if (ep % 10 === 0 || ep === 1 || ep === epochs) {
          for (let i = 0; i < batch.actualSize; i++) {
            for (let o = 0; o < O; o++) {
              const diff = batch.tBatch[i][o] - Y_out[i][o];
              epochLoss += diff * diff;
            }
          }
          sampleCount += batch.actualSize;
        }
      }

      if (sampleCount > 0) {
        finalLoss = epochLoss / (sampleCount * O);
      }

      if (typeof onTick === "function") {
        onTick(ep, epochs, finalLoss, startTime);
      }

      // Early Stopping
      if (finalLoss < 0.0001 && ep >= 40) {
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      weightsIH: W_ih,
      weightsHO: W_ho,
      biasH,
      biasO,
      durationMs,
      finalLoss,
      epochsCompleted: epochs,
    };
  }

  destroy() {
    if (this.gpu) {
      try {
        this.gpu.destroy();
      } catch (e) { }
      this.gpu = null;
      this.kernels = null;
      this.isReady = false;
    }
  }
}

module.exports = GpuNeuralNetwork;
