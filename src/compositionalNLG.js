"use strict";

/**
 * =======================================================================
 *  COMPOSITIONAL NATURAL LANGUAGE GENERATION (NLG) ENGINE
 * =======================================================================
 *  Bosqich 5: Har bir savolga if-else yozish o'rniga, foydalanuvchi
 *  bayonoti, rejasi yoki niyatidan Mavzu (Entity) va Harakat (Predicate)ni
 *  ajratib olib, tabiiy o'zbek tilida kompozitsion javob sintez qiluvchi
 *  universal semantik generator.
 * =======================================================================
 */

class CompositionalNLGEngine {
  constructor(embeddings = null) {
    this.embeddings = embeddings;
  }

  /**
   * Kiruvchi matndan niyat, mavzu va harakatni ajratib olib, javob generatsiya qilish
   * @param {string} text - Foydalanuvchi jumlasi
   * @param {boolean} isFormal - Rasmiy yoki norasmiy ohang
   * @returns {{ reply: string, topic: string, modality: string } | null}
   */
  generateResponse(text, isFormal = true) {
    if (!text || typeof text !== "string") return null;

    const raw = text.trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 1. O'rganish / Ilm-fan niyati: "...ni o'rganmoqchiman", "...ni o'rganaman", "...o'rganishim kerak"
    const learnMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i|ga|ka|qa)?\s+(?:o'rganmoqchiman|o'rganaman|o'rganmoqchi\s+edim|o'rganishim\s+kerak|o'zlashtirmoqchiman)\b/i);
    if (learnMatch && learnMatch[1]) {
      const topic = this._cleanTopic(learnMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} sohasini o'rganish — o'z ustingizda ishlash va yangi bilimlarni egallash uchun juda ajoyib va istiqbolli qadam! Mazkur yo'nalishda aynan nimalardan boshlashni rejalashtiryapsiz?`
          : `${cap}ni o'rganish juda zo'r reja, do'stim! Ilm olish va yangi narsalarni o'rganish doim foyda keltiradi. Qachondan boshlamoqchisan?`;
        return { reply, topic, modality: "learning" };
      }
    }

