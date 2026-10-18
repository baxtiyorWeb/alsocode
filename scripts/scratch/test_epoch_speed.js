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

const t0 = Date.now();
const N = 100;
for (let i = 0; i < N; i++) {
  model.trainStep(tokens, 0.001);
}
const elapsed = Date.now() - t0;
console.log(`${N} trainSteps took ${elapsed} ms (${(elapsed / N).toFixed(2)} ms/step)`);
console.log(`Estimated time for 8,000 samples (1 epoch): ${(8000 * (elapsed / N) / 1000).toFixed(1)} seconds`);
