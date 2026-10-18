
"use strict";

/**
 * ================================================================
 * O'ZBEKCHA AI KNOWLEDGE AUTO-TRAIN PIPELINE
 * ================================================================
 * - Eski va yangi suhbat kategoriyalari.
 * - AI xatoligida gateway boshqa modelga darhol o'tadi.
 * - Model cooldown ishlatilmaydi.
 * - Dublikat jumlalar normallashtirib tekshiriladi.
 * - Yangi jumlalar Neon PostgreSQL bazasiga yoziladi.
 * - Lokal data/knowledge.json yangilanadi.
 * - Yakunda trainKnowledgeBase() ishga tushadi.
 * - Cheksiz urinishlar va noto'g'ri AI javoblaridan himoya.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");

const aiGateway = require("../src/aiGateway");
const dbService = require("../src/db");
const trainKnowledgeBase = require("./legacy_mlp/train");

// ================================================================
// SOZLAMALAR
// ================================================================

const DEFAULT_COUNT = 25;
const BATCH_SIZE = 5;
const MAX_FAILED_ATTEMPTS = 12;
const RETRY_DELAY_MS = 0;

const MIN_WORDS = 4;
const MAX_WORDS = 20;
const MIN_TEXT_LENGTH = 6;

const LOCAL_KNOWLEDGE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "knowledge.json"
);

// ================================================================
// KATEGORIYALAR
// Format: [category, theme]
// Barcha kategoriyalar uchun count avtomatik beriladi.
// ================================================================

const CATEGORY_ROWS = [
  // --------------------------------------------------------------
  // ASOSIY SUHBAT VA HIS-TUYG'ULAR
  // --------------------------------------------------------------

  ["hol_ahvol", "Kundalik hol-ahvol, kayfiyat, charchoq, uyqu va ishlar."],
  ["hazil_kayfiyat", "O'zbekona yengil hazillar, kundalik kulgili vaziyatlar va samimiy suhbat."],
  ["samimiy_dalda", "Hamdardlik, insonni tushunish va qiyin kunlarda dalda berish."],
  ["qiziqishlar_hayot", "Kitoblar, musiqa, kino, tabiat, sayohat va do'stlik."],
  ["yaxshi_kayfiyat", "Quvonch, xursandchilik, mamnunlik va ijobiy hislar."],
  ["yomon_kayfiyat", "Hafsalasizlik, charchoq va kayfiyat tushishi."],
  ["xafa_bolish", "Ranjish, ko'ngil qolishi va xafa bo'lishni ifodalash."],
  ["jahldorlik", "Jahl, asabiylashish va norozilikni haqoratsiz ifodalash."],
  ["xavotir", "Kelajak, muammolar va noaniqliklar haqida xavotir."],
  ["bilmaslik", "Biror narsani bilmaslik va aniqlik so'rash."],
  ["kinoya", "Kontekstga bog'liq kinoya va yashirin ma'noli gaplar."],
  ["yengil_tanqid", "Odatlar, xatolar va vaziyatlar haqida odobli tanqid."],
  ["shikoyat", "Muammo, noqulaylik va xizmatdan norozilik."],
  ["fikr_bildirish", "Shaxsiy fikr, sabab va boshqacha qarashga munosabat."],
  ["hamdardlik", "Boshqa odamning hislarini tushunish va tinglash."],
  ["motivatsiya", "Maqsad, harakat, muvaffaqiyatsizlikdan saboq olish."],
  ["do_stlik", "Do'stlik, ishonch, sadoqat va o'zaro yordam."],
  ["kelishmovchilik", "Fikrlar to'qnashuvi, murosa va janjalsiz tushuntirish."],
  ["shaxsiy_chegaralar", "Shaxsiy chegaralar va noqulay mavzularni bildirish."],
  ["iltimos_va_rad", "Iltimos, taklif, muloyim rad va rad javobini tushunish."],

  // --------------------------------------------------------------
  // KUNDALIK HAYOT
  // --------------------------------------------------------------

  ["uy_va_mahalla", "Uy, hovli, kvartira, qo'shnilar va mahalla hayoti."],
  ["ta_lim", "Maktab, universitet, darslar, imtihonlar va mustaqil o'rganish."],
  ["ingliz_tili", "Til o'rganish, yangi so'zlar va oddiy suhbatlar."],
  ["ish_va_kasb", "Kasb, ish kuni, hamkasblar va mas'uliyat."],
  ["masofaviy_ish", "Uydan ishlash, masofaviy jamoa va vaqtni boshqarish."],
  ["tadbirkorlik", "Biznes g'oyalar, mijozlar, xizmatlar va savdo."],
  ["texnologiya", "Telefon, kompyuter, internet va texnologiya."],
  ["dasturlash", "Kod yozish, xatolarni tuzatish, API va dastur yaratish."],
  ["suniy_intellekt", "Sun'iy intellekt imkoniyatlari, cheklovlari va foydalanish."],
  ["tabiat", "Tabiat, gullar, daraxtlar va hayvonlar."],
  ["tog_lar", "Tog'lar, sayohat, balandlik va tog' manzaralari."],
  ["ob_havo", "Yomg'ir, qor, issiq, sovuq va shamol."],
  ["sayohat", "Yangi joylar, dam olish va safar rejalari."],
  ["milliy_taomlar", "O'zbek taomlari, ta'm va ovqat tanlash."],
  ["xarid_qilish", "Bozor, do'kon, narxlar va mahsulot tanlash."],
  ["musiqa_va_kino", "Musiqa, filmlar, seriallar va shaxsiy did."],

  // --------------------------------------------------------------
  // INKOR VA SALBIY MUNOSABAT
  // --------------------------------------------------------------

  ["oddiy_inkor", "Yo'q, emas, bormayman va bilmayman kabi inkorlar."],
  ["kuchaytirilgan_inkor", "Aslo, mutlaqo, hech qachon va umuman kabi kuchli inkorlar."],
  ["ikki_marta_inkor", "Ikki inkor qatnashgan gaplar va kontekstga bog'liq ma'no."],
  ["yoqtirmaslik", "Narsa, joy yoki faoliyatni yoqtirmaslik."],
  ["afzallik_va_did", "Shaxsiy did, afzallik va tanlovlar."],
  ["taqqoslashdagi_inkor", "Variantlarni taqqoslash, ikkalasini rad etish yoki birini tanlamaslik."],
  ["yumshatilgan_rad_etish", "Bilvosita rad, unchalik xohlamaslik va boshqa safarga qoldirish."],
  ["taqiq_va_cheklov", "Qilma, borma, tegma, mumkin emas va kerak emas."],
  ["shartli_inkor", "Muayyan sharoitda biror narsani rad etish."],
  ["qisman_rozilik", "Fikrning bir qismini qabul qilish, boshqa qismiga qarshi chiqish."],
  ["qarama_qarshi_fikr", "Bir gapda turli narsalarga ijobiy va salbiy munosabat."],
  ["bir_biriga_zid_bolmagan_fikrlar", "Joyni chiroyli deb bilish, ammo borishni istamaslik kabi fikrlar."],

  // --------------------------------------------------------------
  // KONTEKST VA MA'NO
  // --------------------------------------------------------------

  ["kontekstga_bogliq_manolar", "Bir jumlaning vaziyatga qarab turli ma'nolarda ishlatilishi."],
  ["ikki_manoli_gaplar", "Ikki xil talqin qilinishi mumkin bo'lgan jumlalar."],
  ["olmosh_va_referent", "Bu, shu, u, o'sha va shuni kabi olmoshlarning referenti."],
  ["kontekstni_saqlash", "Oldingi va hozirgi xabar orasidagi aloqani saqlash."],
  ["mavzularni_aralashtirmaslik", "Turli mavzularni ajratish va asossiz umumlashtirmaslik."],
  ["fikrning_ozgarishi", "Foydalanuvchining vaqt o'tishi bilan fikrini o'zgartirishi."],
  ["oz_fikrini_tuzatish", "Adashdim, boshqacha aytmoqchi edim kabi tuzatishlar."],
  ["oldingi_gapni_rad_etish", "Oldingi bayonotni rad etish va noto'g'ri taxminni tuzatish."],
  ["mavzuni_ozgartirish", "Suhbatni yangi mavzuga o'tkazish."],
  ["qayta_izohlash", "Oldingi fikrni boshqa so'zlar bilan tushuntirish."],

  // --------------------------------------------------------------
  // VAQT VA NIYAT
  // --------------------------------------------------------------

  ["otgan_va_hozirgi_holat", "Oldingi va hozirgi holat yoki afzallik o'rtasidagi farq."],
  ["reja_va_amalga_oshgan_ish", "Reja, istak, niyat va bajarilgan ishni farqlash."],
  ["odat_va_bir_martalik_holat", "Doimiy odat va bir martalik voqea farqi."],
  ["harakatni_tugatish", "Boshlangan, davom etayotgan va tugagan ishlarni farqlash."],
  ["kutish_va_bashorat", "Kelajak taxmini va sodir bo'lgan faktni farqlash."],
  ["shartli_preferensiya", "Biror narsani faqat ma'lum sharoitda qabul qilish."],

  // --------------------------------------------------------------
  // NUTQ MAQSADI VA ANIQLIK
  // --------------------------------------------------------------

  ["savol_va_darak_gap", "Savol, xabar, buyruq, iltimos va fikr farqi."],
  ["ritorik_savollar", "Javob talab qilmaydigan ritorik savollar."],
  ["yashirin_iltimos", "Bilvosita va muloyim iltimoslarni tushunish."],
  ["fikr_yoki_fakt", "Shaxsiy fikr, tekshiriladigan fakt va taxmin farqi."],
  ["ehtimol_va_taxmin", "Balki, ehtimol, chamasi va shekilli kabi noaniqliklar."],
  ["aniq_bilmaslik", "Bilmayman va ishonchim komil emas kabi iboralar."],
  ["yetishmayotgan_ma_lumot", "Javob uchun zarur tafsilot yetishmaganda aniqlashtirish."],
  ["suhbatdosh_niyatini_taxmin_qilmaslik", "Yetarli dalilsiz foydalanuvchi niyatini taxmin qilmaslik."],

  // --------------------------------------------------------------
  // TIL VA YOZUV
  // --------------------------------------------------------------

  ["imlo_xatoli_xabarlar", "Imlo xatolari, tushib qolgan harflar va chat qisqartmalari."],
  ["ogzaki_ozbek_tili", "Og'zaki o'zbek tili, sheva va kundalik iboralar."],
  ["aralash_tillar", "O'zbekcha matndagi ruscha, inglizcha va IT atamalari."],
  ["so_z_oyinlari", "So'z o'yinlari va ko'chma ma'nolar."],
  ["noto_g_ri_tushunish", "Tushunmovchilikni aniqlash va noto'g'ri talqinni tuzatish."],

  // --------------------------------------------------------------
  // JAVOB VA TAVSIYALAR
  // --------------------------------------------------------------

  ["muqobil_takliflar", "Rad etilgan variant o'rniga muqobil taklif berish."],
  ["afzalliklar_tartibi", "Variantlar orasidagi yoqtirish darajalarini saqlash."],
  ["taklifni_qabul_qilish", "Rozilik, shartli rozilik, ikkilanish va rad farqi."],
  ["umumlashtirish_xatosi", "Bitta holatdan barcha o'xshash holatlar haqida xulosa qilmaslik."],
  ["hissiyot_va_fakt_farqi", "Shaxsiy afzallik va vaziyat haqidagi faktni farqlash."],
  ["javobni_kontekstga_moslash", "Javobni foydalanuvchining haqiqiy fikri va savoliga moslash."],

  // ==============================================================
  // YANGI KATEGORIYALAR: SUHBATNI DAVOM ETTIRISH
  // ==============================================================

  ["suhbatni_davom_ettirish", "Oldingi gapga mos javob berish va suhbatni tabiiy davom ettirish."],
  ["suhbatni_boshlash", "Salomlashish, hol-ahvol so'rash va suhbat boshlash."],
  ["qisqa_javoblarni_tushunish", "Ha, yo'q, mayli, xo'p va tushunarli kabi qisqa javoblar."],
  ["suhbatdagi_aloqa", "Savolga javob berish va oldingi fikr bilan aloqani saqlash."],
  ["aniqlashtiruvchi_savollar", "Noaniq so'rov uchun eng kerakli aniqlashtiruvchi savolni berish."],
  ["tabiiy_javob_uslubi", "Robotga o'xshamaydigan, sodda va ravon o'zbekcha javoblar."],
  ["javob_uzunligini_moslash", "Savolga mos ravishda qisqa yoki batafsil javob berish."],
  ["minnatdorchilikka_javob", "Rahmat va minnatdorchilikka tabiiy javob qaytarish."],
  ["uzr_va_kechirim", "Uzr so'rash, xatoni tan olish va kechirimni qabul qilish."],
  ["salomlashuvga_javob", "Salomlashuvga vaziyatga mos javob qaytarish."],
  ["xayrlashuv", "Xayrlashish va suhbatni tabiiy yakunlash."],
  ["qayta_sorash", "Qayta tushuntirish yoki takrorlashni so'rash."],
  ["suhbatdagi_aniq_ism", "Odam, joy va obyektlarni farqlash, asossiz bog'lamaslik."],
  ["foydalanuvchi_afzalliklari", "Foydalanuvchi aytgan did va tanlovlarni hisobga olish."],
  ["fikrni_eslab_qolish", "Suhbatda aytilgan tegishli fikrlarni keyingi xabarlarda ishlatish."],
  ["mantiqiy_izchillik", "Javoblarda mantiqiy moslikni saqlash."],
  ["savolga_bevosita_javob", "Savolning asosiy maqsadiga to'g'ridan-to'g'ri javob berish."],
  ["foydalanuvchi_tuzatishini_qabul_qilish", "Tuzatishni tekshirish va kerak bo'lsa javobni yangilash."],
  ["bir_nechta_savol", "Bitta xabardagi bir nechta savolning har biriga javob berish."],
  ["ketma_ket_korsatmalar", "Ko'p bosqichli topshiriqlardagi tartib va shartlarni saqlash."],
  ["suhbatdagi_vaqt", "Kecha, bugun, ertaga, keyin va hozirni kontekstda tushunish."],
  ["noaniq_rozilik", "Mayli, ko'ramiz va o'ylab ko'raman kabi noaniq rozilik."],
  ["hissiy_ohang", "Hayrat, quvonch, ikkilanish va norozilik ohangini tushunish."],
  ["hazilni_tushunish", "Hazil, kinoya, jiddiy gap va mubolag'ani farqlash."],
  ["suhbatdagi_mavzu_chegarasi", "Yangi mavzuga o'tilganda aloqasiz eski mavzuni aralashtirmaslik."],
  ["takroriy_javobdan_qochish", "Bir xil javobni qayta-qayta bermaslik."],
  ["foydalanuvchi_maqsadini_tushunish", "Ma'lumot, maslahat, misol, tarjima yoki amaliy yechim niyatini farqlash."],
  ["amaliy_yordam", "Muammoni aniqlash va bajariladigan qadamlarni taklif qilish."],
  ["tushuntirish_va_misol", "Murakkab tushunchani sodda izoh va misol bilan tushuntirish."],
  ["javobdagi_noaniqlik", "Fakt, taxmin va noma'lum ma'lumotni farqlash."],
  ["suhbatdagi_ishonch", "Rostgo'ylik, va'da, ishonch va xatoni tan olish."],
  ["raqamli_muloqot", "Telegram, ovozli xabarlar va onlayn muloqot odobi."],
  ["oila_va_munosabatlar", "Oila, qarindoshlar va kundalik munosabatlar."],
  ["kundalik_rejalar", "Bugungi ishlar, ertangi rejalar va rejalarni o'zgartirish."],
  ["tanlov_va_qaror", "Variantlarni solishtirish va qaror qabul qilish."],
  ["kelishuv_va_uchrashuv", "Uchrashuv vaqti, joyi va rejalarni kelishish."],
  ["muammoni_bosqichma_bosqich_hal_qilish", "Muammoni qismlarga ajratib, tartibli yechim topish."],
  ["muloyim_munosabat", "Hurmatli muloqot va fikrga odobli qarshi chiqish."],
  ["fikrni_qayta_ifodalash", "Fikrni ma'nosini o'zgartirmasdan boshqa so'zlarda ifodalash."],
  ["kutilmagan_savollar", "Noodatiy savollarga tegishli javob berish va to'qib chiqarmaslik."],
  ["suhbatni_yakunlash_yoki_davom", "Suhbatni tugatish yoki davom ettirish istagini farqlash."],
];

const CATEGORIES_CONFIG = CATEGORY_ROWS.map(
  ([category, theme]) => ({
    category,
    theme,
    count: DEFAULT_COUNT,
  })
);

// ================================================================
// YORDAMCHI FUNKSIYALAR
// ================================================================

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

function renderProgressBar(current, total, width = 24) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(
    100,
    Math.round((current / safeTotal) * 100)
  );
  const filled = Math.round((percent / 100) * width);
  return (
    `[${"█".repeat(filled).padEnd(width, "░")}] ` +
    `${percent}% (${current}/${total})`
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("uz-UZ")
    .replace(/[.,!?;:'"«»()[\]{}…—–-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(value) {
  const words = String(value ?? "").trim().split(/\s+/);
  return words.filter(Boolean).length;
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateCategories(categories) {
  const seen = new Set();

  for (const item of categories) {
    if (!item.category || !item.theme) {
      throw new Error("Kategoriya yoki theme bo'sh.");
    }

    if (seen.has(item.category)) {
      throw new Error(`Takrorlangan kategoriya: ${item.category}`);
    }

    if (!Number.isInteger(item.count) || item.count < 1) {
      throw new Error(
        `Kategoriya count noto'g'ri: ${item.category}`
      );
    }

    seen.add(item.category);
  }
}

function validateConfiguration() {
  validateCategories(CATEGORIES_CONFIG);

  if (!Number.isInteger(DEFAULT_COUNT) || DEFAULT_COUNT < 1) {
    throw new Error("DEFAULT_COUNT kamida 1 bo'lishi kerak.");
  }

  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
    throw new Error("BATCH_SIZE kamida 1 bo'lishi kerak.");
  }

  if (
    !Number.isInteger(MAX_FAILED_ATTEMPTS) ||
    MAX_FAILED_ATTEMPTS < 1
  ) {
    throw new Error("MAX_FAILED_ATTEMPTS kamida 1 bo'lishi kerak.");
  }
}

function parseJsonArray(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("AI javobi bo'sh.");
  }

  let cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket < 0 || lastBracket < firstBracket) {
    throw new Error("AI javobida JSON massivi topilmadi.");
  }

  cleaned = cleaned.slice(firstBracket, lastBracket + 1);

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("AI javobi JSON massivi emas.");
  }

  return parsed;
}

function validateSentence(sentence) {
  if (typeof sentence !== "string") {
    return { valid: false, reason: "Matn string emas" };
  }

  const text = sentence.trim().replace(/\s+/g, " ");

  if (text.length < MIN_TEXT_LENGTH) {
    return { valid: false, reason: "Jumla juda qisqa" };
  }

  const words = wordCount(text);

  if (words < MIN_WORDS || words > MAX_WORDS) {
    return {
      valid: false,
      reason: `So'zlar soni noto'g'ri: ${words}`,
    };
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    return { valid: false, reason: "Matnda boshqaruv belgisi bor" };
  }

  return { valid: true, text };
}

function getAiText(response) {
  if (typeof response === "string") return response;
  if (typeof response?.text === "string") return response.text;
  throw new Error("AI gateway noto'g'ri javob formatini qaytardi.");
}

/**
 * dbService.seedKnowledge() natijasi loyihaning haqiqiy API'siga
 * bog'liq. Aniq nol yoki bo'sh natija qaytsa, yozuv bajarilmadi
 * deb hisoblaymiz. undefined qaytsa, DB funksiyasi xato tashlamagan
 * bo'lsa ham, bu yozuvni tasdiqlamaydi: loyihangiz API'sini tekshiring.
 */
