"use strict";

const LLM_CONFIG = require("../src/llmConfig");
const CausalTransformerModel = require("../src/transformerModel");

// Test that current trainStep only updates lm_head, wte, wpe
const model = new CausalTransformerModel({
  vocabSize: 50,
  dModel: 16,
  nHeads: 2,
  dFfn: 32,
  nLayers: 2,
  maxSeqLen: 16,
});

const tokens = [1, 5, 12, 8, 20, 2];
const b0_wq_before = model.blocks[0].W_q[0][0];
const b0_wf1_before = model.blocks[0].W_f1[0][0];
const head_before = model.lm_head[0][0];

console.log("Before trainStep:");
console.log("- block0.W_q[0][0]:", b0_wq_before);
console.log("- block0.W_f1[0][0]:", b0_wf1_before);
console.log("- lm_head[0][0]:", head_before);

model.trainStep(tokens, 0.01);

console.log("\nAfter trainStep (current code):");
console.log("- block0.W_q[0][0]:", model.blocks[0].W_q[0][0], "(Diff:", model.blocks[0].W_q[0][0] - b0_wq_before, ")");
console.log("- block0.W_f1[0][0]:", model.blocks[0].W_f1[0][0], "(Diff:", model.blocks[0].W_f1[0][0] - b0_wf1_before, ")");
console.log("- lm_head[0][0]:", model.lm_head[0][0], "(Diff:", model.lm_head[0][0] - head_before, ")");
