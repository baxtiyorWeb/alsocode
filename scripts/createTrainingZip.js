"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * =======================================================================
 *  GOOGLE COLAB & TRAINING PACKAGE EXPORTER
 * =======================================================================
 *  Loyiha fayllarini ortiqcha og'ir keshlar va node_modules'larsiz
 *  Google Colab ga yuklash uchun ixcham zip arxivga aylantiradi.
 * =======================================================================
 */

const rootDir = path.resolve(__dirname, "..");
const stagingDir = path.join(rootDir, "llm_staging");
const localZipPath = path.join(rootDir, "llm_colab_package.zip");
const parentZipPath = path.join(path.dirname(rootDir), "llm_colab_package.zip");

console.log("=========================================================================");
console.log("  📦 GOOGLE COLAB O'QITISH PAKETINI ARXIVLASH (ZIP EXPORTER)");
console.log("=========================================================================\n");

// 0. Tozalash
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
if (fs.existsSync(localZipPath)) fs.unlinkSync(localZipPath);

fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(path.join(stagingDir, "data"), { recursive: true });
fs.mkdirSync(path.join(stagingDir, "data", "checkpoints"), { recursive: true });

// 1. Papkalarni nusxalash (src, scripts, tests, public)
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith("archive_") || entry.name.startsWith(".")) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("- 📁 Asosiy modullar nusxalanmoqda (src, scripts, tests, public)...");
copyDir(path.join(rootDir, "src"), path.join(stagingDir, "src"));
copyDir(path.join(rootDir, "scripts"), path.join(stagingDir, "scripts"));
copyDir(path.join(rootDir, "tests"), path.join(stagingDir, "tests"));
copyDir(path.join(rootDir, "public"), path.join(stagingDir, "public"));

// 2. Data papkasidagi muhim fayllar
console.log("- 📚 Baza va dataset splits fayllari nusxalanmoqda...");
const dataFiles = [
  "knowledge.json",
  "bpe_vocab.json",
  "dataset_splits.json",
  "documents.json",
  "memory.json",
  "model.json",
  "vocab.json",
  "uzbek_pretrain_corpus.txt"
];

for (const df of dataFiles) {
  const p = path.join(rootDir, "data", df);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(stagingDir, "data", df));
  }
}

// sessions.json ni toza holatda yaratish
fs.writeFileSync(
  path.join(stagingDir, "data", "sessions.json"),
  JSON.stringify({ sessions: [], activeSessionId: null }, null, 2),
  "utf-8"
);

// 3. Ildizdagi zarur skriptlar va Colab Notebook
console.log("- 📝 Konfiguratsiya va Colab Notebook nusxalanmoqda...");
const rootFiles = [
  "package.json",
  "package-lock.json",
  "server.js",
  "cli.js",
  "train_transformer.js",
  "Colab_Uzbek_LLM_Training.ipynb",
  "README.md"
];

for (const rf of rootFiles) {
  const p = path.join(rootDir, rf);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(stagingDir, rf));
  }
}

// .env fayl mavjud bo'lsa nusxalash
if (fs.existsSync(path.join(rootDir, ".env"))) {
  fs.copyFileSync(path.join(rootDir, ".env"), path.join(stagingDir, ".env"));
}

console.log("- 🗜️ Zip arxiv yaratilmoqda...");

// Linux va Windows uchun universal arxivlash
let archived = false;
try {
  // Linux zip buyrug'i
  execSync(`cd "${stagingDir}" && zip -r -q "${localZipPath}" .`, { stdio: "inherit" });
  archived = true;
} catch (e) {
  try {
    // Python zipfile moduli (har qanday OT da)
    const pyCmd = `python3 -c "import shutil; shutil.make_archive('${localZipPath.replace(/\.zip$/, '')}', 'zip', '${stagingDir}')"`;
    execSync(pyCmd, { stdio: "inherit" });
    archived = true;
  } catch (e2) {
    // Windows PowerShell fallback
    const psCmd = `powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${localZipPath}' -CompressionLevel Optimal"`;
    execSync(psCmd, { stdio: "inherit" });
    archived = true;
  }
}

// Parent directory ga ham nusxa olish (foydalanuvchi qidirganda topishi oson bo'lishi uchun)
try {
  fs.copyFileSync(localZipPath, parentZipPath);
} catch (e) {}

// Staging ni tozalash
fs.rmSync(stagingDir, { recursive: true, force: true });

if (archived && fs.existsSync(localZipPath)) {
  const stats = fs.statSync(localZipPath);
  console.log(`\n=========================================================================`);
  console.log(`🎉 COLAB PAKETI MUVAFFAQIYATLI YARATILDI!`);
  console.log(`=========================================================================`);
  console.log(`- Asosiy zip fayl: ${localZipPath}`);
  console.log(`- Qo'shimcha nusxa:${parentZipPath}`);
  console.log(`- Hajmi:           ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size.toLocaleString()} bayt)`);
  console.log(`\nEndi ushbu 'llm_colab_package.zip' faylini to'g'ridan-to'g'ri Google Colab ga yuklashingiz mumkin!\n`);
} else {
  console.error("❌ Arxiv yaratishda xatolik yuz berdi.");
  process.exit(1);
}