function wasInsertSuccessful(result) {
  if (typeof result === "number") {
    return result > 0;
  }

  if (Array.isArray(result)) {
    return result.length > 0;
  }

  if (result && typeof result === "object") {
    if (typeof result.rowCount === "number") {
      return result.rowCount > 0;
    }

    if (typeof result.count === "number") {
      return result.count > 0;
    }

    if (typeof result.insertedCount === "number") {
      return result.insertedCount > 0;
    }

    if (Array.isArray(result.rows)) {
      return result.rows.length > 0;
    }

    if (typeof result.success === "boolean") {
      return result.success;
    }
  }

  return false;
}

// ================================================================
// LOKAL KNOWLEDGE.JSON YORDAMCHILARI
// ================================================================

function readLocalKnowledge() {
  if (!fs.existsSync(LOCAL_KNOWLEDGE_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(LOCAL_KNOWLEDGE_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed?.knowledge)) {
    return parsed.knowledge;
  }

  return [];
}

function writeLocalKnowledge(items) {
  const dir = path.dirname(LOCAL_KNOWLEDGE_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const map = new Map();

  for (const item of items) {
    if (!item?.text) continue;

    const normalized = normalizeText(item.text);
    if (!normalized) continue;

    map.set(normalized, {
      text: String(item.text).trim(),
      category: item.category || "umumiy",
    });
  }

  const knowledge = [...map.values()];
  const categories = [...new Set(
    knowledge.map((item) => item.category)
  )];

  const tempPath = `${LOCAL_KNOWLEDGE_PATH}.tmp`;

  fs.writeFileSync(
    tempPath,
    JSON.stringify({ categories, knowledge }, null, 2),
    "utf8"
  );

  fs.renameSync(tempPath, LOCAL_KNOWLEDGE_PATH);

  return knowledge.length;
}

// ================================================================
// ASOSIY AUTO-TRAIN JARAYONI
// ================================================================

async function runAutoTrain(options = {}) {
  validateConfiguration();

  const startTime = Date.now();

  const totalTarget = CATEGORIES_CONFIG.reduce(
    (sum, item) => sum + item.count,
    0
  );

  let dbInitialized = false;
  let globalCount = 0;
  let dbInsertFailures = 0;
  let validationFailures = 0;
  let duplicateCount = 0;

  const knownTextsSet = new Set();
  const newlyGenerated = [];
  const failedCategories = [];

  console.log("\n============================================================");
  console.log(" O'ZBEKCHA AI KNOWLEDGE AUTO-TRAIN PIPELINE");
  console.log(" Cooldown: O'CHIRILGAN");
  console.log(" Xatoda: KEYINGI MODELGA DARHOL O'TISH");
  console.log("============================================================\n");

  console.log(`Kategoriyalar: ${CATEGORIES_CONFIG.length}`);
  console.log(`Rejalashtirilgan jumlalar: ${totalTarget}`);
  console.log(`Batch hajmi: ${BATCH_SIZE}`);
  console.log(`Har kategoriya: ${DEFAULT_COUNT} ta\n`);

  try {
    // ------------------------------------------------------------
    // 1. DATABASE
    // ------------------------------------------------------------

    await dbService.init();
    dbInitialized = true;

    const loaded = await dbService.loadKnowledge();

    const existingKnowledge = Array.isArray(loaded?.knowledge)
      ? loaded.knowledge
      : Array.isArray(loaded)
        ? loaded
        : [];

    for (const item of existingKnowledge) {
      if (item?.text) {
        const normalized = normalizeText(item.text);
        if (normalized) knownTextsSet.add(normalized);
      }
    }

    console.log(`Bazadagi bilimlar: ${existingKnowledge.length}`);
    console.log(`Takroriy matnlar indeksi: ${knownTextsSet.size}\n`);

    // ------------------------------------------------------------
    // 2. KATEGORIYALAR BO'YICHA GENERATSIYA
    // ------------------------------------------------------------

    for (const catConfig of CATEGORIES_CONFIG) {
      let catCount = 0;
      let failedAttempts = 0;
      let categoryDbErrors = 0;

      console.log("\n------------------------------------------------------------");
      console.log(`KATEGORIYA: ${catConfig.category}`);
      console.log(`MAVZU: ${catConfig.theme}`);
      console.log("------------------------------------------------------------");

      const existingSamples = existingKnowledge
        .filter((item) => item?.category === catConfig.category)
        .slice(-12)
        .map((item) => `- ${item.text}`)
        .join("\n");

      while (catCount < catConfig.count) {
        const remaining = catConfig.count - catCount;
        const requestCount = Math.min(BATCH_SIZE, remaining);

        const prompt = `
Siz o'zbek tilidagi tabiiy suhbatlar uchun ma'lumotlar
to'plamini yaratuvchi mutaxassissiz.

VAZIFA:
"${catConfig.theme}" mavzusiga mos ${requestCount} ta yangi
va bir-biridan farqli o'zbekcha jumla yarating.

KATEGORIYA: ${catConfig.category}

TALABLAR:
1. Faqat tabiiy, tushunarli o'zbek tilidan foydalaning.
2. Har bir jumla ${MIN_WORDS}-${MAX_WORDS} ta so'zdan iborat bo'lsin.
3. Har bir jumla aynan belgilangan mavzuga mos bo'lsin.
4. Bir xil mazmundagi jumlalarni turli so'zlar bilan takrorlamang.
5. Inkor, rad etish va yoqtirmaslik ma'nolarini o'zgartirmang.
6. Foydalanuvchi aytmagan fikr yoki niyatni unga nisbat bermang.
7. Savol, darak, iltimos va kundalik suhbat shakllarini mavzuga
   mos ravishda xilma-xil ishlating.
8. Tabiiy imlo va tinish belgilaridan foydalaning.
9. Har bir element oddiy JSON string bo'lsin.
10. JSON massivdan tashqari hech qanday izoh yozmang.
11. Quyidagi namunalarni takrorlamang.

${existingSamples ? `MAVJUD NAMUNALAR:\n${existingSamples}` : ""}

JAVOB FORMATI:
[
  "Birinchi jumla.",
  "Ikkinchi jumla."
]
`;

        try {
          // Gateway xatoda keyingi modelga o'zi darhol o'tadi.
          const aiResponse = await aiGateway.generateText(
            prompt,
            requestCount
          );

          const rawText = getAiText(aiResponse);
          const parsed = parseJsonArray(rawText);

          let addedThisBatch = 0;
          let sawNewCandidate = false;

          for (const sentence of parsed) {
            if (catCount >= catConfig.count) break;

            const validation = validateSentence(sentence);

            if (!validation.valid) {
              validationFailures++;
              console.log(
                `⚠️ Jumla o'tkazildi: ${validation.reason}`
              );
              continue;
            }

            const textClean = validation.text;
            const normalized = normalizeText(textClean);

            if (!normalized) {
              validationFailures++;
              continue;
            }

            if (knownTextsSet.has(normalized)) {
              duplicateCount++;
              console.log(`↪ Dublikat o'tkazildi: ${textClean}`);
              continue;
            }

            sawNewCandidate = true;

            // DB ga yozishdan oldin Set ga qo'shmaymiz.
            // Aks holda DB xatosida jumla noto'g'ri ravishda
            // saqlangan deb belgilanib qolishi mumkin.
            const inserted = await dbService.seedKnowledge([
              {
                text: textClean,
                category: catConfig.category,
              },
            ]);

            if (!wasInsertSuccessful(inserted)) {
              dbInsertFailures++;

              throw new Error(
                "seedKnowledge() yangi qator qo'shilganini " +
                "tasdiqlamadi. src/db API natijasini tekshiring."
              );
            }

            knownTextsSet.add(normalized);

            const record = {
              text: textClean,
              category: catConfig.category,
            };

            newlyGenerated.push(record);

            catCount++;
            globalCount++;
            addedThisBatch++;

            const elapsedMs = Date.now() - startTime;
            const avgMs = globalCount > 0
              ? elapsedMs / globalCount
              : 0;

            const remainingMs = Math.max(
              0,
              (totalTarget - globalCount) * avgMs
            );

            const progress = renderProgressBar(
              globalCount,
              totalTarget
            );

            const modelName = aiResponse?.usedModel ||
              "model noma'lum";

            console.log(
              `${progress} | Model: ${modelName} | ` +
              `Taxminiy vaqt: ${formatDuration(remainingMs)}`
            );

            console.log(`  + ${textClean}`);
          }

          if (addedThisBatch > 0) {
            failedAttempts = 0;
          } else {
            failedAttempts++;

            const reason = sawNewCandidate
              ? "Bazaga yozish tasdiqlanmadi"
              : "Yangi yaroqli jumla topilmadi";

            console.warn(
              `⚠️ ${reason} ` +
              `(${failedAttempts}/${MAX_FAILED_ATTEMPTS})`
            );
          }
        } catch (error) {
          failedAttempts++;

          console.error(
            `❌ Urinish xatosi ` +
            `(${failedAttempts}/${MAX_FAILED_ATTEMPTS}):`,
            error.message
          );

          // Sun'iy kutish yo'q.
          // RETRY_DELAY_MS = 0 bo'lsa sleep darhol yakunlanadi.
          await sleep(RETRY_DELAY_MS);
        }

        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          console.error(
            `🛑 Kategoriya limiti tugadi: ${catConfig.category}`
          );

          failedCategories.push({
            category: catConfig.category,
            generated: catCount,
            target: catConfig.count,
          });

          break;
        }
      }

      console.log(
        `📦 Kategoriya yakuni: ${catConfig.category} ` +
        `(${catCount}/${catConfig.count})`
      );
    }

    // ------------------------------------------------------------
    // 3. LOKAL KNOWLEDGE.JSON YANGILASH
    // ------------------------------------------------------------

    console.log("\nLokal knowledge.json yangilanmoqda...");

    try {
      const localKnowledge = readLocalKnowledge();

      const merged = [
        ...localKnowledge,
        ...newlyGenerated,
      ];

      const localCount = writeLocalKnowledge(merged);

      console.log(
        `✅ Lokal kesh yangilandi: ${localCount} ta noyob jumla.`
      );
    } catch (error) {
      console.error(
        "❌ Lokal knowledge.json yangilanmadi:",
        error.message
      );
    }

    // ------------------------------------------------------------
    // 4. YAKUNIY HISOBOT
    // ------------------------------------------------------------

    const totalDuration = Date.now() - startTime;

    console.log("\n============================================================");
    console.log(" AUTO-TRAIN JARAYONI YAKUNLANDI");
    console.log("============================================================");
    console.log(`Yangi jumlalar: ${globalCount}`);
    console.log(`Reja: ${totalTarget}`);
    console.log(`Dublikatlar: ${duplicateCount}`);
    console.log(`Validatsiya xatolari: ${validationFailures}`);
    console.log(`DB yozuv xatolari: ${dbInsertFailures}`);
    console.log(`Muvaffaqiyatsiz kategoriyalar: ${failedCategories.length}`);
    console.log(`Davomiyligi: ${formatDuration(totalDuration)}`);

    if (failedCategories.length > 0) {
      console.log("\nTUGALLANMAGAN KATEGORIYALAR:");

      for (const item of failedCategories) {
        console.log(
          `- ${item.category}: ${item.generated}/${item.target}`
        );
      }
    }

    console.log("============================================================\n");

    // ------------------------------------------------------------
    // 5. KNOWLEDGE BASE TRENINGI
    // ------------------------------------------------------------

    console.log("Knowledge base qayta o'qitilmoqda...");

    await trainKnowledgeBase(options);

    console.log("✅ Trening funksiyasi yakunlandi.");

    return {
      success: failedCategories.length === 0,
      generated: globalCount,
      target: totalTarget,
      duplicates: duplicateCount,
      validationFailures,
      dbInsertFailures,
      failedCategories,
      durationMs: totalDuration,
    };
  } finally {
    if (
      dbInitialized &&
      typeof dbService.close === "function"
    ) {
      await dbService.close();
    }
  }
}

// ================================================================
// BEVOSITA ISHGA TUSHIRISH
// ================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  if (args.includes("--gpu")) options.device = "gpu";
  if (args.includes("--cpu")) options.device = "cpu";

  runAutoTrain(options)
    .then((result) => {
      if (!result.success) {
        console.error(
          "⚠️ Auto-train ayrim kategoriyalarni to'liq bajarmadi."
        );
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(
        "❌ Auto-train jiddiy xatolik bilan tugadi:",
        error
      );
      process.exitCode = 1;
    });
}

module.exports = runAutoTrain;
