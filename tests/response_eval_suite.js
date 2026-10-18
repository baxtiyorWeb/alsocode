"use strict";

/**
 * =======================================================================
 *  NEURAL STUDIO — COMPREHENSIVE RESPONSE EVALUATION SUITE (STAGE 2)
 * =======================================================================
 *  10 ta standart guruh bo'yicha chatbotning haqiqiy sifatini, kechikishini,
 *  kontekstini va mantiqiy barqarorligini avtomatik baholash tizimi.
 *  
 *  - Faqat bitta kalit so'zga aldanmaydi (Multi-criterion evaluation).
 *  - Kutilmagan qattiq kodlarni (Cheats/Overfitting) aniqlaydi.
 *  - Halol, shaffof va takrorlanuvchi baseline ko'rsatkichlarini hisoblaydi.
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

function buildFreshChatbot() {
  const vocabData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json"), "utf-8"));
  const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
  const tokenizer = new Tokenizer();
  tokenizer.vocabulary = vocabData.vocabulary;
  tokenizer.categories = vocabData.categories;
  const analyzer = new TextAnalyzer(nn, tokenizer);
  const embeddings = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
  const miniLLM = new MiniLLM(12, embeddings);
  const memory = new CognitiveMemory(":memory:"); // Memory in-memory to prevent state bleed
  const rag = new DocumentRAGEngine(embeddings, path.join(__dirname, "..", "data", "documents.json"));

  return new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);
}

/**
 * 10 ta toifadagi 32 ta qat'iy sinov holatlari (Evaluation Benchmark)
 */
