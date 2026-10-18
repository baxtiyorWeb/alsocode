/**
 * =======================================================================
 *  HISSIY VA MANTIQIY INTELLEKT MOTOR (Emotional & Cognitive Empathy Engine)
 * =======================================================================
 *  Gumanoid robotlar va insoniy muloqot uchun maxsus arxitektura:
 *  - Foydalanuvchining his-tuyg'usini (xursandchilik, charchoq, asabiylik, qiziqish) aniqlaydi;
 *  - Suhbat ohangini (Empathy Mode) insonga moslab o'zgartiradi;
 *  - Quruq robotik javob o'rniga samimiy, tirik va tushunuvchan muloqot qiladi.
 * =======================================================================
 */

class EmotionIntelligenceEngine {
  constructor() {
    // Hissiy leksikon bazasi (O'zbek tili uchun)
    this.emotionLexicon = {
      joy: {
        keywords: [
          "xursand", "ajoyib", "zo'r", "qoyil", "baxtli", "yaxshi", "kulgili",
          "maroqli", "yutdim", "omad", "kayfiyatim", "a'lo", "rahmat", "sevaman",
          "zo'r", "super", "yashang", "yordam", "baxt", "tabassum"
        ],
        label: "Quvonch / Xursandchilik",
        icon: "😊",
        empathyTone: "quvnoq_va_ilhomlantiruvchi",
      },
      sadness: {
        keywords: [
          "charchadim", "xafa", "og'ir", "alam", "dardi", "yig'ladim", "yomon",
          "tushkun", "omadsiz", "hech narsa o'xshamayapti", "bo'lmayapti",
          "yetar", "og'riq", "qiyin", "havotir", "yolg'iz", "umidsiz"
        ],
        label: "Charchoq / G'amginlik",
        icon: "😔",
        empathyTone: "hamdardlik_va_dalda",
      },
      anger: {
        keywords: [
          "jahlim", "asabiy", "g'azab", "tutdi", "adolatsiz", "ahmoq", "xunuk",
          "yoqmayapti", "yomon ko'raman", "bema'ni", "bekorga", "yo'qol",
          "asabiylashdim", "charchatdi"
        ],
        label: "Asabiylik / G'azab",
        icon: "😤",
        empathyTone: "tinchlantiruvchi_va_vazmin",
      },
      curiosity: {
        keywords: [
          "qiziq", "qanday", "nima uchun", "siri", "sababi", "tushuntir",
          "qanday qilib", "o'rganmoqchiman", "bilmoqchiman", "mohiyati",
          "tadqiq", "ilmiy", "aytchi"
        ],
        label: "Qiziquvchanlik / Ilhom",
        icon: "🤔",
        empathyTone: "chuqur_tahliliy_va_qiziqarli",
      },
    };

    // Hamdardlik va hissiy javob prefikslari (Empathy Responses)
    this.empathyPrefixes = {
      sadness: [
        "Sizni juda yaxshi tushunib turibman. Ba'zida hamma narsadan tanaffus olib, bir piyola issiq choy bilan nafas rostlash kerak.",
        "Qiyin kunlar o'tib ketadi. Siz hozirga qadar katta yo'lni bosib o'tdingiz, aslo tushkunlikka tushmang.",
        "Charchoq — bu miyaning qayta quvvatlanishga ehtiyoji borligini bildiradi. O'zingizni ehtiyot qiling, do'stim.",
      ],
      joy: [
        "Sizning kayfiyatingiz a'loligidan men ham cheksiz quvondim! Ajoyib energiya!",
        "Qoyil! Bunday xush kayfiyatda har qanday murakkab maqsadni zabt etish mumkin!",
        "Ajoyib yangilik! Yutuqlaringiz bardavom bo'lsin!",
      ],
      anger: [
        "Vaziyat chindan ham asabiy bo'lishi mumkin, sizni to'la tushunaman. Keling, birgalikda sokinlik bilan yechimini ko'rib chiqamiz.",
        "G'azab eng yaxshi g'oyalarni to'sib qo'yishi mumkin. Keling, vazminlik bilan masalani hal qilamiz.",
      ],
      curiosity: [
        "Juda teran va kognitiv savol! Bu mavzuni o'rganish menga ham katta zavq bag'ishlaydi.",
        "Bunday qiziquvchanlik — haqiqiy kashfiyotchi va muhandisning eng muhim hislati!",
      ],
    };
  }

  /**
   * Foydalanuvchi matnidagi hissiyotni (Sentiment & Emotion) tahlil qilish
   * @param {string} text
   * @returns {{
   *   primaryEmotion: string,
   *   confidence: number,
   *   label: string,
   *   icon: string,
   *   empathyPrefix: string | null
   * }}
   */
  analyzeEmotion(text) {
    if (!text || typeof text !== "string") {
      return {
        primaryEmotion: "neutral",
        confidence: 90,
        label: "Neytral / Xolis",
        icon: "😐",
        empathyPrefix: null,
      };
    }

    const lower = text.toLowerCase();
    const scores = { joy: 0, sadness: 0, anger: 0, curiosity: 0 };

    Object.entries(this.emotionLexicon).forEach(([emotionKey, data]) => {
      data.keywords.forEach((kw) => {
        if (lower.includes(kw)) {
          scores[emotionKey] += 1;
        }
      });
    });

    let bestEmotion = "neutral";
    let maxScore = 0;

    Object.entries(scores).forEach(([em, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestEmotion = em;
      }
    });

    if (maxScore === 0) {
      return {
        primaryEmotion: "neutral",
        confidence: 85,
        label: "Vazmin / Mantiqiy",
        icon: "🧠",
        empathyPrefix: null,
      };
    }

    const emotionData = this.emotionLexicon[bestEmotion];
    const prefixes = this.empathyPrefixes[bestEmotion] || [];
    const chosenPrefix = prefixes.length > 0 ? prefixes[Math.floor(Math.random() * prefixes.length)] : null;
    const confidence = Math.min(65 + maxScore * 15, 98);

    return {
      primaryEmotion: bestEmotion,
      confidence,
      label: emotionData.label,
      icon: emotionData.icon,
      empathyPrefix: chosenPrefix,
    };
  }
}

module.exports = EmotionIntelligenceEngine;