    // 2. Sport / O'yin / Musobaqa niyati: "...o'ynamoqchiman", "...o'ynayman"
    const playMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i|ga)?\s+(?:o'ynamoqchiman|o'ynayman|o'ynamoqchi\s+edim|o'ynashim\s+kerak)\b/i);
    if (playMatch && playMatch[1]) {
      const topic = this._cleanTopic(playMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} — inson tafakkurini, diqqatini va jismoniy chaqqonligini charxlaydigan ajoyib mashg'ulot! O'yiningiz maroqli va g'alabalarga boy bo'lishini tilayman.`
          : `${cap} o'ynash zo'r mashg'ulot, do'stim! O'yinda senga omad va g'alaba tilayman. Kim bilan bellashmoqchisan?`;
        return { reply, topic, modality: "playing" };
      }
    }

    // 3. Ijod / Yozish niyati: "...yozmoqchiman", "...yozaman"
    const writeMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i)?\s+(?:yozmoqchiman|yozaman|yozmoqchi\s+edim|yozishim\s+kerak)\b/i);
    if (writeMatch && writeMatch[1]) {
      const topic = this._cleanTopic(writeMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} yozish — chuqur fikr, ijodiy mahorat va ilhom talab qiladigan sermahsul jarayondir! Ijodingizga yuksak ilhom va muvaffaqiyat tilayman.`
          : `${cap} yozish ajoyib ish, do'stim! Ijodiy ishlaringda doimo ilhom yor bo'lsin. Mavzusi nima haqida bo'ladi?`;
        return { reply, topic, modality: "writing" };
      }
    }

    // 4. Transport / Harakat niyati: "...haydayman", "...haydamoqchiman", "...uchmoqchiman"
    const driveMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i)?\s+(?:haydayman|haydamoqchiman|uchaman|uchmoqchiman|minaman|minmoqchiman)\b/i);
    if (driveMatch && driveMatch[1]) {
      const topic = this._cleanTopic(driveMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} boshqarish — ajoyib harakat vositasi va maroqli sayohat manbaidir! Yo'llaringiz hamisha bexatar, sayringiz yoqimli o'tsin.`
          : `${cap} haydash juda zo'r mashg'ulot, do'stim! Yo'llaring bexatar bo'lsin, ehtiyotkorlik bilan boshqar!`;
        return { reply, topic, modality: "driving" };
      }
    }

    // 5. Pazandachilik / Taom tayyorlash: "...pishirmoqchiman", "...tayyorlamoqchiman"
    const cookMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i)?\s+(?:pishirmoqchiman|pishiraman|tayyorlamoqchiman|tayyorlayman)\b/i);
    if (cookMatch && cookMatch[1]) {
      const topic = this._cleanTopic(cookMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} tayyorlash — ajoyib mahorat va mehmondo'stlik belgisidir! Pishirig'ingiz xushxo'r va lazzatli bo'lishiga tilakdoshman.`
          : `${cap} pishirish zo'r fikr, do'stim! Qo'llaring dard ko'rmasin, juda mazali chiqishiga ishonaman!`;
        return { reply, topic, modality: "cooking" };
      }
    }

    // 6. Sayohat / Joyga borish: "...ga bormoqchiman", "...ga boraman", "...ketmoqchiman"
    const travelMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ga|ka|qa|dagi)?\s+(?:bormoqchiman|boraman|ketmoqchiman|ketaman|sayohat\s+qilmoqchiman)\b/i);
    if (travelMatch && travelMatch[1]) {
      const topic = this._cleanTopic(travelMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} bo'ylab sayr yoki safar qilish yangi taassurotlar va yaxshi hordiq bag'ishlaydi! Safaringiz bexatar va unumli o'tishini tilayman.`
          : `${cap}ga borish ajoyib reja, do'stim! Safaring xayrli va maroqli o'tsin, yaxshi borib kel!`;
        return { reply, topic, modality: "travel" };
      }
    }

    // 7. Mutolaa / O'qish: "...o'qimoqchiman", "...o'qiyman", "...o'qishim kerak"
    const readMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:ni|i)?\s+(?:o'qimoqchiman|o'qiyman|o'qimoqchi\s+edim|o'qishim\s+kerak|mutolaa\s+qilmoqchiman)\b/i);
    if (readMatch && readMatch[1]) {
      const topic = this._cleanTopic(readMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} mutolaasi — inson ma'naviyatini boyitadigan va dunyoqarashini kengaytiradigan ajoyib mashg'ulot! Maroqli mutolaa tilayman.`
          : `${cap} o'qish juda ajoyib reja, do'stim! Mutolaang unumli va maroqli o'tsin, yangi fikrlarga boy bo'lsin!`;
        return { reply, topic, modality: "reading" };
      }
    }

    // 8. Jismoniy tarbiya / Sport / Mashq: "...mashq qilmoqchiman", "...yugurmoqchiman", "...shug'ullanmoqchiman"
    const sportMatch = lower.match(/(?:^|\b)(?:men\s+)?([a-zа-яёo'g'0-9\s+#.-]+?)(?:bilan)?\s+(?:shug'ullanmoqchiman|shug'ullanaman|mashq\s+qilmoqchiman|yugurmoqchiman|yuguraman)\b/i);
    if (sportMatch && sportMatch[1]) {
      const topic = this._cleanTopic(sportMatch[1]);
      if (topic && topic.length >= 2 && !this._isStopTopic(topic)) {
        const cap = this._capitalize(topic);
        const reply = isFormal
          ? `${cap} bilan shug'ullanish — sog'lik garovi va tetiklik manbaidir! Mashg'ulotlaringizda yuqori natijalar va mustahkam salomatlik tilayman.`
          : `${cap} bilan shug'ullanish zo'r, do'stim! Har doim tetik va baquvvat bo'l, mashg'ulotlaringda omad!`;
        return { reply, topic, modality: "sport" };
      }
    }

    return null;
  }

  _cleanTopic(str) {
    if (!str) return "";
    return str
      .replace(/^(?:bir\s+|men\s+|va\s+|endi\s+|bugun\s+|ertaga\s+|hozir\s+)/i, "")
      .replace(/(?:ni|i|ga|ka|qa|da|dan)$/i, "")
      .trim();
  }

  _isStopTopic(str) {
    const stops = new Set(["u", "bu", "shu", "o'sha", "nima", "qanday", "nega", "qachon", "kim", "faqat", "juda", "yana"]);
    return stops.has(str.toLowerCase());
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = CompositionalNLGEngine;
