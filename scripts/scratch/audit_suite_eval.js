"use strict";

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

const vocabData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocab.json"), "utf-8"));
const nn = NeuralNetwork.loadModel(path.join(__dirname, "..", "data", "model.json"));
const tokenizer = new Tokenizer();
tokenizer.vocabulary = vocabData.vocabulary;
tokenizer.categories = vocabData.categories;
const analyzer = new TextAnalyzer(nn, tokenizer);
const embeddings = WordEmbeddings.load(path.join(__dirname, "..", "data", "embeddings.json"));
const miniLLM = new MiniLLM(12, embeddings);
const memory = new CognitiveMemory(path.join(__dirname, "..", "data", "memory.json"));
const rag = new DocumentRAGEngine(embeddings, path.join(__dirname, "..", "data", "documents.json"));

const chatbot = new SmartChatbot(analyzer, miniLLM, embeddings, memory, rag);

const TEST_CASES = [
  // A. Bilim
  {
    group: "A. Bilim",
    id: "B1",
    prompt: "Fotosintez nima?",
    expected: ["o'simlik", "quyosh", "kislorod", "organik", "xlorofill"],
    rubric: "O'simliklarning quyosh nuri orqali oziqlanishi va kislorod ishlab chiqarishi tushuntirilishi kerak."
  },
  {
    group: "A. Bilim",
    id: "B2",
    prompt: "Demokratiya nima?",
    expected: ["xalq", "hokimiyat", "saylov", "boshqaruv", "erkinlik"],
    rubric: "Xalq hokimiyati va teng huquqlilik tamoyili ifodalanishi kerak."
  },
  {
    group: "A. Bilim",
    id: "B3",
    prompt: "Suv nega qaynaydi?",
    expected: ["harorat", "bug'", "issiqlik", "bosim", "100"],
    rubric: "Issiqlik ta'sirida bug'lanish bosimi tashqi bosimga tenglashishi yoki harorat oshishi tushuntirilishi kerak."
  },

  // B. Mantiq
  {
    group: "B. Mantiq",
    id: "M1",
    prompt: "Barcha A lar B. X — A. Bundan qanday xulosa chiqadi?",
    expected: ["x — b", "x b", "x ham b"],
    rubric: "X ham B ekanligi haqida qat'iy deduktiv xulosa chiqarilishi kerak."
  },
  {
    group: "B. Mantiq",
    id: "M2",
    prompt: "5 ta kitobning har biri 10 000 so‘m. Jami qancha?",
    expected: ["50 000", "50000", "ellik ming"],
    rubric: "5 * 10 000 = 50 000 so'm to'g'ri hisoblanishi kerak."
  },
  {
    group: "B. Mantiq",
    id: "M3",
    prompt: "Ketma-ketlik: 2, 4, 8, 16. Keyingi son nima va nima uchun?",
    expected: ["32", "ikki barobar", "2 ga ko'payt"],
    rubric: "Keyingi son 32 ekanligi va har safar 2 ga ko'payib borayotgani ko'rsatilishi kerak."
  },

  // C. Til (Sinonimlar, imlo, apostrof)
  {
    group: "C. Til",
    id: "T1",
    prompt: "O'zbekistonning poytaxti qayer?",
    expected: ["toshkent"],
    rubric: "Toshkent shahri javob sifatida berilishi kerak."
  },
  {
    group: "C. Til",
    id: "T2",
    prompt: "Oʻzbekistonning bosh shahri qaysi?",
    expected: ["toshkent"],
    rubric: "Oʻ (o'zbekcha apostrof) va 'bosh shahri' (sinonim) tushunilib, Toshkent aytilishi kerak."
  },
  {
    group: "C. Til",
    id: "T3",
    prompt: "ozbekiston poytaxti",
    expected: ["toshkent"],
    rubric: "Apostrofsiz va qisqa so'rov to'g'ri anglanishi kerak."
  },

  // D. Kontekst (Ko'p bosqichli dialog)
  {
    group: "D. Kontekst",
    id: "K1",
    prompt: "Quyosh energiyasini tushuntir.",
    expected: ["quyosh", "energiya", "panel", "tabiiy"],
    rubric: "Quyosh nuri orqali olinadigan ekologik energiya haqida ma'lumot berilishi kerak."
  },
  {
    group: "D. Kontekst",
    id: "K2",
    prompt: "Endi uning afzalliklarini ayt.",
    expected: ["arzon", "cheksiz", "toza", "zararsiz", "tejamkor"],
    rubric: "Oldingi mavzu (quyosh energiyasi) afzalliklari kontekstda davom ettirilishi kerak."
  },
  {
    group: "D. Kontekst",
    id: "K3",
    prompt: "Buni ikki jumlada qisqartir.",
    expected: ["energiya", "quyosh"],
    rubric: "Oldingi mavzu qisqa shaklda jamlanishi kerak."
  },

  // E. Ishonchlilik (Halollik, noaniqlik, noto'g'ri taxmin)
  {
    group: "E. Ishonchlilik",
    id: "I1",
    prompt: "Marsda 2024 yilda qurilgan shahar nomi nima?",
    expected: ["qurilmagan", "yo'q", "mavjud emas", "marsda shahar yo'q"],
    rubric: "Noto'g'ri taxmin fosh qilinishi, Marsda hali shahar qurilmagani halol bildirilishi kerak."
  },
  {
    group: "E. Ishonchlilik",
    id: "I2",
    prompt: "U qachon keladi?",
    expected: ["kim", "qaysi", "aniq", "tushunmadim"],
    rubric: "Noaniq olmosh yuzasidan aniqlashtirish so'ralishi kerak."
  },
  {
    group: "E. Ishonchlilik",
    id: "I3",
    prompt: "Qora tuynukning ichidagi harorat necha daraja ekanligini laboratoriyada o'lchagan olim kim?",
    expected: ["o'lchanmagan", "mumkin emas", "olim yo'q", "noma'lum"],
    rubric: "Qora tuynuk ichiga kirib harorat o'lchash imkonsizligi halol aytilishi kerak."
  }
];