const EVALUATION_CASES = [
  // =====================================================================
  // GURUH 1: Oddiy faktik savollar (Facts & Definitions)
  // =====================================================================
  {
    group: "1. Oddiy faktik savollar",
    id: "G1_F1",
    prompt: "O'zbekistonning poytaxti qaysi shahar?",
    mustInclude: ["toshkent"],
    mustNotInclude: ["bilim yo'q", "o'rgatilmagan"],
    rubric: "O'zbekiston poytaxti Toshkent ekanligi to'g'ridan-to'g'ri ko'rsatilishi kerak."
  },
  {
    group: "1. Oddiy faktik savollar",
    id: "G1_F2",
    prompt: "Quyosh nima?",
    mustInclude: ["yulduz", "markaz"],
    mustNotInclude: ["bilim yo'q", "o'rgatilmagan"],
    rubric: "Quyosh Quyosh tizimi markazidagi yulduz (plazma shari) sifatida ta'riflanishi kerak."
  },
  {
    group: "1. Oddiy faktik savollar",
    id: "G1_F3",
    prompt: "Fotosintez jarayoni nima?",
    mustInclude: ["o'simlik", "quyosh", "kislorod"],
    mustNotInclude: ["bilim yo'q"],
    rubric: "O'simliklarning quyosh nuri yordamida oziqa va kislorod hosil qilishi tushuntirilishi kerak."
  },

  // =====================================================================
  // GURUH 2: Oddiy matematika va mantiq (Math & Reasoning)
  // =====================================================================
  {
    group: "2. Oddiy matematika va mantiq",
    id: "G2_M1",
    prompt: "5 ta olma bor edi, 2 tasini yedim. Nechta qoldi?",
    mustInclude: ["3"],
    mustNotInclude: ["16", "22", "19", "alida"], // Oldingi datasetdagi 16 ta olma iqtibosini jazolash
    rubric: "5 - 2 = 3 ta olma qolgani to'g'ri hisoblanishi kerak (dataset iqtibosisiz)."
  },
  {
    group: "2. Oddiy matematika va mantiq",
    id: "G2_M2",
    prompt: "12 ni 4 ga ko'paytir",
    mustInclude: ["48"],
    mustNotInclude: ["bilim yo'q"],
    rubric: "12 * 4 = 48 arifmetik natijasi to'g'ri ko'rsatilishi kerak."
  },
  {
    group: "2. Oddiy matematika va mantiq",
    id: "G2_M3",
    prompt: "Barcha insonlar nafas oladi. Ali — inson. Ali nafas oladimi?",
    mustInclude: ["ha", "nafas oladi"],
    mustNotInclude: ["bilim yo'q", "mumkin emas"],
    rubric: "Alining inson ekanligidan kelib chiqib, u ham nafas olishi deduktiv xulosa qilinishi kerak."
  },
  {
    group: "2. Oddiy matematika va mantiq",
    id: "G2_M4",
    prompt: "Ketma-ketlik: 3, 6, 12, 24. Keyingi son nima?",
    mustInclude: ["48"],
    mustNotInclude: ["bilim yo'q"],
    rubric: "Geometrik progressiya bo'yicha 24 * 2 = 48 soni topilishi kerak."
  },

  // =====================================================================
  // GURUH 3: Shartli va chalg‘ituvchi savollar (Conditional & Capabilities)
  // =====================================================================
  {
    group: "3. Shartli va chalg'ituvchi savollar",
    id: "G3_C1",
    prompt: "Mushuk ucha oladimi?",
    mustInclude: ["yo'q", "ucha olmaydi"],
    mustNotInclude: ["ha, ucha oladi", "qanotlari bor"],
    rubric: "Mushuk sutemizuvchi ekanligi va ucha olmasligi biologik to'g'ri aytilishi kerak."
  },
  {
    group: "3. Shartli va chalg'ituvchi savollar",
    id: "G3_C2",
    prompt: "Qishda havo sovuq bo'lsa, nima kiyish kerak?",
    mustInclude: ["issiq", "qalin"],
    mustNotInclude: ["yupqa", "futbolka"],
    rubric: "Sovuq havo uchun issiq/qalin kiyimlar tavsiya etilishi kerak."
  },
  {
    group: "3. Shartli va chalg'ituvchi savollar",
    id: "G3_C3",
    prompt: "Tosh suvda suza oladimi?",
    mustInclude: ["yo'q", "cho'kadi", "suza olmaydi"],
    mustNotInclude: ["ha, suzadi"],
    rubric: "Tosh suvdan og'ir bo'lgani sababli cho'kishi, suza olmasligi bildirilishi kerak."
  },

  // =====================================================================
  // GURUH 4: Noaniq savollar va aniqlashtirish (Ambiguity & Clarification)
  // =====================================================================
  {
    group: "4. Noaniq savollar va aniqlashtirish",
    id: "G4_A1",
    prompt: "U qachon keladi?",
    mustInclude: ["kim", "qaysi", "aniq"],
    mustNotInclude: ["soat 5 da", "ertaga keladi"],
    rubric: "Kontekstsiz 'u' olmoshi uchun taxmin qilinmasdan aniqlashtirish so'ralishi kerak."
  },
  {
    group: "4. Noaniq savollar va aniqlashtirish",
    id: "G4_A2",
    prompt: "Menga uning narxini ayt",
    mustInclude: ["qaysi", "mahsulot", "aniq"],
    mustNotInclude: ["10 000 so'm", "arzon"],
    rubric: "Qaysi mahsulot yoki tovar narxi so'ralayotgani aniqlashtirilishi kerak."
  },

  // =====================================================================
  // GURUH 5: Ko‘p bosqichli suhbat (Multi-turn Context & DST)
  // =====================================================================
  {
    group: "5. Ko'p bosqichli suhbat",
    id: "G5_MT1",
    isMultiTurn: true,
    turns: [
      {
        prompt: "Mening ismim Bobur va men shifokorman.",
        mustInclude: ["Bobur"],
        rubric: "Foydalanuvchi ismi va kasbini eslab qolish tasdig'i."
      },
      {
        prompt: "Mening kasbim nima?",
        mustInclude: ["shifokor"],
        mustNotInclude: ["dasturchi", "bilim yo'q"],
        rubric: "Oldingi replikadagi shifokor kasbini xotiradan to'g'ri qaytarish."
      },
      {
        prompt: "Mening ismim nima edi?",
        mustInclude: ["Bobur"],
        mustNotInclude: ["Hursand", "Ali"],
        rubric: "Foydalanuvchi ismi Bobur ekanligini to'g'ri aytish."
      }
    ]
  },
  {
    group: "5. Ko'p bosqichli suhbat",
    id: "G5_MT2",
    isMultiTurn: true,
    turns: [
      {
        prompt: "Jasur bu kompaniya rahbari",
        mustInclude: ["Jasur", "rahbari"],
        rubric: "Yangi fakt xotiraga saqlanishi."
      },
      {
        prompt: "Jasur kim?",
        mustInclude: ["rahbar"],
        mustNotInclude: ["bilim yo'q"],
        rubric: "Jasur haqidagi o'rganilgan faktni eslash."
      }
    ]
  },

  // =====================================================================
  // GURUH 6: Oldingi javobni qisqartirish yoki tushuntirish (Summarization)
  // =====================================================================
  {
    group: "6. Qisqartirish yoki tushuntirish",
    id: "G6_S1",
    isMultiTurn: true,
    turns: [
      {
        prompt: "Oy nima?",
        mustInclude: ["sun'iy yo'ldosh" , "tabiiy yo'ldosh", "yer"],
        rubric: "Oy Yerning tabiiy yo'ldoshi sifatida ta'riflanishi."
      },
      {
        prompt: "Buni ikki jumlada qisqartir",
        mustInclude: ["oy", "yer"],
        mustNotInclude: ["quyosh energiyasi"], // Qat'iy test: Quyosh energiyasi hardcode qilingan cheatni jazolash
        rubric: "Oy haqidagi javob qisqartirilishi kerak (Quyosh energiyasiga aylanib ketmasligi shart)."
      }
    ]
  },

  // =====================================================================
  // GURUH 7: Mavzuni almashtirish (Topic Shift & Context Reset)
  // =====================================================================
  {
    group: "7. Mavzuni almashtirish",
    id: "G7_TS1",
    isMultiTurn: true,
    turns: [
      {
        prompt: "JavaScript dasturlash tili nima?",
        mustInclude: ["dasturlash"],
        rubric: "Dasturlash tili haqida tushuntirish."
      },
      {
        prompt: "Endi mavzuni butunlay o'zgartiramiz. Somsa qanday taom?",
        mustInclude: ["taom", "pishiriq", "go'sht"],
        mustNotInclude: ["javascript", "kod", "dastur"],
        rubric: "Mavzu o'zgarganda yangi mavzuga mos javob berish (oldigi mavzu aralashmasligi kerak)."
      }
    ]
  },

  // =====================================================================
  // GURUH 8: Noma’lum savollarga javob berish (Unknown / OOV)
  // =====================================================================
  {
    group: "8. Noma'lum savollarga javob",
    id: "G8_U1",
    prompt: "2099 yilda kashf etilgan gipotetik zarracha kodi qanday?",
    mustInclude: ["ma'lumot yo'q", "bilmayman", "o'rgatilmagan"],
    mustNotInclude: ["aniq kodi:", "kashf qilingan"],
    rubric: "Kelajakdagi mavjud bo'lmagan fakt to'qib chiqarilmasdan, ma'lumot yo'qligi tan olinishi kerak."
  },
  {
    group: "8. Noma'lum savollarga javob",
    id: "G8_U2",
    prompt: "Marsdagi 5-qavatli turar-joy binosining manzili nima?",
    mustInclude: ["mavjud emas", "qurilmagan", "shahar yo'q"],
    mustNotInclude: ["ko'chasi", "bino manzili"],
    rubric: "Marsda bino yo'qligi sababli soxta manzil to'qimaslik."
  },

  // =====================================================================
  // GURUH 9: O‘zbekcha imlo, apostrof, sinonim va paraphrase
  // =====================================================================
  {
    group: "9. Imlo, apostrof va sinonimlar",
    id: "G9_O1",
    prompt: "oʻzbekiston poytaxti qayer?",
    mustInclude: ["toshkent"],
    mustNotInclude: ["bilim yo'q"],
    rubric: "Oʻ (o'zbekcha teskari apostrof) to'g'ri normallashtirilib, Toshkent aytilishi kerak."
  },
  {
    group: "9. Imlo, apostrof va sinonimlar",
    id: "G9_O2",
    prompt: "O'zbekistonning bosh shahri qaysi?",
    mustInclude: ["toshkent"],
    mustNotInclude: ["bilim yo'q"],
    rubric: "'Bosh shahri' sinonimi poytaxt ma'nosida tushunilishi kerak."
  },
  {
    group: "9. Imlo, apostrof va sinonimlar",
    id: "G9_O3",
    prompt: "men hursandman",
    mustInclude: ["xursand", "kayfiyat", "quvondim"],
    mustNotInclude: ["Tanishganimdan xursandman, Hursand"], // 'Hursand'ni ism deb tushunish xatosini jazolash
    rubric: "'hursandman' so'zi inson ismi emas, hissiyot ekanligi to'g'ri anglanishi kerak."
  },
  {
    group: "9. Imlo, apostrof va sinonimlar",
    id: "G9_O4",
    prompt: "juda toliqdim",
    mustInclude: ["dam", "charchab", "hordiq"],
    mustNotInclude: ["imtihonlarga tayyorlanib"],
    rubric: "'toliqdim' so'zi charchoq holati sifatida iliq qabul qilinishi kerak."
  },

  // =====================================================================
  // GURUH 10: Noto‘g‘ri taxmin yoki yolg‘on shart kiritilgan savollar
  // =====================================================================
  {
    group: "10. Noto'g'ri taxminlarni fosh qilish",
    id: "G10_FP1",
    prompt: "Marsda 2024 yilda qurilgan shahar nomi nima?",
    mustInclude: ["qurilmagan", "shahar yo'q"],
    mustNotInclude: ["shahar nomi:", "qurilgan shahar"],
    rubric: "Marsda shahar yo'qligi va taxmin asossiz ekanligi bildirilishi kerak."
  },
  {
    group: "10. Noto'g'ri taxminlarni fosh qilish",
    id: "G10_FP2",
    prompt: "Qora tuynukning ichidagi haroratni laboratoriyada o'lchagan olim kim?",
    mustInclude: ["imkonsiz", "olim yo'q"],
    mustNotInclude: ["o'lchagan olim:", "laboratoriyada o'lchandi"],
    rubric: "Fizik jihatdan bu imkonsiz ekanligi fosh qilinishi kerak."
  },
  {
    group: "10. Noto'g'ri taxminlarni fosh qilish",
    id: "G10_FP3",
    prompt: "Toshkent dengiz bo'yida joylashganmi?",
    mustInclude: ["yo'q", "emas", "dengiz"],
    mustNotInclude: ["ha, dengiz bo'yida"],
    rubric: "Toshkent dengiz bo'yida emasligi to'g'ri tushuntirilishi kerak."
  }
];

