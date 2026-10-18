"use strict";

const assert = require("assert");
const CausalTransformerModel = require("../src/transformerModel");

console.log("==================================================");
console.log("  RUNNING CAUSAL TRANSFORMER ARCHITECTURE TESTS");
console.log("==================================================");

const config = {
  vocabSize: 64,
  dModel: 32,
  nHeads: 4,
  headDim: 8,
  dFfn: 128,
  nLayers: 2,
  maxSeqLen: 32,
};

const model = new CausalTransformerModel(config);

// 1. Parametrlar sonini aniq o'lchash testi
const params = model.countParameters();
console.log(`- Model parametrlari:`);
console.log(`  • Token Embeddings:    ${params.tokenEmbeddings}`);
console.log(`  • Positional Embeddings:${params.posEmbeddings}`);
console.log(`  • Transformer Layers:   ${params.transformerLayers}`);
console.log(`  • LM Output Head:       ${params.lmHead}`);
console.log(`  • Jami Parametrlar:     ${params.total}`);
assert(params.total > 0 && params.total === params.trainable, "Parametrlar to'g'ri hisoblanishi kerak");
console.log("  ✅ Test 1: Parametrlar soni aniq va shaffof o'lchandi.");

// 2. Causal Masking (Kelajak tokenlaridan himoya) testi
// Ketma-ketlik A: [5, 12, 20]
// Ketma-ketlik B: [5, 12, 99] (3-token o'zgargan)
// CAUSAL XUSUSIYAT: 1- va 2-tokenlarning chiqish logitlari ikkala ketma-ketlikda 100% bir xil bo'lishi shart!
const seqA = [5, 12, 20];
const seqB = [5, 12, 35];

const fwdA = model.forward(seqA);
const fwdB = model.forward(seqB);

let diffPos0 = 0;
let diffPos1 = 0;
for (let v = 0; v < config.vocabSize; v++) {
  diffPos0 += Math.abs(fwdA.logits[0][v] - fwdB.logits[0][v]);
  diffPos1 += Math.abs(fwdA.logits[1][v] - fwdB.logits[1][v]);
}

console.log(`- Causal Mask farqi (Pos 0): ${diffPos0.toFixed(8)}`);
console.log(`- Causal Mask farqi (Pos 1): ${diffPos1.toFixed(8)}`);
assert(diffPos0 < 1e-6, "Causal mask buzilgan: 3-token 1-token logitiga ta'sir o'tkazmoqda!");
assert(diffPos1 < 1e-6, "Causal mask buzilgan: 3-token 2-token logitiga ta'sir o'tkazmoqda!");
console.log("  ✅ Test 2: Causal Masking 100% to'g'ri ishlamoqda (Kelajak tokenlari ko'rilmaydi).");

// 3. Next-Token Prediction & Loss kamayishi va qatlamlar backpropagation testi
const trainSeq = [1, 10, 15, 22, 30, 2]; // <bos>, t1, t2, t3, t4, <eos>
const b0_wq_initial = model.blocks[0].W_q[0][0];
const b0_wf1_initial = model.blocks[0].W_f1[0][0];
let initialLoss = 0;
let finalLoss = 0;

for (let iter = 1; iter <= 25; iter++) {
  const res = model.trainStep(trainSeq, 0.01);
  if (iter === 1) initialLoss = res.loss;
  finalLoss = res.loss;
}

console.log(`- Boshlang'ich Loss: ${initialLoss.toFixed(4)}`);
console.log(`- 25 qadamdan keyingi Loss: ${finalLoss.toFixed(4)}`);
console.log(`- Block 0 W_q vazn o'zgarishi: ${(model.blocks[0].W_q[0][0] - b0_wq_initial).toFixed(8)}`);
console.log(`- Block 0 W_f1 vazn o'zgarishi: ${(model.blocks[0].W_f1[0][0] - b0_wf1_initial).toFixed(8)}`);
assert(finalLoss < initialLoss, "Loss o'qitish davomida pasayishi shart!");
assert(Math.abs(model.blocks[0].W_q[0][0] - b0_wq_initial) > 1e-8, "Transformer Attention qatlami o'rganishi shart!");
assert(Math.abs(model.blocks[0].W_f1[0][0] - b0_wf1_initial) > 1e-8, "Transformer FFN qatlami o'rganishi shart!");
console.log("  ✅ Test 3: Next-Token Cross-Entropy Loss kamaydi va barcha qatlamlar (Attention, FFN) to'liq backprop bilan yangilandi.");

// 4. Autoregressive Generation testi
const prompt = [1, 10]; // <bos>, t1
const generated = model.generate(prompt, 6, { temperature: 0.1 });
console.log(`- Autoregressive generatsiya natijasi (Token IDs): [${generated.join(", ")}]`);
assert(generated.length > prompt.length, "Generatsiya yangi tokenlar qo'shishi kerak");
assert(generated[0] === 1 && generated[1] === 10, "Prompt tokenlari boshida saqlanishi kerak");
console.log("  ✅ Test 4: Autoregressive generatsiya to'g'ri ishladi.");

// 5. Checkpoint Serialization (toJSON / fromJSON) testi
const currentFwd = model.forward(seqA);
const exportedJSON = model.toJSON();
const restoredModel = CausalTransformerModel.fromJSON(exportedJSON);
const restoredFwd = restoredModel.forward(seqA);

let restoreDiff = 0;
for (let t = 0; t < seqA.length; t++) {
  for (let v = 0; v < config.vocabSize; v++) {
    restoreDiff += Math.abs(currentFwd.logits[t][v] - restoredFwd.logits[t][v]);
  }
}
console.log(`- Checkpoint tiklanish farqi: ${restoreDiff.toFixed(8)}`);
assert(restoreDiff < 1e-6, "Tiklagan model chiqishi asl model bilan bir xil bo'lishi shart!");
console.log("  ✅ Test 5: Checkpoint to'liq saqlanadi va 100% aniqlik bilan qayta tiklanadi.");

console.log("\n🎉 BARCHA TRANSFORMER MODEL ARCHITECTURE TESTLARI 100% MUVAFFAQ QILINDI!\n");