async function runAudit() {
  const results = [];
  console.log("=========================================================================");
  console.log("  NEURAL STUDIO - PHASE 2 SMOKE & GENERALIZATION AUDIT EVALUATION");
  console.log("=========================================================================\n");

  for (const tc of TEST_CASES) {
    const tStart = Date.now();
    let res = null;
    let reply = "";
    try {
      res = await chatbot.process(tc.prompt);
      reply = res.reply || "";
    } catch (e) {
      reply = `XATOLIK: ${e.message}`;
      res = { intent: "error", toolUsed: null, reasoning: {} };
    }
    const durationMs = Date.now() - tStart;
    const lowerReply = reply.toLowerCase();

    const matched = tc.expected.filter(kw => lowerReply.includes(kw.toLowerCase()));
    const isPass = matched.length > 0;

    // Check for irrelevant memory or database hallucination
    const isIrrelevantDumping = reply.startsWith("O'rganilgan bilimlarimga ko'ra:") && matched.length === 0;

    results.push({
      group: tc.group,
      id: tc.id,
      prompt: tc.prompt,
      reply,
      intent: res.intent,
      confidence: res.confidence,
      toolUsed: res.toolUsed,
      reasoning: res.reasoning,
      expected: tc.expected,
      matched,
      passed: isPass,
      isIrrelevantDumping,
      durationMs,
      rubric: tc.rubric
    });

    const status = isPass ? "✅ [O'TDI]" : "❌ [XATO]";
    console.log(`${status} [${tc.id}] (${tc.group})`);
    console.log(`   Savol:    "${tc.prompt}"`);
    console.log(`   Javob:    "${reply.replace(/\n/g, ' ').slice(0, 120)}..."`);
    console.log(`   Intent:   ${res.intent} | Tool: ${res.toolUsed || 'None'} | Vaqt: ${durationMs} ms`);
    if (isPass) {
      console.log(`   Topildi:  [${matched.join(', ')}]`);
    } else {
      console.log(`   Kutilgan: [${tc.expected.join(', ')}]`);
      console.log(`   Rubrika:  ${tc.rubric}`);
      if (isIrrelevantDumping) {
        console.log(`   ⚠️ Xato sababi: Aloqasiz tayyor jumla (Lexical mismatch dumping)!`);
      }
    }
    console.log("");
  }

  const passedCount = results.filter(r => r.passed).length;
  const score = (passedCount / results.length) * 100;

  console.log("=========================================================================");
  console.log(`  YAKUNIY NATIJA: ${passedCount} / ${results.length} ta o'tdi (${score.toFixed(1)}%)`);
  console.log("=========================================================================\n");

  fs.writeFileSync(
    path.join(__dirname, "smoke_audit_results.json"),
    JSON.stringify({ score, passedCount, total: results.length, results }, null, 2),
    "utf-8"
  );
}

runAudit();
