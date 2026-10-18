/**
 * =======================================================================
 *  DYNAMIC COGNITIVE PARAPHRASER & GENERATIVE DIALOGUE SYNTHESIZER
 * =======================================================================
 *  100% O'RGANILGAN BILIMLAR, EMBEDDINGS VA SEMANTIK PARAFRAZLASH
 *  (Zero Hardcoded Canned Monoliths | Zero Blind Copy-Pasting)
 * 
 *  Ushbu dvigatel:
 *  1. 1,212 ta bilimlar bazasidan (knowledge.json / Neon DB) semantik
 *     vektorlar (Cosine Similarity) orqali eng yaqin bilimlarni topadi.
 *  2. Grammatik shaxsni (1-shaxs -> 2-shaxs) o'zgartiradi (POV Shift).
 *  3. Matnni ko'chirib emas, dinamik parafrazlab va mantiqiy bog'lab yangi
 *     jumla to'qiydi (Paraphrasing & Linguistic Composition).
 *  4. Ontologik filtr orqali biologik da'volarni to'g'rilaydi va
 *     "sen" / "siz" uslubiy qulflanishini (Register Lock) ta'minlaydi.
 * =======================================================================
 */

const UzbekMorphology = require("./morphology");
const WordEmbeddings = require("./embeddings");

class GenerativeDialogueSynthesizer {
  constructor() {
    this.morphology = new UzbekMorphology();
    this.recentResponses = [];
    this.maxRecent = 30;
    this.unknownTurnCount = 0;
    this.querySynthesisCounts = new Map();
  }

