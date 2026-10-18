"use strict";

const CausalTransformerModel = require("../src/transformerModel");

const model = new CausalTransformerModel({
  vocabSize: 399,
  dModel: 64,
  nHeads: 4,
  headDim: 16,
  dFfn: 256,
  nLayers: 2,
  maxSeqLen: 48,
});

const tokens = new Array(32).fill(0).map((_, i) => (i * 7) % 390 + 1);

// Warmup
model.trainStep(tokens, 0.001);

const t0 = Date.now();
for (let i = 0; i < 50; i++) {
  model.trainStep(tokens, 0.001);
}
console.log("50 steps took:", Date.now() - t0, "ms");
