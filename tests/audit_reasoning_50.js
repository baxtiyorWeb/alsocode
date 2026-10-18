"use strict";

const fs = require("fs");
const path = require("path");
const SmartChatbot = require("../src/chatbot");
const Tokenizer = require("../src/tokenizer");
const NeuralNetwork = require("../src/neuralNetwork");
const TextAnalyzer = require("../src/analyzer");
const WordEmbeddings = require("../src/embeddings");
const MiniLLM = require("../src/generator");
const DocumentRAGEngine = require("../src/rag");

const REASONING_50_CASES = [
  // A. Oddiy til va umumiy bilim (8 test)
  {
    id: "A1",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Toshkent shahri qaysi davlatning poytaxti hisoblanadi?",
    expected: ["o'zbekiston", "ozbekiston"],
    rubric: "O'zbekiston nomi keltirilishi kerak."
  },
  {
    id: "A2",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Bir haftada necha kun bor?",
    expected: ["7", "yetti"],
    rubric: "7 yoki yetti soni bo'lishi kerak."
  },
  {
    id: "A3",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Suv qaynash harorati normal bosimda necha gradus?",
    expected: ["100", "yuz"],
    rubric: "100 gradus bo'lishi kerak."
  },
  {
    id: "A4",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Yilning eng issiq fasli qaysi?",
    expected: ["yoz"],
    rubric: "Yoz fasli ko'rsatilishi kerak."
  },
  {
    id: "A5",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Kuz faslidan keyin qaysi fasl keladi?",
    expected: ["qish"],
    rubric: "Qish fasli aytilishi kerak."
  },
  {
    id: "A6",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Non tayyorlash uchun asosiy masalliq nima?",
    expected: ["un", "bug'doy", "bugdoy"],
    rubric: "Un yoki bug'doy keltirilishi kerak."
  },
  {
    id: "A7",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Kitob o'qish inson ongiga qanday ta'sir qiladi?",
    expected: ["rivojlantiradi", "boyitadi", "bilim", "foyda"],
    rubric: "Ijobiy intellektual ta'sir bildirilishi kerak."
  },
  {
    id: "A8",
    cat: "oddiy_til_umumiy_bilim",
    prompt: "Samolyot qayerda harakatlanadi: yerda, suvda yoki havoda?",
    expected: ["havo", "havoda"],
    rubric: "Havo muhiti tanlanishi kerak."
  },

  // B. Sabab va oqibat (9 test)
  {
    id: "B1",
    cat: "sabab_va_oqibat",
    prompt: "Agar qozonga suv solib tagiga olov yoqilsa, bir ozdan keyin suv nima bo'ladi?",
    expected: ["qaynaydi", "isiydi", "bug'lanadi", "buglanadi"],
    rubric: "Suvning qaynashi yoki isishi ko'rsatilishi kerak."
  },
  {
    id: "B2",
    cat: "sabab_va_oqibat",
    prompt: "Ertalab uyg'onmasdan uxlab qolsang, maktab yoki ishga nima bo'lasan?",
    expected: ["kech", "kechikasan", "kechirasiz"],
    rubric: "Kechikish oqibati bo'lishi kerak."
  },
  {
    id: "B3",
    cat: "sabab_va_oqibat",
    prompt: "Daraxt barglari nega kuzda to'kiladi?",
    expected: ["sovuq", "qish", "xazon", "tayyorgarlik"],
    rubric: "Sovuq yoki xazon mavsumi sababi bo'lishi kerak."
  },
  {
    id: "B4",
    cat: "sabab_va_oqibat",
    prompt: "Muzlatgichdan chiqarilgan muz xonada tursa nega erib ketadi?",
    expected: ["harorat", "issiqlik", "iliq", "eriydi"],
    rubric: "Issiqlik sababli erishi tushuntirilishi kerak."
  },
  {
    id: "B5",
    cat: "sabab_va_oqibat",
    prompt: "Agar mashinaga benzin quyilmasa, u nima bo'ladi?",
    expected: ["to'xtaydi", "yurmaydi", "o'chadi", "yurmay"],
    rubric: "Mashina yurmasligi aytilishi kerak."
  },
  {
    id: "B6",
    cat: "sabab_va_oqibat",
    prompt: "Yomg'ir yoqqanda soyabonsiz ko'chaga chiqsang nima bo'ladi?",
    expected: ["ho'l", "ivib", "nam", "kasal"],
    rubric: "Ho'l bo'lish yoki ivish keltirilishi kerak."
  },
  {
    id: "B7",
    cat: "sabab_va_oqibat",
    prompt: "Kechasi yetarli uxlamagan odam ertalab o'zini qanday his qiladi?",
    expected: ["charchoq", "toliqqan", "uyqusiraydi", "holsiz"],
    rubric: "Charchoq yoki holsizlik ko'rsatilishi kerak."
  },
  {
    id: "B8",
    cat: "sabab_va_oqibat",
    prompt: "Qor erisa nima hosil bo'ladi?",
    expected: ["suv", "loy"],
    rubric: "Suv hosil bo'lishi ko'rsatilishi kerak."
  },
  {
    id: "B9",
    cat: "sabab_va_oqibat",
    prompt: "O'simlikka uzoq vaqt suv quyilmasa u nima bo'ladi?",
    expected: ["quriydi", "so'liydi", "soliydi", "nobud"],
    rubric: "Qurib qolishi aytilishi kerak."
  },

  // C. Deduktiv va munosabatli mantiq (9 test)
  {
    id: "C1",
    cat: "deduktiv_va_munosabatli",
    prompt: "Ali Validan baland. Vali Sardordan baland. Ularning eng pasti kim?",
    expected: ["sardor"],
    rubric: "Sardor eng pasti bo'lishi kerak."
  },
  {
    id: "C2",
    cat: "deduktiv_va_munosabatli",
    prompt: "Akmal Boburdan katta, Bobur Jamshiddan katta. Eng kichigi kim?",
    expected: ["jamshid"],
    rubric: "Jamshid eng kichigi ekani topilishi kerak."
  },
  {
    id: "C3",
    cat: "deduktiv_va_munosabatli",
    prompt: "Qizil qalam yashil qalamdan uzun, lekin ko'k qalamdan kalta. Eng uzun qalam qaysi?",
    expected: ["ko'k", "kok"],
    rubric: "Ko'k qalam eng uzun bo'lishi kerak."
  },
  {
    id: "C4",
    cat: "deduktiv_va_munosabatli",
    prompt: "Barcha qushlarning qanoti bor. Qaldirg'och — qush. Qaldirg'ochning qanoti bormi?",
    expected: ["ha", "bor", "albatta"],
    rubric: "Ha yoki bor deb tasdiqlanishi kerak."
  },
  {
    id: "C5",
    cat: "deduktiv_va_munosabatli",
    prompt: "Agar barcha olmalar meva bo'lsa va anor ham meva bo'lsa, anor olma hisoblanadimi?",
    expected: ["yo'q", "emas", "yoq"],
    rubric: "Yo'q yoki emas deb inkor etilishi kerak."
  },
  {
    id: "C6",
    cat: "deduktiv_va_munosabatli",
    prompt: "Dilnoza Malikaning singlisi. Malika esa Ziyodaning opasi. Dilnoza Ziyodaga kim bo'ladi?",
    expected: ["opa", "singil", "qarindosh"],
    rubric: "Opa yoki singil ekani ko'rsatilishi kerak."
  },
  {
    id: "C7",
    cat: "deduktiv_va_munosabatli",
    prompt: "Uy ichida stol bor, stol ustida quti, quti ichida kalit bor. Kalit qayerda?",
    expected: ["quti", "qutida"],
    rubric: "Quti ichida ekani topilishi kerak."
  },
  {
    id: "C8",
    cat: "deduktiv_va_munosabatli",
    prompt: "Agar A B dan tezroq yugursa, B esa C dan tezroq yugursa, marraga birinchi kim keladi?",
    expected: ["a"],
    rubric: "A harfi birinchi bo'lishi kerak."
  },
  {
    id: "C9",
    cat: "deduktiv_va_munosabatli",
    prompt: "Temir suvdan og'ir va suvga cho'kadi. Yog'och esa suv yuzida suzadi. Qaysi biri suvdan yengil?",
    expected: ["yog'och", "yogoch"],
    rubric: "Yog'och suvdan yengil ekani topilishi kerak."
  },

  // D. Matematika va algoritmik fikrlash (8 test)
  {
    id: "D1",
    cat: "matematika_algoritmik",
    prompt: "5 qo'shuv 3 necha bo'ladi?",
    expected: ["8", "sakkiz"],
    rubric: "8 soni bo'lishi kerak."
  },
  {
    id: "D2",
    cat: "matematika_algoritmik",
    prompt: "12 ko'paytiruv 4 nechiga teng?",
    expected: ["48", "qirq sakkiz"],
    rubric: "48 soni bo'lishi kerak."
  },
  {
    id: "D3",
    cat: "matematika_algoritmik",
    prompt: "Savatda 10 ta olma bor edi. 4 tasini yedim. Nechta olma qoldi?",
    expected: ["6", "olti"],
    rubric: "6 soni bo'lishi kerak."
  },
  {
    id: "D4",
    cat: "matematika_algoritmik",
    prompt: "Sonlar ketma-ketligini davom ettir: 2, 4, 6, 8, ... Keyingi son nima?",
    expected: ["10", "o'n", "on"],
    rubric: "10 soni bo'lishi kerak."
  },
  {
    id: "D5",
    cat: "matematika_algoritmik",
    prompt: "Ketma-ketlikdagi keyingi toq sonni top: 1, 3, 5, 7, ...?",
    expected: ["9", "to'qqiz", "toqqiz"],
    rubric: "9 soni bo'lishi kerak."
  },
  {
    id: "D6",
    cat: "matematika_algoritmik",
    prompt: "15 ni 3 ga bo'lsak necha chiqadi?",
    expected: ["5", "besh"],
    rubric: "5 soni bo'lishi kerak."
  },
  {
    id: "D7",
    cat: "matematika_algoritmik",
    prompt: "Bir dona daftar 2000 so'm bo'lsa, 3 ta daftar necha so'm bo'ladi?",
    expected: ["6000", "6 000", "olti ming"],
    rubric: "6000 so'm bo'lishi kerak."
  },
  {
    id: "D8",
    cat: "matematika_algoritmik",
    prompt: "100 dan 35 ni ayirsak necha qoladi?",
    expected: ["65", "oltmish besh"],
    rubric: "65 soni bo'lishi kerak."
  },

  // E. Ko'p bosqichli savol-javob (8 test)
  {
    id: "E1",
    cat: "kop_bosqichli",
    prompt: "Farhod do'konga bordi, 10 000 so'mga non va 15 000 so'mga sut oldi. Kassaga 50 000 so'm berdi. Unga qancha qaytim qaytarishadi?",
    expected: ["25 000", "25000", "yigirma besh ming"],
    rubric: "25 000 so'm qaytim bo'lishi kerak."
  },
  {
    id: "E2",
    cat: "kop_bosqichli",
    prompt: "Birinchi kuni 5 sahifa, ikkinchi kuni birinchi kundan 3 sahifa ko'p kitob o'qidim. Ikki kunda jami necha sahifa o'qidim?",
    expected: ["13", "o'n uch", "on uch"],
    rubric: "Jami 13 sahifa bo'lishi kerak."
  },
  {
    id: "E3",
    cat: "kop_bosqichli",
    prompt: "Xonada 3 ta stul bor, har bir stulning 4 ta oyog'i bor. Xonadagi stullarning jami oyoqlari nechta?",
    expected: ["12", "o'n ikki", "on ikki"],
    rubric: "12 soni bo'lishi kerak."
  },
  {
    id: "E4",
    cat: "kop_bosqichli",
    prompt: "Avtobusda 15 kishi bor edi. Birinchi bekatda 5 kishi tushdi va 2 kishi chiqdi. Avtobusda nechta odam qoldi?",
    expected: ["12", "o'n ikki", "on ikki"],
    rubric: "12 soni bo'lishi kerak."
  },
  {
    id: "E5",
    cat: "kop_bosqichli",
    prompt: "Agar soat 14:00 bo'lsa, 3 soatdan keyin soat necha bo'ladi?",
    expected: ["17", "17:00", "5:00", "besh"],
    rubric: "17:00 yoki 5 bo'lishi kerak."
  },
  {
    id: "E6",
    cat: "kop_bosqichli",
    prompt: "Kutubxonada 4 ta javon bor, har javonda 10 tadan kitob bor. Agar 5 ta kitob olinsa, nechta kitob qoladi?",
    expected: ["35", "o'ttiz besh", "ottiz besh"],
    rubric: "35 soni bo'lishi kerak."
  },
  {
    id: "E7",
    cat: "kop_bosqichli",
    prompt: "Doston dushanba kuni 2 km, seshanba kuni esa dushanbaga qaraganda 2 marta ko'p yugurdi. Ikki kunda jami necha km yugurdi?",
    expected: ["6", "olti"],
    rubric: "6 km bo'lishi kerak."
  },
  {
    id: "E8",
    cat: "kop_bosqichli",
    prompt: "Hovuzda 8 ta baliq bor edi, ulardan 2 tasi cho'kib ketdi. Hovuzda nechta baliq qoldi?",
    expected: ["8", "sakkiz", "cho'kmaydi", "chokmaydi"],
    rubric: "Baliq cho'kmasligi yoki 8 ta qolishi kerak."
  },

  // F. Xatolarni aniqlash va tuzatish (8 test)
  {
    id: "F1",
    cat: "xatolarni_aniqlash",
    prompt: "Birov aytdi: 2 qo'shuv 2 teng 5. Bu to'g'rimi yoki xatomi?",
    expected: ["xato", "noto'g'ri", "notogri", "4"],
    rubric: "Xato yoki 4 ekani aytilishi kerak."
  },
  {
    id: "F2",
    cat: "xatolarni_aniqlash",
    prompt: "Quyosh g'arbdan chiqib sharqqa botadi degan fikr to'g'rimi?",
    expected: ["noto'g'ri", "notogri", "xato", "emas", "sharqdan"],
    rubric: "Noto'g'ri ekani yoki sharqdan chiqishi aytilishi kerak."
  },
  {
    id: "F3",
    cat: "xatolarni_aniqlash",
    prompt: "Savol: Fil chumolidan ancha kichkina. Bu jumlada qanday xatolik bor?",
    expected: ["katta", "xato", "noto'g'ri", "notogri"],
    rubric: "Fil katta ekani yoki jumla xatoligi aytilishi kerak."
  },
  {
    id: "F4",
    cat: "xatolarni_aniqlash",
    prompt: "Qishda havo juda issiq bo'ladi va hamma muzqaymoq yeydi. Ushbu fikrdagi xatoni ko'rsat.",
    expected: ["sovuq", "xato", "yozda"],
    rubric: "Qishda sovuq bo'lishi ko'rsatilishi kerak."
  },
  {
    id: "F5",
    cat: "xatolarni_aniqlash",
    prompt: "1 kg temir 1 kg paxtadan og'irroq degan gap to'g'rimi?",
    expected: ["yo'q", "yoq", "teng", "bir xil", "emas"],
    rubric: "Vazni teng ekani yoki gap noto'g'ri ekani ko'rsatilishi kerak."
  },
  {
    id: "F6",
    cat: "xatolarni_aniqlash",
    prompt: "O'zbekiston okean sohilida joylashgan degan gap to'g'rimi?",
    expected: ["yo'q", "yoq", "noto'g'ri", "notogri", "emas", "quruqlik"],
    rubric: "Yo'q yoki noto'g'ri deb inkor etilishi kerak."
  },
  {
    id: "F7",
    cat: "xatolarni_aniqlash",
    prompt: "Haftada 8 kun bor deb aytish to'g'rimi?",
    expected: ["yo'q", "yoq", "xato", "7", "yetti"],
    rubric: "Xato yoki 7 kun ekani aytilishi kerak."
  },
  {
    id: "F8",
    cat: "xatolarni_aniqlash",
    prompt: "Toshkent Fransiyaning poytaxti degan da'vo to'g'rimi?",
    expected: ["yo'q", "yoq", "noto'g'ri", "notogri", "emas", "parij"],
    rubric: "Yo'q yoki Parij deb to'g'rilanishi kerak."
  }
];

