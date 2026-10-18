"use strict";

/**
 * =======================================================================
 *  DYNAMIC TASK UNDERSTANDING & INTENT DECOMPOSITION ENGINE
 * =======================================================================
 *  Bosqich 3: O'zbek tili normalizatsiyasi, niyat (intent), mavzu (topic)
 *  va ob'yektlar (entities)ni ajratib olish hamda savol turini chuqur aniqlash.
 *
 *  Savol turlari (Question Types):
 *  1. Fakt so'rovi (fact_inquiry)
 *  2. Ta'rif so'rovi (definition_inquiry)
 *  3. Sabab-oqibat so'rovi (causal_inquiry)
 *  4. Taqqoslash (comparison_inquiry)
 *  5. Ko'rsatma / maslahat so'rovi (instruction_advice)
 *  6. Oddiy suhbat (chitchat)
 *  7. Matematik hisob (calculation)
 *  8. Deduktiv mantiq (deduction)
 *  9. Ketma-ketlik (sequence)
 *  10. Asossiz taxmin (false_premise)
 *  11. Shaxsiy profil eslash (user_profile)
 *  12. Noaniq so'rov / aniqlashtirish (clarification)
 *  13. Insoniy holat / g'amxo'rlik (empathy_care)
 * =======================================================================
 */

const illogicalEngine = require("./illogicalEngine");
const { uzbekNormalizer } = require("./uzbekNormalizer");

const TASK_TYPES = {
  CALCULATION: "calculation",                   // Matematik hisob, matnli masala
  DEDUCTION: "deduction",                       // Mantiqiy xulosa, sillogizm
  COMPARISON: "comparison",                     // Taqqoslash, ziddiyat, tanlov (comparison_inquiry)
  SEQUENCE: "sequence",                         // Ketma-ketlik (son, kun, fasl)
  ILLOGICAL: "illogical",                       // Kategoriya xatosi, paradoks
  FALSE_PREMISE: "false_premise",               // Noto'g'ri/asossiz taxmin
  AMBIGUOUS_CLARIFICATION: "clarification",     // Noaniq olmosh/yetishmovchilik
  DEFINITION: "definition",                     // Ta'rif so'rovi (definition_inquiry)
  FACT: "fact",                                 // Fakt so'rovi (fact_inquiry)
  CAUSAL: "causal",                             // Sabab-oqibat so'rovi (causal_inquiry)
  INSTRUCTION_ADVICE: "instruction_advice",     // Ko'rsatma / maslahat so'rovi
  CONTEXT_FOLLOWUP: "context_followup",         // Oldingi xabarga bog'liq davom
  CHITCHAT: "chitchat",                         // Salom, hol-ahvol, xayrlashuv
  EMPATHY_CARE: "empathy_care",                 // Insoniy holat, g'amxo'rlik, charchoq, og'riq, empatiya
  USER_PROFILE: "user_profile",                 // Foydalanuvchining o'z ismi/kasbi haqida so'rovi
  CONVERSATIONAL_REPAIR: "conversational_repair", // Muloqotni tuzatish / e'tiroz bildirish
  DISCOURSE_FOLLOWUP: "discourse_followup",       // Oldingi replika bo'yicha savol (nimani tushunding, nega hayrlashding)
  STATE_NEGATION: "state_negation",               // Holat inkori (charchamadim, kasal emasman, uyqum yo'q)
  USER_INTENTION: "user_intention",               // Foydalanuvchi rejasi / niyati (kitob o'qishim kerak, ishga borishim kerak)
  GENERAL_KNOWLEDGE: "general_knowledge",       // RAG / Bilimlar bazasi qidiruvi
};

class TaskUnderstandingEngine {
  constructor() {
    this.illogicalEngine = illogicalEngine;
    this.normalizer = uzbekNormalizer;
  }

