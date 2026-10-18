"use strict";

/**
 * =======================================================================
 *  UZBEK TEXT NORMALIZER & ORTHOGRAPHY UNIFICATION ENGINE
 * =======================================================================
 *  Bosqich 3: O'zbek tili grafemasi, apostroflari, so'zlashuv qisqartmalari
 *  va fonetik variantlarini yagona standartga keltirish qatlami.
 *
 *  Xususiyatlari:
 *  1. Apostroflar va tutuq belgilari unifikatsiyasi:
 *     [' , ‘ , ’ , ` , ʼ , ʻ , ´ , ‛] -> "'"
 *  2. O'zbek harf birikmalari: o', g', sh, ch, ng
 *  3. Kirill-Lotin unifikatsiyasi va fonetik xatolar (x/h, j/zh)
 *  4. So'zlashuv uslubi, SMS qisqartmalar va dialektizmlar xaritasi
 *  5. Tinish belgilari va ortiqcha bo'shliqlarni tozalash
 * =======================================================================
 */

// So'zlashuv uslubi, qisqartmalar va dialektik so'zlar lug'ati
const COLLOQUIAL_MAP = new Map([
  // Qayerda / Qayerga
  ["qatta", "qayerda"],
  ["qattada", "qayerda"],
  ["qattasan", "qayerdasan"],
  ["qattasiz", "qayerdasiz"],
  ["qattaga", "qayerga"],
  ["qayoqqa", "qayerga"],
  ["qayoqda", "qayerda"],
  ["qattan", "qayerdan"],
  ["qattansan", "qayerdansan"],
  ["qattansiz", "qayerdansiz"],

  // Nima / Nimaga
  ["nma", "nima"],
  ["nme", "nima"],
  ["nime", "nima"],
  ["nmaga", "nimaga"],
  ["nemaga", "nimaga"],
  ["nmadur", "nimadir"],
  ["nmadir", "nimadir"],
  ["nimaqa", "qanday"],
  ["qanaqa", "qanday"],
  ["qanaqadir", "qandaydir"],
  ["qande", "qanday"],
  ["kere", "kerak"],
  ["keremi", "kerakmi"],
  ["kerek", "kerak"],

  // Fe'l qisqartmalari va lahjalar
  ["qilvosan", "qilyapsan"],
  ["qilvosz", "qilyapsiz"],
  ["qilvotti", "qilyapti"],
  ["qilvotgan", "qilayotgan"],
  ["qilvomman", "qilyapman"],
  ["yozvosan", "yozyapsan"],
  ["gapirvosan", "gapiryapsan"],
  ["kelvosan", "kelyapsan"],
  ["ketvosan", "ketyapsan"],
  ["borvosan", "boryapsan"],
  ["ovosam", "olyapman"],
  ["bervosan", "beryapsan"],
  ["tushunvosan", "tushunyapsan"],

  // Tasdiq, inkor va odob so'zlari
  ["bopti", "bo'pti"],
  ["bo'bti", "bo'pti"],
  ["obti", "bo'pti"],
  ["kettu", "ketdik"],
  ["ketu", "ketdik"],
  ["gapyo", "gap yo'q"],
  ["gapyoq", "gap yo'q"],
  ["gap yo", "gap yo'q"],
  ["xop", "xo'p"],
  ["hop", "xo'p"],
  ["maylida", "mayli"],
  ["mayl", "mayli"],

  // Bog'lovchilar va qisqartmalar
  ["blan", "bilan"],
  ["b-n", "bilan"],
  ["bn", "bilan"],
  ["kn", "keyin"],
  ["keyn", "keyin"],
  ["keyingi", "keyingi"],
  ["uchun", "uchun"],
  ["chun", "uchun"],
  ["uchn", "uchun"],
  ["masalan", "masalan"],
  ["msl", "masalan"],
  ["xullas", "xullas"],
  ["xlsa", "xullas"],
  ["prosta", "shunchaki"],
  ["shunchak", "shunchaki"],

  // Salomlashish va minnatdorchilik
  ["salomalevaleykum", "assalomu alaykum"],
  ["salomaleykum", "assalomu alaykum"],
  ["assalomualaykum", "assalomu alaykum"],
  ["assalom", "assalomu alaykum"],
  ["salam", "salom"],
  ["slm", "salom"],
  ["privet", "salom"],
  ["raxmat", "rahmat"],
  ["rahmatiz", "rahmat"],
  ["spasibo", "rahmat"],
  ["tashakkur", "rahmat"],

  // Yordam / Maslahat birikmalari
  ["yordamber", "yordam ber"],
  ["yordamvor", "yordam bering"],
  ["aytber", "aytib ber"],
  ["aytvoring", "aytib bering"],
  ["tushuntirvor", "tushuntirib ber"],
  ["korsatvor", "ko'rsatib ber"],
  ["maslahatber", "maslahat ber"],
  ["maslahatvor", "maslahat bering"],

  // Hissiy va holat so'zlari
  ["hursand", "xursand"],
  ["hursandman", "xursandman"],
  ["xursanman", "xursandman"],
  ["hursanman", "xursandman"],
  ["xursan", "xursand"],
  ["charchadm", "charchadim"],
  ["charchadimku", "charchadim"],
  ["toliqmman", "toliqdim"],
  ["uxliman", "uxlayman"],
  ["uxlimiz", "uxlaymiz"],
]);

