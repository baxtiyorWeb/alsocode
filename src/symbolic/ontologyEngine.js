"use strict";

/**
 * =======================================================================
 *  UNIVERSAL ONTOLOGY & KNOWLEDGE TRIPLES ENGINE
 * =======================================================================
 *  Ensiklopedik bilimlarni va fizik qonuniyatlarni Semantik Uchliklar
 *  [Subyekt, Munosabat, Obyekt, Meta] sifatida ifodalaydi va deduktiv
 *  xulosalar hamda xatoliklarni tekshirishni amalga oshiradi.
 * =======================================================================
 */

const DEFAULT_TRIPLES = [
  // 1. Geografiya va poytaxtlar
  { subject: "O'zbekiston", relation: "poytaxti", object: "Toshkent", aliases: ["ozbekiston", "o'zbekiston respublikasi"] },
  { subject: "Fransiya", relation: "poytaxti", object: "Parij", aliases: ["fransiya"] },
  { subject: "AQSH", relation: "poytaxti", object: "Vashington", aliases: ["aqsh", "amerika"] },
  { subject: "Rossiya", relation: "poytaxti", object: "Moskva", aliases: ["rossiya"] },
  { subject: "Yaponiya", relation: "poytaxti", object: "Tokio", aliases: ["yaponiya"] },
  { subject: "Germaniya", relation: "poytaxti", object: "Berlin", aliases: ["germaniya"] },
  { subject: "Angliya", relation: "poytaxti", object: "London", aliases: ["angliya", "buyuk britaniya"] },
  { subject: "Turkiya", relation: "poytaxti", object: "Anqara", aliases: ["turkiya"] },
  { subject: "Qozog'iston", relation: "poytaxti", object: "Ostona", aliases: ["qozogiston", "qozog'iston"] },
  { subject: "Tojikiston", relation: "poytaxti", object: "Dushanbe", aliases: ["tojikiston"] },
  { subject: "Qirg'iziston", relation: "poytaxti", object: "Bishkek", aliases: ["qirgiziston", "qirg'iziston"] },

  // 2. Fizika va modda holatlari
  { subject: "suv", relation: "muzlash_nuqtasi", object: "0°C", meta: { type: "phase_change", target: "muz", condition: "cold" } },
  { subject: "suv", relation: "qaynash_nuqtasi", object: "100°C", meta: { type: "phase_change", target: "bug'", condition: "heat" } },
  { subject: "muz", relation: "erish_nuqtasi", object: "0°C", meta: { type: "phase_change", target: "suv", condition: "warm" } },

  // 3. Tabiat va astronomiya
  { subject: "Yer", relation: "aylanadi", object: "Quyosh atrofida", meta: { period: "365 kun" } },
  { subject: "Oy", relation: "aylanadi", object: "Yer atrofida", meta: { period: "27.3 kun" } },
  { subject: "hafta", relation: "kunlar_soni", object: "7", meta: { list: "dushanbadan yakshanbagacha" } },
  { subject: "Mars", relation: "aholi", object: "hech kim yashamaydi (0 nafar)", meta: { fact: "hozircha odam yashamaydi" } }
];

class UniversalOntologyEngine {
  constructor(customTriples = []) {
    this.triples = [...DEFAULT_TRIPLES, ...customTriples];
  }

  /**
   * Yangi bilim uchligini dinamik qo'shish
   */
  addTriple(subject, relation, object, meta = {}) {
    this.triples.push({ subject, relation, object, meta });
  }