async function run50Benchmark() {
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

  const stats = {
    total: REASONING_50_CASES.length,
    correct: 0,
    incorrect: 0,
    unknown: 0,
    toolUsedCount: 0,
    memoryUsedCount: 0,
    ragUsedCount: 0,
    byCategory: {}
  };

  const detailedResults = [];

  for (const t of REASONING_50_CASES) {
    if (!stats.byCategory[t.cat]) {
      stats.byCategory[t.cat] = { total: 0, correct: 0, incorrect: 0, unknown: 0 };
    }
    stats.byCategory[t.cat].total++;

    const startTime = Date.now();
    const res = await bot.process(t.prompt);
    const duration = Date.now() - startTime;
    const reply = (res.reply || "").trim();
    const replyLower = reply.toLowerCase();

    const isUnknown = replyLower.includes("menga bilim o'rgatilmagan") ||
                      replyLower.includes("menda bilim yo'q") ||
                      replyLower.includes("hali to'liq o'rganmaganman") ||
                      replyLower.includes("tushunmadim");

    let isCorrect = false;
    for (const exp of t.expected) {
      if (replyLower.includes(exp.toLowerCase())) {
        isCorrect = true;
        break;
      }
    }

    if (res.toolUsed === "AssociativeMemory") stats.memoryUsedCount++;
    if (res.toolUsed === "DocumentRAGEngine") stats.ragUsedCount++;
    if (res.toolUsed && res.toolUsed !== "LocalKnowledgeEngine") stats.toolUsedCount++;

    if (isCorrect) {
      stats.correct++;
      stats.byCategory[t.cat].correct++;
    } else if (isUnknown) {
      stats.unknown++;
      stats.byCategory[t.cat].unknown++;
    } else {
      stats.incorrect++;
      stats.byCategory[t.cat].incorrect++;
    }

    detailedResults.push({
      id: t.id,
      category: t.cat,
      prompt: t.prompt,
      reply,
      isCorrect,
      isUnknown,
      toolUsed: res.toolUsed,
      intent: res.intent,
      durationMs: duration
    });
  }

  return { stats, detailedResults };
}

