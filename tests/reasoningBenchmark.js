"use strict";

const fs = require("fs");
const path = require("path");

/**
 * =======================================================================
 *  INDEPENDENT REASONING & GENERALIZATION BENCHMARK (14 CATEGORIES)
 * =======================================================================
 *  Mustaqil baholash to'plami — training datasetidan 100% ajratilgan.
 *  Modelning shunchaki yodlab olishini (memorization) emas, balki:
 *  - Arifmetika;
 *  - Sabab-oqibat;
 *  - Ko'p shartli masalalar;
 *  - Inkor va istisnolar;
 *  - O'zbekcha imlo variantlari va OOV so'zlarni tushunishini baholaydi.
 * =======================================================================
 */

const BENCHMARK_CASES = [
  // 1. Yangi savolga mos javob (Relevance)
  {
    id: "eval_01",
    category: "yangi_savol",
    prompt: "Toshkent qaysi davlatning poytaxti?",
    expectedKeywords: ["o'zbekiston", "respublika"],
    rubric: "Javobda 'O'zbekiston' nomi tilga olinishi kerak.",
  },

  // 2. Sabab va oqibat (Cause and Effect)
  {
    id: "eval_02",
    category: "sabab_oqibat",
    prompt: "Agar qishda qalin kiyinmasang nima bo'ladi?",
    expectedKeywords: ["shamollash", "sovuq", "kasal", "muzlash"],
    rubric: "Kasal bo'lish yoki sovuq qotish oqibati aytilishi kerak.",
  },

  // 3. Bir nechta shartli masala (Multi-condition)
  {
    id: "eval_03",
    category: "shartli_masala",
    prompt: "Agar svet o'chsa va telefoningda zaryad qolmasa nima qila olasan?",
    expectedKeywords: ["kitob", "dam", "uxlash", "kutish", "sham"],
    rubric: "Elektrsiz va telefonsiz bajarish mumkin bo'lgan harakat keltirilishi kerak.",
  },

  // 4. Oddiy arifmetika (Arithmetic Reasoning)
  {
    id: "eval_04",
    category: "arifmetika",
    prompt: "Savatda 5 ta olma bor edi, 2 tasini edim. Qancha olma qoldi?",
    expectedKeywords: ["3", "uch"],
    rubric: "To'g'ri son (3) ifodalanishi shart.",
  },

  // 5. Ketma-ketlik va naqshlar (Sequences & Patterns)
  {
    id: "eval_05",
    category: "ketma_ketlik",
    prompt: "Dushanba, seshanba, chorshanba... Keyingi kun qaysi?",
    expectedKeywords: ["payshanba"],
    rubric: "Hafta kunlarining to'g'ri davomi (Payshanba) topilishi kerak.",
  },

  // 6. Taqqoslash va tanlov (Comparison)
  {
    id: "eval_06",
    category: "taqqoslash",
    prompt: "Fil va chumolidan qaysi biri kattaroq?",
    expectedKeywords: ["fil"],
    rubric: "Kattaroq jism (fil) aniq ko'rsatilishi kerak.",
  },

  // 7. Inkor va istisnolar (Negation & Exceptions)
  {
    id: "eval_07",
    category: "inkor",
    prompt: "Quyosh kechasi chiqadimi yoki kunduzimi?",
    expectedKeywords: ["kunduzi", "kechasi emas", "chiqmaydi"],
    rubric: "Quyoshning kechasi chiqmasligi yoki kunduzi chiqishi to'g'ri tanlanishi kerak.",
  },

  // 8. Kontekstni saqlash (Context Retention)
  {
    id: "eval_08",
    category: "kontekst_saqlash",
    prompt: "Mening ismim Anvar. Mening ismim kim edi?",
    expectedKeywords: ["anvar"],
    rubric: "Foydalanuvchi bergan ism (Anvar) to'g'ri eslab qolinishi kerak.",
  },

  // 9. Oldingi xabar bilan bog'langan savol (Follow-up)
  {
    id: "eval_09",
    category: "boglangan_savol",
    prompt: "Men kitob o'qiyapman. U nima haqida deb o'ylaysan?",
    expectedKeywords: ["kitob", "mavzu", "qiziq", "bilim"],
    rubric: "Kitob mavzusiga aloqador mantiqiy savol yoki javob berilishi kerak.",
  },

  // 10. Noaniq savol (Ambiguity Detection)
  {
    id: "eval_10",
    category: "noaniq_savol",
    prompt: "U qachon keladi?",
    expectedKeywords: ["kim", "qaysi", "aniq", "tushunmadim"],
    rubric: "Noaniq olmosh 'u' kim ekanligi so'ralishi yoki aniqlashtirilishi kerak.",
  },

  // 11. Noto'g'ri taxminni aniqlash (False Premise)
  {
    id: "eval_11",
    category: "notogri_taxmin",
    prompt: "Toshkent dengiz bo'yida joylashganmi?",
    expectedKeywords: ["yo'q", "emas", "dengiz yo'q", "quruqlik"],
    rubric: "Toshkentda dengiz yo'qligi va taxmin noto'g'ri ekanligi bildirilishi kerak.",
  },

  // 12. Yetarli ma'lumot bo'lmaganda aniqlashtirish (Clarification)
  {
    id: "eval_12",
    category: "aniqlashtirish",
    prompt: "Menga uning narxini ayt.",
    expectedKeywords: ["nima", "qaysi", "mahsulot", "narxi"],
    rubric: "Qaysi mahsulot haqida gap ketayotgani aniqlashtirilishi kerak.",
  },

  // 13. O'zbekcha imlo variantlari (Spelling Robustness)
  {
    id: "eval_13",
    category: "imlo_variantlari",
    prompt: "O‘zbekiston, Oʻzbekiston va O'zbekiston bir xil davlatmi?",
    expectedKeywords: ["ha", "bir", "albatta", "aynan"],
    rubric: "Apostrof farqi bir xil davlat ekanligini anglatishi tasdiqlanishi kerak.",
  },

  // 14. Oldin ko'rilmagan so'zlar (OOV Generalization)
  {
    id: "eval_14",
    category: "unseen_sozlar",
    prompt: "Ertaga supertexnologiyaviy tadbir bo'ladi, borasanmi?",
    expectedKeywords: ["tadbir", "texnologiya", "bor", "qiziq"],
    rubric: "Murakkab yangi so'zdan qat'i nazar, kontekstga mos mantiqiy munosabat berilishi kerak.",
  },
];

