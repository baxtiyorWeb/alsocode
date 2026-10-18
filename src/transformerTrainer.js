"use strict";

const fs = require("fs");
const path = require("path");
const LLM_CONFIG = require("./llmConfig");
const CausalTransformerModel = require("./transformerModel");
const UzbekTokenizer = require("./uzbekTokenizer");
const DatasetPipeline = require("./datasetPipeline");

/**
 * =======================================================================
 *  PRODUCTION-GRADE TRANSFORMER TRAINING & EVALUATION ENGINE
 * =======================================================================
 *  - Causal next-token prediction;
 *  - Train vs Validation alohida metrikalar (Loss & Perplexity);
 *  - Cosine Learning Rate Schedule & Warmup;
 *  - Early Stopping va eng yaxshi (Best Val Loss) checkpointni saqlash;
 *  - To'liq Checkpoint & Resume (Model og'irliklari, epoxa, step, val_loss);
 *  - Token throughput va vaqt hisobi.
 * =======================================================================
 */

class TransformerTrainer {
  /**
   * @param {CausalTransformerModel} model
   * @param {UzbekTokenizer} tokenizer
   * @param {Object} options
   */
  constructor(model, tokenizer, options = {}) {
    this.model = model;
    this.tokenizer = tokenizer;
    this.config = { ...LLM_CONFIG.training, ...options };

    this.currentEpoch = 0;
    this.globalStep = 0;
    this.bestValLoss = Infinity;
    this.history = [];
    this.checkpointDir = this.config.checkpointDir || "./data/checkpoints";

    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Learning rate hisoblash (Warmup + Cosine Decay)
   * @param {number} step
   * @param {number} totalSteps
   * @returns {number}
   */
  getLearningRate(step, totalSteps) {
    const baseLr = this.config.learningRate;
    const minLr = this.config.minLearningRate || baseLr * 0.1;
    const warmupSteps = Math.max(1, Math.floor(totalSteps * (this.config.warmupStepsRatio || 0.1)));

    if (step < warmupSteps) {
      // Linear Warmup
      return minLr + (baseLr - minLr) * (step / warmupSteps);
    }

    // Cosine Decay
    const progress = (step - warmupSteps) / Math.max(1, totalSteps - warmupSteps);
    return minLr + 0.5 * (baseLr - minLr) * (1.0 + Math.cos(Math.PI * progress));
  }

  /**
   * Validation to'plamida modelni baholash (Inference / Eval Rejimi)
   * @param {Array<Object>} valSamples
   * @returns {{ valLoss: number, valPerplexity: number }}
   */
  evaluate(valSamples, maxEval = 150) {
    if (!valSamples || valSamples.length === 0) {
      return { valLoss: 0, valPerplexity: 1.0 };
    }

    const subset = valSamples.length > maxEval ? valSamples.slice(0, maxEval) : valSamples;
    let totalLoss = 0;
    let totalTokens = 0;

    for (const sample of subset) {
      const tokenIds = sample.tokenIds;
      if (!tokenIds || tokenIds.length < 2) continue;

      const T = Math.min(tokenIds.length, this.model.maxSeqLen);
      const fwd = this.model.forward(tokenIds);

      for (let t = 0; t < T - 1; t++) {
        const target = tokenIds[t + 1];
        if (target < 0 || target >= this.model.vocabSize) continue;

        const weight = sample.mask && sample.mask[t + 1] !== undefined ? sample.mask[t + 1] : 1.0;
        if (weight <= 0) continue;

        // Softmax
        let maxL = -Infinity;
        for (let v = 0; v < this.model.vocabSize; v++) {
          if (fwd.logits[t][v] > maxL) maxL = fwd.logits[t][v];
        }
        let sumExp = 0;
        for (let v = 0; v < this.model.vocabSize; v++) {
          sumExp += Math.exp(fwd.logits[t][v] - maxL);
        }
        const targetProb = Math.max(Math.exp(fwd.logits[t][target] - maxL) / (sumExp || 1e-9), 1e-12);
        totalLoss += -Math.log(targetProb) * weight;
        totalTokens += weight;
      }
    }

    const avgLoss = totalTokens > 0 ? totalLoss / totalTokens : 0;
    const perplexity = Math.min(Math.exp(avgLoss), 9999.0);

    return { valLoss: avgLoss, valPerplexity: perplexity };
  }

  /**
   * Checkpointni to'liq saqlash
   * @param {string} tag
   */
  saveCheckpoint(tag = "latest") {
    const checkpointFile = path.join(this.checkpointDir, `transformer_${tag}.json`);
    const payload = {
      modelData: this.model.toJSON(),
      currentEpoch: this.currentEpoch,
      globalStep: this.globalStep,
      bestValLoss: this.bestValLoss,
      config: this.config,
      history: this.history,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(checkpointFile, JSON.stringify(payload), "utf-8");
    return checkpointFile;
  }

  /**
   * Checkpointdan qayta davom ettirish (Resume)
   * @param {string} tag
   */
  resumeFromCheckpoint(tag = "latest") {
    const checkpointFile = path.join(this.checkpointDir, `transformer_${tag}.json`);
    if (!fs.existsSync(checkpointFile)) {
      return false;
    }

    const raw = fs.readFileSync(checkpointFile, "utf-8");
    const payload = JSON.parse(raw);

    this.model = CausalTransformerModel.fromJSON(payload.modelData);
    this.currentEpoch = payload.currentEpoch || 0;
    this.globalStep = payload.globalStep || 0;
    this.bestValLoss = payload.bestValLoss || Infinity;
    this.history = payload.history || [];

    return true;
  }

  /**
   * To'liq trening sikli (Training Loop)
   * @param {Array<Object>} trainSamples
   * @param {Array<Object>} valSamples
   * @param {Function} onProgress
   * @returns {{ bestValLoss: number, totalEpochs: number, history: Array<Object> }}
   */
  train(trainSamples, valSamples, onProgress = null) {
    const epochs = this.config.epochs || 40;
    const batchSize = Math.max(1, this.config.batchSize || 1);
    const stepsPerEpoch = Math.ceil(trainSamples.length / batchSize);
    const totalSteps = epochs * stepsPerEpoch;
    const evalInterval = this.config.evalIntervalEpochs || 2;
    const patience = this.config.earlyStoppingPatience || 6;
    let epochsWithoutImprovement = 0;

    const startTime = Date.now();
    let totalProcessedTokens = 0;

    for (let epoch = this.currentEpoch + 1; epoch <= epochs; epoch++) {
      this.currentEpoch = epoch;
      let epochTrainLoss = 0;
      let epochTokens = 0;
      const epochStartTime = Date.now();

      // Har bir epoxada deterministik aralashtirish
      const shuffled = [...trainSamples].sort(() => Math.random() - 0.5);

      let batchIndex = 0;
      for (let i = 0; i < shuffled.length; i += batchSize) {
        batchIndex++;
        this.globalStep++;
        const batch = shuffled.slice(i, i + batchSize);
        const lr = this.getLearningRate(this.globalStep, totalSteps);

        let stepResult;
        if (batchSize === 1) {
          stepResult = this.model.trainStep(batch[0].tokenIds, lr, batch[0].mask);
          epochTokens += batch[0].tokenIds.length;
          totalProcessedTokens += batch[0].tokenIds.length;
        } else {
          stepResult = this.model.trainBatch(batch, lr);
          for (const item of batch) {
            epochTokens += item.tokenIds.length;
            totalProcessedTokens += item.tokenIds.length;
          }
        }

        epochTrainLoss += stepResult.loss * batch.length;

        if (batchIndex % 10 === 0 || i + batchSize >= shuffled.length) {
          const stepElapsedSec = (Date.now() - epochStartTime) / 1000;
          const curThroughput = Math.round(epochTokens / Math.max(0.1, stepElapsedSec));
          const curLoss = (epochTrainLoss / Math.min(shuffled.length, i + batch.length)).toFixed(4);
          const percent = ((Math.min(shuffled.length, i + batch.length) / shuffled.length) * 100).toFixed(1);
          if (onProgress && typeof onProgress === "function") {
            onProgress({
              stepProgress: true,
              epoch,
              epochs,
              step: batchIndex,
              totalStepsInEpoch: stepsPerEpoch,
              percent,
              currentLoss: curLoss,
              throughput: curThroughput,
              lr: lr.toFixed(6),
            });
          }
        }
      }

      const avgTrainLoss = epochTrainLoss / shuffled.length;
      const trainPerplexity = Math.min(Math.exp(avgTrainLoss), 9999.0);
      const epochDurationMs = Date.now() - epochStartTime;
      const throughput = Math.round((epochTokens / (epochDurationMs / 1000)));

      // Validation va monitoring
      let valMetrics = { valLoss: null, valPerplexity: null };
      let isNewBest = false;

      if (epoch % evalInterval === 0 || epoch === epochs || epoch === 1) {
        valMetrics = this.evaluate(valSamples);

        if (valMetrics.valLoss < this.bestValLoss) {
          this.bestValLoss = valMetrics.valLoss;
          epochsWithoutImprovement = 0;
          isNewBest = true;
          this.saveCheckpoint("best");
        } else {
          epochsWithoutImprovement += evalInterval;
        }
      }

      // Har bir epoxada latest checkpointni saqlash
      this.saveCheckpoint("latest");

      const logEntry = {
        epoch,
        trainLoss: Number(avgTrainLoss.toFixed(4)),
        trainPerplexity: Number(trainPerplexity.toFixed(2)),
        valLoss: valMetrics.valLoss !== null ? Number(valMetrics.valLoss.toFixed(4)) : null,
        valPerplexity: valMetrics.valPerplexity !== null ? Number(valMetrics.valPerplexity.toFixed(2)) : null,
        throughputTokensPerSec: throughput,
        durationMs: epochDurationMs,
        isBest: isNewBest,
      };
      this.history.push(logEntry);

      if (onProgress && typeof onProgress === "function") {
        onProgress(logEntry);
      }

      // Early Stopping
      if (epochsWithoutImprovement >= patience && epoch >= 10) {
        if (onProgress) {
          onProgress({ message: `[Early Stopping]: Validation loss ${patience} epoxa davomida yaxshilanmadi. Trening yakunlandi.` });
        }
        break;
      }
    }

    return {
      bestValLoss: this.bestValLoss,
      totalEpochs: this.currentEpoch,
      history: this.history,
      durationMs: Date.now() - startTime,
    };
  }
}

module.exports = TransformerTrainer;
