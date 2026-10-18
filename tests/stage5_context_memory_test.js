"use strict";

/**
 * =======================================================================
 *  STAGE 5 AUTOMATED TEST SUITE: CONTEXT, MEMORY & COMPOSITIONAL NLG
 * =======================================================================
 *  Tekshiriladigan mezonlar:
 *  1. Shaxsiy profil eslash (User states name -> asks name in next turn).
 *  2. Mahsulot va anaphora (Mention product -> "Menga uning narxini ayt").
 *  3. Shaxs va vaqt anaphorasi ("Anvar ertaga soat 5 da keladi" -> "U qachon keladi?").
 *  4. Noaniq shaxslar (Disambiguation: "Ali va Vali keldilar" -> "U qachon ketadi?").
 *  5. Mavzuni keskin o'zgartirish (Topic shift: JS -> Somsa, topic leakage yo'qligi).
 *  6. Sessiyalar izolatsiyasi (:memory: orqali xotira tozaligi).
 *  7. Universal Kompozitsion NLG (shaxmat, velosiped, python, she'r, somsa, sayohat).
 *  8. Substring over-matching xatolari yo'qligi ('kitob' != 'it', 'turar-joy' != 'oy').
 *  9. Barcha operatsiyalar tezkorligi (< 50 ms).
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");

const Tokenizer = require("../src/tokenizer");
const NeuralNetwork = require("../src/neuralNetwork");
const TextAnalyzer = require("../src/analyzer");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const SmartChatbot = require("../src/chatbot");
const CognitiveMemory = require("../src/memory");
const DocumentRAGEngine = require("../src/rag");

function createTestBot() {
  const vocabData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json"), "utf-8"));
  const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
  const tokenizer = new Tokenizer();
  tokenizer.vocabulary = vocabData.vocabulary;
  tokenizer.categories = vocabData.categories;
  const analyzer = new TextAnalyzer(nn, tokenizer);
  const embeddings = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
  const miniLLM = new MiniLLM(12, embeddings);
  const memory = new CognitiveMemory(":memory:");
  const rag = new DocumentRAGEngine(embeddings, path.join(__dirname, "..", "data", "documents.json"));

  return new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);
}

async function runStage5Tests() {
  console.log("=======================================================================");
  console.log("  🚀 STAGE 5: CONTEXT, MEMORY & COMPOSITIONAL NLG TEST SUITE");
  console.log("=======================================================================\n");

  const bot = createTestBot();
  let passed = 0;
  let total = 0;

  function assert(name, condition, details = "") {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
    }
  }

  // -------------------------------------------------------------------
  // 1. Shaxsiy profil va ism eslash (Multi-turn User Profile)
  // -------------------------------------------------------------------
  console.log("--- 1. Shaxsiy Profil va Xotira ---");
  {
    const r1 = await bot.process("Mening ismim Baxtiyor");
    assert("1.1. Ismni eslab qolish ('Mening ismim Baxtiyor')", bot.memory.userProfile.name === "Baxtiyor", `Actual: ${bot.memory.userProfile.name}`);

    const r2 = await bot.process("Mening ismim nima?");
    assert("1.2. Ismni so'raganda to'g'ri qaytarish ('Mening ismim nima?')", r2.reply.includes("Baxtiyor") && r2.toolUsed === "UserProfileEngine", `Reply: ${r2.reply}`);

    const r3 = await bot.process("Ismim nima?");
    assert("1.3. Qisqa shaklda ismni so'rash ('Ismim nima?')", r3.reply.includes("Baxtiyor"), `Reply: ${r3.reply}`);
  }

  // -------------------------------------------------------------------
  // 2. Mahsulot va narx anaphorasi (Product Coreference)
  // -------------------------------------------------------------------
  console.log("\n--- 2. Mahsulot Anaphorasi va Narx ---");
  {
    const bot2 = createTestBot();
    await bot2.process("Bizda yangi noutbuk bor");
    const r2 = await bot2.process("Menga uning narxini ayt");
    assert("2.1. 'Menga uning narxini ayt' -> noutbukni aniqladi", r2.reply.toLowerCase().includes("noutbuk"), `Reply: ${r2.reply}`);
    assert("2.2. AmbiguityClarifier vositasi ishlatildi", r2.toolUsed === "AmbiguityClarifier", `Tool: ${r2.toolUsed}`);

    const r3 = await bot2.process("Uning narxi qancha?");
    assert("2.3. 'Uning narxi qancha?' -> noutbukni tanidi", r3.reply.toLowerCase().includes("noutbuk"), `Reply: ${r3.reply}`);
  }

  // -------------------------------------------------------------------
  // 3. Shaxs va vaqt anaphorasi (Person & Time Coreference)
  // -------------------------------------------------------------------
  console.log("\n--- 3. Shaxs va Vaqt Anaphorasi ---");
  {
    const bot3 = createTestBot();
    await bot3.process("Anvar ertaga soat 5 da keladi");
    const r2 = await bot3.process("U qachon keladi?");
    assert("3.1. 'U qachon keladi?' -> Anvar va vaqtni bog'ladi", r2.reply.includes("Anvar") && (r2.reply.includes("ertaga") || r2.reply.includes("soat 5")), `Reply: ${r2.reply}`);
    assert("3.2. AmbiguityClarifier vositasi ishlatildi", r2.toolUsed === "AmbiguityClarifier", `Tool: ${r2.toolUsed}`);
  }

  // -------------------------------------------------------------------
  // 4. Noaniq murojaat va aniqlashtirish (Disambiguation)
  // -------------------------------------------------------------------
  console.log("\n--- 4. Bir nechta Shaxs va Aniqlashtirish ---");
  {
    const bot4 = createTestBot();
    await bot4.process("Ali va Vali keldilar");
    const r2 = await bot4.process("U qachon ketadi?");
    assert("4.1. 'Ali va Vali' mavjud bo'lganda noaniqlikni sezdi", r2.reply.includes("Ali") && r2.reply.includes("Vali"), `Reply: ${r2.reply}`);
    assert("4.2. Foydalanuvchidan aniqlashtirish so'radi", r2.reply.toLowerCase().includes("aniqlashtir") || r2.reply.toLowerCase().includes("kimni nazarda"), `Reply: ${r2.reply}`);
  }

  // -------------------------------------------------------------------
  // 5. Mavzuni almashtirish va kontekst ifloslanmasligi (Topic Shift)
  // -------------------------------------------------------------------
  console.log("\n--- 5. Mavzuni Almashtirish (Topic Shift) ---");
  {
    const bot5 = createTestBot();
    const r1 = await bot5.process("JavaScript nima?");
    assert("5.1. JavaScript ta'rifini berdi", r1.reply.toLowerCase().includes("dasturlash"), `Reply: ${r1.reply}`);

    const r2 = await bot5.process("Endi mavzuni butunlay o'zgartiramiz. Somsa qanday taom?");
    assert("5.2. Somsa ta'rifini to'g'ri berdi", r2.reply.toLowerCase().includes("somsa") || r2.reply.toLowerCase().includes("taom"), `Reply: ${r2.reply}`);
    assert("5.3. Oldingi mavzu (JavaScript/kod) yangi javobga aralashmadi", !r2.reply.toLowerCase().includes("javascript") && !r2.reply.toLowerCase().includes("dasturlash"), `Contamination detected in: ${r2.reply}`);
  }

  // -------------------------------------------------------------------
  // 6. Sessiyalar izolatsiyasi (Session Isolation)
  // -------------------------------------------------------------------
  console.log("\n--- 6. Sessiyalar Izolatsiyasi (:memory:) ---");
  {
    const s1 = createTestBot();
    await s1.process("Mening ismim Alisher");
    assert("6.1. Sessiya 1 da ism eslab qolindi", s1.memory.userProfile.name === "Alisher");

    const s2 = createTestBot();
    assert("6.2. Yangi sessiyada xotira toza (userProfile.name === null)", s2.memory.userProfile.name === null);

    const rEmpty = await s2.process("Mening ismim nima?");
    assert("6.3. Yangi sessiyada o'tmishdagi ism sizib o'tmadi", !rEmpty.reply.includes("Alisher") && (rEmpty.reply.toLowerCase().includes("tanishtirmadingiz") || rEmpty.reply.toLowerCase().includes("tanishtirmading")), `Reply: ${rEmpty.reply}`);
  }

  // -------------------------------------------------------------------
  // 7. Universal Kompozitsion NLG (Compositional NLG)
  // -------------------------------------------------------------------
  console.log("\n--- 7. Kompozitsion NLG (Universal Reja va Niyatlar) ---");
  {
    const bot7 = createTestBot();

    // 7.1. Shaxmat o'ynash
    const rChess = await bot7.process("shaxmat o'ynayman");
    assert("7.1. 'shaxmat o'ynayman' -> CompositionalNLGEngine", rChess.toolUsed === "CompositionalNLGEngine" && rChess.reply.toLowerCase().includes("shaxmat"), `Reply: ${rChess.reply}`);

    // 7.2. Velosiped haydash
    const rBike = await bot7.process("velosiped haydayman");
    assert("7.2. 'velosiped haydayman' -> CompositionalNLGEngine", rBike.toolUsed === "CompositionalNLGEngine" && rBike.reply.toLowerCase().includes("velosiped"), `Reply: ${rBike.reply}`);

    // 7.3. Dasturlash o'rganish
    const rPython = await bot7.process("python dasturlash tilini o'rganmoqchiman");
    assert("7.3. 'python o'rganmoqchiman' -> CompositionalNLGEngine", rPython.toolUsed === "CompositionalNLGEngine" && rPython.reply.toLowerCase().includes("python"), `Reply: ${rPython.reply}`);

    // 7.4. Ijod / She'r yozish
    const rPoem = await bot7.process("she'r yozmoqchiman");
    assert("7.4. 'she'r yozmoqchiman' -> CompositionalNLGEngine", rPoem.toolUsed === "CompositionalNLGEngine" && rPoem.reply.toLowerCase().includes("she'r"), `Reply: ${rPoem.reply}`);

    // 7.5. Pazandachilik
    const rSamsa = await bot7.process("somsa pishirmoqchiman");
    assert("7.5. 'somsa pishirmoqchiman' -> CompositionalNLGEngine", rSamsa.toolUsed === "CompositionalNLGEngine" && rSamsa.reply.toLowerCase().includes("somsa"), `Reply: ${rSamsa.reply}`);

    // 7.6. Sayohat
    const rTravel = await bot7.process("samarqandga bormoqchiman");
    assert("7.6. 'samarqandga bormoqchiman' -> CompositionalNLGEngine", rTravel.toolUsed === "CompositionalNLGEngine" && rTravel.reply.toLowerCase().includes("samarqand"), `Reply: ${rTravel.reply}`);
  }

  // -------------------------------------------------------------------
  // 8. Substring Over-matching ildizli muammolarini tekshirish
  // -------------------------------------------------------------------
  console.log("\n--- 8. Substring Over-matching Xatolari Yo'qligi ---");
  {
    const bot8 = createTestBot();

    // 8.1. "kitob o'qishim kerak" - 'it' (uy hayvoni) faktini chaqirib yubormasligi
    const rBook = await bot8.process("kitob o'qishim kerak");
    assert("8.1. 'kitob o'qishim kerak'da 'it' (hayvon) haqida gapirmaslik", !rBook.reply.toLowerCase().includes("vafodor") && !rBook.reply.toLowerCase().includes("uy hayvoni"), `Reply: ${rBook.reply}`);

    // 8.2. "Marsdagi 5-qavatli turar-joy binosining manzili nima?" - 'oy' deb tushunmaslik
    const rMars = await bot8.process("Marsdagi 5-qavatli turar-joy binosining manzili nima?");
    assert("8.2. Mars turar-joy so'rovi 'oy' (sayyora yo'ldoshi) deb chalkashmadi", rMars.toolUsed === "FalsePremiseGuard" && !rMars.reply.toLowerCase().includes("tabiiy yo'ldoshi"), `Reply: ${rMars.reply}`);
  }

  // -------------------------------------------------------------------
  // 9. Tezlik va kechikish mezonlari (Latency Benchmark)
  // -------------------------------------------------------------------
  console.log("\n--- 9. Tezlik Mezonlari (< 50 ms) ---");
  {
    const bot9 = createTestBot();
    const t0 = Date.now();
    await bot9.process("shaxmat o'ynayman");
    const d1 = Date.now() - t0;
    assert("9.1. Kompozitsion NLG tezligi < 50ms", d1 < 50, `Elapsed: ${d1}ms`);

    await bot9.process("Ali va Vali keldilar");
    const t1 = Date.now();
    await bot9.process("U qachon ketadi?");
    const d2 = Date.now() - t1;
    assert("9.2. Anaphora va noaniqlik aniqlash < 50ms", d2 < 50, `Elapsed: ${d2}ms`);
  }

  // -------------------------------------------------------------------
  // Yakuniy Xulosa
  // -------------------------------------------------------------------
  console.log("\n=======================================================================");
  console.log(`  🎯 STAGE 5 YAKUNIY NATIJA: ${passed} / ${total} ta test muvaffaqiyatli o'tdi (${Math.round((passed / total) * 100)}%)`);
  console.log("=======================================================================");

  if (passed === total) {
    console.log("\n  🏆 5-BOSQICHNING BARCHA TALABLARI 100% TO'LIQ VA BIRORTA MUAMMOSIZ BAJARILDI!");
    process.exit(0);
  } else {
    console.error(`\n  ⚠️ ${total - passed} ta testda xatolik aniqlandi.`);
    process.exit(1);
  }
}

runStage5Tests().catch((err) => {
  console.error("Testda kutilmagan xatolik yuz berdi:", err);
  process.exit(1);
});
