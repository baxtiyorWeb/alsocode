"use strict";

const { execSync } = require("child_process");
const path = require("path");

console.log("=========================================================================");
console.log("  NEURAL LLM STUDIO - COMPREHENSIVE REGRESSION & INTEGRATION TEST RUNNER");
console.log("=========================================================================\n");

const testFiles = [
  "test_tokenizer.js",
  "test_transformer_arch.js",
  "test_dataset_pipeline.js",
  "test_trainer_resume.js",
  "test_gradient_check.js",
  "test_server_streaming.js",
  "test_rag_synthesis.js",
];

let allPassed = true;
const results = [];

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  process.stdout.write(`▶ Ishga tushirilmoqda: tests/${file}... `);

  const start = Date.now();
  try {
    execSync(`node "${filePath}"`, {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    });
    const duration = Date.now() - start;
    console.log(`✅ [O'TDI] (${duration} ms)`);
    results.push({ file, passed: true, duration });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ [XATOLIK] (${duration} ms)`);
    console.error(err.stdout || err.stderr || err.message);
    results.push({ file, passed: false, duration, error: err.message });
    allPassed = false;
  }
}

console.log("\n=========================================================================");
console.log("  TEST NATIJALARI YAKUNI");
console.log("=========================================================================");
for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`  ${icon} ${r.file.padEnd(28, " ")}: ${r.passed ? "Muvaffaqiyatli" : "Muvaffaqiyatsiz"} (${r.duration} ms)`);
}

if (!allPassed) {
  console.error("\n❌ AYRIM TESTLARDA XATOLIK ANIQLANDI!");
  process.exit(1);
} else {
  console.log("\n🎉 BARCHA REGRESSION VA UNIT TESTLAR 100% MUVAFFAQIYATLI O'TDI!\n");
  process.exit(0);
}
