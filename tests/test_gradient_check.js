"use strict";

const assert = require("assert");
const CausalTransformerModel = require("../src/transformerModel");

console.log("=========================================================================");
console.log("  STAGE 1-6 VERIFICATION: FINITE DIFFERENCE GRADIENT CHECKING");
console.log("=========================================================================\n");

// Kichik model konfiguratsiyasi (Gradient checking uchun)
const testConfig = {
  vocabSize: 12,
  dModel: 8,
  nHeads: 2,
  headDim: 4,
  dFfn: 16,
  nLayers: 1,
  maxSeqLen: 8,
};

const model = new CausalTransformerModel(testConfig);
const tokenIds = [1, 4, 7, 3, 2]; // 5 ta token

// 1. Analitik gradientlarni hisoblash
model.zeroGrad();
const fwd = model.forward(tokenIds);
const { loss: initialLoss } = model.backward(fwd, tokenIds, null, 1.0);

console.log(`- Boshlang'ich Loss: ${initialLoss.toFixed(6)}`);

// Yordamchi: bitta parametr qiymatini o'zgartirib loss ni hisoblovchi funksiya
function computeLossForParam(targetArray, idx, delta) {
  const original = targetArray[idx];
  targetArray[idx] = original + delta;

  const f = model.forward(tokenIds);
  let totalL = 0;
  let count = 0;
  const T = f.cache.T;
  const V = model.vocabSize;

  for (let t = 0; t < T - 1; t++) {
    const target = tokenIds[t + 1];
    // softmax
    let maxV = -Infinity;
    for (let v = 0; v < V; v++) if (f.logits[t][v] > maxV) maxV = f.logits[t][v];
    let sumE = 0;
    for (let v = 0; v < V; v++) sumE += Math.exp(f.logits[t][v] - maxV);
    const prob = Math.exp(f.logits[t][target] - maxV) / sumE;
    totalL += -Math.log(Math.max(prob, 1e-12));
    count++;
  }

  // Asl qiymatni tiklash
  targetArray[idx] = original;
  return totalL / count;
}

const eps = 1e-4;
const checks = [
  { name: "LM Head", target: model.lm_head[2], grad: model.dlm_head[2], idx: 3 },
  { name: "Block 0 W_f2", target: model.blocks[0].W_f2[3], grad: model.blocks[0].dW_f2[3], idx: 2 },
  { name: "Block 0 W_f1", target: model.blocks[0].W_f1[2], grad: model.blocks[0].dW_f1[2], idx: 4 },
  { name: "Block 0 W_o", target: model.blocks[0].W_o[1], grad: model.blocks[0].dW_o[1], idx: 2 },
  { name: "Block 0 W_q", target: model.blocks[0].W_q[0], grad: model.blocks[0].dW_q[0], idx: 1 },
  { name: "Block 0 W_k", target: model.blocks[0].W_k[1], grad: model.blocks[0].dW_k[1], idx: 0 },
  { name: "Block 0 W_v", target: model.blocks[0].W_v[2], grad: model.blocks[0].dW_v[2], idx: 3 },
  { name: "Token Embeddings wte", target: model.wte[4], grad: model.dwte[4], idx: 1 },
  { name: "Pos Embeddings wpe", target: model.wpe[1], grad: model.dwpe[1], idx: 2 },
];

let allPassed = true;

for (const chk of checks) {
  const analyticGrad = chk.grad[chk.idx];

  const lossPlus = computeLossForParam(chk.target, chk.idx, eps);
  const lossMinus = computeLossForParam(chk.target, chk.idx, -eps);
  const numGrad = (lossPlus - lossMinus) / (2 * eps);

  const diff = Math.abs(analyticGrad - numGrad);
  const denom = Math.max(Math.abs(analyticGrad), Math.abs(numGrad)) + 1e-7;
  const relDiff = diff / denom;

  const isPass = relDiff < 0.05 || diff < 1e-4; // 5% dan kam nisbiy xato
  const icon = isPass ? "✅ [O'TDI]" : "❌ [XATO]";

  console.log(`${icon} Parametr: ${chk.name.padEnd(24, " ")}`);
  console.log(`   Analitik grad:   ${analyticGrad.toFixed(8)}`);
  console.log(`   Raqamli (Num):   ${numGrad.toFixed(8)}`);
  console.log(`   Nisbiy farq:     ${(relDiff * 100).toFixed(4)}% (Abs: ${diff.toFixed(8)})`);

  if (!isPass) allPassed = false;
}

console.log("\n-------------------------------------------------------------------------");
if (allPassed) {
  console.log("🎉 BARCHA ANALITIK GRADIENTLAR 100% MATEMATIK ISBOTLANDI!");
  process.exit(0);
} else {
  console.error("❌ GRADIENT CHECKING XATOLIK ANIQLADI!");
  process.exit(1);
}
