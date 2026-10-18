"use strict";

/**
 * =======================================================================
 *  CENTRAL LLM CONFIGURATION & VERSIONING ARCHITECTURE (v1 & v2)
 * =======================================================================
 *  - v1: Yengil va tezkor asosiy model (3 qatlam, 64 d_model, 512 BPE vocab)
 *  - v2: Masshtablangan yuqori sig'imli model (4 qatlam, 128 d_model, 1024 BPE vocab)
 *  - Qattiq o'rganib qolish (overfitting) dan himoya:
 *    * AdamW Decoupled Weight Decay (0.015 - 0.02)
 *    * Target Loss Masking (Savolga loss=0, javobga loss=1)
 *    * Early Stopping (val_loss o'sishi bilan to'xtatish)
 *    * Repetition Penalty (1.15 - 1.20)
 * =======================================================================
 */

const SPECIAL_TOKENS = {
  PAD: 0,
  BOS: 1,
  EOS: 2,
  UNK: 3,
  HUMAN: 4,
  BOT: 5,
  CONTEXT: 6,
  END_CONTEXT: 7,
  THINK: 8,
  END_THINK: 9,
};

const SPECIAL_TOKEN_NAMES = {
  "<pad>": 0,
  "<bos>": 1,
  "<eos>": 2,
  "<unk>": 3,
  "<human>": 4,
  "<bot>": 5,
  "<context>": 6,
  "</context>": 7,
  "<think>": 8,
  "</think>": 9,
};