class ReasoningBenchmark {
  /**
   * Model yoki Chatbotni mustaqil test to'plamida baholash
   * @param {Object} respondent - { generateReply: (text) => string | Promise<string> }
   * @returns {Promise<Object>}
   */
  static async runEvaluation(respondent) {
    const results = [];
    let passedCount = 0;

    for (const testCase of BENCHMARK_CASES) {
      const startTime = Date.now();
      let reply = "";
      try {
        if (typeof respondent.generateReply === "function") {
          reply = await respondent.generateReply(testCase.prompt);
        } else if (typeof respondent.process === "function") {
          const res = await respondent.process(testCase.prompt);
          reply = res.reply || "";
        } else {
          reply = String(respondent(testCase.prompt));
        }
      } catch (e) {
        reply = `XATOLIK: ${e.message}`;
      }
      const durationMs = Date.now() - startTime;

      const lowerReply = (reply || "").toLowerCase();
      const matchedKeywords = testCase.expectedKeywords.filter((kw) =>
        lowerReply.includes(kw.toLowerCase())
      );

      const isPass = matchedKeywords.length > 0;
      if (isPass) passedCount++;

      results.push({
        id: testCase.id,
        category: testCase.category,
        prompt: testCase.prompt,
        reply,
        expectedKeywords: testCase.expectedKeywords,
        matchedKeywords,
        rubric: testCase.rubric,
        passed: isPass,
        durationMs,
      });
    }

    const score = Number(((passedCount / BENCHMARK_CASES.length) * 100).toFixed(1));

    return {
      score,
      totalTests: BENCHMARK_CASES.length,
      passedCount,
      failedCount: BENCHMARK_CASES.length - passedCount,
      results,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Natijalarni chiroyli konsol jadvali ko'rinishida chiqarish
   */
  static printReport(evalReport) {
    console.log("=========================================================================");
    console.log("  MUSTAQIL REASONING & EVALUATION BENCHMARK NATIJALARI");
    console.log("=========================================================================");
    console.log(`- Jami testlar: ${evalReport.totalTests} ta`);
    console.log(`- Muvaffaqiyatli: ${evalReport.passedCount} ta (${evalReport.score}%)`);
    console.log(`- O'tolmagan: ${evalReport.failedCount} ta`);
    console.log("-------------------------------------------------------------------------");

    for (const r of evalReport.results) {
      const statusIcon = r.passed ? "✅ [O'TDI]" : "❌ [XATO]";
      console.log(`${statusIcon} [${r.category.toUpperCase()}]`);
      console.log(`   Savol:    "${r.prompt}"`);
      console.log(`   Javob:    "${r.reply.replace(/\n/g, " ").slice(0, 100)}..."`);
      if (r.matchedKeywords.length > 0) {
        console.log(`   Topildi:  [${r.matchedKeywords.join(", ")}]`);
      } else {
        console.log(`   Kutilgan: [${r.expectedKeywords.join(", ")}] | Rubrika: ${r.rubric}`);
      }
      console.log("");
    }
    console.log("=========================================================================\n");
  }
}

module.exports = {
  BENCHMARK_CASES,
  ReasoningBenchmark,
};

if (require.main === module) {
  const SmartChatbot = require("../src/chatbot");
  const Tokenizer = require("../src/tokenizer");
  const NeuralNetwork = require("../src/neuralNetwork");
  const TextAnalyzer = require("../src/analyzer");
  const WordEmbeddings = require("../src/embeddings");
  const MiniLLM = require("../src/generator");
  const DocumentRAGEngine = require("../src/rag");

  const vocab = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json")));
  const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
  const tok = new Tokenizer();
  tok.vocabulary = vocab.vocabulary;
  tok.categories = vocab.categories;
  const analyzer = new TextAnalyzer(nn, tok);
  const emb = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
  const gen = new MiniLLM(12, emb);
  const rag = new DocumentRAGEngine(emb);

  const bot = new SmartChatbot(analyzer, gen, emb, null, rag);

  ReasoningBenchmark.runEvaluation(bot).then((report) => {
    ReasoningBenchmark.printReport(report);
  });
}