  /**
   * Kiruvchi matnni to'liq tahlil qilish
   * @param {string} text - Foydalanuvchi jumlasi
   * @param {Object} dialogueState - Joriy suhbat holati (mavzu, oldingi replikalar)
   * @returns {Object}
   */
  understand(text, dialogueState = {}) {
    const normResult = this.normalizer.normalize(text);
    const raw = normResult.raw;
    const lower = normResult.lower;

    const analysis = {
      rawText: raw,
      normalizedText: lower,
      primaryTask: TASK_TYPES.GENERAL_KNOWLEDGE,
      secondaryTasks: [],
      topic: null,
      entities: {
        numbers: [],
        units: [],
        subjects: [],
        questionWord: null,
        adjectives: [],
        action: null,
      },
      formatRequirement: "standard", // standard | concise | step_by_step | detailed
      confidence: 80,
      reason: "",
      metadata: {},
      ambiguityInfo: null,
    };

    if (!raw) {
      analysis.primaryTask = TASK_TYPES.CHITCHAT;
      analysis.reason = "Bo'sh kiruvchi matn.";
      return analysis;
    }

    // 0. ENTITY VA MAVZU AJRATIB OLISH (Topic & Entity Extraction)
    this._extractEntitiesAndTopic(lower, raw, analysis);

    // 1. FORMAT TALABLARINI ANIQLASH (Qisqa / Qadam-baqadam / Batafsil)
    if (/\b(?:ikki\s+jumlada|qisqacha|qisqartir|qisqa\s+qilib|faqat\s+javob)\b/i.test(lower)) {
      analysis.formatRequirement = "concise";
    } else if (/\b(?:qadam-baqadam|bosqichma-bosqich|yechimi\s+bilan|hisob-kitobi\s+bilan)\b/i.test(lower)) {
      analysis.formatRequirement = "step_by_step";
    } else if (/\b(?:batafsil|kengroq|to'liq\s+tushuntir|tahlil\s+qil)\b/i.test(lower)) {
      analysis.formatRequirement = "detailed";
    }

    // 2.0. BOT SHAXSIYATI VA O'ZINI TANISHTIRISH (BOT IDENTITY & PERSONA)
    // Masalan: "Sen kimsan?", "Sen nimasan?", "Uxlaysanmi sen?", "Charchamaysanmi?", "Nima qila olasan?"
    const isBotIdentity = (
      /\b(?:isming\s+nima|ismingiz\s+nima|sen\s+kimsan|kimsan|kimsiz|sen\s+kimsiz|oting\s+nima|o'zing\s+haqingda|kim\s+san|sen\s+nimasan|nimasan|nimasiz|sen\s+nimasiz|qanday\s+botsan|qanday\s+modelsan|qanday\s+dastursan|qanday\s+tizimsan|nima\s+qila\s+olasan|nimalarga\s+qodirsan|vazifang\s+nima)\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:uxlaysanmi|uxlaysizmi|uxlaysan|uxlaysiz|dam\s+olasanmi|dam\s+olasizmi)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:charchaysanmi|charchamaysanmi|charchaysizmi|charchamaysizmi|toliqmaysanmi)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:ovqat\s+yeysanmi|yeysanmi|ovqatlanasanmi|suv\s+ichasanmi|ichasanmi|non\s+yeysanmi)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:odammisan|insonmisan|robotsanmi|robotmisan|sun'iy\s+intellektmisan|mashinamisan|kompyutermisan|dasturmisan)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:tirikmisan|tirikmisiz|yashaysanmi)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:necha\s+yoshdasan|yoshing\s+nechada|yoshingiz\s+nechada|necha\s+yoshsiz|qachon\s+tug'ilgansan)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:qayerdasan|qayerda\s+yashaysan|qayerda\s+turasan|qayerdansan|qaerdansan)(?:\s+sen|\s+siz)?\b/i.test(lower) ||
      /\b(?:seni\s+)?(?:kim\s+yaratgan|kim\s+yasagan|kim\s+ishlab\s+chiqqan|yaratuvching\s+kim|egasi\s+kim|muallifing\s+kim)\b/i.test(lower) ||
      /\b(?:sen\s+)?(?:zerikmaysanmi|zerikasanmi|zerikdingmi|hislaring\s+bormi|yig'laysanmi|kulasanmi|sevasanmi|xafa\s+bo'lasanmi)\b/i.test(lower) ||
      /\b(?:meni\s+taniysanmi|meni\s+eslaysanmi|meni\s+bilasanmi)\b/i.test(lower)
    );
    if (isBotIdentity) {
      analysis.primaryTask = TASK_TYPES.CHITCHAT;
      analysis.confidence = 99;
      analysis.reason = "Bot shaxsiyati, tabiati yoki imkoniyati haqida so'rov (Bot Persona).";
      analysis.metadata.botIdentity = true;
      if (/uxla|dam\s+ol/i.test(lower)) {
        analysis.metadata.botPersonaType = "sleep";
      } else if (/charchay|charcham|toliq/i.test(lower)) {
        analysis.metadata.botPersonaType = "tiredness";
      } else if (/yeysan|ichasan|ovqat|suv/i.test(lower)) {
        analysis.metadata.botPersonaType = "food";
      } else if (/odam|inson|robot|mashina|dastur|sun'iy\s+intellekt/i.test(lower)) {
        analysis.metadata.botPersonaType = "nature";
      } else if (/tirik|yasha/i.test(lower)) {
        analysis.metadata.botPersonaType = "life";
      } else if (/yosh|tug'ilgan/i.test(lower)) {
        analysis.metadata.botPersonaType = "age";
      } else if (/qayerda|qaerda|qayerdan|qaerdan/i.test(lower)) {
        analysis.metadata.botPersonaType = "location";
      } else if (/yaratgan|yasagan|ishlab\s+chiqqan|muallif|egasi/i.test(lower)) {
        analysis.metadata.botPersonaType = "creator";
      } else if (/zerik|his|yig'la|kula|seva|xafa/i.test(lower)) {
        analysis.metadata.botPersonaType = "feelings";
      } else if (/taniysan|eslaysan|bilasan/i.test(lower)) {
        analysis.metadata.botPersonaType = "recognition";
      } else {
        analysis.metadata.botPersonaType = "identity";
      }
      return analysis;
    }

    // 2. FOYDALANUVCHINING SHAXSIY PROFILINI ESLASH (USER_PROFILE INQUIRY)
    // Masalan: "Mening ismim nima?", "Mening kasbim nima?", "Mening sevimli mashinam nima edi?"
    const isProfileInquiry = (
      /(?:mening\s+|meni\s+)?(?:ismim|otim|kasbim|soham|yoshim|manzilim)\s+(?:nima|kim|qanday)(?:\s+edi)?\b/i.test(lower) ||
      /\bmen\s+kimman\b/i.test(lower)
    );
    if (isProfileInquiry) {
      analysis.primaryTask = TASK_TYPES.USER_PROFILE;
      analysis.confidence = 99;
      analysis.reason = "Foydalanuvchi o'z ismi yoki kasbini xotiradan eslashni so'radi.";
      if (lower.includes("ismim") || lower.includes("kimman")) {
        analysis.metadata.profileField = "name";
      } else if (lower.includes("kasbim") || lower.includes("soham")) {
        analysis.metadata.profileField = "profession";
      }
      return analysis;
    }

    // 2.1. MULOQOTNI TUZATISH VA E'TIROZ (CONVERSATIONAL_REPAIR)
    const isConversationalRepair = (
      /\b(?:men\s+sendan\s+)?(?:hol[\s-]+?ahvol|hol|ahvol|salomlashish|boshqa\s+narsa)(?:ingni|ingizni)?\s+(?:so'radim|so'rayapman)\b/i.test(lower) ||
      /\b(?:men\s+)?buni\s+so'ramadim\b/i.test(lower) ||
      /\b(?:noto'g'ri|notogri)\s+tushunding\b/i.test(lower) ||
      /\b(?:men\s+)?boshqa\s+narsa(?:ni)?\s+(?:so'radim|nazarda\s+tutdim|demoqchiman)\b/i.test(lower) ||
      /\b(?:mening\s+ismim|men)\s+[a-zа-яёo‘oʻg‘gʻ']+\s+emas\b/i.test(lower) ||
      /\b(?:qanaqa|qanday)\s+[a-zа-яёo‘oʻg‘gʻ']+(?:,\s*|\s+)(?:men|axir|senga)\b/i.test(lower) ||
      /\b(?:men\s+)?(?:senga\s+)?(.+?)\s+(?:dedim|aytdim)(?:ku|\s+axir)?\b/i.test(lower) ||
      /\bnima\s+aloqasi\s+bor\b/i.test(lower) ||
      /\bqaerdan\s+(?:olding|chiqdi)\b/i.test(lower) ||
      /\bkim\s+aytdi\s+senga\b/i.test(lower) ||
      /\bgapimga\s+javob\s+ber\b/i.test(lower)
    );
    if (isConversationalRepair) {
      analysis.primaryTask = TASK_TYPES.CONVERSATIONAL_REPAIR;
      analysis.confidence = 98;
      analysis.reason = "Foydalanuvchi suhbatdoshning oldingi javobidagi tushunmovchilikni tuzatmoqda yoki e'tiroz bildirmoqda (conversational repair).";
      const saidMatch = lower.match(/(?:senga\s+)?(.+?)\s+(?:dedim|aytdim)/i);
      if (saidMatch && saidMatch[1]) {
        analysis.metadata.intendedMessage = saidMatch[1].trim();
      }
      return analysis;
    }

    // 2.2. OLDINGI REPLIKA TAHLILI VA SAVOLLAR (DISCOURSE_FOLLOWUP)
    const isDiscourseFollowup = (
      /\bnimani\s+(?:tushunding|tushundingiz|bilding|nazarda\s+tutding)\b/i.test(lower) ||
      /\bnega\s+(?:tez\s+)?(?:xayrlashding|hayrlashding|xayrlashyapsan|hayrlashyapsan)\b/i.test(lower) ||
      /\bnega\s+(?:dam\s+ol\s+deysan|bunday\s+deding|unday\s+deding|buni\s+aytding)\b/i.test(lower)
    );
    if (isDiscourseFollowup) {
      analysis.primaryTask = TASK_TYPES.DISCOURSE_FOLLOWUP;
      analysis.confidence = 98;
      analysis.reason = "Oldingi bot replikasi bo'yicha tushuntirish yoki kontekstual so'rov (discourse follow-up).";
      return analysis;
    }

    // 2.3. HOLAT VA HISSIYOT INKORI (STATE_NEGATION & ALERTNESS)
    const isStateNegation = (
      /\b(?:men\s+)?(?:charchamadim|toliqmadim|charchaganim\s+yo'q|toliqqanim\s+yo'q|charchagan\s+emasman)\b/i.test(lower) ||
      /\b(?:dam\s+olmayman|dam\s+olishni\s+istamayman|dam\s+olish\s+kerakmas)\b/i.test(lower) ||
      /\b(?:kasal|betob)\s+emasman\b/i.test(lower) ||
      /\buyqum\s+(?:kelmadi|kelmayapti|yo'q)\b/i.test(lower) ||
      /\buxlamayman\b/i.test(lower) ||
      /\b(?:xafa|hafa)\s+emasman\b/i.test(lower)
    );
    if (isStateNegation) {
      analysis.primaryTask = TASK_TYPES.STATE_NEGATION;
      analysis.confidence = 98;
      analysis.reason = "Foydalanuvchi charchoq yoki noxush holatni inkor qildi, tetiklik bildirdi.";
      return analysis;
    }

    // 2.4. FOYDALANUVCHI REJASI / NIYATI / MASHG'ULOTI (USER_INTENTION)
    // Masalan: "kitob o'qishim kerak", "men ishga borishim kerak", "dars qilishim kerak", "uxlashim kerak"
    const isUserIntention = (
      /\b(?:o'qishim|borishim|qilishim|ketishim|uxlashim|yotishim|ishlashim|yozishim|ovqatlanishim|yeyishim|ichishim|o'rganishim|tayyorlashim|shug'ullanishim|bajarishim|o'ynashim|haydashim|pishirishim|dam\s+olishim)\s+(?:kerak|zarur|lozim|shart)\b/i.test(lower) ||
      /\b(?:o'qimoqchiman|bormoqchiman|qilmoqchiman|uxlamoqchiman|yotmoqchiman|ishlamoqchiman|yozmoqchiman|o'rganmoqchiman|bajarmoqchiman|o'ynamoqchiman|haydamoqchiman|pishirmoqchiman|tayyorlamoqchiman|uchmoqchiman|minmoqchiman|yugurmoqchiman|sayr\s+qilmoqchiman|dam\s+olmoqchiman)\b/i.test(lower) ||
      (/\b(?:men\s+)?(?:ishga|darsga|uyga|bozorga|shifoxonaga|mashg'ulotga)\s+(?:borishim|ketishim)\s+kerak\b/i.test(lower)) ||
      (/\b(?:kitob|maqola|dars)\s+(?:o'qishim|tayyorlashim)\s+kerak\b/i.test(lower)) ||
      (/\b(?:men\s+)?(?:shaxmat|futbol|tennis|voleybol|basketbol|kompyuter|velosiped|mashina|she'r|maqola|kitob|dars|ovqat|somsa|osh)\s+(?:o'ynayman|haydayman|yozaman|pishiraman|o'qiyman|tayyorlayman)\b/i.test(lower))
    );
    if (isUserIntention) {
      analysis.primaryTask = TASK_TYPES.USER_INTENTION;
      analysis.confidence = 96;
      analysis.reason = "Foydalanuvchi o'z rejasi, niyati yoki amaliy mashg'ulotini bildirdi (user intention).";
      if (lower.includes("kitob") || lower.includes("o'qish") || lower.includes("mutolaa") || lower.includes("o'qimoqchiman")) {
        analysis.metadata.intentionType = "reading";
      } else if (lower.includes("ish") || lower.includes("borish") || lower.includes("ketish")) {
        analysis.metadata.intentionType = "work";
      } else if (lower.includes("dars") || lower.includes("o'rganish")) {
        analysis.metadata.intentionType = "study";
      } else if (lower.includes("uxla") || lower.includes("yotish")) {
        analysis.metadata.intentionType = "sleep";
      } else if (lower.includes("ovqat") || lower.includes("ye") || lower.includes("ich")) {
        analysis.metadata.intentionType = "eating";
      } else {
        analysis.metadata.intentionType = "general_plan";
      }
      return analysis;
    }

    // 3. KATEGORIYA XATOSI VA PARADOKSLAR (ILLOGICAL ENGINE)
    const illogicalDetection = this.illogicalEngine.detectIllogicalQuery(raw);
    if (illogicalDetection) {
      analysis.primaryTask = TASK_TYPES.ILLOGICAL;
      analysis.confidence = illogicalDetection.confidence || 95;
      analysis.reason = illogicalDetection.reason;
      analysis.metadata.illogical = illogicalDetection;
      return analysis;
    }

    // 4. NOTO'G'RI TAXMINLARNI ANIQLASH (FALSE PREMISE)
    const hasFalsePremise = (
      (/\bmars(?:da|dagi)?\b/i.test(lower) && /\b(?:shahar|bino|respublika|prezident|aholi|turar-joy|kvartira|manzil)\b/i.test(lower) && !/\b(?:orzu|kelajakda|ilmiy\s+fantastika)\b/i.test(lower)) ||
      (/\bqora\s+tuynuk/i.test(lower) && /\b(?:ichiga|laboratoriya|olim|harorat)/i.test(lower)) ||
      (/\btoshkent\b/i.test(lower) && /\b(?:dengiz\s+bo'yida|okean\s+bo'yida)\b/i.test(lower)) ||
      (/\bquyosh\b/i.test(lower) && /\b(?:kechasi\s+chiqadi|sovuq\s+muzlaydi)\b/i.test(lower))
    );
    if (hasFalsePremise) {
      analysis.primaryTask = TASK_TYPES.FALSE_PREMISE;
      analysis.confidence = 95;
      analysis.reason = "Savolda ilmiy yoki geografik jihatdan asossiz/noto'g'ri taxmin aniqlandi.";
      return analysis;
    }

    // 5. DEDUKTIV MANTIQ VA SILLOGIZMLAR (DEDUCTION)
    const isSyllogism = (
      /\bbarcha\s+[a-z0-9\s\.,\-—']+(?:—|-|esa|\.|\,)\s*[a-z0-9\s\.,\-—']+(?:—|-|esa|bu)\s*[a-z0-9\s']+/i.test(lower) ||
      /\bhech\s+bir\s+[a-z0-9\s\.,\-—']+\s+(?:emas|uchmaydi|yashamaydi|bo'lmaydi)\b/i.test(lower) ||
      /\bba'zi[\s\S]+?barcha/i.test(lower) ||
      /\b(?:yo|yoki)\s+[a-z0-9\s']+,?\s*(?:yo|yoki)\s+[a-z0-9\s']+/i.test(lower) ||
      /\bbundan[\s\S]*?xulosa\s+(?:kelib\s+)?chiqadi\b/i.test(lower) ||
      /\bagar\s+kecha\s+ertangi\s+kun\b/i.test(lower) ||
      (/\bagar\b/i.test(lower) && /\b(?:bo'lsa|yog'sa|kelsa|yuz\s+bersa)\b/i.test(lower) && /\b(?:bo'ladi|yuz\s+beradi|bo'ldi|yog'di|sodir\s+bo'ldi)\b/i.test(lower)) ||
      (/\bbarcha\b/i.test(lower) && /\b(?:xulosa|demak|insonlar|inson|nafas)\b/i.test(lower)) ||
      (/\b([a-z0-9']+)\s+(?:esa\s+)?([a-z0-9']+)\s*dan\s+(?:baland|katta|kichik|past|og'ir|yengil|uzun|kalta|tez|sekin|kuchli|zaif)(?:roq)?\b/i.test(lower) && /\b(?:eng\s+(?:pasti|balandi|kattasi|kichigi|uzuni|kaltasi|yengili|birinchi|tezi|tez\b|sekini|sekin\b|kuchlisi|oxirgi)|kim\s+(?:katta|kichik|baland|past|tez|sekin)|qaysi|marraga)\b/i.test(lower)) ||
      (/\bmarraga\s+(?:birinchi|oxirgi)\b/i.test(lower)) ||
      (/\b(?:barcha\s+qushlarning\s+qanoti|olmalar\s+meva|dilnoza\s+malikaning|stol\s+ustida\s+quti|temir\s+suvdan\s+og'ir|qizil\s+qalam)\b/i.test(lower))
    );
    if (isSyllogism) {
      analysis.primaryTask = TASK_TYPES.DEDUCTION;
      analysis.confidence = 96;
      analysis.reason = "Deduktiv sillogizm, disyunksiya yoki mantiqiy xulosa chiqarish.";
      return analysis;
    }

    // 6. ARIFMETIKA VA MATNLI MASALALAR (CALCULATION)
    const hasMathFormula = /(\d+[\s]*[\+\-\*\/][\s]*\d+)/.test(raw);
    const hasWordProblemMath = (
      (/\b(\d+)\s*(?:ga|dan|ni)\s*(\d+)\s*(?:ni|ga|dan)?\s*(?:qo'sh|ayir|ko'paytir|bo'l|plus|minus)/i.test(lower)) ||
      (/\b(\d+)\s*(?:qo'shuv|ayiruv|ko'paytiruv|bo'luv|\+|\-|\*|\/)\s*(\d+)/i.test(lower)) ||
      (/\b(\d+[\d\s]*)\s*(?:ning)?\s*(\d+[\.,]?\d*)\s*(?:foizi|%|protsenti)/i.test(lower)) ||
      (/\b(\d+)\s*ning\s*(?:kvadrati|kubi|\d+-darajasi)/i.test(lower)) ||
      (/\b(?:bir|1)\s*(?:dona\s+)?([a-z']+)\s*(\d+[\d\s]*)\s*so'm/i.test(lower)) ||
      (/\b(\d+)\s*ta\s*([a-z']+)\b/i.test(lower) && /\b(?:har\s*biri|donasi|narxi|so'm|jami|qancha|qoldi|yedim|berdim|sotdim)\b/i.test(lower)) ||
      (/\b(\d+)\s*ta\s*bor\s*edi\b/i.test(lower) && /\b(\d+)\s*tasini\b/i.test(lower)) ||
      (/\b(\d+)\s*ta\b/i.test(lower) && /\blekin\b/i.test(lower) && /\bnechta\b/i.test(lower)) ||
      (/\b(?:jami|umumiy|qancha)\s+(?:bo'ladi|to'ladi|qoldi|hisobla)\b/i.test(lower) && /\d+/.test(raw))
    );
    if (hasMathFormula || hasWordProblemMath) {
      analysis.primaryTask = TASK_TYPES.CALCULATION;
      analysis.confidence = 96;
      analysis.reason = hasWordProblemMath ? "Tabiiy tildagi matnli arifmetik masala" : "To'g'ridan-to'g'ri matematik formula";
      return analysis;
    }

    // 7. KETMA-KETLIKLAR VA NAQSHLAR (SEQUENCE)
    const isSequence = (
      /\b(?:ketma-ketlik|keyingi\s+son|davomi\s+nima|keyingi\s+kun|keyingi\s+fasl|kun\s+o'tsa|kundan\s+keyin|haftaning\s+qaysi\s+kuni)\b/i.test(lower) ||
      /\b(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\b/.test(raw) ||
      (/\b(?:dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)\b/i.test(lower) && /\b(?:keyin|o'tsa|kuni)\b/i.test(lower)) ||
      (/\b(?:fasl|faslidan\s+keyin)\b/i.test(lower))
    );
    if (isSequence) {
      analysis.primaryTask = TASK_TYPES.SEQUENCE;
      analysis.confidence = 93;
      analysis.reason = "Raqamli yoki taqvimiy ketma-ketlik masalasi.";
      return analysis;
    }

    // 8. TAQQOSLASH VA TANLOV (COMPARISON_INQUIRY)
    const isComparison = (
      /\b(?:qaysi\s+biri\s+kattaroq|qaysi\s+biri\s+kichikroq|taqqosla|farqi\s+nima(?:da)?|farqi\s+qanday|afzalmi|yaxshiroqmi)\b/i.test(lower) ||
      (/\b([a-z']+)\s+bilan\s+([a-z']+)\s+(?:farqi|taqqosla)/i.test(lower)) ||
      (/\byoki\b/i.test(lower) && /\?$/.test(raw) && !/\b(?:choy|kofe|qahva|xulosa)\b/i.test(lower))
    );
    if (isComparison) {
      analysis.primaryTask = TASK_TYPES.COMPARISON;
      analysis.confidence = 92;
      analysis.reason = "Ikki yoki undan ortiq tushunchani taqqoslash (taqqoslash so'rovi).";
      return analysis;
    }

    // 9. SABAB-OQIBAT SO'ROVI (CAUSAL_INQUIRY)
    // Masalan: "Nega osmon moviy?", "Nimaga qor yog'adi?", "Qanday sababga ko'ra barglar sarg'ayadi?"
    const isCausal = (
      /\b(?:nega|nimaga|sababi\s+nima|qanday\s+sabab(?:ga\s+ko'ra)?|nimaning\s+oqibatida|nima\s+uchun)\b/i.test(lower) ||
      (/\bagar\b/i.test(lower) && /\b(?:bo'lsa|sovuq|harorat|daraja)\b/i.test(lower) && /\bnima\s+bo'ladi\b/i.test(lower))
    );
    if (isCausal) {
      analysis.primaryTask = TASK_TYPES.CAUSAL;
      analysis.confidence = 92;
      analysis.reason = "Sabab va oqibatni aniqlash so'rovi (causal inquiry).";
      return analysis;
    }

    // 10. KO'RSATMA VA MASLAHAT SO'ROVI (INSTRUCTION_ADVICE)
    // Masalan: "Qishda havo sovuq bo'lsa nima kiyish kerak?", "Qanday qilib dasturchi bo'lish mumkin?", "Maslahat ber"
    const isInstructionAdvice = (
      /\b(?:nima\s+qilish\s+kerak|nima\s+kiyish\s+kerak|qanday\s+qilish\s+kerak|qanday\s+qilib\s+[a-z']+\s+bo'lish|maslahat\s+ber|tavsiya\s+ber|yo'l-yo'riq|ko'rsatma)\b/i.test(lower) ||
      (/\bkerak\b/i.test(lower) && /\b(?:qilsam|bursam|o'rgansam|yondashsam|kiyish)\b/i.test(lower))
    );
    if (isInstructionAdvice) {
      analysis.primaryTask = TASK_TYPES.INSTRUCTION_ADVICE;
      analysis.confidence = 92;
      analysis.reason = "Amaliy ko'rsatma yoki tavsiya/maslahat so'rovi (instruction & advice).";
      return analysis;
    }

    // 11. NOANIQ SO'ROVLAR VA ANIQLASHTIRISH (CLARIFICATION)
    // Agar savolda noaniqlik bo'lsa, asosiy mavzuni aniqlab olishga urinish
    const isAmbiguous = (
      /^u\s+(?:[\w\s']+)?(?:qachon|qayerda|kim|keladi|ketadi|boradi|bo'ladi)\b/i.test(lower) ||
      /^(?:menga\s+)?uning\s+(?:narxini|narxi|manzilini|nomini|vazifasini)\b/i.test(lower) ||
      /^(?:u\s+)?kim\s+o'zi\b/i.test(lower) ||
      /^(?:qachon\s+keladi|narxi\s+qancha)\?*$/i.test(lower)
    );
    if (isAmbiguous) {
      analysis.primaryTask = TASK_TYPES.AMBIGUOUS_CLARIFICATION;
      analysis.confidence = 94;
      analysis.reason = "Noaniq olmosh yoki kontekstga tayangan murojaat (anaphora / clarification).";

      let targetProp = "ma'lumot";
      if (lower.includes("narx")) targetProp = "narxi";
      else if (lower.includes("qachon") || lower.includes("keladi")) targetProp = "kelish vaqti";
      else if (lower.includes("manzil")) targetProp = "manzili";

      analysis.ambiguityInfo = {
        isAmbiguous: true,
        missingEntity: "aniq mahsulot, tovar yoki shaxs",
        targetProperty: targetProp,
      };
      return analysis;
    }

    // 12. KONTEKSTGA BOG'LIQ DAVOM (CONTEXT FOLLOWUP)
    const isFollowup = (
      /\b(?:uning\s+afzallik\w*|afzallik\w*|kamchilik\w*|buni\s+ikki|qisqartir\w*|yana\s+boshqa)/i.test(lower) ||
      (dialogueState.lastTopic && /^(?:nega|qanday|afzalliklari|kamchiliklari)\b/i.test(lower))
    );
    if (isFollowup) {
      analysis.primaryTask = TASK_TYPES.CONTEXT_FOLLOWUP;
      analysis.confidence = 88;
      analysis.reason = "Oldingi suhbat mavzusiga bog'langan follow-up so'rov.";
      return analysis;
    }


    // 14. REAL VAQT OB-HAVO SO'ROVI (WEATHER QUERY)
    const isWeather = /\b(?:bugungi\s+ob-havo|ertangi\s+ob-havo|ob-havo\s+qanday|ob-havo\s+qanaqa|tashqarida\s+havo\s+qanday)\b/i.test(lower);
    if (isWeather) {
      analysis.primaryTask = TASK_TYPES.GENERAL_KNOWLEDGE;
      analysis.confidence = 95;
      analysis.reason = "Ayni paytdagi ob-havo haqida so'rov.";
      analysis.metadata.weatherQuery = true;
      return analysis;
    }

    // 15. INSONIY SHAXSIY HOLATLAR, EMPATIYA VA G'AMXO'RLIK (EMPATHY & CARE)
    const isConceptInquiry = /\b(?:nima|nimani|nimaligini|tushunchasi|ta'rifi)\b/i.test(lower);
    if (!isConceptInquiry) {
      let empathyType = null;
      if (
        /\b(?:men\s+)?charchadim\b/i.test(lower) ||
        /\b(?:charchab\s+ketdim|juda\s+charchadim|rosa\s+charchadim|toliqdim|toliqib\s+ketdim|holdan\s+toydim|holsizman|madorim\s+yo'q|madorim\s+qolmadi|boshim\s+qotdi|boshim\s+qotib\s+ketdi|ishlab\s+charchadim|dars\s+qilib\s+charchadim)\b/i.test(lower) ||
        (/\bcharchad/i.test(lower) && !/\b(?:kitob|dars|savol|fakt|daraxt|suv)\b/i.test(lower))
      ) {
        empathyType = "fatigue";
      } else if (
        /\b(?:boshim|tishim|qornim|belim|yuragim|ko'zim|tomog'im|oyog'im)\s+og'riyapti\b/i.test(lower) ||
        /\bmazzam\s+(?:yo'q|bo'lmayapti)\b/i.test(lower) ||
        /\b(?:kasalman|kasal\s+bo'lib\s+qoldim|betobman|betob\s+bo'lib\s+qoldim|isitmalayapman|haroratim\s+ko'tarildi)\b/i.test(lower)
      ) {
        empathyType = "pain";
      } else if (
        /\bkayfiyatim\s+(?:yo'q|tushib\s+ketdi|nol|yomon|buzildi)\b/i.test(lower) ||
        /\b(?:siqilyapman|siqilib\s+ketdim|yuragim\s+siqilyapti|asabim\s+buzildi|asabiylashdim|asabiylashyapman|yig'lagim\s+kelyapti|ko'nglim\s+g'ash)\b/i.test(lower) ||
        /\b(?:men\s+)?xafaman\b/i.test(lower)
      ) {
        empathyType = "distress";
      } else if (
        /\b(?:zerikdim|zerikyapman|zerikib\s+ketdim)\b/i.test(lower)
      ) {
        empathyType = "boredom";
      } else if (
        /\b(?:uyqum\s+kelyapti|ko'zim\s+yumilib\s+ketyapti|uxlagani\s+ketyapman|yotib\s+dam\s+olmoqchiman|uxlayman\s+men|dam\s+olmoqchiman)\b/i.test(lower)
      ) {
        empathyType = "sleep";
      } else if (
        /\b(?:juda\s+xursandman|kayfiyatim\s+a'lo|kayfiyatim\s+zo'r|baxtliman|omadim\s+keldi)\b/i.test(lower) ||
        /^(?:men\s+)?(?:xursandman|hursandman)$/i.test(lower)
      ) {
        empathyType = "joy";
      }

      if (empathyType) {
        analysis.primaryTask = TASK_TYPES.EMPATHY_CARE;
        analysis.confidence = 98;
        analysis.reason = `Foydalanuvchining shaxsiy holati bo'yicha insoniy empatiya va g'amxo'rlik (${empathyType}).`;
        analysis.metadata.empathyType = empathyType;
        return analysis;
      }
    }

    // 16. TA'RIF VA TUSHUNCHALAR (DEFINITION_INQUIRY)
    const isDefinition = (
      /(?:^|\b)([a-z0-9'+#.-]+)\s+(?:nima|nimani\s+anglatadi|qanday\s+jarayon|tushunchasi|ta'rifi|nima\s+degani|nima\s+o'zi)\b/i.test(lower) ||
      /(?:^|\b)([a-z0-9'+#.-]+)\s+qanday\s+(?:taom|ovqat|pishiriq|meva|sabzavot|hayvon|qush|o'simlik|dastur|til|fan|tushuncha|hodisa|narsa)\b/i.test(lower) ||
      /(?:^|\b)([a-z0-9'+#.-]+)\s+haqida\s+(?:ma'lumot|tushuncha|tushuntir|gapir)/i.test(lower)
    ) && !/\b(?:mening\s+ismim|mening\s+kasbim|sen\s+kim|isming|ismingiz)\b/i.test(lower);
    if (isDefinition) {
      analysis.primaryTask = TASK_TYPES.DEFINITION;
      analysis.confidence = 92;
      analysis.reason = "Tushuncha, soha yoki ilmiy hodisaga ta'rif so'rovi (definition inquiry).";
      return analysis;
    }

    // 17. ANIQ FAKT SO'ROVI (FACT_INQUIRY)
    // Masalan: "O'zbekistonning poytaxti qaysi shahar?", "Yer Quyosh atrofida aylanadimi?", "Amir Temur qachon tug'ilgan?"
    const isFact = (
      /\b(?:poytaxti\s+qayer(?:da)?|poytaxti\s+qaysi|bosh\s+shahri\s+qaysi|nechanchi\s+yilda|qachon\s+tug'ilgan|qayerda\s+joylashgan|aylanadimi|haqiqatmi)\b/i.test(lower) ||
      (/\b([a-z']+)\s+kim\b/i.test(lower) && !/\b(?:sen|siz|men)\b/i.test(lower))
    );
    if (isFact) {
      analysis.primaryTask = TASK_TYPES.FACT;
      analysis.confidence = 92;
      analysis.reason = "Aniq ensiklopedik fakt yoki ma'lumot so'rovi (fact inquiry).";
      return analysis;
    }

    // 18. KUNDALIK SUHBAT (CHITCHAT)
    const isChitchat = (
      /\b(?:salom|assalomu\s+alaykum|assalom|qandaysan|qandaysiz|qalaysan|qalaysiz|qaleysan|nima\s+gap(?:lar)?|ishlar\s+qalay|ahvol\s+qalay|ahvoling\s+qanday|ahvollaring\s+qalay|kayfiyat\s+qalay|charchama|charchamang|xayr|rahmat|tashakkur|xush\s+ko'rdik|salomlashish|tinchmisan|tinchlikmi)\b/i.test(lower)
    );
    if (isChitchat && lower.split(/\s+/).length <= 6) {
      analysis.primaryTask = TASK_TYPES.CHITCHAT;
      analysis.confidence = 96;
      analysis.reason = "Oddiy kundalik ijtimoiy suhbat yoki salomlashish (chitchat).";
      let subtype = "general";
      if (/\b(?:qandaysan|qandaysiz|qalaysan|qalaysiz|qaleysan|ahvol|ishlar\s+qalay|kayfiyat|tinchmisan|nima\s+gap(?:lar)?)\b/i.test(lower)) {
        subtype = "how_are_you";
      } else if (/\b(?:salom|assalomu\s+alaykum|assalom|xush\s+ko'rdik)\b/i.test(lower)) {
        subtype = "greeting";
      } else if (/\b(?:rahmat|tashakkur)\b/i.test(lower)) {
        subtype = "gratitude";
      } else if (/\b(?:xayr|ko'rishguncha|salomat\s+bo'l)\b/i.test(lower)) {
        subtype = "farewell";
      }
      analysis.metadata.chitchatSubtype = subtype;
      return analysis;
    }

    // Default: Umumiy bilim va RAG qidiruvi
    analysis.primaryTask = TASK_TYPES.GENERAL_KNOWLEDGE;
    analysis.reason = "Umumiy faktik bilim yoki korpus qidiruvi.";
    return analysis;
  }

  /**
   * Matndan mavzu (topic) va ob'yektlar (entities)ni ajratish
   */
  _extractEntitiesAndTopic(lower, raw, analysis) {
    // 1. Raqamlar
    const numMatches = raw.match(/\b\d+(?:[\.,]\d+)?\b/g);
    if (numMatches) {
      analysis.entities.numbers = numMatches.map((n) => parseFloat(n.replace(",", ".")));
    }

    // 2. So'roq so'zlari
    const qWordMatch = lower.match(/\b(nima|nimani|qaysi|qayerda|qayer|qachon|nega|nimaga|kim|qanday|nechta|qancha)\b/i);
    if (qWordMatch) {
      analysis.entities.questionWord = qWordMatch[1];
    }

    // 3. Sifatlar / Holat belgilari
    const adjMatch = lower.match(/\b(katta|kichik|kattaroq|kichikroq|og'ir|yengil|issiq|sovuq|qalin|yupqa|tez|sekin)\b/gi);
    if (adjMatch) {
      analysis.entities.adjectives = [...new Set(adjMatch.map((a) => a.toLowerCase()))];
    }

    // 4. Sanaladigan predmetlar / Birliklar
    const unitMatch = lower.match(/\b\d+\s*(?:ta\s+)?([a-z']+)\b/i);
    if (unitMatch && unitMatch[1]) {
      analysis.entities.units.push(unitMatch[1]);
    }

    // 5. Asosiy mavzu (Topic) ajratish
    let topic = null;
    const defMatch = lower.match(/\b([a-z0-9'\s]+?)\s+(?:nima|ta'rifi|tushunchasi|haqida)/i);
    if (defMatch && defMatch[1]) {
      topic = defMatch[1].trim();
    } else {
      const factMatch = lower.match(/\b([a-z0-9']+)\s+(?:poytaxti|prezidenti|tarixi)/i);
      if (factMatch && factMatch[1]) {
        topic = factMatch[1].trim();
      }
    }
    analysis.topic = topic;
  }
}

module.exports = {
  TASK_TYPES,
  TaskUnderstandingEngine,
  taskUnderstanding: new TaskUnderstandingEngine(),
};
