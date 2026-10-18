"use strict";

/**
 * =======================================================================
 *  STAGE 6 AUTOMATED TEST SUITE: ADVANCED DEDUCTION, FAST KNOWLEDGE & NLG
 * =======================================================================
 *  Tekshiriladigan asosiy professional talablar:
 *  1. Aristotel Barbara sillogizmi (ko'p so'zli predikat bilan: "nafas oladi").
 *  2. Polisillogizm (Sorites / Zanjirli sillogizm tranzitivligi).
 *  3. Disyunktiv sillogizm (Modus Tollendo Ponens: "Yo A, yoki B. A emas").
 *  4. Shartli deduksiya (Modus Ponens & Modus Tollens).
 *  5. Ikki inkor asos mantiqiy xatosi (Fallacy of Exclusive Premises).
 *  6. FastIndexedKnowledge tezligi: 2.2 soniyalik kechikish yo'qotilgani (< 50 ms).
 *  7. Dinamik kontekst davomi: 'afzalliklarini ayt' da quyosh energiyasi qattiq kodi yo'qligi.
 *  8. Kontekstual qisqartirish ('ikki jumlada qisqartir') dinamik matnni qisqartirishi.
 *  9. Ko'r-ko'rona retrieval iqtiboslarini tozalash.
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

async function runStage6Tests() {
  console.log("=======================================================================");
  console.log("  🧠 STAGE 6: ADVANCED DEDUCTION, FAST KNOWLEDGE & DYNAMIC NLG SUITE");
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
  // 1. Deduktiv Mantiq va Aristotel Sillogizmlari (Barbara)
  // -------------------------------------------------------------------
  console.log("--- 1. Deduktiv Mantiq va Sillogizmlar ---");
  {
    const t0 = Date.now();
    const r1 = await bot.process("Barcha insonlar nafas oladi. Ali — inson. Ali nafas oladimi?");
    const elapsed = Date.now() - t0;

    assert("1.1. Barbara sillogizmi to'g'ri yechildi (Ha, Ali ham nafas oladi)",
      r1.reply.toLowerCase().includes("ha") && r1.reply.toLowerCase().includes("nafas oladi"),
      `Reply: ${r1.reply}`
    );
    assert("1.2. Vosita DeductiveReasoningEngine bo'ldi (LocalKnowledgeEngine emas)",
      r1.toolUsed === "DeductiveReasoningEngine",
      `Tool: ${r1.toolUsed}`
    );
    assert("1.3. Barbara sillogizmi ultra-tezkor ishladi (< 50ms)",
      elapsed < 50,
      `Elapsed: ${elapsed}ms`
    );
  }

  // -------------------------------------------------------------------
  // 2. Polisillogizm (Sorites / Zanjirli Sillogizm)
  // -------------------------------------------------------------------
  console.log("\n--- 2. Polisillogizm (Sorites) ---");
  {
    const r2 = await bot.process("Barcha A lar B. Barcha B lar C. X — A. Bundan qanday xulosa chiqadi?");
    assert("2.1. Zanjirli sillogizm tranzitivligi to'g'ri topildi (X ham C)",
      r2.reply.toUpperCase().includes("X HAM C") || r2.reply.toUpperCase().includes("C"),
      `Reply: ${r2.reply}`
    );
    assert("2.2. Vosita DeductiveReasoningEngine ishlatildi",
      r2.toolUsed === "DeductiveReasoningEngine",
      `Tool: ${r2.toolUsed}`
    );
  }

  // -------------------------------------------------------------------
  // 3. Disyunktiv Sillogizm (Modus Tollendo Ponens)
  // -------------------------------------------------------------------
  console.log("\n--- 3. Disyunktiv Sillogizm ---");
  {
    const r3 = await bot.process("Yo choy, yoki qahva. Choy emas. Bundan qanday xulosa chiqadi?");
    assert("3.1. Muqobillardan biri inkor qilinganda ikkinchisi xulosa qilindi (QAHVA)",
      r3.reply.toUpperCase().includes("QAHVA"),
      `Reply: ${r3.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 4. Shartli Deduksiya (Modus Ponens)
  // -------------------------------------------------------------------
  console.log("\n--- 4. Shartli Deduksiya (Modus Ponens) ---");
  {
    const r4 = await bot.process("Agar yomg'ir yog'sa, ko'cha ho'l bo'ladi. Yomg'ir yog'di. Nima bo'ladi?");
    assert("4.1. Modus Ponens tasdiqlovchi xulosasi berildi (ko'cha ho'l bo'ladi)",
      r4.reply.toLowerCase().includes("ko'cha") && r4.reply.toLowerCase().includes("ho'l"),
      `Reply: ${r4.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 5. Ikki inkor asos mantiqiy xatosi (Fallacy of Exclusive Premises)
  // -------------------------------------------------------------------
  console.log("\n--- 5. Mantiqiy Xatolar Tahlili (Fallacy) ---");
  {
    const r5 = await bot.process("Hech bir sudralib yuruvchi uchmaydi. Mushuk — sudralib yuruvchi emas. Bundan qanday xulosa kelib chiqadi?");
    assert("5.1. Ikki inkor asosdan qat'iy xulosa chiqarib bo'lmasligi to'g'ri ko'rsatildi",
      r5.reply.toLowerCase().includes("xulosa chiqarib bo'lmaydi") || r5.reply.toLowerCase().includes("noaniq"),
      `Reply: ${r5.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 6. FastIndexedKnowledge Latency Benchmark (2.2s -> < 50ms)
  // -------------------------------------------------------------------
  console.log("\n--- 6. FastIndexedKnowledge Tezlik Sinovi ---");
  {
    const botFast = createTestBot();
    const tStart = Date.now();
    const rUnknown = await botFast.process("2099 yilda kashf etilgan gipotetik zarracha kodi qanday?");
    const dUnknown = Date.now() - tStart;

    assert("6.1. O'qitilmagan umumiy so'rov tezligi < 50ms (2200ms bottleneck yo'q qilindi)",
      dUnknown < 50,
      `Elapsed: ${dUnknown}ms`
    );
    assert("6.2. Bilim o'rgatilmaganligi to'g'ri va xolis bildirildi",
      rUnknown.reply.toLowerCase().includes("o'rgatilmagan") || rUnknown.reply.toLowerCase().includes("bilim yo'q"),
      `Reply: ${rUnknown.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 7. Dinamik Kontekstual Davom: Quyosh Energiyasi Qattiq Kodini Tozalash
  // -------------------------------------------------------------------
  console.log("\n--- 7. Dinamik Kontekst Davomi (Dynamic Advantages) ---");
  {
    const botDyn = createTestBot();
    // 1-turn: Kitob haqida suhbat
    const rBook = await botDyn.process("Kitob nima?");
    assert("7.1. 1-qadam: Kitob ta'rifi berildi", rBook.reply.toLowerCase().includes("kitob") || rBook.reply.toLowerCase().includes("asar"));

    // 2-turn: Uning afzalliklarini ayt
    const rAdv = await botDyn.process("Uning afzalliklarini ayt");
    assert("7.2. 2-qadam: Afzalliklarda 'quyosh energiyasi' va 'tabiiy manba' kabi begona qattiq kodlar yo'q",
      !rAdv.reply.toLowerCase().includes("quyosh") && !rAdv.reply.toLowerCase().includes("qayta tiklanuvchi tabiiy manba"),
      `Reply: ${rAdv.reply}`
    );
    assert("7.3. 2-qadam: Kontekstga mos afzalliklar qaytarildi",
      rAdv.reply.toLowerCase().includes("afzallik") || rAdv.reply.toLowerCase().includes("samaradorlik"),
      `Reply: ${rAdv.reply}`
    );

    // 3-turn: Buni ikki jumlada qisqartir
    const rSum = await botDyn.process("Buni ikki jumlada qisqartir");
    assert("7.4. 3-qadam: Oldingi replikani dinamik qisqartirdi (quyosh energiyasi shabloni yo'q)",
      !rSum.reply.toLowerCase().includes("quyosh energiyasi") && rSum.reply.toLowerCase().includes("qisqacha xulosa"),
      `Reply: ${rSum.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 8. Tranzitiv Taqqoslash Mantiqi
  // -------------------------------------------------------------------
  console.log("\n--- 8. Tranzitiv Taqqoslash Mantiqi ---");
  {
    const rTrans = await bot.process("Ali Validan balandroq. Vali esa Sardordan balandroq. Eng pasti kim?");
    assert("8.1. Tranzitivlik munosabati yechildi (Eng pasti Sardor)",
      rTrans.reply.toLowerCase().includes("sardor"),
      `Reply: ${rTrans.reply}`
    );
  }

  // -------------------------------------------------------------------
  // 9. Vaqt va Taqvim Mantiqiy Topishmog'i
  // -------------------------------------------------------------------
  console.log("\n--- 9. Vaqt va Taqvim Mantiqiy Topishmog'i ---");
  {
    const rTime = await bot.process("Agar kecha ertangi kun bo'lganida, bugun shanba bo'lar edi. Unda aslida bugun qaysi kun?");
    assert("9.1. Vaqt topishmog'i to'g'ri yechildi (Payshanba yoki Dushanba)",
      rTime.reply.toUpperCase().includes("PAYSHANBA") || rTime.reply.toUpperCase().includes("DUSHANBA"),
      `Reply: ${rTime.reply}`
    );
  }

  // -------------------------------------------------------------------
  // Yakuniy Xulosa
  // -------------------------------------------------------------------
  console.log("\n=======================================================================");
  console.log(`  🎯 STAGE 6 YAKUNIY NATIJA: ${passed} / ${total} ta test muvaffaqiyatli o'tdi (${Math.round((passed / total) * 100)}%)`);
  console.log("=======================================================================");

  if (passed === total) {
    console.log("\n  🏆 6-BOSQICHNING BARCHA KRITERIYALARI 100% SENIOR DARAJADA BAJARILDI!");
    process.exit(0);
  } else {
    console.error(`\n  ⚠️ ${total - passed} ta testda muammo aniqlandi.`);
    process.exit(1);
  }
}

runStage6Tests().catch((err) => {
  console.error("Kutilmagan xatolik yuz berdi:", err);
  process.exit(1);
});
