#!/usr/bin/env python3
"use strict";

/**
 * =======================================================================
 *  DYNAMIC DOCUMENT INGESTION CLI (Universal RAG File Loader)
 * =======================================================================
 *  Foydalanuvchi ixtiyoriy .txt, .md, .json yoki matn faylini berishi
 *  bilan uni darhol o'qib, semantik bo'laklarga (chunks) ajratadi,
 *  vektorlashtiradi va RAG bilimlar bazasiga ('data/documents.json') qo'shadi.
 *
 *  Ishlatish:
 *    node scripts/ingest_document.js <fayl_yo'li> [sarlavha] [toifa]
 *
 *  Misol:
 *    node scripts/ingest_document.js tibbiyot.txt "Tibbiyot Qo'llanmasi" "salomatlik"
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");
const DocumentRAGEngine = require("../src/rag");
const WordEmbeddings = require("../src/embeddings");

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
📚 Universal RAG Hujjat Yuklash Dvigateli
Foydalanish:
  node scripts/ingest_document.js <fayl_yoki_matn> [sarlavha] [toifa]

Misollar:
  node scripts/ingest_document.js yangilik.txt "Oxirgi Yangiliklar" "yangiliklar"
  node scripts/ingest_document.js "Qonun matni..." "Mehnat Kodeksi" "huquq"
`);
  process.exit(0);
}

const inputTarget = args[0];
let title = args[1];
const category = args[2] || "umumiy";

let content = "";

if (fs.existsSync(inputTarget)) {
  content = fs.readFileSync(inputTarget, "utf-8").trim();
  if (!title) {
    title = path.basename(inputTarget, path.extname(inputTarget));
  }
} else {
  // Matn to'g'ridan-to'g'ri berilgan bo'lsa
  content = inputTarget.trim();
  if (!title) {
    title = "Yangi Hujjat #" + Date.now().toString(36);
  }
}

if (!content) {
  console.error("❌ Xatolik: Hujjat matni bo'sh!");
  process.exit(1);
}

const embeddingsPath = path.join(__dirname, "..", "data", "embeddings.json");
const docPath = path.join(__dirname, "..", "data", "documents.json");

let embeddings = null;
if (fs.existsSync(embeddingsPath)) {
  embeddings = WordEmbeddings.load(embeddingsPath);
}

const rag = new DocumentRAGEngine(embeddings, docPath);
rag.load();

console.log("=========================================================================");
console.log(`  📄 HUJJAT YUKLANMOQDA VA INDEKSLANMOQDA: «${title}»`);
console.log("=========================================================================");

const res = rag.addDocument(title, content, category);

console.log(`✔ Sarlavha:          «${res.title}»`);
console.log(`✔ Toifasi:           ${category}`);
console.log(`✔ Matn uzunligi:     ${content.length} ta belgi`);
console.log(`✔ Semantik bo'laklar: ${res.chunksCount} ta bo'lak (chunks)`);
console.log(`✔ Bazadagi jami bo'laklar: ${rag.chunks.length} ta`);
console.log(`✔ Saqlangan manzil:  ${docPath}`);
console.log("-------------------------------------------------------------------------");
console.log("🎉 Hujjat muvaffaqiyatli indekslandi! Endi CLI orqali ushbu mavzuda savol berishingiz mumkin.");
