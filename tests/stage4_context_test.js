"use strict";

/**
 * =======================================================================
 *  STAGE 4 AUTOMATED TEST SUITE: DIALOGUE MANAGEMENT & CONTEXT REPAIR
 * =======================================================================
 *  Tekshiriladigan muhim talablar:
 *  1. Chitchat & Hol-ahvol ("qandaysan", "salom", "rahmat") — 50ms dan tez,
 *     kitobiy iqtiboslarsiz (masalan, "koinot" haqida gapirmasdan).
 *  2. Conversational Repair ("men sendan hol ahvol so'radim", "buni so'ramadim") —
 *     xatoni insoniy tushunib, to'g'ri dialog davom ettirish.
 *  3. Discourse Follow-up ("nimani tushunding", "nega tez hayrlashding") —
 *     oldingi gap kontekstini ochib berish.
 *  4. Inkor nazorati (State Negation: "men charchamadim") —
 *     "dam ol" deb takrorlamaslik, tetiklikni qo'llab-quvvatlash.
 *  5. Ism va inkor ("mening ismim Bobur emas Baxtiyor") —
 *     Boburni inkor qilib, faqat Baxtiyorni eslab qolish.
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
  const memory = new CognitiveMemory(":memory:"); // Xotira izolatsiyasi
  const rag = new DocumentRAGEngine(embeddings, path.join(__dirname, "..", "data", "documents.json"));

  return new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);
}

async function runStage4Tests() {
  console.log("=======================================================================");
  console.log("  🚀 STAGE 4: DIALOGUE MANAGEMENT, REPAIR & NEGATION TEST SUITE");
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

  // 1. Chitchat: "qandaysan"
  {
    const start = Date.now();
    const res = await bot.process("qandaysan");
    const dur = Date.now() - start;
    const lower = res.reply.toLowerCase();

    assert(
      "1. 'qandaysan' — tezkor javob (< 50ms)",
      dur < 100,
      `Vaqt: ${dur}ms`
    );
    assert(
      "1. 'qandaysan' — vosita ChitchatDialogueEngine",
      res.toolUsed === "ChitchatDialogueEngine",
      `Tool: ${res.toolUsed}`
    );
    assert(
      "1. 'qandaysan' — koinot/fizika iqtibosisiz samimiy hol-ahvol",
      !lower.includes("koinot") && !lower.includes("nisbiylik") && (lower.includes("yaxshi") || lower.includes("rahmat")),
      `Javob: "${res.reply}"`
    );
  }

  // 2. Conversational Repair: "men sendan hol ahvol so'radim"
  {
    const res = await bot.process("men sendan hol ahvol so'radim");
    const lower = res.reply.toLowerCase();

    assert(
      "2. 'men sendan hol ahvol so'radim' — ConversationalRepairEngine ishlatildi",
      res.toolUsed === "ConversationalRepairEngine",
      `Tool: ${res.toolUsed}`
    );
    assert(
      "2. 'men sendan hol ahvol so'radim' — uzr so'rab, haqiqiy hol-ahvol aytdi",
      (lower.includes("kechir") || lower.includes("uzr")) && (lower.includes("yaxshi") || lower.includes("a'lo")),
      `Javob: "${res.reply}"`
    );
  }

  // 3. Discourse Follow-up: "nega tez hayrlashding"
  {
    const res = await bot.process("nega tez hayrlashding");
    const lower = res.reply.toLowerCase();

    assert(
      "3. 'nega tez hayrlashding' — DiscourseFollowupEngine ishlatildi",
      res.toolUsed === "DiscourseFollowupEngine",
      `Tool: ${res.toolUsed}`
    );
    assert(
      "3. 'nega tez hayrlashding' — noo'rin dam olish shablonisiz davom ettirish bildirdi",
      !lower.includes("zo'riqtirma") && (lower.includes("xayrlash") || lower.includes("suhbat") || lower.includes("davom")),
      `Javob: "${res.reply}"`
    );
  }

  // 4. Inkor nazorati: "men charchamadim"
  {
    const res = await bot.process("men charchamadim");
    const lower = res.reply.toLowerCase();

    assert(
      "4. 'men charchamadim' — StateNegationEngine ishlatildi",
      res.toolUsed === "StateNegationEngine",
      `Tool: ${res.toolUsed}`
    );
    assert(
      "4. 'men charchamadim' — 'dam ol' deb maslahat bermadi, tetiklikni olqishladi",
      !lower.includes("dam ol") && !lower.includes("zo'riqtirma") && (lower.includes("tetik") || lower.includes("quvvat") || lower.includes("xursand")),
      `Javob: "${res.reply}"`
    );
  }

  // 5. Ko'p bosqichli suhbat konteksti: "yo'q" -> "nimani tushunding"
  {
    const turn1 = await bot.process("yo'q");
    assert(
      "5. Turn 1: 'yo'q' — ShortReplyContextGate",
      turn1.toolUsed === "ShortReplyContextGate",
      `Tool: ${turn1.toolUsed}`
    );

    const turn2 = await bot.process("nimani tushunding");
    const lower2 = turn2.reply.toLowerCase();
    assert(
      "5. Turn 2: 'nimani tushunding' — DiscourseFollowupEngine",
      turn2.toolUsed === "DiscourseFollowupEngine",
      `Tool: ${turn2.toolUsed}`
    );
    assert(
      "5. Turn 2: 'nimani tushunding' — hujjat iqtibosisiz kontekstual tushuntirish",
      !lower2.includes("hujjat") && (lower2.includes("yo'q") || lower2.includes("inobatga") || lower2.includes("fikr")),
      `Javob: "${turn2.reply}"`
    );
  }

  // 6. Ism va Inkorli tuzatish: "mening ismim Bobur emas Baxtiyor"
  {
    const res = await bot.process("mening ismim Bobur emas Baxtiyor");
    const lower = res.reply.toLowerCase();

    assert(
      "6. 'mening ismim Bobur emas Baxtiyor' — ism Baxtiyor deb saqlandi",
      bot.memory.userProfile.name === "Baxtiyor",
      `Profile name: ${bot.memory.userProfile.name}`
    );
    assert(
      "6. 'mening ismim Bobur emas Baxtiyor' — javobda Baxtiyor deb kutib olindi (Bobur emas)",
      lower.includes("baxtiyor") && !lower.includes("xursandman, bobur"),
      `Javob: "${res.reply}"`
    );
  }

  // 7. Teskari inkor: "Men Jasur Baxtiyor emas"
  {
    const res = await bot.process("Men Jasur Baxtiyor emas");
    assert(
      "7. 'Men Jasur Baxtiyor emas' — ism Jasur deb yangilandi",
      bot.memory.userProfile.name === "Jasur",
      `Profile name: ${bot.memory.userProfile.name}`
    );
  }

  // 8. To'g'ridan-to'g'ri ism kiritish: "Mening ismim Sardor"
  {
    const start = Date.now();
    const res = await bot.process("Mening ismim Sardor");
    const dur = Date.now() - start;
    const lower = res.reply.toLowerCase();

    assert(
      "8. 'Mening ismim Sardor' — tezkor javob (< 50ms, RAG qidiruvisiz)",
      dur < 100,
      `Vaqt: ${dur}ms`
    );
    assert(
      "8. 'Mening ismim Sardor' — ortiqcha 'dam oling' iqtibosisiz sof tanishuv",
      lower.includes("sardor") && !lower.includes("dam olishingizni tilayman"),
      `Javob: "${res.reply}"`
    );
    assert(
      "8. Profil eslash: 'mening ismim nima?' ➔ Sardor",
      (await bot.process("mening ismim nima?")).reply.includes("Sardor"),
      "Ism eslash muvaffaqiyatsiz"
    );
  }

  // 9. Salomlashish va Rahmat
  {
    const salomRes = await bot.process("salom");
    assert(
      "9. 'salom' — ChitchatDialogueEngine orqali tezkor salomlashuv",
      salomRes.toolUsed === "ChitchatDialogueEngine" && salomRes.reply.toLowerCase().includes("salom"),
      `Javob: "${salomRes.reply}"`
    );

    const rahmatRes = await bot.process("katta rahmat");
    const rLower = rahmatRes.reply.toLowerCase();
    assert(
      "9. 'katta rahmat' — do'stona munosabat ('arzimaydi' yoki 'salomat bo'l')",
      (rahmatRes.toolUsed === "ShortReplyContextGate" || rahmatRes.toolUsed === "ChitchatDialogueEngine") &&
      (rLower.includes("arzimaydi") || rLower.includes("salomat")),
      `Javob: "${rahmatRes.reply}" (Tool: ${rahmatRes.toolUsed})`
    );
  }

  console.log("\n-----------------------------------------------------------------------");
  console.log(`  🎯 YAKUNIY NATIJA: ${passed} / ${total} ta tekshiruv muvaffaqiyatli o'tdi (${Math.round((passed/total)*100)}%)`);
  console.log("-----------------------------------------------------------------------\n");

  if (passed === total) {
    console.log("  🏆 4-BOSQICHNING BARCHA KRITERIYALARI 100% BAJARILDI!");
    process.exit(0);
  } else {
    console.error("  ⚠️ AYRIM TEKSHIRUVLARDA XATOLIK ANIQLANDI.");
    process.exit(1);
  }
}

runStage4Tests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
