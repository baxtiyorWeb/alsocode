/**
 * =======================================================================
 *  O'ZBEK TILI MORFOLOGIK TAHLILCHISI VA LEMMATIZATORI (Uzbek Morphological Lemmatizer)
 * =======================================================================
 *  O'zbek tili agglyutinativ til bo'lib, bitta o'zakka ko'plab qo'shimchalar
 *  (ko'plik, egalik, kelishik, kesimlik, fe'l zamonlari) qo'shiladi.
 *  Masalan: "dasturchilarimizga" -> o'zak: "dastur"
 *  Bu modul neyron tarmoq va NLP aniqligini keskin oshiradi.
 * =======================================================================
 */

class UzbekMorphology {
  constructor() {
    // Olmoshlar va istisno so'zlar jadvali (Irregular & Pronoun normalizer)
    this.irregularMap = new Map([
      ["menga", "men"],
      ["meni", "men"],
      ["mening", "men"],
      ["menda", "men"],
      ["mendan", "men"],
      ["senga", "sen"],
      ["seni", "sen"],
      ["sening", "sen"],
      ["senda", "sen"],
      ["sendan", "sen"],
      ["unga", "u"],
      ["uni", "u"],
      ["uning", "u"],
      ["unda", "u"],
      ["undan", "u"],
      ["bizga", "biz"],
      ["bizni", "biz"],
      ["bizning", "biz"],
      ["bizda", "biz"],
      ["bizdan", "biz"],
      ["sizga", "siz"],
      ["sizni", "siz"],
      ["sizning", "siz"],
      ["sizda", "siz"],
      ["sizdan", "siz"],
      ["ularga", "ular"],
      ["ularni", "ular"],
      ["ularning", "ular"],
      ["bunga", "bu"],
      ["buni", "bu"],
      ["buning", "bu"],
      ["shunga", "shu"],
      ["shuni", "shu"],
      ["shuning", "shu"],
      ["qilyapti", "qil"],
      ["qilmoqda", "qil"],
      ["yozmoqda", "yoz"],
      ["yozayapti", "yoz"],
    ]);

    // 0-bosqich: So'roq va ta'kid yuklamalari (-mi, -chi, -ku, -da, -ya)
    this.particleSuffixes = [
      "mikan", "mikin", "mikanlar", "mi", "chi", "ku", "da", "ya"
    ];

    // 1-bosqich: Kesimlik va shaxs-son qo'shimchalari
    this.predicateSuffixes = [
      "dirlar", "dir", "miz", "siz", "man", "san", "lar"
    ];

    // 2-bosqich: Kelishik qo'shimchalari
    this.caseSuffixes = [
      "ning", "dan", "dagi", "da", "ga", "ka", "qa", "ni"
    ];

    // 3-bosqich: Egalik qo'shimchalari
    this.possessiveSuffixes = [
      "imiz", "ingiz", "lari", "im", "ing", "si", "i"
    ];

    // 4-bosqich: Ko'plik qo'shimchasi
    this.pluralSuffixes = ["lar"];

    // 5-bosqich: Fe'l shakllari va sifat/ot yasovchi qo'shimchalar
    this.verbalSuffixes = [
      "moqchiman", "moqchisiz", "moqchi",
      "ayotgan", "ayotir", "yotgan",
      "moqda", "yapti", "yotir",
      "ganman", "gansan", "ganmiz", "gansiz",
      "gan", "kan", "qan",
      "moq", "sh", "ish", "lash", "lik", "chilik", "chi",
      "li", "siz"
    ];
  }

  /**
   * So'zni tozalash va normal holatga keltirish
   * @param {string} rawWord
   * @returns {string}
   */
  normalize(rawWord) {
    if (!rawWord || typeof rawWord !== "string") return "";
    return rawWord
      .toLowerCase()
      .replace(/[`ʼʻ']/g, "'") // Barcha tutuq belgilarini unifikatsiya qilish
      .replace(/[^a-zа-яёo'g'0-9]/gi, "")
      .trim();
  }

  /**
   * Bitta so'zni lemmatizatsiya qilish (o'zagini ajratish)
   * @param {string} word
   * @returns {{ original: string, lemma: string, suffixes: string[] }}
   */
  lemmatize(word) {
    const cleaned = this.normalize(word);
    if (!cleaned) return { original: word, lemma: "", suffixes: [] };

    // Juda qisqa so'zlarga (3 yoki undan kam harf) tegilmaydi
    if (cleaned.length <= 3) {
      return { original: word, lemma: cleaned, suffixes: [] };
    }

    // Istisnolar tekshiruvi
    if (this.irregularMap.has(cleaned)) {
      return {
        original: word,
        lemma: this.irregularMap.get(cleaned),
        suffixes: ["irregular"],
      };
    }

    let stem = cleaned;
    const strippedSuffixes = [];

    // Affikslarni bosqichma-bosqich qirqish funksiyasi
    const stripGroup = (suffixList) => {
      // Eng uzun qo'shimchadan boshlab tekshirish
      const sorted = [...suffixList].sort((a, b) => b.length - a.length);
      for (const suff of sorted) {
        if (stem.endsWith(suff) && stem.length - suff.length >= 3) {
          stem = stem.slice(0, -suff.length);
          strippedSuffixes.push(suff);
          break; // guruhdan 1 ta qo'shimcha olinadi
        }
      }
    };

    // Ketma-ketlik: Yuklamalar (-mi, -chi) -> Kesimlik -> Kelishik -> Egalik -> Ko'plik -> Fe'l/Sifat
    stripGroup(this.particleSuffixes);
    stripGroup(this.predicateSuffixes);
    stripGroup(this.caseSuffixes);
    stripGroup(this.possessiveSuffixes);
    stripGroup(this.pluralSuffixes);
    stripGroup(this.verbalSuffixes);

    // Agar o'zak qisqarib ketib oxiri 'g' yoki 'q' ga aylangan bo'lsa (tovush almashinuvi)
    // Masalan: yurakka -> yurak, o'rtog'i -> o'rtoq
    if (stem.endsWith("g'") && stem.length > 3) {
      stem = stem.slice(0, -2) + "q";
    }

    return {
      original: word,
      lemma: stem,
      suffixes: strippedSuffixes,
    };
  }

  /**
   * Butun gap yoki matnni lemmatizatsiya qilish
   * @param {string} sentence
   * @returns {string[]} lemmalar ro'yxati
   */
  lemmatizeSentence(sentence) {
    if (!sentence || typeof sentence !== "string") return [];
    const words = sentence
      .toLowerCase()
      .replace(/[^a-zа-яёo‘oʻg‘gʻ0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    return words.map((w) => this.lemmatize(w).lemma);
  }
}

module.exports = UzbekMorphology;