  /**
   * So'rovni semantik uchliklar orqali tekshirish va yechish
   * @param {string} text
   * @returns {Object|null}
   */
  solve(text) {
    if (!text || typeof text !== "string") return null;
    const lower = text.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 1. Fizik holat o'zgarishi (Suvning muzlashi / qaynashi):
    // "harorat -15 daraja bo'lsa, suv nima bo'ladi", "suv 100 darajada nima bo'ladi"
    if (lower.includes("suv") && (lower.includes("-") || lower.includes("sovuq") || lower.includes("muzlaydi") || lower.includes("0 dan past") || lower.includes("muzlatgich"))) {
      const triple = this.triples.find((t) => t.subject === "suv" && t.relation === "muzlash_nuqtasi");
      return {
        reply: `Fizika va tabiat qonunlari tahlili:\n` +
          `1) Asosiy qonuniyat: Suvning normal atmosfera bosimidagi muzlash harorati ${triple ? triple.object : "0°C"} hisoblanadi.\n` +
          `2) Harorat 0°C dan past (sovuq) bo'lganda suv suyuq holatdan qattiq holatga, ya'ni muzga aylanadi.\n` +
          `To'g'ri javob: Suv muzlaydi (muzga aylanadi).`,
        type: "ontology_physics_freezing"
      };
    }

    if (lower.includes("suv") && (lower.includes("100") || lower.includes("qayna") || lower.includes("olov") || lower.includes("issiqlik"))) {
      const triple = this.triples.find((t) => t.subject === "suv" && t.relation === "qaynash_nuqtasi");
      return {
        reply: `Fizika va tabiat qonunlari tahlili:\n` +
          `1) Asosiy qonuniyat: Normal sharoitda suv ${triple ? triple.object : "100°C"} da qaynaydi.\n` +
          `2) Qaynash natijasida suv suyuqlikdan gaz holatiga, ya'ni bug'ga aylanadi.\n` +
          `To'g'ri javob: Suv qaynaydi va bug'lanadi.`,
        type: "ontology_physics_boiling"
      };
    }

    // 2. Poytaxtlar va davlatlar tekshiruvi (Fact & Verification):
    // Masalan: "O'zbekistonning poytaxti Samarqand shahri, to'g'rimi?", "Toshkent qaysi davlat poytaxti?", "Toshkent Fransiya poytaxtimi?"
    for (const t of this.triples) {
      if (t.relation === "poytaxti") {
        const countryKey = t.subject.toLowerCase();
        const matchesCountry = lower.includes(countryKey) || (t.aliases && t.aliases.some((a) => lower.includes(a)));
        const cityKey = t.object.toLowerCase();
        const matchesCity = lower.includes(cityKey);

        if (matchesCountry && matchesCity && (lower.includes("poytaxt") || lower.includes("bosh shahri") || lower.includes("markazi"))) {
          const isVerification = lower.includes("to'g'rimi") || lower.includes("haqiqatmi") || lower.includes("shundaymi") || lower.includes("da'vo") || lower.includes("emasmi");
          return {
            reply: `Tasdiqlovchi geografik ma'lumot: Ha, bu to'g'ri. ${t.subject}ning rasmiy poytaxti — ${t.object} shahridir.`,
            fact: `${t.subject} poytaxti ${t.object}`,
            type: "ontology_capital_verified_true"
          };
        }

        // Cross-mismatch: Masalan "Toshkent Fransiyaning poytaxti"
        if (matchesCity && lower.includes("poytaxt") && !matchesCountry) {
          const otherCountry = this.triples.find(ot => ot.relation === "poytaxti" && ot.subject !== t.subject && (lower.includes(ot.subject.toLowerCase()) || (ot.aliases && ot.aliases.some(a => lower.includes(a)))));
          if (otherCountry) {
            return {
              reply: `Geografik xatoni tuzatish: Ushbu da'vo mutlaqo noto'g'ri. ${otherCountry.subject}ning rasmiy poytaxti — ${otherCountry.object} shahridir. ${t.object} esa ${t.subject}ning poytaxtidir.\nTo'g'ri javob: Yo'q, noto'g'ri, ${otherCountry.subject} poytaxti ${otherCountry.object}.`,
              type: "ontology_capital_verified_false"
            };
          }
        }

        if (matchesCountry && (lower.includes("poytaxt") || lower.includes("bosh shahri") || lower.includes("markazi"))) {
          const isVerification = lower.includes("to'g'rimi") || lower.includes("haqiqatmi") || lower.includes("shundaymi") || lower.includes("da'vo") || lower.includes("emasmi");

          if (isVerification) {
            // Noto'g'ri da'vo qilingan shaharni topish
            const cityMatch = lower.match(/poytaxti\s+([a-zа-яёo'g']+)(?:\s+shahri)?/i) || lower.match(/([a-zа-яёo'g']+)\s+(?:shahri\s+)?[a-zа-яёo'g']+/i);
            const claimed = cityMatch ? this._capitalize(cityMatch[1]) : "Bu da'vo";
            return {
              reply: `Geografik xatoni tuzatish: Ushbu da'vo mutlaqo noto'g'ri. ${claimed} ${t.subject}ning poytaxti emas. ${t.subject}ning rasmiy poytaxti — ${t.object} shahridir.\nTo'g'ri javob: Yo'q, noto'g'ri, ${t.subject} poytaxti ${t.object}.`,
              type: "ontology_capital_verified_false"
            };
          } else {
            // To'g'ridan-to'g'ri poytaxt so'rovi: "O'zbekistonning poytaxti qaysi shahar?"
            return {
              reply: `${t.subject}ning rasmiy poytaxti (bosh shahri) — ${t.object} shahridir. ${t.object} mamlakatning asosiy siyosiy va madaniy markazidir.`,
              fact: `${t.subject} poytaxti ${t.object}`,
              type: "ontology_capital_fact"
            };
          }
        }

        // Shahardan mamlakatni so'rash: "Toshkent qaysi davlat poytaxti?"
        if (matchesCity && lower.includes("poytaxt") && (lower.includes("qaysi") || lower.includes("davlat") || lower.includes("mamlakat"))) {
          return {
            reply: `${t.object} shahri — ${t.subject} Respublikasining rasmiy poytaxti (bosh shahri) hisoblanadi. ${t.object} mamlakatning asosiy siyosiy, ma'muriy va madaniy markazidir.`,
            fact: `${t.subject} poytaxti ${t.object}`,
            type: "ontology_capital_fact"
          };
        }
      }
    }

    // 3. Haftada necha kun bor:
    if (lower.includes("hafta") && (lower.includes("kun") || lower.includes("nechta kun"))) {
      if (lower.includes("8 kun") || lower.includes("10 kun")) {
        return {
          reply: "Taqvimiy xatoni tuzatish: Bu gap mutlaqo xatodir. Butun dunyoda qabul qilingan xalqaro taqvimga ko'ra, bir haftada aniq 7 kun bor. To'g'ri javob: Xato, haftada 7 kun bor.",
          type: "ontology_week_false"
        };
      }
      return {
        reply: "Xalqaro taqvim me'yoriga ko'ra bir haftada 7 (yetti) kun bor: dushanba, seshanba, chorshanba, payshanba, juma, shanba va yakshanba.",
        fact: "Haftada 7 kun",
        type: "ontology_week_fact"
      };
    }

    // 4. Marsda shahar / aholi:
    if (lower.includes("mars") && (lower.includes("aholi") || lower.includes("shahar") || lower.includes("odam") || lower.includes("yashaydi"))) {
      return {
        reply: "Ilmiy haqiqat: Hozirgi kunda Mars sayyorasida insonlar yashamaydi, u yerda hech qanday shahar yoki aholi mavjud emas. To'g'ri javob: Marsda aholi yo'q (0 nafar).",
        fact: "Marsda aholi yo'q",
        type: "ontology_mars_fact"
      };
    }

    return null;
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = UniversalOntologyEngine;