const VERSIONS = {
  v1: {
    name: "UzbekCausalTransformer-v1",
    version: "1.0.0",
    model: {
      name: "UzbekCausalTransformer-v1",
      version: "1.0.0",
      dModel: 64,           // Hidden embedding dimension (d_model)
      nHeads: 4,            // Boshlar soni (Multi-Head Attention)
      headDim: 16,          // Har bir bosh o'lchami: dModel / nHeads
      dFfn: 256,            // Feed-Forward tarmog'i o'lchami (4 * dModel)
      nLayers: 3,           // Transformer bloklari soni
      maxSeqLen: 64,        // Maksimal kontekst oynasi (tokenlar soni)
      vocabSize: 512,       // BPE subword tokenlar hajmi
      dropoutRate: 0.0,     // CPU trainingda barqaror
      tieWordEmbeddings: false,
    },
    training: {
      batchSize: 8,
      epochs: 8,
      learningRate: 0.003,
      minLearningRate: 0.0003,
      weightDecay: 0.015,   // Overfittingdan himoya (AdamW L2 regulyarizatsiya)
      gradClipNorm: 1.0,
      warmupStepsRatio: 0.1,
      seed: 42,
      evalIntervalEpochs: 1,
      earlyStoppingPatience: 4,
      checkpointDir: "./data/checkpoints/v1",
      targetLossMasking: true,
    },
    generation: {
      defaultMaxTokens: 32,
      temperature: 0.7,
      topK: 12,
      topP: 0.9,
      repetitionPenalty: 1.15,
    },
    data: {
      knowledgePath: "./data/knowledge.json",
      vocabPath: "./data/bpe_vocab.json",
      splitsPath: "./data/dataset_splits.json",
      trainRatio: 0.80,
      valRatio: 0.10,
      testRatio: 0.10,
      minTokenLength: 2,
      maxTokenLength: 60,
    }
  },

  v2: {
    name: "UzbekCausalTransformer-v2",
    version: "2.0.0",
    model: {
      name: "UzbekCausalTransformer-v2",
      version: "2.0.0",
      dModel: 192,          // Hidden Dim: 192
      nHeads: 6,            // 6 ta bosh (192 / 6 = 32)
      headDim: 32,          // Head Dim: 32
      dFfn: 768,            // FFN Dim: 4 * 192 = 768
      nLayers: 4,           // 4 ta Decoder blok
      maxSeqLen: 128,       // 128 ta token kontekst
      vocabSize: 2048,      // 2048 ta BPE subword token
      dropoutRate: 0.1,     // Overfitting himoyasi
      tieWordEmbeddings: false,
    },
    training: {
      batchSize: 32,
      epochs: 25,
      learningRate: 0.0012,
      minLearningRate: 0.0001,
      weightDecay: 0.02,    // Yuqori AdamW L2 regulyarizatsiya
      gradClipNorm: 1.0,
      warmupStepsRatio: 0.1,
      seed: 42,
      evalIntervalEpochs: 1,
      earlyStoppingPatience: 6,
      checkpointDir: "./data/checkpoints/v2",
      targetLossMasking: true,
    },
    generation: {
      defaultMaxTokens: 48,
      temperature: 0.25,
      topK: 5,
      topP: 0.90,
      repetitionPenalty: 1.15,
    },
    data: {
      knowledgePath: "./data/knowledge.json",
      vocabPath: "./data/bpe_vocab.json",
      splitsPath: "./data/dataset_splits.json",
      trainRatio: 0.80,
      valRatio: 0.10,
      testRatio: 0.10,
      minTokenLength: 2,
      maxTokenLength: 120,
    }
  },

  v3: {
    name: "UzbekCausalTransformer-v3",
    version: "3.0.0",
    model: {
      name: "UzbekCausalTransformer-v3",
      version: "3.0.0",
      dModel: 384,          // Hidden Dim: 384
      nHeads: 12,           // 12 ta bosh (384 / 12 = 32)
      headDim: 32,          // Head Dim: 32
      dFfn: 1536,           // FFN Dim: 4 * 384 = 1536
      nLayers: 12,          // 12 ta Decoder blok (Kanonik chuqur Transformer)
      maxSeqLen: 256,       // 256 ta token kontekst oynasi (RAG Context uchun)
      vocabSize: 8192,      // 8192 ta BPE subword token
      dropoutRate: 0.1,     // Overfitting himoyasi
      tieWordEmbeddings: false,
    },
    training: {
      batchSize: 32,
      epochs: 3,            // 20M-30M token korpusda 3 epoxa optimal
      learningRate: 0.0008,
      minLearningRate: 0.00008,
      weightDecay: 0.02,
      gradClipNorm: 1.0,
      warmupStepsRatio: 0.05,
      seed: 42,
      evalIntervalEpochs: 1,
      earlyStoppingPatience: 5,
      checkpointDir: "./data/checkpoints/v3",
      targetLossMasking: true,
      stage: "pretrain",    // 'pretrain' yoki 'sft'
    },
    generation: {
      defaultMaxTokens: 64,
      temperature: 0.25,
      topK: 5,
      topP: 0.90,
      repetitionPenalty: 1.20,
    },
    data: {
      knowledgePath: "./data/knowledge.json",
      pretrainCorpusPath: "./data/uzbek_pretrain_corpus.txt",
      vocabPath: "./data/bpe_vocab.json",
      splitsPath: "./data/dataset_splits.json",
      trainRatio: 0.90,
      valRatio: 0.05,
      testRatio: 0.05,
      minTokenLength: 2,
      maxTokenLength: 250,
    }
  }
};

const LLM_CONFIG = {
  // Standart (default v1)
  model: { ...VERSIONS.v1.model },
  specialTokens: SPECIAL_TOKENS,
  specialTokenNames: SPECIAL_TOKEN_NAMES,
  training: { ...VERSIONS.v1.training },
  generation: { ...VERSIONS.v1.generation },
  data: { ...VERSIONS.v1.data },

  // Versiyalar katalogi va tanlagich
  VERSIONS,
  getVersionConfig(ver = "v1") {
    const key = String(ver || "v1").toLowerCase().replace(/[^a-z0-9]/g, "");
    return VERSIONS[key] || VERSIONS.v1;
  }
};

module.exports = LLM_CONFIG;
