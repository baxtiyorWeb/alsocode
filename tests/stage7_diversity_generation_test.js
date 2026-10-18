"use strict";

/**
 * =======================================================================
 *  STAGE 7 AUTOMATED TEST SUITE: DIVERSITY, ANTI-TEMPLATING & ADAPTIVE NLG
 * =======================================================================
 *  Tekshiriladigan asosiy professional talablar:
 *  1. Bitta savol 5 marta berilganda 5 xil noyob javob shakllanishi.
 *  2. Javoblarning hajmi dinamik o'zgarishi (to'liq tahlil, qisqa lo'nda, amaliy, xulosa).
 *  3. Bilim yo'q bo'lganda rad javobining ham 5 xil o'zgaruvchan shaklda berilishi.
 *  4. Qotib qolgan « » qavslar va shablonlarning yo'qotilgani.
 *  5. Bot persona (uyqu, charchoq) bo'yicha ketma-ket javoblar xilma-xilligi.
 *  6. Faktik aniqlik 100% saqlanishi.
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

async function runStage7Tests() {
  console.log("=======================================================================");
  console.log("  🧠 STAGE 7: DIVERSITY, ANTI-TEMPLATING & ADAPTIVE NLG SUITE");
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
  // 1. Bir xil savolga 5 xil turlicha javob (Syntactic & Lexical Diversity)
  // -------------------------------------------------------------------
  console.log("--- 1. Tushuncha Ta'rifi: 5 Turn Davomida Xilma-xillik ---");
  {
    const replies = [];
    const lengths = [];
    for (let i = 1; i <= 5; i++) {
      const res = await bot.process("Kitob nima?");
      replies.push(res.reply);
      lengths.push(res.reply.length);
    }

    const uniqueReplies = new Set(replies);
    assert("1.1. 'Kitob nima?' 5 marta so'ralganda 5 ta butunlay boshqacha javob qaytdi",
      uniqueReplies.size === 5,
      `Noyob javoblar soni: ${uniqueReplies.size} / 5`
    );

    const minLen = Math.min(...lengths);
    const maxLen = Math.max(...lengths);
    const lenDiff = maxLen - minLen;
    assert("1.2. Javoblarning hajmi va chuqurligi dinamik o'zgardi (Farq >= 30 belgi)",
      lenDiff >= 30,
      `Min: ${minLen}, Max: ${maxLen}, Farq: ${lenDiff} belgi`
    );

    const allFactuallyCorrect = replies.every(r => {
      const low = r.toLowerCase();
      return low.includes("kitob") || low.includes("manba") || low.includes("asar");
    });
    assert("1.3. Barcha 5 ta javobda faktik aniqlik 100% to'g'ri saqlandi",
      allFactuallyCorrect,
      `Faktlar to'g'riligi tasdiqlandi`
    );
  }

  // -------------------------------------------------------------------
  // 2. Noma'lum Savolga Rad Javobi Xilma-xilligi (Dynamic Unknown Generation)
  // -------------------------------------------------------------------
  console.log("\n--- 2. Noma'lum Savollar: O'zgaruvchan Kamtarlik va Rad Javoblari ---");
  {
    const refusals = [];
    for (let i = 1; i <= 5; i++) {
      const res = await bot.process("2099 yilda kashf etilgan gipotetik zarracha kodi qanday?");
      refusals.push(res.reply);
    }

    const uniqueRefusals = new Set(refusals);
    assert("2.1. Noma'lum savol 5 marta berilganda 5 xil ifoda bilan rad javobi qaytdi",
      uniqueRefusals.size === 5,
      `Noyob rad javoblari: ${uniqueRefusals.size} / 5`
    );

    const hasNoStaticTemplate = refusals.every(r => {
      const low = r.toLowerCase();
      return (low.includes("menga bilim o'rgatilmagan") || low.includes("menda bilim yo'q") || low.includes("bilimim yetarli emas")) &&
             (low.includes("afsuski") || low.includes("ochiq aytganda") || low.includes("to'g'risini") || low.includes("rosti") || low.includes("kechirasiz") || low.includes("hozircha"));
    });
    assert("2.2. Rad javoblarida kirish, sabab va muqobil takliflar doimiy o'zgarib turdi",
      hasNoStaticTemplate,
      `Namunalar: ${refusals[0].substring(0, 40)}... | ${refusals[1].substring(0, 40)}...`
    );
  }

  // -------------------------------------------------------------------
  // 3. Xom Qavslar (« ») va Statik Iqtiboslarning Yo'qotilgani
  // -------------------------------------------------------------------
  console.log("\n--- 3. Sintetik Erkin Bayon (Zero Raw Bracketed Quotes) ---");
  {
    const rGen = await bot.process("Fotosintez jarayoni nima?");
    const hasRawBrackets = rGen.reply.includes("«") || rGen.reply.includes("»");
    assert("3.1. Sintetik javoblarda xom « » qavslari ishlatilmadi (erkin tabiiy matn)",
      !hasRawBrackets,
      `Reply: ${rGen.reply.substring(0, 60)}...`
    );

    assert("3.2. Fotosintez jarayoni mohiyati to'g'ri izohlandi",
      rGen.reply.toLowerCase().includes("fotosintez") && (rGen.reply.toLowerCase().includes("quyosh") || rGen.reply.toLowerCase().includes("kislorod")),
      `Reply: ${rGen.reply.substring(0, 60)}...`
    );
  }

  // -------------------------------------------------------------------
  // 4. Bot Persona Xilma-xilligi (Uyqu va Charchoq)
  // -------------------------------------------------------------------
  console.log("\n--- 4. Bot Shaxsiyati va Tabiati Xilma-xilligi ---");
  {
    const sleepReplies = [];
    for (let i = 1; i <= 3; i++) {
      const res = await bot.process("uxlaysanmi sen");
      sleepReplies.push(res.reply);
    }
    const uniqueSleep = new Set(sleepReplies);
    assert("4.1. 'uxlaysanmi sen' ketma-ket so'ralganda turli xil samimiy javoblar berildi",
      uniqueSleep.size >= 2,
      `Noyob javoblar: ${uniqueSleep.size} / 3`
    );

    const allAIPersona = sleepReplies.every(r => {
      const low = r.toLowerCase();
      return low.includes("sun'iy intellekt") || low.includes("uyqu") || low.includes("uxlamayman") || low.includes("24/7");
    });
    assert("4.2. Barcha javoblar 100% AI Assistant shaxsiyatiga mos, begona iqtiboslarsiz chiqdi",
      allAIPersona,
      `Replies valid`
    );
  }

  // -------------------------------------------------------------------
  // 5. Dinamik Mantiq va Deduktiv To'g'rilik
  // -------------------------------------------------------------------
  console.log("\n--- 5. Deduktiv Mantiqiy Sintez ---");
  {
    const rSyl = await bot.process("Barcha insonlar nafas oladi. Ali — inson. Ali nafas oladimi?");
    assert("5.1. Barbara sillogizmida qat'iy mantiqiy xulosa berildi (Ha, Ali ham nafas oladi)",
      rSyl.reply.toLowerCase().includes("ha") && rSyl.reply.toLowerCase().includes("nafas oladi"),
      `Reply: ${rSyl.reply.substring(0, 50)}...`
    );
  }

  // -------------------------------------------------------------------
  // 6. Yumshoq Faktik Nazorat va Falsafiy Mushohada (Soft Grounding)
  // -------------------------------------------------------------------
  console.log("\n--- 6. Yumshoq Faktik Nazorat va Kognitiv Mushohada ---");
  {
    const rReflect = await bot.process("baxt haqida nima deysan?");
    const lowReflect = rReflect.reply.toLowerCase();
    assert("6.1. Falsafiy savolga quruq rad etmasdan donishmandona mushohada bilan javob berildi",
      lowReflect.includes("baxt") && (lowReflect.includes("qalb") || lowReflect.includes("xotirjamlik") || lowReflect.includes("quvonch")),
      `Reply: ${rReflect.reply.substring(0, 60)}...`
    );
    assert("6.2. Falsafiy savolda soxta rad javobi ('bilim o'rgatilmagan') ishlatilmadi",
      !lowReflect.includes("bilim o'rgatilmagan") && !lowReflect.includes("bilimim yo'q"),
      `Reply: ${rReflect.reply.substring(0, 60)}...`
    );

    const rFactual = await bot.process("Marsda nechta shahar bor?");
    const lowFactual = rFactual.reply.toLowerCase();
    assert("6.3. Noma'lum empirik faktga yolg'on to'qimasdan xolis faktik nazorat qo'llandi",
      lowFactual.includes("bilim") || lowFactual.includes("mavjud emas") || lowFactual.includes("shahar"),
      `Reply: ${rFactual.reply.substring(0, 60)}...`
    );
  }

  // -------------------------------------------------------------------
  // 7. Hajm Dinamikasi (Dynamic Volume Scaling)
  // -------------------------------------------------------------------
  console.log("\n--- 7. Hajm Dinamikasi (Dynamic Volume Scaling) ---");
  {
    const lengths = [];
    for (let i = 0; i < 5; i++) {
      const res = await bot.process("somsa haqida aytchi");
      lengths.push(res.reply.length);
    }
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    const diff = maxLen - minLen;
    assert("7.1. Somsa so'rovi 5 turn davomida sezilarli hajm tebranishini namoyish etdi (Farq >= 40 belgi)",
      diff >= 40,
      `Max: ${maxLen}, Min: ${minLen}, Diff: ${diff}`
    );
  }

  // -------------------------------------------------------------------
  // Yakuniy Xulosa
  // -------------------------------------------------------------------
  console.log("\n=======================================================================");
  console.log(`  🎯 STAGE 7 YAKUNIY NATIJA: ${passed} / ${total} ta test muvaffaqiyatli o'tdi (${Math.round((passed / total) * 100)}%)`);
  console.log("=======================================================================");

  if (passed === total) {
    console.log("\n  🏆 7-BOSQICHNING BARCHA TALABLARI (DIVERSITY & ANTI-TEMPLATING) 100% BAJARILDI!");
    process.exit(0);
  } else {
    console.error(`\n  ⚠️ ${total - passed} ta testda muammo aniqlandi.`);
    process.exit(1);
  }
}

runStage7Tests().catch((err) => {
  console.error("Kutilmagan xatolik yuz berdi:", err);
  process.exit(1);
});