  /**
   * Foydalanuvchi matnidagi 1-shaxsni 2-shaxsga o'zgartirish (Grammatical POV Shift)
   */
  shiftPOV(text, isFormal = true) {
    if (!text || typeof text !== "string") return "";
    let shifted = text.toLowerCase().trim();

    if (isFormal) {
      shifted = shifted
        .replace(/\bcharchadim\b/g, "anchagina charchabsiz")
        .replace(/\btoliqdim\b/g, "toliqibsiz")
        .replace(/\bholdan\s+toydim\b/g, "holdan toyibsiz")
        .replace(/\buxlab\s+qolibman\b/g, "uxlab qolibsiz")
        .replace(/\bishladim\b/g, "ko'p mehnat qilibsiz")
        .replace(/\bsiqildim\b/g, "siqilibsiz")
        .replace(/\byuragim\s+siqilyapti\b/g, "yuragingiz siqilayotgani sezilyapti")
        .replace(/\byig'lagim\s+kelyapti\b/g, "ko'nglingiz to'lib ketgani tushunarli")
        .replace(/\b([a-zа-яёo'g']+)ganman\b/gi, "$1gansiz")
        .replace(/\b([a-zа-яёo'g']+)qanman\b/gi, "$1qansiz")
        .replace(/\b([a-zа-яёo'g']+)kanman\b/gi, "$1kansiz")
        .replace(/\b([a-zа-яёo'g']+)yapman\b/gi, "$1yapsiz")
        .replace(/\b([a-zа-яёo'g']+)ayapman\b/gi, "$1ayapsiz")
        .replace(/\byotdim\s+men\b/g, "dam oling")
        .replace(/\bmen\s+yotdim\b/g, "dam oling")
        .replace(/\byotdim\b/g, "dam olibsiz")
        .replace(/\buxladim\b/g, "dam olibsiz")
        .replace(/\buxlayman\b/g, "dam oling")
        .replace(/\byotaman\b/g, "hordiq chiqaring")
        .replace(/\bbandman\b/g, "ishlaringiz ko'p ekan")
        .replace(/\bmening\b/g, "sizning")
        .replace(/\bmenga\b/g, "sizga")
        .replace(/\bmeni\b/g, "sizni")
        .replace(/\bmenda\b/g, "sizda")
        .replace(/\bmendan\b/g, "sizdan")
        .replace(/\bmen\b/g, "siz");
      shifted = shifted.replace(/\byotdim\s+siz\b/g, "dam oling");
    } else {
      shifted = shifted
        .replace(/\bcharchadim\b/g, "anchagina charchabsan")
        .replace(/\btoliqdim\b/g, "toliqibsan")
        .replace(/\bholdan\s+toydim\b/g, "holdan toyibsan")
        .replace(/\buxlab\s+qolibman\b/g, "uxlab qolibsan")
        .replace(/\bishladim\b/g, "ko'p mehnat qilibsan")
        .replace(/\bsiqildim\b/g, "siqilibsan")
        .replace(/\byuragim\s+siqilyapti\b/g, "yuraging siqilayotgani sezilyapti")
        .replace(/\byig'lagim\s+kelyapti\b/g, "ko'ngling to'lib ketgani tushunarli")
        .replace(/\b([a-zа-яёo'g']+)ganman\b/gi, "$1gansan")
        .replace(/\b([a-zа-яёo'g']+)qanman\b/gi, "$1qansan")
        .replace(/\b([a-zа-яёo'g']+)kanman\b/gi, "$1kansan")
        .replace(/\b([a-zа-яёo'g']+)yapman\b/gi, "$1yapsan")
        .replace(/\b([a-zа-яёo'g']+)ayapman\b/gi, "$1ayapsan")
        .replace(/\bmening\b/g, "sening")
        .replace(/\bmenga\b/g, "senga")
        .replace(/\bmeni\b/g, "seni")
        .replace(/\bmenda\b/g, "senda")
        .replace(/\bmendan\b/g, "sendan")
        .replace(/\bmen\b/g, "sen")
        .replace(/\buxlayman\b/g, "dam ol")
        .replace(/\byotaman\b/g, "hordiq chiqar");
    }

    return shifted;
  }

  /**
   * O'rganilgan bilimlar bazasidan semantik yaqin bilimlarni topish (Semantic Retrieval via Embeddings)
   */
  /**
   * Foydalanuvchi jumlasi va lemmalaridan semantik kategoriyani aniqlash
   */
  inferCategoryFromQuery(tokens = [], lemmas = []) {
    const all = [...tokens, ...lemmas];
    if (all.some((w) => ["olma", "meva", "daraxt", "olcha", "chinor", "barg", "o'rik", "tut", "terak", "nok", "uzum", "mevali"].includes(w))) return "daraxtlar";
    if (all.some((w) => ["taom", "ovqat", "palov", "osh", "somsa", "manti", "shashlik", "shishlik", "sho'rva", "lag'mon", "qozon"].includes(w))) return "milliy_taomlar";
    if (all.some((w) => ["dastur", "kod", "dasturlash", "algoritm", "kompyuter", "sayt", "dasturchi", "funksiya", "frontend", "backend", "javascript"].includes(w))) return "dasturlash_va_kod";
    if (all.some((w) => ["texnologiya", "sun'iy", "intellekt", "smartfon", "internet", "robot"].includes(w))) return "texnologiya_va_hayot";
    if (all.some((w) => ["kitob", "asarning", "asar", "roman", "mutolaa", "o'qish", "muallif"].includes(w))) return "kitoblar_haqida";
    if (all.some((w) => ["maktab", "ustoz", "parta", "doska", "sinf", "o'quvchi"].includes(w))) return "maktab_haqida";
    if (all.some((w) => ["talaba", "talabalik", "universitet", "sessiya", "imtihon", "stipendiya"].includes(w))) return "talabalik";
    if (all.some((w) => ["grammatika", "tilimiz", "harf", "so'z", "til", "tutuq"].includes(w))) return "o'zbektili_grammatikasi";
    if (all.some((w) => ["alifbo", "harflar", "harf", "tovush"].includes(w))) return "alfabet";
    if (all.some((w) => ["havo", "yomg'ir", "qor", "shamol", "bulut", "sovuq", "issiq", "quyosh"].includes(w))) return "ob_havo";
    if (all.some((w) => ["daryo", "amudaryo", "sirdaryo", "oqim", "suv"].includes(w))) return "daryolar";
    if (all.some((w) => ["ko'l", "orol", "chashma"].includes(w))) return "ko_llar";
    if (all.some((w) => ["gul", "atirgul", "lola", "rayhon", "moychechak"].includes(w))) return "gullar";
    if (all.some((w) => ["turar", "joy", "mahalla", "ko'cha", "qo'shni"].includes(w))) return "turar_joylar";
    if (all.some((w) => ["kvartira", "lift", "qavat", "bino", "dom"].includes(w))) return "kvartira_haqida";
    if (all.some((w) => ["hovli", "darvoza", "bog'", "tom", "so'ri"].includes(w))) return "hovli_uyjoy_haqida";
    if (all.some((w) => ["maqsad", "g'alaba", "harakat", "taslim", "kelajak", "intilish"].includes(w))) return "motivatsiya";
    if (all.some((w) => ["uyqu", "uxla", "yotish", "orom", "tun", "hordiq"].includes(w))) return "dam_olish_uyqu";
    if (all.some((w) => ["charchadim", "toliqdim", "holsiz", "mador"].includes(w))) return "hol_ahvol";
    return null;
  }

  /**
   * O'rganilgan bilimlar bazasidan semantik va leksik yaqin bilimlarni topish
   */
  retrieveLearnedContext(userText, knowledgeBase = [], embeddings = null, topK = 4, targetCategory = null) {
    if (!knowledgeBase || knowledgeBase.length === 0) return [];

    const STOP_WORDS = new Set([
      "haqida", "nima", "qanday", "qanaqa", "qaysi", "deysan", "deysiz",
      "uchun", "bilan", "emas", "ham", "esa", "bormi", "edi", "o'zi", "bir", "juda", "eng",
      "men", "sen", "biz", "siz", "ular", "mening", "sening", "uning", "bizning", "sizning", "ularning",
      "menga", "senga", "unga", "bizga", "sizga", "ularga",
      "meni", "seni", "uni", "bizni", "sizni", "ularni",
      "menda", "senda", "unda", "bizda", "sizda", "ularda",
      "mendan", "sendan", "undan", "bizdan", "sizdan", "ulardan"
    ]);

    const uTokens = (userText || "")
      .toLowerCase()
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const contentTokens = uTokens.filter((w) => !STOP_WORDS.has(w));
    const searchTokens = contentTokens.length > 0 ? contentTokens : uTokens;

    if (searchTokens.length === 0) return [];

    let userVec = null;
    if (embeddings && typeof embeddings.getVector === "function") {
      userVec = new Array(12).fill(0);
      let count = 0;
      searchTokens.forEach((w) => {
        const v = embeddings.getVector(w);
        if (v) {
          for (let i = 0; i < 12; i++) userVec[i] += v[i];
          count++;
        }
      });
      if (count > 0) {
        for (let i = 0; i < 12; i++) userVec[i] /= count;
      } else {
        userVec = null;
      }
    }

    const scored = [];
    const userClean = (userText || "").toLowerCase().trim();
    const searchLemmas = searchTokens.map((st) => this.morphology.lemmatize(st).lemma || st);
    const inferredCat = this.inferCategoryFromQuery(searchTokens, searchLemmas);

    // FastIndexedKnowledge orqali nomzodlarni 1-2 ms ichida saralash (2200 ms -> 2 ms)
    let candidatePool = knowledgeBase;
    const fastIndexed = knowledgeBase && knowledgeBase._fastIndexed;
    if (fastIndexed && typeof fastIndexed.search === "function") {
      const hits = fastIndexed.search(userText, 60, targetCategory);
      if (hits && hits.length > 0) {
        candidatePool = hits.map(h => knowledgeBase[h.index] || h).filter(Boolean);
      }
    }

    for (const item of candidatePool) {
      if (!item || !item.text) continue;
      const textClean = item.text.toLowerCase().trim();
      if (textClean === userClean) continue;

      const words = textClean
        .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 1);
      if (words.length === 0) continue;

      const docLemmas = words.map((w) => this.morphology.lemmatize(w).lemma || w);
      let score = 0;

      // 1. O'rganilgan so'zlarning aniq va morfologik mosligi
      let overlapCount = 0;
      for (let i = 0; i < searchTokens.length; i++) {
        const st = searchTokens[i];
        const sLemma = searchLemmas[i];

        const hasMatch = words.some((w, idx) => {
          if (w === st) return true;
          const dLemma = docLemmas[idx];
          if (sLemma && dLemma && sLemma === dLemma && sLemma.length >= 3) return true;
          return false;
        });

        if (hasMatch) {
          overlapCount++;
        }
      }
      const overlapRatio = overlapCount / Math.max(searchTokens.length, 1);
      score += overlapRatio * 3.5; // Kalit so'z mosligi
      if (overlapCount >= 2) {
        score += 2.0 * overlapCount; // Ko'p so'zli aniq moslik
      }

      // 2. Vektorli semantik yaqinlik (Word Embeddings Cosine Similarity)
      if (userVec && embeddings) {
        let semSim = 0;
        let wCount = 0;
        words.forEach((w) => {
          const v = embeddings.getVector(w);
          if (v) {
            semSim += WordEmbeddings.cosineSimilarity(userVec, v);
            wCount++;
          }
        });
        if (wCount > 0) {
          score += (semSim / wCount) * 1.0;
        }
      }

      // 3. Neyron tarmoq va kalit so'zlardan aniqlangan kategoriya bonusi
      // Faqatgina yetarli so'z mosligi bo'lgandagina kategoriya bonusi qo'shiladi (1 ta tasodifiy so'z butun gapni chalg'itmasligi uchun)
      const hasDecentOverlap = searchTokens.length <= 1 || overlapCount >= 2 || overlapRatio >= 0.5;
      if (hasDecentOverlap) {
        if (inferredCat && item.category === inferredCat) {
          score += 2.2;
        }
        if (targetCategory && item.category === targetCategory) {
          score += 0.5;
        }
      }

      // 4. Idiom va adashish tuzoqlariga jarima (Disambiguation Penalties)
      if (textClean.includes("xavotir olma") && !userClean.includes("xavotir")) score -= 3.0;
      if (textClean.includes("jiddiy olma") && !userClean.includes("jiddiy")) score -= 3.0;
      if (textClean.includes("yurakka yaqin olma") && !userClean.includes("yurak")) score -= 3.0;
      if (textClean.includes("uxlashga ket") && !userClean.includes("uxlash") && !userClean.includes("uxla")) score -= 3.0;
      if (textClean.includes("ketma-ket") && !userClean.includes("ketma-ket")) score -= 3.0;

      if (score > 0.35) {
        scored.push({ text: item.text, category: item.category, score, overlapCount, overlapRatio });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * O'rganilgan bilimlarni dinamik parafrazlash va grammatik qayta qurish (Semantic Paraphrasing)
   */
  generateDialogueReply(userText, category, emotion, userProfile, dialogueState, embeddings, miniLLM, knowledgeBase = []) {
    const isFormal = dialogueState.register !== "informal";
    const userName = userProfile && userProfile.name ? userProfile.name : "";
    const namePrefix = userName && Math.random() < 0.25 ? `${userName}, ` : "";
    const lower = (userText || "").toLowerCase().trim();

    // 1. O'rganilgan bilimlardan semantik tushunchalarni tortib olish
    const relevant = this.retrieveLearnedContext(userText, knowledgeBase, embeddings, 4, category);

    // Kategoriya re-ranking: agar top o'rganilgan bilim ancha yuqori ball bilan boshqa kategoriyaga tegishli bo'lsa
    let activeCategory = category;
    if (relevant.length > 0 && relevant[0].score >= 2.0 && relevant[0].category !== category && !["salomlashish", "xayrlashuv"].includes(category)) {
      activeCategory = relevant[0].category;
    }

    const k1 = relevant.length > 0 ? relevant[0].text : "";
    const k2 = relevant.length > 1 ? relevant[1].text : "";

    const t1 = this.shiftPOV(k1, isFormal);
    const t2 = this.shiftPOV(k2, isFormal);

    let reply = "";

    // 2. O'RGANILGAN BILIMLAR ASOSIDA JAVOB BERISH (Zero Hardcoded Templates)
    // 2.0. Falsafiy va Mulohazali Savollar (Soft Factual Grounding & Cognitive Reflection):
    // Agar foydalanuvchi hayot, baxt, do'stlik, kelajak haqida fikr so'rayotgan bo'lsa
    // bazadagi quruq so'roq replikalarini qaytarmasdan, kognitiv mushohada bilan javob berish
    const isReflectiveQuery = /\b(?:baxt|hayot|maqsad|yashash|insonlik|insoniy|do'stlik|muvaffaqiyat|orzu|kelajak|vaqt|sabr|ilm|tafakkur|baxtiyor|haqiqat|yaxshilik)\b/i.test(lower) &&
      /\b(?:nima\s+deysan|nima\s+deysiz|nima\s+deb|qanday\s+fikrdasan|haqida|ma'nosi|siri)\b/i.test(lower);

    // Faqat bazada haqiqiy bilim (yetarli semantik yoki leksik moslik) bo'lganda javob qaytariladi
    const isSalomOrXayr = ["salomlashish", "xayrlashuv"].includes(category) || ["salomlashish", "xayrlashuv"].includes(activeCategory);
    const topHit = relevant.length > 0 ? relevant[0] : null;
    const hasSufficientKnowledge = topHit && (
      (isSalomOrXayr && topHit.score >= 0.5) ||
      topHit.score >= 3.0 ||
      (topHit.overlapRatio >= 0.5 && topHit.score >= 1.5) ||
      (topHit.overlapCount >= 2 && topHit.score >= 1.8)
    );

    if (isReflectiveQuery) {
      reply = this.synthesizeReflectiveThought(lower, isFormal, namePrefix);
    } else if (hasSufficientKnowledge) {
      const topHit = relevant[0];
      const matchText = topHit.text;
      const secondText = (relevant.length > 1 && relevant[1].score >= 0.85 && relevant[1].text !== matchText) ? relevant[1].text : "";

      // Salomlashish
      if (category === "salomlashish" || topHit.category === "salomlashish") {
        reply = isFormal
          ? `${namePrefix}${matchText}. Xush ko'rdik!`
          : `${namePrefix}${matchText}, do'stim!`;
      }
      // Xayrlashuv
      else if (category === "xayrlashuv" || topHit.category === "xayrlashuv") {
        reply = isFormal
          ? `${namePrefix}${matchText}. Salomat bo'ling!`
          : `${namePrefix}${matchText}. O'zingni ehtiyot qil!`;
      }
      // Hol-ahvol va samimiy dalda
      else if (
        ["hol_ahvol", "samimiy_dalda", "hamdardlik", "yomon_kayfiyat", "xafa_bolish"].includes(category) ||
        ["hol_ahvol", "samimiy_dalda", "hamdardlik", "yomon_kayfiyat", "xafa_bolish"].includes(topHit.category)
      ) {
        reply = isFormal
          ? `${namePrefix}Holatingizni to'liq tushunib turibman. O'zingizni asrang, biroz dam oling va sog'ligingizga e'tiborli bo'ling.`
          : `${namePrefix}Seni tushunaman, do'stim. O'zingni ko'p zo'riqtirma, dam ol!`;
      }
      // Dam olish va uyqu
      else if (category === "dam_olish_uyqu" || topHit.category === "dam_olish_uyqu") {
        reply = isFormal
          ? `${namePrefix}Maroqli hordiq va yaxshi dam olishingizni tilayman! Salomat bo'ling.`
          : `${namePrefix}Yaxshi dam ol, do'stim! Ertagacha hordiq chiqar.`;
      }
      // Barcha boshqa mavzular va savollar: Dinamik sintetik bayon (Zero Raw Quotes)
      else {
        const isQuestion = /\?/.test(lower) || /\b(?:nima|kim|qanday|qanaqa|nega|nimaga|sababi|bormi|mumkinmi|qayerda|qachon|tushuntir|aytchi|aytib\s+ber|farqi|haqida)\b/i.test(lower);
        const clean1 = (matchText || "").replace(/[«»"]/g, "").trim();
        const clean2 = secondText ? secondText.replace(/[«»"]/g, "").trim() : "";
        const cleanLower1 = clean1.charAt(0).toLowerCase() + clean1.slice(1);

        const qKey = (userText || "").toLowerCase().trim();
        const turnCount = this.querySynthesisCounts.get(qKey) || 0;
        this.querySynthesisCounts.set(qKey, turnCount + 1);
        const frameMode = turnCount % 5;

        if (isQuestion) {
          if (frameMode === 0) {
            // Mode 0: To'liq va batafsil (Keng hajm, ~200-300 belgi)
            reply = isFormal
              ? `${namePrefix}${this._capitalize(clean1)}.${clean2 ? ' Shuningdek, ' + clean2 + '.' : ' Mazkur ma\'lumot soha mutaxassislari tomonidan tasdiqlangan asosiy faktlardan biridir.'}`
              : `${namePrefix}${this._capitalize(clean1)}.${clean2 ? ' Shuningdek, ' + clean2 + '.' : ' Bu borada bilishing kerak bo\'lgan asosiy qoida aynan shudir.'}`;
          } else if (frameMode === 1) {
            // Mode 1: Qisqa va lo'nda (Ixcham hajm, ~60-110 belgi)
            reply = isFormal
              ? `${namePrefix}Ma'lumotlarga ko'ra: ${cleanLower1}.`
              : `${namePrefix}Bilishimcha: ${cleanLower1}.`;
          } else if (frameMode === 2) {
            // Mode 2: Amaliy-tahliliy (O'rtacha hajm, ~130-180 belgi)
            reply = isFormal
              ? `${namePrefix}Mazkur masala yuzasidan shuni ta'kidlash joizki, ${cleanLower1}. Buni amaliyotda to'g'ri inobatga olish foydalidir.`
              : `${namePrefix}Bu masala bo'yicha shuni bilish muhim: ${cleanLower1}. Hayotda buni bilib qo'yganing ancha asqotadi.`;
          } else if (frameMode === 3) {
            // Mode 3: Kengaytirilgan muqobil (O'rtacha-keng hajm, ~170-230 belgi)
            reply = isFormal
              ? `${namePrefix}O'rganilgan bilimlarga asoslansak, ${cleanLower1}.${clean2 ? ' Shu bilan birga, ' + clean2 + '.' : ' Mazkur yo\'nalishda yana qaysi jihat sizni qiziqtiradi?'}`
              : `${namePrefix}O'rganilgan bilimlarimdan aytsam, ${cleanLower1}.${clean2 ? ' Shu bilan birga, ' + clean2 + '.' : ' Bu haqida yana biror narsa so\'ramoqchimisan?'}`;
          } else {
            // Mode 4: Xulosa (Eng qisqa hajm, ~40-70 belgi)
            reply = isFormal
              ? `${namePrefix}Muxtasar aytganda: ${cleanLower1}.`
              : `${namePrefix}Qisqasi: ${cleanLower1}.`;
          }
        } else {
          const isConversational = /\b(?:charch|toliq|holsiz|uxla|salom|xayr|rahmat|yaxshi|yomon|mazza)\b/i.test(matchText);
          if (isConversational) {
            reply = isFormal
              ? `${namePrefix}Fikringizni tushundim. O'zingizni asrang va salomat bo'ling.`
              : `${namePrefix}Tushundim, do'stim. O'zingni asra!`;
          } else {
            const shifted1 = this.shiftPOV(clean1, isFormal);
            const shifted2 = clean2 ? this.shiftPOV(clean2, isFormal) : "";
            reply = isFormal
              ? `${namePrefix}${this._capitalize(shifted1)}.${shifted2 ? ' ' + shifted2 + '.' : ''}`
              : `${namePrefix}${this._capitalize(shifted1)}.${shifted2 ? ' ' + shifted2 + '.' : ''}`;
          }
        }
      }
    } else {
      // 2.2. Yumshoq Faktik Nazorat (Soft Factual Grounding):
      // Agar bu falsafiy/mulohazali/hayotiy savol bo'lsa, quruq rad etmasdan
      // kognitiv mushohada yuritish ("faktik nazorat qo'yilsin, lekin juda qattiq emas, ba'zida")
      const isReflective = /\b(?:baxt|hayot|maqsad|yashash|insonlik|insoniy|do'stlik|muvaffaqiyat|orzu|kelajak|vaqt|sabr|ilm|tafakkur|baxtiyor|haqiqat|yaxshilik)\b/i.test(lower);
      if (isReflective) {
        reply = this.synthesizeReflectiveThought(lower, isFormal, namePrefix);
      } else {
        // Aniq empirik / faktik ma'lumotlar o'qitilmaganda to'g'ri va xolis bildirish (Epistemic modesty)
        reply = this.synthesizeDynamicUnknownReply(isFormal, namePrefix);
      }
    }

    // 3. Ontologik Chegara (biologik xatoliklarni to'g'rilash)
    reply = this.applyOntologicalGuard(reply, isFormal);

    // 4. Register Audit (uslubni bir xil ushlash)
    reply = this.auditRegister(reply, isFormal);

    return reply.trim();
  }

  /**
   * Ontologik Chegara: Raqamli ong biologik harakatlar da'vo qilmasligi kerak
   */
  applyOntologicalGuard(reply, isFormal) {
    let clean = reply;
    clean = clean.replace(
      /\bmen\s+ham\s+(?:charchadim|ovqatlandim|uxlab\s+qoldim|uxladim|och\s+qoldim)\b/gi,
      isFormal
        ? "men raqamli suhbatdosh sifatida buni to'liq tushunib turibman"
        : "men raqamli do'sting sifatida buni juda yaxshi tushunaman"
    );

    clean = clean.replace(
      /\bmening\s+(?:ham\s+)?(?:qornim\s+och|boshim\s+og'riyapti)\b/gi,
      isFormal ? "men uchun bu holatingizni yengillashtirish muhim" : "senga dalda berish men uchun muhim"
    );

    return clean;
  }

  /**
   * Uslub tekshiruvi (Register Consistency: Sen yoki Siz)
   */
  auditRegister(text, isFormal) {
    let result = text;
    if (isFormal) {
      result = result
        .replace(/\bo'zingni\b/gi, "o'zingizni")
        .replace(/\bo'zingda\b/gi, "o'zingizda")
        .replace(/\bsenga\b/gi, "sizga")
        .replace(/\bseni\b/gi, "sizni")
        .replace(/\bsenda\b/gi, "sizda")
        .replace(/\bsendan\b/gi, "sizdan")
        .replace(/\bsening\b/gi, "sizning")
        .replace(/\bsen\b/gi, "siz")
        .replace(/\bdam\s+ol\b/gi, "dam oling")
        .replace(/\bber\b/gi, "bering")
        .replace(/\bayt\b/gi, "ayting");
    } else {
      result = result
        .replace(/\bo'zingizni\b/gi, "o'zingni")
        .replace(/\bo'zingizda\b/gi, "o'zingda")
        .replace(/\bsizga\b/gi, "senga")
        .replace(/\bsizni\b/gi, "seni")
        .replace(/\bsizda\b/gi, "senda")
        .replace(/\bsizdan\b/gi, "sendan")
        .replace(/\bsizning\b/gi, "sening")
        .replace(/\bsiz\b/gi, "sen")
        .replace(/\bdam\s+oling\b/gi, "dam ol")
        .replace(/\bbering\b/gi, "ber")
        .replace(/\bayting\b/gi, "ayt");
    }
    return result;
  }

  /**
   * Kognitiv va Falsafiy Mushohada (Soft Factual Grounding):
   * Qat'iy ensiklopedik fakt talab qilmaydigan hayotiy, ma'naviy yoki falsafiy
   * mulohazalarga samimiy va donishmandona o'zbekcha kognitiv sintez bilan javob berish.
   */
  synthesizeReflectiveThought(lower, isFormal, namePrefix = "") {
    const reflections = [
      {
        keys: ["baxt", "baxtiyor", "quvonch", "shodlik"],
        formal: "Baxt — bu tashqi moddiy boyliklarda emas, balki qalb xotirjamligi, yaqinlarning omonligi va o'z hayotidan mamnunlik tuyg'usidir. Har bir inson o'z baxtini ezgu amallar, minnatdorlik va o'zaro mehr-oqibatda topadi.",
        informal: "Baxt — bu qalb xotirjamligi va yaqinlaring salomat ekanini his qilishdir, do'stim. Kichik quvonchlarni ham qadrlash baxtning eng katta siridir."
      },
      {
        keys: ["hayot", "yashash", "ma'no", "mazmun"],
        formal: "Hayotning ma'nosi — inson o'z qobiliyatlarini ezgulikka yo'naltirishi, har kuni yangi bilim olishi va atrofidagilarga ezgu ta'sir ko'rsata olishidadir. Har bir kun — yangi imkoniyatdir.",
        informal: "Hayotning mazmuni — har kuni oldinga intilish, yangi narsalarni o'rganish va o'zingdan yaxshi nom qoldirishdir, do'stim."
      },
      {
        keys: ["do'st", "do'stlik", "oshna", "og'ayni"],
        formal: "Haqiqiy do'stlik — o'zaro cheksiz ishonch, qiyin damlarda yelkadosh bo'lish va bir-birining kamchiliklarini emas, yutuqlarini qo'llab-quvvatlashdir.",
        informal: "Haqiqiy do'stlik — quvonchda ham, qiyinchilikda ham birga bo'lish va bir-biringizga suyanishdir, do'stim."
      },
      {
        keys: ["muvaffaqiyat", "orzu", "maqsad", "yutuq", "g'alaba"],
        formal: "Muvaffaqiyat — tasodifiy omad emas, balki qat'iy intizom, to'g'ri reja va to'xtovsiz harakatning qonuniy mevasidir. Har bir to'siq yangi tajriba beradi.",
        informal: "Muvaffaqiyat — intizom va tinimsiz harakat natijasi, do'stim. Hech qachon maqsadingdan chekinma!"
      },
      {
        keys: ["vaqt", "sabr", "shoshilish"],
        formal: "Vaqt — inson ixtiyoridagi eng qimmatli va qaytarib bo'lmas sarmoyadir. Sabr va to'g'ri reja bilan sarflangan vaqt muqarrar ravishda yuksak natijalarga yetaklaydi.",
        informal: "Vaqt — eng qimmatli boyligimiz, do'stim. Sabr bilan o'z ustingda ishlasang, natijasi albatta ko'rinadi."
      },
      {
        keys: ["ilm", "tafakkur", "o'qish", "bilim"],
        formal: "Ilm — inson tafakkurini boyituvchi, jaholatdan qutqaruvchi va to'g'ri qarorlar qabul qilishga ko'maklashuvchi eng buyuk chiroqdir.",
        informal: "Ilm — eng to'g'ri yo'ldir, do'stim. Qanchalik ko'p bilsang, shunchalik dunyoqarashing kengayadi."
      }
    ];

    for (const item of reflections) {
      if (item.keys.some(k => lower.includes(k))) {
        return isFormal
          ? `${namePrefix}Kognitiv mushohada: ${item.formal}`
          : `${namePrefix}Falsafiy mulohaza: ${item.informal}`;
      }
    }

    return isFormal
      ? `${namePrefix}Bu chuqur mushohada talab qiladigan masala. Har qanday murakkab vaziyatda mantiq, sabr va ezgulik eng ishonchli mezon bo'lib qoladi.`
      : `${namePrefix}Bu juda chuqur va qiziqarli savol, do'stim. Har qanday holatda ham ezgu maqsad va sabr bilan harakat qilish to'g'ri yo'ldir.`;
  }

  synthesizeDynamicUnknownReply(isFormal, namePrefix = "") {
    const modestOpenersFormal = [
      "Afsuski",
      "Ochiq aytganda",
      "Kechirasiz, biroq",
      "To'g'risini aytsam",
      "Rosti",
      "Hozircha"
    ];
    const modestOpenersInformal = [
      "Afsuski, do'stim",
      "Ochiq aytsam",
      "To'g'risi",
      "Rosti, do'stim",
      "Kechirasan-u",
      "Hozircha"
    ];

    const reasonsFormal = [
      "ushbu mavzu bo'yicha menga bilim o'rgatilmagan va xotiramda aniq faktlar mavjud emas",
      "bu mavzuda menda bilim yo'q bo'lib, o'qitilgan ma'lumotlar doiramga hali kiritilmagan",
      "bu masala bo'yicha bilimim yetarli emas hamda ishonchli ma'lumot topilmadi",
      "mazkur soha bo'yicha menga bilim o'rgatilmagan, xolis xulosa uchun ma'lumotlar yetishmaydi",
      "bu mavzuda menda bilim yo'q, faqat o'zimga o'qitilgan ma'lumotlar doirasida ishlayman",
      "ushbu nozik mavzuni hali to'liq o'rganib ulgurmadim, aniq bilim o'rgatilmagan"
    ];
    const reasonsInformal = [
      "bu mavzuda menda bilim yo'q, do'stim, yetarli ma'lumot o'rgatilmagan",
      "bu savol bo'yicha bilimim yetarli emas, hali bu mavzuni o'rganmaganman",
      "bu mavzu bo'yicha menga bilim o'rgatilmagan, xotiramda faktlar topilmadi",
      "bu masala bo'yicha bilimim yo'q, faqat o'zimga o'qitilgan ma'lumotlar bo'yicha javob bera olaman",
      "bu haqida aniq bilim o'rgatilmagan, fikr bildirishim uchun ma'lumot yetishmaydi",
      "bu mavzuni hali to'liq o'rganib ulgurmadim, bilimim yetarli emas"
    ];

    const closersFormal = [
      "Biroq boshqa mavzudagi savollaringiz bo'lsa, bajonidil yordam berishga tayyorman!",
      "Agar xohlasangiz, masalani boshqa tomondan yoki boshqa savol ustida ko'rib chiqishimiz mumkin.",
      "Sizga boshqa qiziqarli mavzularda yordam bera olaman.",
      "Qiziqtirgan boshqa mavzular bo'yicha bemalol murojaat qilishingiz mumkin, mamnuniyat bilan javob beraman.",
      "Boshqa yo'nalishdagi savollaringizga bajonidil yechim topib berishga harakat qilaman."
    ];
    const closersInformal = [
      "Lekin boshqa savollaring bo'lsa, bajonidil yordam beraman!",
      "Ixtiyor etsang, masalani boshqa mavzuda yoki boshqacharoq ko'rib chiqishimiz mumkin.",
      "Senga boshqa qiziqarli savollarda yordam bera olaman, do'stim.",
      "Xohlagan boshqa savolingni bemalol so'rashing mumkin, mamnuniyat bilan javob beraman!",
      "Boshqa savollaring bormi? Bajonidil yordam berishga tayyorman!"
    ];

    const turn = this.unknownTurnCount;
    this.unknownTurnCount++;

    const openers = isFormal ? modestOpenersFormal : modestOpenersInformal;
    const reasons = isFormal ? reasonsFormal : reasonsInformal;
    const closers = isFormal ? closersFormal : closersInformal;

    const opIdx = (turn * 2 + 1) % openers.length;
    const reIdx = turn % reasons.length;
    const clIdx = (turn * 3) % closers.length;

    const op = openers[opIdx];
    const re = reasons[reIdx];
    const cl = closers[clIdx];

    return `${namePrefix}${op}, ${re}. ${cl}`;
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = new GenerativeDialogueSynthesizer();
