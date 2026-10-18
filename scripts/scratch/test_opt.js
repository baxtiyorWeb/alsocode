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

// Let's test training on mini-batches or subsampled steps
console.log("Model created successfully.");