/**
 * Matnni mezonlar bo'yicha tekshirish
 */
function evaluateResponse(reply, testCase) {
  const lower = (reply || "").toLowerCase().replace(/[`ʼʻ']/g, "'");
  let score = 100;
  const failureReasons = [];

  // 1. Majburiy so'zlar tekshiruvi (mustInclude)
  if (testCase.mustInclude && testCase.mustInclude.length > 0) {
    const hasAny = testCase.mustInclude.some(term => lower.includes(term.toLowerCase().replace(/[`ʼʻ']/g, "'")));
    if (!hasAny) {
      score -= 50;
      failureReasons.push(`Kutilgan asosiy tushunchalar topilmadi: [${testCase.mustInclude.join(", ")}]`);
    }
  }

  // 2. Taqiqlangan so'zlar / xatolar tekshiruvi (mustNotInclude)
  if (testCase.mustNotInclude && testCase.mustNotInclude.length > 0) {
    for (const banned of testCase.mustNotInclude) {
      if (lower.includes(banned.toLowerCase().replace(/[`ʼʻ']/g, "'"))) {
        score -= 40;
        failureReasons.push(`Taqiqlangan/noto'g'ri ibora uchradi: "${banned}"`);
      }
    }
  }

  // 3. Quruq bir xil shablon yoki bo'sh javob
  if (!reply || reply.trim().length < 5) {
    score = 0;
    failureReasons.push("Javob bo'sh yoki o'ta qisqa.");
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 60 && failureReasons.length === 0;

  return {
    score,
    passed,
    failureReasons
  };
}

/**
 * Barcha testlarni to'liq bajarish va hisobot generatsiya qilish
 */
async function runEvaluationSuite() {
  console.log("=========================================================================");
  console.log("  NEURAL STUDIO — 10 BOSQICHLI ISHONCHLI TEST VA BAHOLASH TIZIMI (STAGE 2)");
  console.log("=========================================================================\n");

  const results = [];
  const groupStats = {};

  for (const tc of EVALUATION_CASES) {
    if (!groupStats[tc.group]) {
      groupStats[tc.group] = { total: 0, passed: 0, totalMs: 0, scores: [] };
    }

    if (tc.isMultiTurn) {
      // Ko'p bosqichli test: har bir guruh uchun yangi izolyatsiyalangan chatbot
      const chatbot = buildFreshChatbot();
      let multiPassed = true;
      let multiScoreSum = 0;
      let turnDetails = [];

      for (let tIdx = 0; tIdx < tc.turns.length; tIdx++) {
        const turn = tc.turns[tIdx];
        const t0 = Date.now();
        const res = await chatbot.process(turn.prompt);
        const elapsed = Date.now() - t0;

        const evalRes = evaluateResponse(res.reply, turn);
        multiScoreSum += evalRes.score;
        if (!evalRes.passed) multiPassed = false;

        turnDetails.push({
          turn: tIdx + 1,
          prompt: turn.prompt,
          reply: res.reply,
          toolUsed: res.toolUsed,
          elapsed,
          evalRes
        });
      }

      const avgScore = Math.round(multiScoreSum / tc.turns.length);
      groupStats[tc.group].total++;
      if (multiPassed) groupStats[tc.group].passed++;
      groupStats[tc.group].scores.push(avgScore);

      const statusIcon = multiPassed ? "✅" : "❌";
      console.log(`${statusIcon} [${tc.id}] (${tc.group})`);
      console.log(`   Ko'p bosqichli suhbat (${tc.turns.length} qadam): ${multiPassed ? "O'TDI" : "YIQILDI"} (O'rtacha ball: ${avgScore}%)`);
      for (const td of turnDetails) {
        console.log(`     Turn ${td.turn}: "${td.prompt}" -> [${td.toolUsed || "direct"}] ${td.elapsed} ms`);
        if (!td.evalRes.passed) {
          console.log(`       ⚠️ Kamchilik: ${td.evalRes.failureReasons.join("; ")}`);
        }
      }
      console.log("");

      results.push({
        id: tc.id,
        group: tc.group,
        isMultiTurn: true,
        passed: multiPassed,
        score: avgScore,
        turnDetails
      });

    } else {
      // Bir bosqichli test
      const chatbot = buildFreshChatbot();
      const t0 = Date.now();
      const res = await chatbot.process(tc.prompt);
      const elapsed = Date.now() - t0;

      const evalRes = evaluateResponse(res.reply, tc);
      groupStats[tc.group].total++;
      if (evalRes.passed) groupStats[tc.group].passed++;
      groupStats[tc.group].totalMs += elapsed;
      groupStats[tc.group].scores.push(evalRes.score);

      const statusIcon = evalRes.passed ? "✅" : "❌";
      console.log(`${statusIcon} [${tc.id}] (${tc.group})`);
      console.log(`   Savol:   "${tc.prompt}"`);
      console.log(`   Javob:   "${res.reply.slice(0, 110)}..."`);
      console.log(`   Natija:  ${evalRes.passed ? "O'TDI" : "YIQILDI"} (${evalRes.score}%) | Vosita: ${res.toolUsed || "Direct"} | Vaqt: ${elapsed} ms`);
      if (!evalRes.passed) {
        console.log(`   Sabab:   ${evalRes.failureReasons.join("; ")}`);
      }
      console.log("");

      results.push({
        id: tc.id,
        group: tc.group,
        isMultiTurn: false,
        prompt: tc.prompt,
        reply: res.reply,
        toolUsed: res.toolUsed,
        elapsedMs: elapsed,
        passed: evalRes.passed,
        score: evalRes.score,
        reasons: evalRes.failureReasons
      });
    }
  }

  // Umumiy yakuniy statistika
  console.log("=========================================================================");
  console.log("  GURUHLAR BO'YICHA YAKUNIY KO'RSATKICHLAR (BASELINE)");
  console.log("=========================================================================");
  let overallTotal = 0;
  let overallPassed = 0;

  for (const [groupName, stats] of Object.entries(groupStats)) {
    overallTotal += stats.total;
    overallPassed += stats.passed;
    const passPct = Math.round((stats.passed / stats.total) * 100);
    const avgScore = Math.round(stats.scores.reduce((a, b) => a + b, 0) / (stats.scores.length || 1));
    const icon = passPct >= 80 ? "✅" : passPct >= 50 ? "⚠️" : "❌";
    console.log(`  ${icon} ${groupName.padEnd(42, " ")}: ${stats.passed}/${stats.total} (${passPct}%) | O'rtacha sifat: ${avgScore}%`);
  }

  const overallPct = Math.round((overallPassed / overallTotal) * 100);
  console.log("-------------------------------------------------------------------------");
  console.log(`  JAMI NATIJA: ${overallPassed} / ${overallTotal} ta test o'tdi (${overallPct}%)`);
  console.log("=========================================================================\n");

  // Natijalarni faylga saqlash
  const baselineData = {
    evaluatedAt: new Date().toISOString(),
    overallTotal,
    overallPassed,
    overallPercentage: overallPct,
    groupStats,
    results
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "data", "response_baseline_results.json"),
    JSON.stringify(baselineData, null, 2),
    "utf-8"
  );

  return baselineData;
}

if (require.main === module) {
  runEvaluationSuite().catch(err => {
    console.error("Evaluation error:", err);
    process.exit(1);
  });
}

module.exports = {
  EVALUATION_CASES,
  evaluateResponse,
  runEvaluationSuite
};