// Kirill harflarining o'zbek lotiniga fonetik muqobillari
const CYRILLIC_TO_LATIN_MAP = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
  "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "x", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "'",
  "ы": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  "ў": "o'", "ғ": "g'", "қ": "q", "ҳ": "h"
};

class UzbekNormalizer {
  constructor() {
    this.colloquialMap = COLLOQUIAL_MAP;
    this.cyrillicMap = CYRILLIC_TO_LATIN_MAP;
  }

  /**
   * 1. Apostrof va maxsus belgilarni unifikatsiya qilish
   * Har qanday tutuq belgisi yoki apostrofni "'" ga keltiradi.
   * @param {string} text
   * @returns {string}
   */
  normalizeApostrophes(text) {
    if (!text || typeof text !== "string") return "";

    return text
      // Barcha ko'rinishdagi apostroflarni (Unicode curly, accents, modifier) yagona "'" ga aylantirish
      .replace(/[\u02BB\u02BC\u2018\u2019\u201A\u201B\u0060\u00B4\u02EE\u2032\u2035]/g, "'")
      // Agar o yoki g dan keyin bo'shliq va apostrof bo'lsa: "o '" -> "o'"
      .replace(/\b([ogOG])\s+[']/g, "$1'")
      // Takroriy apostroflarni bittaga keltirish
      .replace(/[']{2,}/g, "'");
  }

  /**
   * 2. Kirillcha matnni lotinchaga transliteratsiya qilish (agar aralash yoki sof kirill bo'lsa)
   * @param {string} text
   * @returns {string}
   */
  transliterateCyrillic(text) {
    if (!text) return "";
    // Agar matnda kirill harflari bo'lsa
    if (!/[\u0400-\u04FF]/i.test(text)) return text;

    return text
      .split("")
      .map((char) => {
        const lower = char.toLowerCase();
        if (this.cyrillicMap[lower] !== undefined) {
          const lat = this.cyrillicMap[lower];
          // Agar asl harf katta bo'lsa
          return char === char.toUpperCase() && lat.length > 0
            ? lat.charAt(0).toUpperCase() + lat.slice(1)
            : lat;
        }
        return char;
      })
      .join("");
  }

  /**
   * 3. So'zlashuv qisqartmalari va keng tarqalgan imlo xatolarini to'g'rilash
   * @param {string} text
   * @returns {{ text: string, replaced: Array<{ from: string, to: string }> }}
   */
  normalizeColloquialAndSpelling(text) {
    if (!text) return { text: "", replaced: [] };

    const replaced = [];
    // Matnni tokenlarga bo'lish (tinish belgilarini saqlagan holda)
    const tokens = text.split(/(\s+|[.,!?;:()\[\]"'-])/);

    const normalizedTokens = tokens.map((token) => {
      const lower = token.toLowerCase();
      if (this.colloquialMap.has(lower)) {
        const target = this.colloquialMap.get(lower);
        replaced.push({ from: token, to: target });
        // Katta harf bilan boshlangan bo'lsa
        if (token[0] && token[0] === token[0].toUpperCase() && target.length > 0) {
          return target.charAt(0).toUpperCase() + target.slice(1);
        }
        return target;
      }
      return token;
    });

    return {
      text: normalizedTokens.join(""),
      replaced,
    };
  }

  /**
   * 4. O'zbek tili harf birikmalarini (o', g', sh, ch, ng) to'g'ri bog'lash
   * @param {string} text
   * @returns {string}
   */
  normalizeCompoundLetters(text) {
    if (!text) return "";

    return text
      // O'zbekcha O' va G' unifikatsiyasi
      .replace(/\bo['`ʼʻ]/gi, "o'")
      .replace(/\bg['`ʼʻ]/gi, "g'")
      // So'z ichidagi o' va g'
      .replace(/([a-zA-Z])o['`ʼʻ]/gi, "$1o'")
      .replace(/([a-zA-Z])g['`ʼʻ]/gi, "$1g'")
      // Ortiqcha tutuq belgisi xatolari (masalan: ma'lumot vs ma lumot)
      .replace(/\bma\s+lumot\b/gi, "ma'lumot")
      .replace(/\bmo\s+jiza\b/gi, "mo'jiza")
      .replace(/\bta\s+rif\b/gi, "ta'rif")
      .replace(/\bta\s+sir\b/gi, "ta'sir")
      .replace(/\bmas\s+ul\b/gi, "mas'ul");
  }

  /**
   * 5. To'liq normalizatsiya (Pipeline)
   * Kiruvchi ixtiyoriy matnni kognitiv dvigatellar va xotira uchun unifikatsiya qiladi.
   * @param {string} rawText
   * @returns {{
   *   raw: string,
   *   normalized: string,
   *   lower: string,
   *   tokens: string[],
   *   replaced: Array<{ from: string, to: string }>,
   *   hasApostrophe: boolean,
   *   isCyrillic: boolean
   * }}
   */
  normalize(rawText) {
    const raw = (rawText || "").trim();
    if (!raw) {
      return {
        raw: "",
        normalized: "",
        lower: "",
        tokens: [],
        replaced: [],
        hasApostrophe: false,
        isCyrillic: false,
      };
    }

    const isCyrillic = /[\u0400-\u04FF]/.test(raw);
    const hasApostrophe = /[\u02BB\u02BC\u2018\u2019\u0060\u00B4']/.test(raw);

    // 1-qadam: Kirill transliteratsiyasi (agar mavjud bo'lsa)
    let processed = this.transliterateCyrillic(raw);

    // 2-qadam: Apostroflarni unifikatsiya qilish
    processed = this.normalizeApostrophes(processed);

    // 2.5-qadam: Cho'zilgan harflarni qisqartirish (masalan: "salooom" -> "salom", "gaplaaar" -> "gaplar")
    processed = processed.replace(/([a-zA-Zа-яА-ЯёЁ])\1{2,}/g, "$1");

    // 3-qadam: O'zbekcha harf birikmalari
    processed = this.normalizeCompoundLetters(processed);

    // 4-qadam: So'zlashuv va imlo xatolarini to'g'rilash
    const { text: cleanText, replaced } = this.normalizeColloquialAndSpelling(processed);

    // 5-qadam: Bo'shliqlar va tinish belgilari tozalanishi
    const normalized = cleanText
      .replace(/[ \t\r]+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1") // "gap yo'q !" -> "gap yo'q!"
      .trim();

    const lower = normalized.toLowerCase();
    const tokens = lower.split(/[\s,!?.;:]+/).filter(Boolean);

    return {
      raw,
      normalized,
      lower,
      tokens,
      replaced,
      hasApostrophe,
      isCyrillic,
    };
  }
}

const uzbekNormalizer = new UzbekNormalizer();

module.exports = {
  UzbekNormalizer,
  uzbekNormalizer,
  COLLOQUIAL_MAP,
};