if (require.main === module) {
  run50Benchmark().then(({ stats, detailedResults }) => {
    console.log("=========================================================================");
    console.log("  50 TA YANGI MANTIQIY VA REASONING TEST NATIJALARI");
    console.log("=========================================================================");
    console.log(`Jami testlar: ${stats.total} ta`);
    console.log(`To'g'ri javoblar: ${stats.correct} ta (${((stats.correct / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Noto'g'ri javoblar: ${stats.incorrect} ta (${((stats.incorrect / stats.total) * 100).toFixed(1)}%)`);
    console.log(`"Bilmayman" (Halol rad javobi): ${stats.unknown} ta (${((stats.unknown / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Tool ishlatilgan holatlar: ${stats.toolUsedCount} ta`);
    console.log(`Xotira / RAG ishlatilgan: Memory=${stats.memoryUsedCount}, RAG=${stats.ragUsedCount}`);
    console.log("\nKATEGORIYALAR KESIMIDA:");
    for (const [cat, data] of Object.entries(stats.byCategory)) {
      const acc = ((data.correct / data.total) * 100).toFixed(1);
      console.log(`- ${cat}: Jami=${data.total}, To'g'ri=${data.correct} (${acc}%), Noto'g'ri=${data.incorrect}, Bilmayman=${data.unknown}`);
    }
    console.log("=========================================================================\n");

    // Write full json results for audit report
    fs.writeFileSync(
      path.join(__dirname, "reasoning_50_results.json"),
      JSON.stringify({ stats, detailedResults }, null, 2),
      "utf8"
    );
  });
}

module.exports = { REASONING_50_CASES, run50Benchmark };
