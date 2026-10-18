/**
 * =======================================================================
 *  KOGNITIV XOTIRA VA JONLI O'QISH TIZIMI (Cognitive Episodic Memory & Knowledge Graph)
 * =======================================================================
 *  Standart neyron tarmoqlardan farqli o'laroq, bu modul:
 *  1. Suhbat ichida berilgan yangi ma'lumotlarni DARHOL eslab qoladi (Hebbian Plasticity / One-shot learning).
 *  2. Foydalanuvchi shaxsiy profili (ism, qiziqish, kasb, til) ni avtomatik ajratib oladi.
 *  3. Faktlar va mantiqiy munosabatlar grafini (Subject-Predicate-Object) doimiy saqlaydi.
 *  4. Qayta o'qitish (backprop) talab qilmasdan xotiradan assotsiativ qidiruv qiladi.
 * =======================================================================
 */

const fs = require("fs");
const path = require("path");

class CognitiveMemory {
  /**
   * @param {string} storagePath - Xotira saqlanadigan JSON fayl yo'li
   */
  constructor(storagePath = null) {
    this.storagePath = storagePath === ":memory:" ? ":memory:" : (storagePath || path.join(__dirname, "..", "data", "memory.json"));

    // 1. Foydalanuvchi profili (User Profile Entity Store)
    this.userProfile = {
      name: null,
      interests: [],
      profession: null,
      preferredLanguage: "uz",
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    // 2. Dinamik faktlar ombori (Dynamic Fact Triplet Store)
    // Har bir fakt: { id, subject, relation, object, rawText, timestamp, confidence }
    this.facts = [];

    // 3. Episodik suhbat xotirasi (Short-term Conversation History)
    this.dialogueHistory = [];
    this.maxDialogueHistory = 30;

    // 4. Muloqot Holati Xaritasi (Dialogue State Tracker - DST)
    this.dialogueState = {
      register: null, // "formal" ('siz') yoki "informal" ('sen')
      pendingOffer: null, // masalan: 'tea_rest', 'status_check', 'action'
      declinedTopics: [], // masalan: ['tea', 'rest']
      lastIntent: null,
      lastTool: null,
      lastUserText: null,
      lastBotReply: null,
      lastTopic: null,
      lastUnderstood: null,
      turnCount: 0,
    };

    // Fayldan yuklash
    this.load();
  }

  /**
   * Xotirani fayldan yuklash
   */
  load() {
    if (this.storagePath === ":memory:" || !this.storagePath) return;
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.userProfile) this.userProfile = { ...this.userProfile, ...parsed.userProfile };
        if (Array.isArray(parsed.facts)) this.facts = parsed.facts;
      }
    } catch (err) {
      console.warn("⚠️ Xotira faylini yuklashda xatolik:", err.message);
    }
  }

  /**
   * Xotirani faylga saqlash (Persist)
   */
  save() {
    if (this.storagePath === ":memory:" || !this.storagePath) return;
    try {
      const data = {
        userProfile: this.userProfile,
        facts: this.facts,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("⚠️ Xotirani saqlashda xatolik:", err.message);
    }
  }

  /**
   * Foydalanuvchi xabaridan shaxsiy ma'lumotlar va yangi faktlarni ajratib olish (Entity & Fact Extraction)
   * @param {string} text
   * @returns {{ learnedUser: Object | null, learnedFact: Object | null }}
   */
  extractAndLearn(text) {
    if (!text || typeof text !== "string") return { learnedUser: null, learnedFact: null };

    const lower = text.trim();
    let learnedUser = null;
    let learnedFact = null;

    // 0. XAVFSIZLIK FILTRI: Savollar, mantiqiy sillogizmlar, shartli gaplar va masalalarni
    // shaxsiy fakt deb xotiraga yozib olmaslik (Memory Interception Guard)
    const isQuestionOrReasoning = (
      lower.includes("?") ||
      /\b(?:qanday|nima|kim|qaysi|qayer|qachon|nega|nimaga|sababi|bormi|mumkinmi|ayt|ayting|tushuntir|yech|hisobla|xulosa|natija|chiqadi|berildi|qoldi|jami|necha|qancha|har\s+biri)\b/i.test(lower) ||
      /\b(?:barcha|agar|faraz\s+qilaylik|masala|misol|toping|taqqosla)\b/i.test(lower)
    );
    if (isQuestionOrReasoning) {
      return { learnedUser: null, learnedFact: null };
    }

    // 1. Ismni aniqlash: "ismim Ali", "mening ismim Sardor", "meni Ali deb chaqir"
    // Va inkorli to'g'rilash: "mening ismim Bobur emas Baxtiyor", "men Baxtiyor Bobur emas"
    let candidateName = null;
    let isCorrection = false;
    let rejectedName = null;

    // A. Inkorli to'g'rilash: "mening ismim [Eski] emas [Yangi]", "men [Eski] emas [Yangi]man"
    const negCorrectionMatch = lower.match(/(?:mening\s+ismim|men)\s+([a-zа-яёo‘oʻg‘gʻ']+)\s+emas(?:man)?(?:[\s,]+(?:mening\s+ismim\s+|men\s+)?([a-zа-яёo‘oʻg‘gʻ']+)(?:man)?)?/i);
    // B. Teskari inkor: "men [Yangi], [Eski] emas", "mening ismim [Yangi], [Eski] emas"
    const revNegMatch = lower.match(/(?:mening\s+ismim|men)\s+([a-zа-яёo‘oʻg‘gʻ']+)(?:man)?[\s,]+([a-zа-яёo‘oʻg‘gʻ']+)\s+emas/i);

    if (negCorrectionMatch) {
      rejectedName = negCorrectionMatch[1].trim();
      if (negCorrectionMatch[2]) {
        candidateName = negCorrectionMatch[2].replace(/man$/i, "").trim();
        isCorrection = true;
      } else {
        // Faqat inkor: "mening ismim Bobur emas"
        if (this.userProfile.name && this.userProfile.name.toLowerCase() === rejectedName.toLowerCase()) {
          this.userProfile.name = null;
          this.save();
          return { learnedUser: { field: "name_cleared", value: this._capitalize(rejectedName) }, learnedFact: null };
        }
      }
    } else if (revNegMatch) {
      candidateName = revNegMatch[1].replace(/man$/i, "").trim();
      rejectedName = revNegMatch[2].trim();
      isCorrection = true;
    } else {
      const explicitNameMatch = lower.match(/(?:mening\s+)?(?:ismim|otim|nomim)\s+(?:esa\s+|bo'lsa\s+)?([a-zа-яёo‘oʻg‘gʻ']+)/i) ||
                                lower.match(/(?:meni\s+)([a-zа-яёo‘oʻg‘gʻ']+)\s+deb\s+(?:chaqir|ata)/i);
      if (explicitNameMatch && explicitNameMatch[1]) {
        const afterMatch = lower.slice(explicitNameMatch.index + explicitNameMatch[0].length);
        if (!/^\s+emas\b/i.test(afterMatch)) {
          candidateName = explicitNameMatch[1].trim();
        }
      } else {
        const implicitMatch = lower.match(/^men\s+([a-zа-яёo‘oʻg‘gʻ']+)(?:\s*man|\s+man\b)?$/i);
        if (implicitMatch && implicitMatch[1] && !lower.includes("emas")) {
          candidateName = implicitMatch[1].replace(/man$/i, "").trim();
        }
      }
    }

    const nonNameWords = new Set([
      "kim", "nima", "qanday", "qaysi", "qayer", "qayerdan", "qachon", "nega", "nimaga",
      "uxla", "uxlay", "uxlayman", "uxladim", "uxlamadim", "yot", "yotdim", "yotaman", "tur", "turdim",
      "ishla", "ishlay", "ishlayman", "ishladim", "bor", "bora", "boraman", "bordim", "bormadim",
      "kel", "kela", "kelaman", "keldim", "kelmadim", "ket", "keta", "ketaman", "ketdim", "ketmadim",
      "bil", "bila", "bilaman", "bildim", "bilmadim", "charchad", "charchadim", "charchamadim", "toliqdim", "toliqmadim", "toliqqan",
      "o'qi", "o'qiyman", "yoz", "yozaman", "qil", "qilaman", "ye", "yeyman", "ich", "ichaman",
      "dasturchi", "talaba", "inson", "o'quvchi", "muhandis", "shifokor", "yaxshi", "yomon",
      "band", "bandman", "kasal", "kasalman", "kasalmasman", "betob", "betobman", "charchagan", "tayyor",
      "xursand", "xursandman", "hursand", "hursandman", "xursan", "hursan", "baxtli", "baxtliman",
      "xafa", "xafaman", "hushyor", "tinch", "sog'", "sog'lom", "salomat", "kayfiyat"
    ]);

    let detectedName = null;
    if (candidateName) {
      const cleanName = candidateName.toLowerCase().replace(/[`ʼʻ']/g, "'");
      const isVerbEnding = /(?:ay|iy|yap|gan|qan|kan|moq|a|y|di|dim|ding|dik|dilar|madim|mading|madi|madik|madilar)$/i.test(cleanName);
      const isStateOrEmpathyWord = /\b(?:charcha|toliq|kasal|betob|uxla|og'ri|holsiz)\b/i.test(cleanName);
      if (
        cleanName.length >= 2 &&
        cleanName.length <= 25 &&
        !nonNameWords.has(cleanName) &&
        !isVerbEnding &&
        !isStateOrEmpathyWord
      ) {
        detectedName = this._capitalize(cleanName);
        this.userProfile.name = detectedName;
        this.userProfile.lastSeen = new Date().toISOString();
        this.save();
        learnedUser = { field: "name", value: detectedName, isCorrection };
      }
    }

    // 2. Kasb yoki mashg'ulotni aniqlash: "men dasturchiman", "kasbim muhandis", "va men shifokorman"
    const explicitProfMatch = lower.match(/(?:kasbim|soham|mutaxassisligim)\s+(?:esa\s+|bo'lsa\s+)?([a-zа-яёo‘oʻg‘gʻ'\s]+)/i) ||
                              lower.match(/men\s+([a-zа-яёo‘oʻg‘gʻ']+)\s+bo'lib\s+ishlayman/i);
    let candidateProf = null;
    if (explicitProfMatch && explicitProfMatch[1]) {
      candidateProf = explicitProfMatch[1].trim();
    } else {
      const implicitProfMatch = lower.match(/(?:^|\b(?:va|ham|esa)\s+)men\s+([a-zа-яёo‘oʻg‘gʻ']+)(?:man\b|man$)/i);
      if (implicitProfMatch && implicitProfMatch[1]) {
        candidateProf = implicitProfMatch[1].trim();
      }
    }

    const knownProfessions = new Set([
      "dasturchi", "muhandis", "shifokor", "vrach", "o'qituvchi", "ustoz",
      "talaba", "o'quvchi", "iqtisodchi", "yurist", "advokat", "buxgalter",
      "menejer", "dizayner", "rassom", "shoir", "yozuvchi", "haydovchi",
      "oshpaz", "quruvchi", "tarjimon", "tadbirkor", "mexanik", "fermer",
      "jurnalist", "olim", "doktor", "akademik", "mutaxassis"
    ]);

    if (!candidateProf) {
      for (const prof of knownProfessions) {
        if (new RegExp(`\\b${prof}(?:man)?\\b`, "i").test(lower)) {
          candidateProf = prof;
          break;
        }
      }
    }

    if (candidateProf) {
      const cleanProf = candidateProf.toLowerCase().replace(/man$/i, "").trim();
      if (cleanProf.length >= 3 && knownProfessions.has(cleanProf) && cleanProf !== detectedName?.toLowerCase()) {
        const detectedProf = this._capitalize(cleanProf);
        this.userProfile.profession = detectedProf;
        if (detectedName) {
          learnedUser = {
            field: "compound",
            name: detectedName,
            profession: detectedProf,
            value: `${detectedName} (${detectedProf})`,
          };
        } else {
          learnedUser = { field: "profession", value: detectedProf };
        }
      }
    }

    // 3. Shaxsiy qiziqish / sevimli narsalar (Preference Extraction)
    // Masalan: "mening sevimli mashinam BMW M5", "sevimli taomim osh"
    const favMatch = lower.match(/(?:mening\s+)?sevimli\s+([a-zа-яёo‘oʻg‘gʻ0-9\s'’ʻ`]+?)\s+(?:bu\s+|—\s+|-)?([a-zа-яёo‘oʻg‘gʻ0-9\s_+.'’ʻ`-]+)$/i);
    if (favMatch) {
      const subject = `sevimli ${favMatch[1].trim()}`.toLowerCase();
      const object = favMatch[2].trim();
      learnedFact = this.addFact(subject, "bu", object, text);
      learnedUser = { field: subject, value: object };
    }

    // 4. Qiziqishlarni aniqlash: "men AI ga qiziqaman", "JavaScript yoqadi"
    const interestMatch = lower.match(/(.+?)(?:ga|ni)\s+(?:juda\s+)?(?:qiziqaman|yaxshi ko'raman|o'rganmoqdaman)/i);
    if (interestMatch && interestMatch[1] && !favMatch) {
      const interest = interestMatch[1].replace(/^(men\s+|va\s+)/i, "").trim();
      if (interest.length > 2 && !this.userProfile.interests.includes(interest)) {
        this.userProfile.interests.push(interest);
        learnedUser = { field: "interests", value: interest };
      }
    }

    // 5. Umumiy faktlarni o'rganish:
    // A) "[Subject] bu [Object]" yoki "[Subject] — [Object]"
    // B) "[Subject] degani [Object]" yoki "[Subject] degani bu [Object]"
    // C) "[Subject] deganda [Object] tushuniladi"
    // D) "[Subject] [Object] hisoblanadi / sanaladi / ataladi"
    let factMatch = lower.match(/^([a-zа-яёo‘oʻg‘gʻ0-9\s_+.'’ʻ`-]{2,35})\s+(?:bu|—|-)\s+(.+)$/i) ||
                    lower.match(/^([a-zа-яёo‘oʻg‘gʻ0-9\s_+.'’ʻ`-]{2,35})\s+degani(?:\s+bu)?\s+(.+)$/i) ||
                    lower.match(/^([a-zа-яёo‘oʻg‘gʻ0-9\s_+.'’ʻ`-]{2,35})\s+deganda\s+(.+?)\s+tushuniladi$/i) ||
                    lower.match(/^([a-zа-яёo‘oʻg‘gʻ0-9\s_+.'’ʻ`-]{2,35})\s+haqida\s*:\s*(.+)$/i);

    if (!factMatch && !favMatch) {
      const hisobMatch = lower.match(/^([a-zа-яёo‘oʻg‘gʻ0-9'’ʻ`-]{2,30})\s+(.+?)\s+(?:hisoblanadi|sanaladi|ataladi|bo'ladi|deb\s+ataladi|deb\s+aytiladi)\.?$/i);
      if (hisobMatch) {
        factMatch = [hisobMatch[0], hisobMatch[1], hisobMatch[2]];
      }
    }

    if (factMatch && !favMatch) {
      const subject = factMatch[1].trim().toLowerCase();
      let object = factMatch[2].trim().replace(/\s+(?:hisoblanadi|sanaladi|ataladi)\.?$/i, "");

      // O'z-o'zidan salomlashish yoki oddiy narsalarni fakt qilib olmaslik
      const stopSubjects = ["salom", "assalomu alaykum", "xayr", "rahmat", "mening ismim"];
      if (!stopSubjects.some((s) => subject.startsWith(s)) && object.length > 2) {
        learnedFact = this.addFact(subject, "bu", object, text);
      }
    }

    if (learnedUser || learnedFact) {
      this.save();
    }

    return { learnedUser, learnedFact };
  }

  /**
   * Yangi faktni kognitiv xotiraga qo'shish
   * @param {string} subject
   * @param {string} relation
   * @param {string} object
   * @param {string} rawText
   */
  addFact(subject, relation, object, rawText = "") {
    // Agar mavjud bo'lsa yangilash
    const existingIdx = this.facts.findIndex((f) => f.subject.toLowerCase() === subject.toLowerCase());
    const factEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      subject: subject.trim(),
      relation: relation.trim(),
      object: object.trim(),
      rawText: rawText || `${subject} ${relation} ${object}`,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      usageCount: 0,
    };

    if (existingIdx !== -1) {
      this.facts[existingIdx] = factEntry;
    } else {
      this.facts.push(factEntry);
    }

    this.save();
    return factEntry;
  }

  /**
   * Kiritilgan matn bo'yicha xotiradan tegishli faktlarni topish (Associative Recall)
   * @param {string} query
   * @returns {Array<{fact: Object, score: number}>}
   */
  recallFacts(query) {
    if (!query || this.facts.length === 0) return [];

    const queryClean = query.toLowerCase().replace(/[`ʼʻ]/g, "'");
    const queryWords = queryClean
      .replace(/[^a-zа-яёo'g'0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const matches = [];

    this.facts.forEach((fact) => {
      let score = 0;
      const subLower = fact.subject.toLowerCase().replace(/[`ʼʻ]/g, "'");
      const objLower = fact.object.toLowerCase().replace(/[`ʼʻ]/g, "'");
      const subWords = subLower.split(/\s+/).filter(Boolean);
      const objWords = objLower.split(/\s+/).filter(Boolean);

      // 1. To'g'ridan-to'g'ri butun subject mustaqil so'z yoki ibora sifatida mos kelishi
      // Muhim: "kitob" ichidagi "it" kabi tasodifiy substringlarni so'z chegarasi (\b) bilan cheklash
      const escapedSub = subLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const subRegex = new RegExp(`(?:^|[^a-zа-яёo'g'0-9])${escapedSub}(?:$|[^a-zа-яёo'g'0-9])`, "i");
      if (subRegex.test(queryClean)) {
        score += 3.5;
      }

      // 2. So'zlar bo'yicha aniq moslik (sub-string emas, so'zma-so'z)
      queryWords.forEach((word) => {
        if (subWords.includes(word)) {
          score += 2.0;
        } else if (word.length >= 4 && subLower.length >= 4 && subLower.includes(word)) {
          score += 1.0;
        }

        if (objWords.includes(word)) {
          score += 1.0;
        } else if (word.length >= 4 && objLower.length >= 4 && objLower.includes(word)) {
          score += 0.5;
        }
      });

      if (score >= 2.0) {
        fact.usageCount = (fact.usageCount || 0) + 1;
        matches.push({ fact, score });
      }
    });

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 3);
  }

  /**
   * Suhbat tarixiga yangi qator qo'shish
   */
  recordTurn(userText, botReply, metadata = {}) {
    this.dialogueHistory.push({
      user: userText,
      bot: botReply,
      timestamp: new Date().toISOString(),
      metadata,
    });

    if (this.dialogueHistory.length > this.maxDialogueHistory) {
      this.dialogueHistory.shift();
    }

    // DST State yangilash (Dialogue State Tracking)
    this.dialogueState.lastUserText = userText;
    this.dialogueState.lastBotReply = botReply;
    this.dialogueState.lastIntent = metadata.intent || metadata.category || null;
    this.dialogueState.lastTool = metadata.tool || null;
    this.dialogueState.lastUnderstood = metadata.understood || null;
    this.dialogueState.turnCount = (this.dialogueState.turnCount || 0) + 1;
    if (metadata.topic) {
      this.dialogueState.lastTopic = metadata.topic;
    }
  }

  /**
   * Oxirgi suhbat kontekstini olish
   * @param {number} turnsCount
   */
  getRecentContext(turnsCount = 3) {
    return this.dialogueHistory.slice(-turnsCount);
  }

  /**
   * Barcha kognitiv xotira statistikasini olish
   */
  getStats() {
    return {
      factsCount: this.facts.length,
      userProfile: this.userProfile,
      historyLength: this.dialogueHistory.length,
      factsSample: this.facts.slice(-5),
    };
  }

  /**
   * Foydalanuvchi profilidan aniq maydonni olish
   * @param {string} field
   * @returns {string|null}
   */
  getUserProfileField(field) {
    if (!field) return null;
    const f = field.toLowerCase();
    if (f === "name" || f === "ism") return this.userProfile.name;
    if (f === "profession" || f === "kasb") return this.userProfile.profession;
    if (f === "interests" || f === "qiziqish") return this.userProfile.interests;
    return this.userProfile[field] || null;
  }

  /**
   * Foydalanuvchi matnidan muloqot registri (sen/siz)ni aniqlash va qulflash
   */
  detectAndUpdateRegister(text) {
    if (!text || typeof text !== "string") return this.dialogueState.register || "formal";
    const lower = text.toLowerCase();

    // 1. Aniq informal signallar ("sen")
    const isInformal = /\b(?:sen|seni|senga|senda|sendan|qalesan|qalaysan|nima gap|charchadingmi|qilyapsan|o'zingchi|aytgin|yozgin|gapir)\b/i.test(lower);

    // 2. Aniq formal signallar ("siz")
    const isFormal = /\b(?:siz|sizni|sizga|sizda|sizdan|assalomu alaykum|yaxshimisiz|charchamadingizmi|qilyapsiz|aytasizmi|yozing|gapiring|iltimos|rahmat sizga)\b/i.test(lower);

    if (isInformal && !isFormal) {
      this.dialogueState.register = "informal";
    } else if (isFormal && !isInformal) {
      this.dialogueState.register = "formal";
    } else if (!this.dialogueState.register) {
      // Default: formal ('siz') hurmat bilan
      this.dialogueState.register = "formal";
    }

    return this.dialogueState.register;
  }

  setPendingOffer(offer) {
    this.dialogueState.pendingOffer = offer;
  }

  declineTopic(topic) {
    if (topic && !this.dialogueState.declinedTopics.includes(topic)) {
      this.dialogueState.declinedTopics.push(topic);
    }
    this.dialogueState.pendingOffer = null;
  }

  isTopicDeclined(topic) {
    return this.dialogueState.declinedTopics.includes(topic);
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = CognitiveMemory;
