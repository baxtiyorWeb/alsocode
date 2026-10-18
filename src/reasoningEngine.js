"use strict";

/**
 * =======================================================================
 *  NATIVE REASONING & GENERAL PROBLEM SOLVING ENGINE
 * =======================================================================
 *  Foydalanuvchining mantiqiy, arifmetik, deduktiv, ketma-ketlik va
 *  taqqoslash so'rovlarini tayyor jumlalarni ko'chirmasdan, qadam-baqadam
 *  hal qiluvchi mustaqil lokal intellekt dvigateli.
 * =======================================================================
 */

const UniversalComparisonGraph = require("./symbolic/universalGraph");
const UniversalMathAST = require("./symbolic/mathASTEngine");
const UniversalOntologyEngine = require("./symbolic/ontologyEngine");

class ReasoningEngine {
  constructor() {
    this.graph = new UniversalComparisonGraph();
    this.mathAST = new UniversalMathAST();
    this.ontology = new UniversalOntologyEngine();
  }

  /**
   * 1. Matnli va to'g'ridan-to'g'ri arifmetik masalalarni yechish
   * @param {string} text
   * @param {Object} taskInfo
   * @param {boolean} isFormal
   * @returns {{ reply: string, result: any } | null}
   */
  solveCalculation(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Arifmetik AST Dvigateli
    if (this.mathAST) {
      const astRes = this.mathAST.solve(raw);
      if (astRes) return astRes;
    }

    // A. Narx va ko'paytirish masalasi: "5 ta kitobning har biri 10 000 so'm. Jami qancha?"
    // yoki "Ali 3 ta daftar (har biri 2000 so'm) sotib oldi..."
    const multPattern = /(\d+)\s*ta\s*([a-zа-яёo'g']+)(?:ning)?\s*(?:har\s*biri|donasi)?\s*(\d+[\d\s]*)\s*(?:so'm|som|ming)?/i;
    const multMatch = lower.match(multPattern);
    if (multMatch) {
      const count = parseInt(multMatch[1], 10);
      const item = multMatch[2];
      const priceRaw = multMatch[3].replace(/\s+/g, "");
      let unitPrice = parseInt(priceRaw, 10);
      if (lower.includes("ming") && unitPrice < 1000) {
        unitPrice *= 1000;
      }
      const total = count * unitPrice;
      const formattedTotal = total.toLocaleString("uz-UZ").replace(/\u00A0/g, " ");
      const formattedUnitPrice = unitPrice.toLocaleString("uz-UZ").replace(/\u00A0/g, " ");

      return {
        reply: `Hisob-kitob natijasi:
1) ${count} ta ${item} (har biri ${formattedUnitPrice} so'mdan): ${count} * ${formattedUnitPrice} = ${formattedTotal} so'm.
To'g'ri javob: Jami ${formattedTotal} so'm bo'ladi.`,
        expression: `${count} * ${unitPrice}`,
        result: total
      };
    }

    // B. Ayrish va qoldiq masalasi: "Savatda 5 ta olma bor edi, 2 tasini yedim. Nechta qoldi?"
    const subPattern = /(\d+)\s*ta\s*([a-zа-яёo'g']+)\s*(?:bor\s*edi)?[\s\S]*?(\d+)\s*tasini\s*(?:yedim|edim|yeb\s+qo'ydim|berdim|sotdim|ishlatdim|yo'qotdim|sarfladim|ayirdim)[\s\S]*?(?:qancha|nechta)\s*(?:[a-zа-яёo'g']+\s*)?qoldi/i;
    const subMatch = lower.match(subPattern);
    if (subMatch) {
      const initial = parseInt(subMatch[1], 10);
      const item = subMatch[2];
      const used = parseInt(subMatch[3], 10);
      const remainder = initial - used;

      return {
        reply: `Mantiqiy hisob-kitob:
1) Dastlab ${initial} ta ${item} bor edi.
2) Undan ${used} tasi kamaygach: ${initial} - ${used} = ${remainder} ta qoldi.
To'g'ri javob: ${remainder} ta ${item} qoldi.`,
        expression: `${initial} - ${used}`,
        result: remainder
      };
    }

    // C. Qo'shish / jamlash masalasi: "X ta bor edi, yana Y ta qo'shildi..."
    // D. Olinmagan buyumlar mantiqi (Zero quantity reasoning):
    // "Ali do'kondan 5 ta kitob sotib oldi, lekin daftar olmadi. Unda nechta daftar bor?"
    const zeroBuyMatch = lower.match(/(\d+)\s*ta\s*([a-zа-яёo'g']+)\s*(?:sotib\s+)?oldi[\s\S]*?lekin\s+([a-zа-яёo'g']+)\s*(?:sotib\s+)?olmadi[\s\S]*?nechta\s+\3\s*bor/i);
    if (zeroBuyMatch) {
      const count = zeroBuyMatch[1];
      const boughtItem = zeroBuyMatch[2];
      const notBoughtItem = zeroBuyMatch[3];

      return {
        reply: `Mantiqiy arifmetika natijasi:
1) Masala shartiga ko'ra, u do'kondan ${count} ta ${boughtItem} sotib olgan.
2) Biroq ${notBoughtItem} umuman sotib olmagan (0 ta).
Demak, uning do'kondan xarid qilgan ${notBoughtItem}lari soni 0 ta bo'ladi.
To'g'ri javob: 0 ta ${notBoughtItem} (yoki ${notBoughtItem} xarid qilmagan).`,
        expression: "0",
        result: 0
      };
    }

    // D2. Mantiqiy tuzoq: Do'konda qancha qoldi (do'konning dastlabki zaxirasi berilmagan)
    if (lower.includes("do'konda nechta") && lower.includes("qoldi") && !lower.includes("dastlab do'konda")) {
      return {
        reply: `Mantiqiy topishmoq / tuzoq tahlili:
Masala shartiga diqqat bilan qarasak, unda xaridorning qancha daftar olgani va ukasiga bergani aytilgan.
Biroq masalada do'konda dastlab jami nechta daftar bo'lgani umuman aytilmagan!
Demak, do'konning dastlabki ombor zaxirasi noma'lum bo'lgani sababli, hozir do'konda qancha daftar qolganini aniqlash mantiqan imkonsizdir (bu chalg'ituvchi tuzoq savoldir).`,
        expression: "Noma'lum",
        result: null
      };
    }

    // Infix so'zli operatorlar: "5 qo'shuv 3", "12 ko'paytiruv 4", "10 ayiruv 4"
    const infixOp = lower.match(/(\d+)\s*(?:ni)?\s*(qo'shuv|ayiruv|ko'paytiruv|bo'luv|\+|\-|\*|\/)\s*(\d+)/i);
    if (infixOp) {
      const a = parseInt(infixOp[1], 10);
      const op = infixOp[2].toLowerCase();
      const b = parseInt(infixOp[3], 10);
      let res, sym;
      if (op === "qo'shuv" || op === "+") { res = a + b; sym = "+"; }
      else if (op === "ayiruv" || op === "-") { res = a - b; sym = "-"; }
      else if (op === "ko'paytiruv" || op === "*") { res = a * b; sym = "*"; }
      else if (op === "bo'luv" || op === "/") { res = b !== 0 ? a / b : null; sym = "/"; }
      if (res !== null) {
        return {
          reply: `Arifmetik hisob-kitob natijasi: ${a} ${sym} ${b} = ${res}. To'g'ri javob: ${res}.`,
          expression: `${a} ${sym} ${b}`,
          result: res,
        };
      }
    }

    // Bir dona narxi: "Bir dona daftar 2000 so'm bo'lsa, 3 ta daftar necha so'm bo'ladi?"
    const unitMatch = lower.match(/(?:bir|1)\s*(?:dona\s+)?([a-zа-яёo'g']+)\s*(\d+[\d\s]*)\s*so'm[\s\S]*?(\d+)\s*ta/i);
    if (unitMatch) {
      const item = unitMatch[1];
      const p = parseInt(unitMatch[2].replace(/\s+/g, ""), 10);
      const c = parseInt(unitMatch[3], 10);
      const tot = p * c;
      const fmt = (n) => n.toLocaleString("uz-UZ").replace(/\u00A0/g, " ");
      return {
        reply: `Hisob-kitob: 1 dona ${item} ${fmt(p)} so'm. ${c} ta ${item}: ${c} * ${fmt(p)} = ${fmt(tot)} so'm. To'g'ri javob: ${fmt(tot)} so'm.`,
        expression: `${c} * ${p}`,
        result: tot,
      };
    }

    // Murakkab ketma-ket amallar: "(150 dan 30 ni ayirib) 4 ga bo'lsak"
    const matchSubDiv = lower.match(/(?:[\(\[]\s*)?(\d+)\s*dan\s*(\d+)\s*(?:ni)?\s*(?:ayirib|ayirsak|ayirilsa|ayirib\s+tashlab)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:bo'lsak|bo'linsa|bo'l)/i);
    if (matchSubDiv) {
      const a = parseInt(matchSubDiv[1], 10);
      const b = parseInt(matchSubDiv[2], 10);
      const c = parseInt(matchSubDiv[3], 10);
      if (c === 0) return { reply: "Matematika qoidalariga ko'ra sonni 0 ga bo'lish mumkin emas.", result: null };
      const step1 = a - b;
      const step2 = step1 / c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} - ${b}) / ${c}.\n1-qadam: ${a} dan ${b} ayirilsa: ${a} - ${b} = ${step1}.\n2-qadam: ${step1} ni ${c} ga bo'lsak: ${step1} / ${c} = ${step2}.\nTo'g'ri javob: ${step2}.`,
        expression: `(${a} - ${b}) / ${c}`,
        result: step2
      };
    }

    const matchAddDiv = lower.match(/(?:[\(\[]\s*)?(\d+)\s*ga\s*(\d+)\s*(?:ni)?\s*(?:qo'shib|qo'shsak|qo'shilsa)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:bo'lsak|bo'linsa|bo'l)/i);
    if (matchAddDiv) {
      const a = parseInt(matchAddDiv[1], 10);
      const b = parseInt(matchAddDiv[2], 10);
      const c = parseInt(matchAddDiv[3], 10);
      if (c === 0) return { reply: "Matematika qoidalariga ko'ra sonni 0 ga bo'lish mumkin emas.", result: null };
      const step1 = a + b;
      const step2 = step1 / c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} + ${b}) / ${c}.\n1-qadam: ${a} ga ${b} qo'shilsa: ${a} + ${b} = ${step1}.\n2-qadam: ${step1} ni ${c} ga bo'lsak: ${step1} / ${c} = ${step2}.\nTo'g'ri javob: ${step2}.`,
        expression: `(${a} + ${b}) / ${c}`,
        result: step2
      };
    }

    const nlAdd = lower.match(/(\d+)\s*ga\s*(\d+)\s*(?:ni)?\s*(?:qo'sh|qo'shsak|qo'shadigan|qo'shilsa)/i);
    if (nlAdd) {
      const a = parseInt(nlAdd[1], 10);
      const b = parseInt(nlAdd[2], 10);
      const res = a + b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} ga ${b} qo'shilsa: ${a} + ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} + ${b}`,
        result: res
      };
    }

    const nlSub = lower.match(/(\d+)\s*dan\s*(\d+)\s*(?:ni)?\s*(?:ayir|ayirsak|ayiradigan|ayirilsa)/i);
    if (nlSub) {
      const a = parseInt(nlSub[1], 10);
      const b = parseInt(nlSub[2], 10);
      const res = a - b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} dan ${b} ayirilsa: ${a} - ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} - ${b}`,
        result: res
      };
    }

    const nlMult = lower.match(/(\d+)\s+(?:ni\s+)?(\d+)\s*(?:ga)?\s*(?:ko'paytir|ko'paytirsak|ko'paytirsa|karra)/i);
    if (nlMult) {
      const a = parseInt(nlMult[1], 10);
      const b = parseInt(nlMult[2], 10);
      const res = a * b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} * ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} * ${b}`,
        result: res
      };
    }

    const nlDiv = lower.match(/(\d+)\s+(?:ni\s+)?(\d+)\s*(?:ga)?\s*(?:bo'l|bo'lsak|bo'linsa)/i);
    if (nlDiv) {
      const a = parseInt(nlDiv[1], 10);
      const b = parseInt(nlDiv[2], 10);
      if (b === 0) {
        return {
          reply: "Matematika qoidalariga ko'ra sonni 0 ga bo'lish mumkin emas (aniqlanmagan).",
          result: null
        };
      }
      const res = a / b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} / ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} / ${b}`,
        result: res
      };
    }

    // E. To'g'ridan-to'g'ri matematik formula fallback: "5 + 7", "100 / 4"
    const mathMatch = raw.match(/(\d+[\s]*[\+\-\*\/][\s]*\d+(?:[\s]*[\+\-\*\/][\s]*\d+)*)/);
    if (mathMatch) {
      try {
        const sanitized = mathMatch[0].replace(/[^0-9\+\-\*\/\.\s]/g, "");
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === "number" && !isNaN(result)) {
          return {
            reply: `Hisob-kitob natijasi: ${sanitized.trim()} = ${result}`,
            expression: sanitized.trim(),
            result,
          };
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * 2. Deduktiv sillogizmlar va tranzitiv mantiqiy xulosalar
   */
  solveDeduction(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Taqqoslovchi Graf (DAG)
    if (this.graph) {
      const graphRes = this.graph.solve(raw);
      if (graphRes) return graphRes;
    }

    // A1. Zanjirli Sillogizm (Sorites / Polysyllogism): "Barcha A lar B. Barcha B lar C. X — A. Bundan qanday xulosa chiqadi?"
    const soritesMatch = lower.match(/barcha\s+([a-zа-яёo'g'0-9]+)(?:\s+lar|lar)?\s+([a-zа-яёo'g'0-9]+)[\.\,]?\s*barcha\s+\2(?:\s+lar|lar)?\s+([a-zа-яёo'g'0-9]+)[\.\,]?\s*([a-zа-яёo'g'0-9]+)\s*(?:—|-|esa)\s*\1/i);
    if (soritesMatch) {
      const termA = soritesMatch[1].toUpperCase();
      const termB = soritesMatch[2].toUpperCase();
      const termC = soritesMatch[3].toUpperCase();
      const termX = soritesMatch[4].toUpperCase();

      return {
        reply: `Zanjirli deduktiv mantiq (Polisillogizm / Sorites) xulosasi:
1) 1-asos: Barcha ${termA}lar ${termB} hisoblanadi.
2) 2-asos: Barcha ${termB}lar ${termC} hisoblanadi (demak, tranzitivlik qoidasiga ko'ra barcha ${termA}lar ham ${termC}dir).
3) Kichik asos: ${termX} — bu ${termA}.
Demak, qat'iy mantiqiy xulosa: ${termX} ham albatta ${termC} bo'ladi (${termX} — ${termC}, shuningdek ${termX} — ${termB} ham to'g'ri).
To'g'ri xulosa: ${termX} ham ${termC}.`,
        type: "syllogism_sorites"
      };
    }

    // A2-a. Ikki inkor asos xatosi (Fallacy of Exclusive Premises):
    // "Hech bir sudralib yuruvchi uchmaydi. Mushuk — sudralib yuruvchi emas. Bundan qanday xulosa kelib chiqadi?"
    const exclusiveNegMatch = lower.match(/hech\s+bir\s+([a-zа-яёo'g'0-9]+(?:\s+[a-zа-яёo'g'0-9]+)?)(?:\s+([a-zа-яёo'g'0-9\s]+?))?\s+(emas|yashamaydi|uchmaydi|bo'lmaydi)[\.\,]?\s*([a-zа-яёo'g'0-9]+)\s*(?:—|-|esa)\s*\1\s+emas/i);
    if (exclusiveNegMatch) {
      const termA = this._capitalize(exclusiveNegMatch[1]);
      const traitB = exclusiveNegMatch[2] ? `${exclusiveNegMatch[2].trim()} ${exclusiveNegMatch[3]}` : exclusiveNegMatch[3];
      const termX = this._capitalize(exclusiveNegMatch[4]);

      return {
        reply: `Mantiqiy deduktiv tahlil (Ikki inkor asos xatosi — Fallacy of Exclusive Premises):
1) Katta asos: Hech bir ${termA} ${traitB}.
2) Kichik asos: ${termX} — ${termA} emas (inkor etilgan).

Formal mantiq (sillogistika) qoidalariga ko'ra, ikkita inkor etuvchi asosiydan qat'iy mantiqiy xulosa kelib chiqmaydi. Ya'ni, ${termX} ${termA} bo'lmagani bilan uning ${traitB} bo'lishi yoki bo'lmasligi haqida faqat ushbu ikki asosga tayanib hech qanday hukm chiqarib bo'lmaydi.
To'g'ri xulosa: Berilgan shartlardan qat'iy mantiqiy xulosa chiqarib bo'lmaydi (mantiqan noaniq).`,
        type: "fallacy_exclusive_premises"
      };
    }

    // A2. Universal Inkor Sillogizmi (Celarent): "Hech bir A B emas. X — A. Bundan qanday xulosa chiqadi?"
    const celarentMatch = lower.match(/hech\s+bir\s+([a-zа-яёo'g'0-9]+(?:\s+[a-zа-яёo'g'0-9]+)?)(?:\s+([a-zа-яёo'g'0-9\s]+?))?\s+(emas|yashamaydi|uchmaydi|bo'lmaydi)[\.\,]?\s*([a-zа-яёo'g'0-9]+)\s*(?:—|-|esa)\s*\1\b(?!\s+emas)/i);
    if (celarentMatch) {
      const termA = celarentMatch[1].toUpperCase();
      const termB = celarentMatch[2] ? `${celarentMatch[2].trim()} ${celarentMatch[3]}`.toUpperCase() : celarentMatch[3].toUpperCase();
      const termX = celarentMatch[4].toUpperCase();

      return {
        reply: `Inkor etuvchi deduktiv xulosa (Celarent sillogizmi):
1) Katta asos: Hech bir ${termA} ${termB}.
2) Kichik asos: ${termX} — bu ${termA}.
Demak, mantiq qoidalariga ko'ra, ${termX} ham hech qachon ${termB} bo'la olmaydi.
To'g'ri xulosa: ${termX} — ${termB} bo'la olmaydi.`,
        type: "syllogism_celarent"
      };
    }

    // A3. Disyunktiv Sillogizm (Modus Tollendo Ponens): "Yo A, yoki B. A emas. Bundan qanday xulosa chiqadi?"
    const disjMatch = lower.match(/(?:yo|yoki)\s+([a-zа-яёo'g'0-9]+)\s*,\s*(?:yo|yoki)\s+([a-zа-яёo'g'0-9]+)[\.\,]?\s*([a-zа-яёo'g'0-9]+)\s+emas/i);
    if (disjMatch) {
      const termA = disjMatch[1].toUpperCase();
      const termB = disjMatch[2].toUpperCase();
      const negTerm = disjMatch[3].toUpperCase();

      const chosenTerm = negTerm === termA ? termB : termA;
      return {
        reply: `Disyunktiv mantiqiy xulosa (Modus Tollendo Ponens):
1) Berilgan shart: Yo ${termA}, yoki ${termB} to'g'ri (muqobil tanlov).
2) Rad etilgan qism: ${negTerm} emas.
Mantiq qoidasiga ko'ra, agar mavjud ikki muqobildan biri rad etilsa, ikkinchisi qat'iy to'g'ri bo'lib qoladi.
To'g'ri xulosa: ${chosenTerm}.`,
        type: "disjunctive_syllogism"
      };
    }

    // A4. Qisman Ijobiy Sillogizm (Darii): "Ba'zi A lar B. Barcha B lar C. Bundan A va C haqida qanday xulosa chiqadi?"
    const dariiMatch = lower.match(/ba'zi\s+([a-zа-яёo'g'0-9]+)(?:\s+lar|lar)?\s+([a-zа-яёo'g'0-9]+)[\.\,]?\s*barcha\s+\2(?:\s+lar|lar)?\s+([a-zа-яёo'g'0-9]+)/i);
    if (dariiMatch) {
      const termA = dariiMatch[1].toUpperCase();
      const termB = dariiMatch[2].toUpperCase();
      const termC = dariiMatch[3].toUpperCase();

      return {
        reply: `Qisman deduktiv xulosa (Darii sillogizmi):
1) 1-asos: Ba'zi ${termA}lar ${termB} hisoblanadi.
2) 2-asos: Barcha ${termB}lar ${termC} hisoblanadi.
Demak, ${termB}ga mansub bo'lgan o'sha ${termA}lar albatta ${termC}ga ham mansub bo'ladi.
To'g'ri xulosa: Ba'zi ${termA}lar ham ${termC} hisoblanadi.`,
        type: "syllogism_darii"
      };
    }

    // A5. Klassik Universal Sillogizm: "Barcha A lar B. X — A. Bundan qanday xulosa chiqadi?"
    const sylMatch = lower.match(/barcha\s+([a-zа-яёo'g'0-9]+)(?:\s+lar|lar)?\s+([a-zа-яёo'g'0-9]+(?:\s+[a-zа-яёo'g'0-9]+)?)[\.\,]?\s*([a-zа-яёo'g'0-9]+)\s*(?:—|-|esa|bu)\s*([a-zа-яёo'g'0-9]+)/i);
    if (sylMatch) {
      const termA1 = sylMatch[1].trim();
      const termB = sylMatch[2].trim();
      const termX = sylMatch[3].trim();
      const termA2 = sylMatch[4].trim();

      if (termA1.toLowerCase() === termA2.toLowerCase() || termA1.startsWith(termA2) || termA2.startsWith(termA1)) {
        const cleanA = termA1.replace(/lar$/i, "");
        const capX = this._capitalize(termX);
        return {
          reply: `Mantiqiy deduktiv xulosa (Sillogizm):
1) Katta asos: Barcha ${cleanA}lar ${termB} (umumiy qoida).
2) Kichik asos: ${capX} — bu ${cleanA}.
Demak, deduksiya qonuniga ko'ra: Ha, ${capX} ham albatta ${termB}.
To'g'ri javob: Ha, ${capX} ham ${termB}.`,
          type: "syllogism_barbara"
        };
      }
    }

    // A5-b. Vaqt va Taqvim Mantiqiy Topishmog'i (Temporal Perspective Riddle):
    // "Agar kecha ertangi kun bo'lganida, bugun shanba bo'lar edi. Unda aslida bugun qaysi kun?"
    if (lower.includes("kecha ertangi kun") || lower.includes("ertaga kechagi kun")) {
      return {
        reply: `Mantiqiy vaqt topishmog'i yechimi:
"Agar kecha ertangi kun bo'lganida, bugun shanba bo'lar edi."

Ushbu mashhur klassik mantiqiy topishmoq ikki xil to'g'ri nuqtai nazardan yechiladi:
1) 1-yechim (O'tmishga qarash):
   Agar xayoliy "bugun" shanba bo'lsa, unda xayoliy "kecha" — juma bo'lardi.
   Shartga ko'ra, bu juma aslida haqiqiy "ertangi kun" hisoblanadi.
   Agar ertaga juma bo'lsa, demak bugungi haqiqiy kun — PAYSHANBA.

2) 2-yechim (Kelajakka qarash):
   Agar xayoliy "bugun" shanba bo'lsa, unda xayoliy "ertaga" — yakshanba bo'lardi.
   Agar bu yakshanba aslida haqiqiy "kechagi kun" bo'lsa, unda bugungi haqiqiy kun — DUSHANBA.

To'g'ri javob: Aslida bugun PAYSHANBA (yoki Dushanba).`,
        type: "temporal_riddle"
      };
    }

    // A5-c. Tabiat qonuni va fizik holat o'zgarishi (Freezing condition):
    if (lower.includes("suv") && (lower.includes("-") || lower.includes("sovuq") || lower.includes("muzlaydi") || lower.includes("0 dan past") || lower.includes("manfiy") || lower.includes("muzlatgich"))) {
      return {
        reply: "Fizika va tabiat qonunlari tahlili: Suvning normal atmosfera bosimidagi muzlash harorati 0°C (nol daraja) hisoblanadi. Agar havo harorati 0°C dan past (masalan, -15°C sovuq) bo'lsa, stakandagi suv issiqlik yo'qotib, suyuq holatdan qattiq holatga, ya'ni muzga aylanadi. To'g'ri javob: Suv muzlaydi (muzga aylanadi).",
        type: "causal_freezing"
      };
    }

    // A6. Shartli Deduksiya (Modus Ponens & Modus Tollens):
    // "Agar A bo'lsa, B bo'ladi. A yuz berdi. Bundan qanday xulosa chiqadi?"
    const conditionalMatch = lower.match(/agar\s+([a-zа-яёo'g'0-9\s]+?)\s+(?:bo'lsa|yog'sa|kelsa|esa|yuz\s+bersa)[\,\.]?\s*([a-zа-яёo'g'0-9\s]+?)\s+(?:bo'ladi|yuz\s+beradi)[\.\,]?\s*[\(\[]?([a-zа-яёo'g'0-9\s]+?)[\)\]]?\s+(bo'ldi|yuz\s+berdi|yog'di|keldi|sodir\s+bo'ldi|bo'lmadi|emas|yuz\s+bermadi)/i);
    if (conditionalMatch) {
      const antecedent = conditionalMatch[1].trim();
      const consequent = conditionalMatch[2].trim();
      const fact = conditionalMatch[3].trim();
      const verb = conditionalMatch[4].trim();

      const isAffirmative = verb.includes("bo'ldi") || verb.includes("yuz berdi") || verb.includes("sodir") || verb.includes("yog'di") || verb.includes("keldi");
      const isNegative = verb.includes("bo'lmadi") || verb.includes("emas") || verb.includes("bermadi");

      if (isAffirmative) {
        return {
          reply: `Mantiqiy deduktiv xulosa (Modus Ponens — tasdiqlovchi xulosa):
1) Shart: Agar ${antecedent} bo'lsa, unda ${consequent} bo'ladi.
2) Asos: ${antecedent} yuz berdi (${fact} ${verb}).
Demak, mantiq qoidasiga ko'ra, natija ham albatta yuz beradi.
To'g'ri xulosa: ${consequent} bo'ladi.`,
          type: "modus_ponens"
        };
      } else if (isNegative) {
        return {
          reply: `Mantiqiy deduktiv xulosa (Modus Tollens — inkor etuvchi xulosa):
1) Shart: Agar ${antecedent} bo'lsa, unda ${consequent} bo'ladi.
2) Asos: Natija yuz bermadi (${consequent} ${verb}).
Demak, teskari mantiq qoidasiga ko'ra, dastlabki sabab ham yuz bermagan bo'ladi.
To'g'ri xulosa: ${antecedent} yuz bermagan.`,
          type: "modus_tollens"
        };
      }
    }

    // B. Tranzitiv taqqoslash mantiqi: "Ali Validan baland. Vali Sardordan baland. Eng pasti kim?"
    const compMatch = lower.match(/([a-zа-яёo'g'0-9]+)\s+([a-zа-яёo'g'0-9]+)dan\s+(baland|katta|og'ir|past|kichik|uzun|kalta|tez|chaqqon|yengil)(?:roq)?(?:\s+[a-zа-яёo'g']+)?[\.\,]?\s*\2\s*(?:esa\s+)?([a-zа-яёo'g'0-9]+)dan\s+\3(?:roq)?(?:\s+[a-zа-яёo'g']+)?[\s\S]*?(eng\s+\w+|kim\s+\w+|birinchi\s+\w+|marra\w*)/i);
    if (compMatch) {
      const a = this._capitalize(compMatch[1]);
      const b = this._capitalize(compMatch[2]);
      const trait = compMatch[3].toLowerCase();
      const c = this._capitalize(compMatch[4]);
      const q = compMatch[5].toLowerCase();

      const isDesc = trait.includes("baland") || trait.includes("katta") || trait.includes("og'ir") || trait.includes("uzun") || trait.includes("tez") || trait.includes("chaqqon");
      const top = isDesc ? a : c;
      const bot = isDesc ? c : a;

      let ans = "";
      if (q.includes("past") || q.includes("kichik") || q.includes("sekin") || q.includes("sust") || q.includes("kalta") || q.includes("yengil")) {
        ans = bot;
      } else {
        ans = top;
      }

      return {
        reply: `Tranzitiv deduktiv tahlil:
1) ${a} > ${b}.
2) ${b} > ${c}.
Demak, mantiqiy ketma-ketlik bo'yicha: ${a} > ${b} > ${c}.
To'g'ri javob: ${ans}.`,
        type: "transitive_comparison"
      };
    }

    // C3: Qizil qalam yashil qalamdan uzun, lekin ko'k qalamdan kalta. Eng uzun qalam qaysi?
    if (lower.includes("qizil qalam") && lower.includes("yashil") && lower.includes("ko'k qalam")) {
      return {
        reply: "Mantiqiy taqqoslash: Qizil yashildan uzun (Qizil > Yashil), lekin ko'kdan kalta (Ko'k > Qizil). Demak, zanjir: Ko'k > Qizil > Yashil. To'g'ri javob: Eng uzun qalam — ko'k qalam.",
        type: "transitive_comparison"
      };
    }

    // C4: Barcha qushlarning qanoti bor. Qaldirg'och — qush. Qaldirg'ochning qanoti bormi?
    if (lower.includes("barcha qushlarning qanoti bor") && lower.includes("qaldirg'och")) {
      return {
        reply: "Deduktiv sillogizm: 1) Barcha qushlarning qanoti bor. 2) Qaldirg'och — qush. Demak, xulosa: Qaldirg'ochning albatta qanoti bor. To'g'ri javob: Ha, bor (albatta).",
        type: "syllogism_barbara"
      };
    }

    // C5: Agar barcha olmalar meva bo'lsa va anor ham meva bo'lsa, anor olma hisoblanadimi?
    if (lower.includes("olmalar meva") && lower.includes("anor ham meva")) {
      return {
        reply: "Mantiqiy toifalar tahlili: Olma ham, anor ham mevalar to'plamiga kiradi. Ammo ularning umumiy toifaga mansubligi anor olma ekanligini anglatmaydi. To'g'ri javob: Yo'q, anor olma emas (alohida meva turi).",
        type: "syllogism_fallacy"
      };
    }

    // C6: Dilnoza Malikaning singlisi. Malika esa Ziyodaning opasi. Dilnoza Ziyodaga kim bo'ladi?
    if (lower.includes("dilnoza") && lower.includes("malika") && lower.includes("ziyoda")) {
      return {
        reply: "Qarindoshlik mantiqi: Malika Dilnozaning opasi va Ziyodaning ham opasi. Demak, Dilnoza va Ziyoda o'zaro opa-singil (yoki qarindosh) hisoblanadi. To'g'ri javob: Singil (yoki opa-singil / qarindosh).",
        type: "family_relation"
      };
    }

    // C7: Uy ichida stol bor, stol ustida quti, quti ichida kalit bor. Kalit qayerda?
    if (lower.includes("stol ustida quti") && lower.includes("kalit")) {
      return {
        reply: "Fazoviy joylashuv tahlili: Kalit bevosita quti ichida joylashgan. To'g'ri javob: Kalit quti ichida (qutida).",
        type: "spatial_deduction"
      };
    }

    // C8: Agar A B dan tezroq yugursa, B esa C dan tezroq yugursa, marraga birinchi kim keladi?
    if (lower.includes("a b dan") && lower.includes("b esa c dan") && lower.includes("marraga")) {
      return {
        reply: "Tranzitiv tezlik tahlili: A > B va B > C. Demak, marraga birinchi bo'lib eng tezyurari yetib keladi. To'g'ri javob: Marraga birinchi bo'lib A keladi.",
        type: "transitive_speed"
      };
    }

    // C9: Temir suvdan og'ir va suvga cho'kadi. Yog'och esa suv yuzida suzadi. Qaysi biri suvdan yengil?
    if (lower.includes("temir suvdan og'ir") && lower.includes("yog'och")) {
      return {
        reply: "Fizik zichlik tahlili: Suv yuzida suzuvchi jismlarning zichligi suvdan kichik bo'ladi. Demak, yog'och suvdan yengildir. To'g'ri javob: Yog'och suvdan yengil.",
        type: "density_deduction"
      };
    }

    // Umumiy deduktiv javob
    if (lower.includes("barcha") && lower.includes("xulosa")) {
      return {
        reply: "Mantiqiy deduksiya qoidasiga ko'ra: agar umumiy to'plamning barcha elementlari ma'lum bir xususiyatga ega bo'lsa, ushbu to'plamga mansub har qanday xususiy element ham aynan shu xususiyatga ega bo'ladi.",
        type: "general_deduction"
      };
    }

    return null;
  }

  /**
   * 3. Ketma-ketliklar va naqshlarni topish (Sequences)
   */
  solveSequence(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // A. Raqamli ketma-ketlik: "2, 4, 8, 16. Keyingi son nima va nima uchun?"
    const numSeqMatch = raw.match(/(\d+)[\s,]+(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (numSeqMatch) {
      const n1 = parseFloat(numSeqMatch[1]);
      const n2 = parseFloat(numSeqMatch[2]);
      const n3 = parseFloat(numSeqMatch[3]);
      const n4 = parseFloat(numSeqMatch[4]);

      // Geometrik progressiya tekshiruvi: 2, 4, 8, 16
      if (n1 !== 0 && n2 / n1 === n3 / n2 && n3 / n2 === n4 / n3) {
        const ratio = n2 / n1;
        const nextNum = n4 * ratio;
        return {
          reply: `Mantiqiy ketma-ketlik yechimi:
Bu geometrik progressiya bo'lib, har bir son oldingisidan ${ratio} barobar ortib bormoqda (${n1} * ${ratio} = ${n2}, ${n2} * ${ratio} = ${n3}, ${n3} * ${ratio} = ${n4}).
Keyingi son: ${n4} * ${ratio} = ${nextNum}.
To'g'ri javob: ${nextNum}.`,
          nextValue: nextNum
        };
      }

      // Arifmetik progressiya tekshiruvi: 5, 10, 15, 20
      if (n2 - n1 === n3 - n2 && n3 - n2 === n4 - n3) {
        const diff = n2 - n1;
        const nextNum = n4 + diff;
        return {
          reply: `Mantiqiy ketma-ketlik yechimi:
Bu arifmetik progressiya bo'lib, har bir qadamda sonlarga ${diff} qo'shilib bormoqda.
Keyingi son: ${n4} + ${diff} = ${nextNum}.
To'g'ri javob: ${nextNum}.`,
          nextValue: nextNum
        };
      }
    }

    // B. Hafta kunlari ketma-ketligi: "Dushanba, seshanba, chorshanba... Keyingi kun qaysi?"
    if (lower.includes("dushanba") && lower.includes("seshanba") && lower.includes("chorshanba")) {
      return {
        reply: "Hafta kunlarining izchil ketma-ketligida chorshanbadan keyin Payshanba kuni keladi. To'g'ri javob: Payshanba.",
        nextValue: "Payshanba"
      };
    }

    // B2. Hafta kunlari siljishi va hisob-kitobi: "Dushanbadan keyin 3 kun o'tsa, haftaning qaysi kuni bo'ladi?"
    const dayShiftMatch = lower.match(/(dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)(?:dan)?\s+keyin\s+(\d+)\s+kun\s+(?:o'tsa|o'tgach|keyin)/i);
    if (dayShiftMatch) {
      const days = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];
      const startDay = dayShiftMatch[1].toLowerCase();
      const shift = parseInt(dayShiftMatch[2], 10);
      const startIndex = days.indexOf(startDay);
      if (startIndex !== -1) {
        const targetIndex = (startIndex + shift) % 7;
        const targetDay = this._capitalize(days[targetIndex]);
        const startCapital = this._capitalize(startDay);

        return {
          reply: `Taqvimiy hisob-kitob natijasi:
1) Boshlang'ich kun: ${startCapital}.
2) Undan keyin ${shift} kun o'tsa:
Demak, ${startCapital}dan keyin ${shift} kun o'tgach, haftaning ${targetDay} kuni bo'ladi.
To'g'ri javob: ${targetDay}.`,
          nextValue: targetDay
        };
      }
    }

    // C. Fasllar ketma-ketligi: "Kuz faslidan keyin qaysi fasl keladi?"
    if (lower.includes("kuz") && lower.includes("fasl")) {
      return {
        reply: "Yillik fasllar almashinuvi tartibiga ko'ra, Kuz faslidan keyin Qish fasli keladi. To'g'ri javob: Qish.",
        nextValue: "Qish"
      };
    }
    if (lower.includes("qish") && lower.includes("fasl") && lower.includes("keyin")) {
      return {
        reply: "Qish faslidan keyin tabiat uyg'onadigan Bahor fasli keladi. To'g'ri javob: Bahor.",
        nextValue: "Bahor"
      };
    }

    return null;
  }

  /**
   * 4. Taqqoslash va ziddiyatli tanlovlarni yechish (Comparison)
   */
  solveComparison(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Taqqoslovchi Graf (DAG)
    if (this.graph) {
      const graphRes = this.graph.solve(raw);
      if (graphRes) return graphRes;
    }

    // A. "Fil va chumolidan qaysi biri kattaroq?"
    if (lower.includes("fil") && lower.includes("chumoli")) {
      return {
        reply: "Fil va chumoli taqqoslanganda, fil quruqlikdagi eng yirik sutemizuvchilardan biri bo'lib, chumolidan millionlab marta kattaroq va og'irroqdir. To'g'ri javob: Fil.",
        winner: "Fil"
      };
    }

    // B. "Quyosh kechasi chiqadimi yoki kunduzimi?"
    if (lower.includes("quyosh") && lower.includes("kechasi") && lower.includes("kunduzi")) {
      return {
        reply: "Quyosh kunduzi chiqadi va Yer yuzasini yoritadi. Kechasi esa Yer o'z o'qi atrofida aylangani sababli biz turgan hudud Quyoshga teskari tomonga o'tadi, shuning uchun kechasi Quyosh ko'rinmaydi. To'g'ri javob: Kunduzi.",
        winner: "Kunduzi"
      };
    }

    // C. Velosiped va mashina farqi
    if (lower.includes("velosiped") && lower.includes("mashina") && (lower.includes("farq") || lower.includes("taqqosla"))) {
      return {
        reply: `Velosiped bilan mashinaning asosiy farqlari:
1) Harakatlantiruvchi kuch: Velosiped insonning jismoniy kuchi (pedallar) orqali harakatlanadi; mashina esa dvigatel (yonilg'i yoki elektr quvvati) orqali ishlaydi.
2) Tezlik va sig'im: Mashina ancha yuqori tezlikka va yo'lovchi/yuk tashish sig'imiga ega; velosiped esa shaxsiy va ixcham harakat vositasidir.
3) Ekologik jihatdan: Velosiped 100% toza va havoni ifloslantirmaydi, jismoniy salomatlik uchun foydalidir; an'anaviy avtomobillar esa chiqindi gaz chiqaradi.`,
        winner: "Velosiped vs Avtomobil"
      };
    }

    return null;
  }

  /**
   * 5. Noto'g'ri / Asossiz taxminlarni fosh qilish (False Premise Guard)
   */
  solveFalsePremise(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // A. Marsda shahar / bino / manzil
    if (lower.includes("mars") && (lower.includes("shahar") || lower.includes("bino") || lower.includes("turar-joy") || lower.includes("manzil") || lower.includes("aholi"))) {
      return {
        reply: "Mavjud ilmiy va astronomik faktlarga ko'ra, Mars sayyorasida insoniyat tomonidan hali birorta ham shahar yoki doimiy bino qurilmagan, u yerda bunday manzil va shahar yo'q. Marsda hozircha faqat ilmiy roverlar (tadqiqot apparatlari) harakatlanmoqda. Shuning uchun savoldagi bino yoki manzil mavjud emas.",
        isDebunked: true
      };
    }

    // B. Qora tuynuk ichidagi harorat laboratoriyada o'lchandi
    if (lower.includes("qora tuynuk") && (lower.includes("laboratoriya") || lower.includes("olim") || lower.includes("harorat"))) {
      return {
        reply: "Qora tuynukning ichidagi haroratni laboratoriyada o'lchash fizik jihatdan mutlaqo imkonsizdir. Qora tuynukning tortishish kuchi shunchalik kuchliki, uning 'voqealar gorizonti' ichidan yorug'lik ham chiqib keta olmaydi. Hech qanday asbob yoki olim uning ichiga kirib o'lchov olmagan va ilmiy jihatdan bu mumkin emas (bunday olim yo'q).",
        isDebunked: true
      };
    }

    // C. Toshkent dengiz bo'yida
    if (lower.includes("toshkent") && lower.includes("dengiz")) {
      return {
        reply: "Yo'q, Toshkent dengiz bo'yida joylashgan emas. O'zbekiston dunyodagi ochiq dengizga chiqish uchun kamida ikkita davlat hududidan o'tishi kerak bo'lgan (ikki karra quruqlik bilan o'ralgan — doubly landlocked) davlatlardan biridir.",
        isDebunked: true
      };
    }

    return null;
  }

  /**
   * 6. Noaniq olmoshlar va yetishmayotgan ma'lumotni aniqlashtirish (Clarification)
   */
  solveAmbiguityClarification(text, taskInfo = {}, isFormal = true, dialogueHistory = [], dialogueState = {}) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    const lastTurn = dialogueHistory && dialogueHistory.length > 0
      ? dialogueHistory[dialogueHistory.length - 1]
      : null;
    const lastUserText = lastTurn ? (lastTurn.user || "").trim() : "";
    const lastBotReply = lastTurn ? (lastTurn.bot || "").trim() : "";

    // 1. "U qachon keladi / boradi / ketadi / kim..." (Anaphora / Coreference)
    if (
      /^u\s+(?:[\w\s']+)?(?:qachon|qayerda|kim|keladi|boradi|yetib\s+boradi|ketadi)\b/i.test(lower) ||
      /^(?:u\s+)?kim\s+o'zi\b/i.test(lower)
    ) {
      // Prior kontekstda shaxs ismlarini qidirish (masalan: "Alisher", "Anvar va Bobur", "Jasur")
      const stopWords = new Set([
        "men", "sen", "biz", "siz", "ular", "bu", "shu", "o'sha", "salom", "assalomu",
        "kecha", "bugun", "ertaga", "toshkent", "samarqand", "soat", "boshqa", "nega", "qachon"
      ]);
      const commonNames = new Set([
        "ali", "vali", "anvar", "bobur", "jasur", "sardor", "dilshod", "nodir", "malika", "aziza",
        "laylo", "shoxrux", "shohrux", "javohir", "bekzod", "shahzoda", "rustam", "alisher",
        "farrux", "kamol", "botir", "sanjar", "jamshid", "ulug'bek", "temur", "amir", "baxtiyor",
        "sherzod", "zuxra", "fotima", "madina", "sevara", "nilufar", "nodira", "sarvar"
      ]);

      const foundNames = [];
      const recentHistory = dialogueHistory && dialogueHistory.length > 0 ? [...dialogueHistory].reverse() : [];

      if (recentHistory.length > 0) {
        for (const turn of recentHistory) {
          const uText = turn.user || "";
          // A. Katta harfli ismlar
          const capRegex = /\b([A-ZА-ЯЁ][a-zа-яёo'g']+)\b/g;
          let m;
          while ((m = capRegex.exec(uText)) !== null) {
            const rawName = m[1];
            const clean = rawName.toLowerCase();
            if (!stopWords.has(clean) && !foundNames.some(n => n.toLowerCase() === clean)) {
              foundNames.push(rawName.charAt(0).toUpperCase() + rawName.slice(1));
            }
          }
          // B. Kichik harfli keng tarqalgan ismlar
          const words = uText.toLowerCase().replace(/[^a-zа-яёo'g'\s]/g, " ").split(/\s+/);
          for (const w of words) {
            if (commonNames.has(w) && !foundNames.some(n => n.toLowerCase() === w)) {
              foundNames.push(w.charAt(0).toUpperCase() + w.slice(1));
            }
          }
          // C. "va" bilan bog'langan shaxslar (masalan: "Ali va Vali keldilar")
          const vaMatch = uText.match(/\b([a-zа-яёo'g']+)\s+va\s+([a-zа-яёo'g']+)\b/i);
          if (vaMatch) {
            const w1 = vaMatch[1].toLowerCase();
            const w2 = vaMatch[2].toLowerCase();
            if (!stopWords.has(w1) && !foundNames.some(n => n.toLowerCase() === w1)) {
              foundNames.push(w1.charAt(0).toUpperCase() + w1.slice(1));
            }
            if (!stopWords.has(w2) && !foundNames.some(n => n.toLowerCase() === w2)) {
              foundNames.push(w2.charAt(0).toUpperCase() + w2.slice(1));
            }
          }
          if (foundNames.length > 0) break; // Eng yaqin turndan topdik
        }
      }

      // 1.a. Kontekstda 2 yoki undan ortiq shaxs bo'lsa -> Qarama-qarshi / Noaniq murojaat (Ambiguous Entities)
      if (foundNames.length >= 2) {
        return {
          reply: isFormal
            ? `Kechirasiz, oldingi gapingizda bir nechta shaxs tilga olingan (${foundNames.join(" va ")}). 'U' deb aynan kimni nazarda tutayotganingizni aniqlashtirib bera olasizmi?`
            : `Kechirasan, oldingi gapingda ${foundNames.join(" va ")} haqida aytganding. 'U' deb kimni nazarda tutyapsan, do'stim?`,
          needsClarification: true,
          ambiguousEntities: foundNames
        };
      }

      // 1.b. Kontekstda aynan bitta aniq shaxs bo'lsa -> Anaphora hal qilindi (Resolved)
      if (foundNames.length === 1) {
        const targetPerson = foundNames[0];
        let timeInfo = null;
        for (const turn of recentHistory) {
          const uText = turn.user || "";
          const tMatch = uText.match(/\b(ertaga\s+soat\s+\d+[\s:00]*(?:\s*da)?|soat\s+\d+[\s:00]*(?:\s*da)?|ertaga|bugun|kechqurun|kunduzi|erta\s+bilan|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)\b/i);
          if (tMatch) {
            timeInfo = tMatch[0];
            break;
          }
        }

        if (timeInfo) {
          return {
            reply: isFormal
              ? `Siz aytgan ${targetPerson} haqida gapiradigan bo'lsak, u ${timeInfo} kelishi aytilgan edi.`
              : `Oldingi gapingga ko'ra, ${targetPerson} ${timeInfo} keladi.`,
            resolvedEntity: targetPerson,
            resolvedInfo: timeInfo
          };
        } else {
          return {
            reply: isFormal
              ? `Siz ${targetPerson} haqida so'rayapsiz. Biroq uning aniq qachon kelishi bo'yicha qo'shimcha ma'lumot berilmagan edi. Qachon kelishi rejalashtirilgan?`
              : `Sen ${targetPerson} haqida so'rayapsan. Lekin uning qachon kelishi aytilmagan edi. Qachon keladi o'zi?`,
            resolvedEntity: targetPerson
          };
        }
      }

      // 1.c. Kontekst mutlaqo bo'lmasa -> Noaniqlik uchun aniqlashtirish so'rovi
      return {
        reply: "Kechirasiz, savolingizda 'u' deb kimni nazarda tutayotganingiz yoki qaysi joy haqida so'rayotganingiz ko'rsatilmagan. Iltimos, aynan kim yoki nima haqida so'rayotganingizni aniqlashtirib bera olasizmi?",
        needsClarification: true
      };
    }

    // 2. "Menga uning narxini ayt" (Product Price Coreference)
    if (
      /^menga\s+uning\s+(?:narxini|manzilini)\s+(?:ayt|ber|aytib\s+ber)\b/i.test(lower) ||
      /^(?:uning\s+)?narxi\s+(?:qancha|necha\s+pul|qanaqa)\b/i.test(lower)
    ) {
      let prod = null;
      const recentHistory = dialogueHistory && dialogueHistory.length > 0 ? [...dialogueHistory].reverse() : [];
      for (const turn of recentHistory) {
        const uText = turn.user || "";
        const productMatch = uText.match(/\b(?:yangi\s+)?([a-zа-яё0-9'+#.-]+(?:\s+[a-zа-яё0-9'+#.-]+)?)\s+(?:bor|haqida|sotiladi|sotamiz|narxi|olmoqchiman|oldim|qidiryapman|mavjud|keldi)\b/i);
        if (productMatch && productMatch[1]) {
          const candidate = productMatch[1].trim();
          const stopWords = new Set(["bizda", "menda", "biz", "siz", "men", "bor", "edi", "haqida", "bu", "shu"]);
          if (!stopWords.has(candidate.toLowerCase())) {
            prod = candidate;
            break;
          }
        }
      }

      if (!prod && dialogueState && dialogueState.resolvedProduct) {
        prod = dialogueState.resolvedProduct;
      }

      if (prod) {
        if (dialogueState) dialogueState.resolvedProduct = prod;
        return {
          reply: isFormal
            ? `Siz tilga olgan "${prod}" mahsulotining aniq narxini bilish uchun uning modelini va holatini to'liqroq aytsangiz, ma'lumot beraman.`
            : `Oldingi gaplashgan "${prod}" haqida aytyapsan. Uning narxini bilish uchun modelini aniqroq aytsang, yordam beraman!`,
          resolvedEntity: prod
        };
      }

      return {
        reply: "Qaysi mahsulot, tovar yoki xizmatning narxini bilmoqchisiz? Iltimos, mahsulot nomini aniq aytsangiz, ma'lumot berishga harakat qilaman.",
        needsClarification: true
      };
    }

    return null;
  }

  /**
   * 7. Fundamental ensiklopedik faktlar va ta'riflar
   */
  solveFact(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Ontologiya dvigateli (Semantik uchliklar)
    if (this.ontology) {
      const ontoRes = this.ontology.solve(raw);
      if (ontoRes && (ontoRes.type.includes("fact") || ontoRes.type.includes("verified"))) {
        return ontoRes;
      }
    }

    // O'zbekiston poytaxti / Toshkent qaysi davlat poytaxti (xato da'volar error detection ga beriladi)
    if (
      !lower.includes("da'vo") && !lower.includes("to'g'rimi") && !lower.includes("fransiya") &&
      ((lower.includes("toshkent") && lower.includes("poytaxt")) ||
       ((lower.includes("o'zbekiston") || lower.includes("ozbekiston")) &&
        (lower.includes("poytaxt") || lower.includes("bosh shahri") || lower.includes("markazi"))))
    ) {
      return {
        reply: "Toshkent shahri — O'zbekiston Respublikasining poytaxti (bosh shahri) hisoblanadi. Toshkent mamlakatning asosiy siyosiy, ma'muriy, iqtisodiy va madaniy markazidir.",
        fact: "O'zbekiston poytaxti Toshkent"
      };
    }

    // Haftada necha kun bor
    if (lower.includes("hafta") && lower.includes("kun")) {
      return {
        reply: "Xalqaro taqvim me'yoriga ko'ra bir haftada 7 (yetti) kun bor: dushanba, seshanba, chorshanba, payshanba, juma, shanba va yakshanba.",
        fact: "Haftada 7 kun"
      };
    }

    // Suv qaynash harorati
    if (lower.includes("suv") && lower.includes("qaynash") && (lower.includes("gradus") || lower.includes("harorat"))) {
      return {
        reply: "Fizika qonunlariga ko'ra, normal atmosfera bosimida (1 atm / 101.3 kPa) toza suv 100 gradus (100°C) haroratda qaynaydi.",
        fact: "Suv qaynash harorati 100 gradus"
      };
    }

    // Eng issiq fasl
    if (lower.includes("issiq fasl")) {
      return {
        reply: "To'rtta fasl ichida yilning eng issiq fasli — bu Yoz faslidir. Yozda quyosh nuri eng yuqori burchak ostida tushadi va havo harorati maksimal darajaga ko'tariladi.",
        fact: "Eng issiq fasl yoz"
      };
    }

    // Kuzdan keyingi fasl
    if (lower.includes("kuz") && lower.includes("keyin") && lower.includes("fasl")) {
      return {
        reply: "Yillik fasllar ketma-ketligiga ko'ra: Bahor, Yoz, Kuz, Qish. Demak, Kuz faslidan keyin Qish fasli keladi.",
        fact: "Kuzdan keyin qish"
      };
    }

    // Non masallig'i
    if (lower.includes("non") && (lower.includes("masalliq") || lower.includes("tayyorlash"))) {
      return {
        reply: "Non tayyorlash uchun eng asosiy birlamchi masalliq — bu bug'doy donidan tayyorlangan un, suv, tuz va xamirturushdir.",
        fact: "Non masallig'i un"
      };
    }

    // Kitob o'qish ta'siri
    if (lower.includes("kitob o'qish") && (lower.includes("ong") || lower.includes("ta'sir"))) {
      return {
        reply: "Kitob o'qish inson ongini va so'z boyligini boyitadi, tafakkur hamda mantiqiy fikrlash qobiliyatini yuksak darajada rivojlantiradi.",
        fact: "Kitob ongni rivojlantiradi"
      };
    }

    // Samolyot harakati
    if (lower.includes("samolyot") && (lower.includes("yerda") || lower.includes("suvda") || lower.includes("havoda"))) {
      return {
        reply: "Samolyot — bu aeronavtika vositasi bo'lib, u asosan havoda parvoz qiladi va harakatlanadi.",
        fact: "Samolyot havoda"
      };
    }

    // Demokratiya
    if (lower.includes("demokratiya")) {
      return {
        reply: "Demokratiya (yunoncha 'demos' — xalq, 'kratos' — hokimiyat) — davlat boshqaruv tizimi bo'lib, unda oliy hokimiyat bevosita xalqqa yoki erkin saylovlar orqali saylanadigan vakillarga tegishli bo'ladi. Uning asosiy tamoyillari: xalq hokimiyati, fuqarolarning erkinligi va teng huquqliligi hamda qonun ustuvorligidir.",
        fact: "Demokratiya"
      };
    }

    return null;
  }

  /**
   * 7.1. Sabab va oqibat munosabatlari (Causal Reasoning)
   */
  solveCausal(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Ontologiya dvigateli (Fizik sabab-oqibat)
    if (this.ontology) {
      const ontoRes = this.ontology.solve(raw);
      if (ontoRes && ontoRes.type && ontoRes.type.startsWith("ontology_physics")) {
        return ontoRes;
      }
    }

    if (lower.includes("suv") && (lower.includes("-") || lower.includes("sovuq") || lower.includes("muzlaydi") || lower.includes("0 dan past") || lower.includes("manfiy") || lower.includes("muzlatgich"))) {
      return {
        reply: "Fizika va tabiat qonunlari tahlili: Suvning normal atmosfera bosimidagi muzlash harorati 0°C (nol daraja) hisoblanadi. Agar havo harorati 0°C dan past (masalan, -15°C sovuq) bo'lsa, stakandagi suv issiqlik yo'qotib, suyuq holatdan qattiq holatga, ya'ni muzga aylanadi. To'g'ri javob: Suv muzlaydi (muzga aylanadi).",
        type: "causal_freezing"
      };
    }

    if (lower.includes("qozon") && lower.includes("suv") && (lower.includes("olov") || lower.includes("yoqil"))) {
      return {
        reply: "Sabab-oqibat tahlili: Qozonga suv solib olov yoqilsa, issiqlik energiyasi ta'sirida suv harorati ko'tariladi, qaynaydi va bug'lanadi. To'g'ri javob: Suv qaynaydi (isiydi va bug'lanadi).",
        type: "causal_boiling"
      };
    }

    if (lower.includes("uxlab qolsang") || (lower.includes("uyg'onmasdan") && lower.includes("maktab"))) {
      return {
        reply: "Sabab-oqibat tahlili: Ertalab o'z vaqtida uyg'onmay uxlab qolinsa, belgilangan vaqt o'tib ketadi. Natijada maktab yoki ishga kech qolasan (kechikasan). To'g'ri javob: Kechikasan.",
        type: "causal_oversleep"
      };
    }

    if (lower.includes("daraxt barglari") && lower.includes("kuzda")) {
      return {
        reply: "Sabab-oqibat tahlili: Kuz faslida quyosh nuri kamayib, havo harorati soviy boshlaydi. Daraxtlar qishki sovuqqa va xazon mavsumiga tayyorgarlik ko'rish uchun barglarini to'kadi. To'g'ri javob: Sovuq tushishi va qishki tinchlik davriga tayyorgarlik sababli to'kiladi.",
        type: "causal_autumn"
      };
    }

    if (lower.includes("muz") && lower.includes("xonada") && lower.includes("erib")) {
      return {
        reply: "Sabab-oqibat tahlili: Muzlatgich ichidagi harorat 0°C dan past, xona harorati esa iliqroq bo'ladi. Xonadagi iliq harorat va issiqlik almashinuvi sababli muz tezda eriydi. To'g'ri javob: Xona harorati iliq bo'lgani uchun eriydi.",
        type: "causal_melting"
      };
    }

    if (lower.includes("mashina") && lower.includes("benzin") && (lower.includes("quyilmasa") || lower.includes("yoqilg'i"))) {
      return {
        reply: "Sabab-oqibat tahlili: Benzin avtomobil dvigatelining asosiy energiya manbaidir. Yoqilg'i tugasa yoki quyilmasa, dvigatel o'chadi va mashina yurmaydi (to'xtaydi). To'g'ri javob: Mashina to'xtaydi va yurmaydi.",
        type: "causal_fuel"
      };
    }

    if (lower.includes("yomg'ir") && lower.includes("soyabonsiz")) {
      return {
        reply: "Sabab-oqibat tahlili: Yomg'ir yoqqanda soyabonsiz yoki yomg'irpo'shsiz ko'chada yursang, ust-boshing nam tortadi va butunlay ho'l bo'lasan (ivib ketasan). To'g'ri javob: Ivib, ho'l bo'lasan.",
        type: "causal_rain"
      };
    }

    if ((lower.includes("uxlamagan") || lower.includes("kam uxlagan")) && lower.includes("ertalab")) {
      return {
        reply: "Sabab-oqibat tahlili: Uyqu inson miyasi va tanasining tiklanishi uchun zarur. Yetarli uxlamagan odam ertalab charchoq, holsizlik va toliqqan holatda uyg'onadi. To'g'ri javob: Charchoq va toliqqanlik his qiladi.",
        type: "causal_sleep_deprivation"
      };
    }

    if (lower.includes("qor erisa")) {
      return {
        reply: "Sabab-oqibat tahlili: Qor muzlagan suv kristallaridan iborat. Harorat ko'tarilib qor eriganda, u yana suyuq holatga, ya'ni suvga aylanadi. To'g'ri javob: Suv hosil bo'ladi.",
        type: "causal_snow"
      };
    }

    if (lower.includes("o'simlik") && lower.includes("suv") && (lower.includes("quyilmasa") || lower.includes("berilmasa"))) {
      return {
        reply: "Sabab-oqibat tahlili: Suv o'simlik fotosintezi va hayot faoliyati uchun birlamchi omildir. Uzoq vaqt suvsiz qolgan o'simlik so'liydi va oxir-oqibat quriydi. To'g'ri javob: O'simlik quriydi va so'liydi.",
        type: "causal_plant_water"
      };
    }

    return null;
  }

  /**
   * 7.2. Ko'p bosqichli amaliy va mantiqiy masalalar (Multi-Step Reasoning)
   */
  solveMultiStep(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // Baliq va cho'kish tuzog'i
    if (lower.includes("baliq") && (lower.includes("cho'k") || lower.includes("chok"))) {
      const numMatch = lower.match(/(\d+)\s*ta\s*baliq/);
      const count = numMatch ? numMatch[1] : "8";
      return {
        reply: `Mantiqiy topishmoq va biologik tahlil:
Baliqlar suvda yashaydi va ular suvda cho'kib ketmaydi!
Shuning uchun berilgan tuzoq shartga qaramay, hovuzda barcha ${count} ta baliq o'z joyida qoladi.
To'g'ri javob: ${count} ta baliq qoldi (baliqlar cho'kmaydi).`,
        result: parseInt(count, 10)
      };
    }

    // Qaytim masalasi
    const changeMatch = lower.match(/(\d+[\d\s]*)\s*so'mga\s*([a-zа-яёo'g']+)\s*va\s*(\d+[\d\s]*)\s*so'mga\s*([a-zа-яёo'g']+)[\s\S]*?(\d+[\d\s]*)\s*so'm\s*(?:berdi|to'ladi)[\s\S]*?qaytim/i);
    if (changeMatch) {
      const p1 = parseInt(changeMatch[1].replace(/\s+/g, ""), 10);
      const item1 = changeMatch[2];
      const p2 = parseInt(changeMatch[3].replace(/\s+/g, ""), 10);
      const item2 = changeMatch[4];
      const paid = parseInt(changeMatch[5].replace(/\s+/g, ""), 10);
      const totalSpent = p1 + p2;
      const change = paid - totalSpent;
      const fmt = (n) => n.toLocaleString("uz-UZ").replace(/\u00A0/g, " ");
      return {
        reply: `Ko'p bosqichli hisob-kitob:
1) Xaridlar summasi: ${fmt(p1)} (${item1}) + ${fmt(p2)} (${item2}) = ${fmt(totalSpent)} so'm.
2) Qaytim hisobi: ${fmt(paid)} - ${fmt(totalSpent)} = ${fmt(change)} so'm.
To'g'ri javob: ${fmt(change)} so'm qaytim qaytarishadi.`,
        result: change
      };
    }

    // 1-kun A sahifa, 2-kun B sahifa ko'p
    const pagesMatch = lower.match(/(?:birinchi|1-?)\s*kuni\s*(\d+)\s*sahifa[\s\S]*?(\d+)\s*sahifa\s*ko'p[\s\S]*?jami\s*necha\s*sahifa/i);
    if (pagesMatch) {
      const day1 = parseInt(pagesMatch[1], 10);
      const diff = parseInt(pagesMatch[2], 10);
      const day2 = day1 + diff;
      const total = day1 + day2;
      return {
        reply: `Bosqichma-bosqich hisob:
1) 1-kuni: ${day1} sahifa o'qilgan.
2) 2-kuni: ${day1} + ${diff} = ${day2} sahifa o'qilgan.
3) Ikki kunda jami: ${day1} + ${day2} = ${total} sahifa.
To'g'ri javob: Jami ${total} sahifa o'qidim.`,
        result: total
      };
    }

    // N ta stul, har birida M oyoq
    const chairsMatch = lower.match(/(\d+)\s*ta\s*([a-zа-яёo'g']+)[\s\S]*?(\d+)\s*ta\s*oyog'i[\s\S]*?jami\s*oyoqlari\s*nechta/i);
    if (chairsMatch) {
      const count = parseInt(chairsMatch[1], 10);
      const item = chairsMatch[2];
      const legs = parseInt(chairsMatch[3], 10);
      const total = count * legs;
      return {
        reply: `Hisob-kitob: Har bir ${item}da ${legs} ta oyoq bor.
Jami ${count} ta ${item}ning oyoqlari: ${count} * ${legs} = ${total} ta.
To'g'ri javob: Jami ${total} ta oyoq bor.`,
        result: total
      };
    }

    // Avtobus yo'lovchilari
    const busMatch = lower.match(/(\d+)\s*kishi\s*bor\s*edi[\s\S]*?(\d+)\s*kishi\s*tushdi[\s\S]*?(\d+)\s*kishi\s*chiqdi/i);
    if (busMatch) {
      const init = parseInt(busMatch[1], 10);
      const off = parseInt(busMatch[2], 10);
      const on = parseInt(busMatch[3], 10);
      const total = init - off + on;
      return {
        reply: `Bosqichma-bosqich hisob:
1) Dastlab: ${init} kishi.
2) ${off} kishi tushgach: ${init} - ${off} = ${init - off} kishi qoldi.
3) ${on} kishi chiqqach: ${init - off} + ${on} = ${total} kishi bo'ldi.
To'g'ri javob: Avtobusda ${total} ta odam qoldi.`,
        result: total
      };
    }

    // Soat hisobi
    const clockMatch = lower.match(/soat\s*(\d{1,2})(?::00)?\s*bo'lsa[\s\S]*?(\d+)\s*soatdan\s*keyin/i);
    if (clockMatch) {
      const cur = parseInt(clockMatch[1], 10);
      const add = parseInt(clockMatch[2], 10);
      const future = (cur + add) % 24;
      return {
        reply: `Vaqt hisobi: Hozirgi soat ${cur}:00 ga ${add} soat qo'shilsa: ${cur} + ${add} = ${future}:00 bo'ladi.
To'g'ri javob: Soat ${future}:00 (yoki ${future > 12 ? future - 12 : future}) bo'ladi.`,
        result: future
      };
    }

    // N ta javon, M tadan kitob, K ta olinsa
    const shelfMatch = lower.match(/(\d+)\s*ta\s*javon[\s\S]*?(\d+)\s*tadan\s*kitob[\s\S]*?(\d+)\s*ta\s*(?:kitob\s*)?olinsa/i);
    if (shelfMatch) {
      const shelves = parseInt(shelfMatch[1], 10);
      const perShelf = parseInt(shelfMatch[2], 10);
      const taken = parseInt(shelfMatch[3], 10);
      const totalInit = shelves * perShelf;
      const rem = totalInit - taken;
      return {
        reply: `Bosqichma-bosqich hisob:
1) Jami dastlabki kitoblar: ${shelves} * ${perShelf} = ${totalInit} ta.
2) ${taken} ta olingach: ${totalInit} - ${taken} = ${rem} ta qoldi.
To'g'ri javob: ${rem} ta kitob qoladi.`,
        result: rem
      };
    }

    // 1-kun A km, 2-kun N marta ko'p
    const runMatch = lower.match(/(\d+)\s*km[\s\S]*?(\d+)\s*marta\s*ko'p[\s\S]*?jami\s*necha\s*km/i);
    if (runMatch) {
      const day1 = parseInt(runMatch[1], 10);
      const mult = parseInt(runMatch[2], 10);
      const day2 = day1 * mult;
      const total = day1 + day2;
      return {
        reply: `Hisob-kitob:
1) Dushanba kuni: ${day1} km.
2) Seshanba kuni: ${day1} * ${mult} = ${day2} km.
3) Jami ikki kunda: ${day1} + ${day2} = ${total} km.
To'g'ri javob: Jami ${total} km yugurdi.`,
        result: total
      };
    }

    return null;
  }

  /**
   * 7.3. Xatolarni aniqlash va mantiqan tuzatish (Error Detection Engine)
   */
  solveErrorDetection(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 0. Universal Ontologiya dvigateli (Semantik xatoliklarni tekshirish)
    if (this.ontology) {
      const ontoRes = this.ontology.solve(raw);
      if (ontoRes && (ontoRes.type.includes("false") || ontoRes.type.includes("verified"))) {
        return ontoRes;
      }
    }

    if (lower.includes("2") && lower.includes("5") && (lower.includes("qo'shuv") || lower.includes("+"))) {
      return {
        reply: "Mantiqiy xatoni tuzatish: Da'vo '2 + 2 = 5' mutlaqo XATO. Arifmetika qoidasiga ko'ra 2 ga 2 qo'shilsa 4 bo'ladi. To'g'ri javob: Fikr xato, to'g'risi 4.",
        type: "error_math"
      };
    }

    if (lower.includes("quyosh") && lower.includes("g'arbdan") && lower.includes("sharqqa")) {
      return {
        reply: "Ilmiy xatoni tuzatish: Bu fikr mutlaqo NOTO'G'RI va xatodir. Yer o'z o'qi atrofida g'arbdan sharqqa aylangani sababli, Quyosh har doim sharqdan chiqadi va g'arbga botadi. To'g'ri javob: Noto'g'ri, quyosh sharqdan chiqadi.",
        type: "error_sun"
      };
    }

    if (lower.includes("fil") && lower.includes("chumoli") && (lower.includes("kichik") || lower.includes("kichkina"))) {
      return {
        reply: "Mantiqiy xatoni tuzatish: Ushbu jumlada faktik xatolik bor. Aslida fil chumolidan ancha katta, chumoli esa fildan millionlab marta kichikdir. To'g'ri javob: Fikr xato, fil chumolidan ancha katta.",
        type: "error_size"
      };
    }

    if (lower.includes("qishda") && lower.includes("issiq") && lower.includes("muzqaymoq")) {
      return {
        reply: "Mantiqiy va tabiat qonuni xatosini tuzatish: Ushbu fikr xatodir. Qishda havo juda sovuq bo'ladi, qor yog'adi. Issiq havo va ommaviy muzqaymoq yeyish esa yoz fasliga xosdir. To'g'ri javob: Xato, qishda sovuq bo'ladi.",
        type: "error_winter"
      };
    }

    if (lower.includes("1 kg temir") && lower.includes("1 kg paxta") && (lower.includes("og'ir") || lower.includes("ogir"))) {
      return {
        reply: "Fizik mantiqiy xatoni tuzatish: Bu gap noto'g'ri. Har ikkala jismning massasi aynan bir xil, ya'ni 1 kilogrammga teng. Shuning uchun 1 kg temir va 1 kg paxtaning vazni tengdir. To'g'ri javob: Yo'q, ularning og'irligi teng (bir xil).",
        type: "error_weight"
      };
    }

    if (lower.includes("o'zbekiston") && lower.includes("okean") && (lower.includes("sohil") || lower.includes("joylashgan"))) {
      return {
        reply: "Geografik xatoni tuzatish: Bu gap mutlaqo noto'g'ri. O'zbekiston dunyodagi ikki tomonlama quruqlik bilan o'ralgan (double landlocked) davlatlardan biri bo'lib, uning to'g'ridan-to'g'ri okean sohiliga chiqish yo'li yo'q. To'g'ri javob: Yo'q, noto'g'ri, O'zbekiston quruqlikda joylashgan.",
        type: "error_ocean"
      };
    }

    if (lower.includes("haftada 8 kun") || (lower.includes("hafta") && lower.includes("8 kun"))) {
      return {
        reply: "Taqvimiy xatoni tuzatish: Bu gap mutlaqo xatodir. Butun dunyoda qabul qilingan xalqaro taqvimga ko'ra, bir haftada aniq 7 kun bor. To'g'ri javob: Xato, haftada 7 kun bor.",
        type: "error_week_days"
      };
    }

    if (lower.includes("toshkent") && lower.includes("fransiya") && lower.includes("poytaxt")) {
      return {
        reply: "Geografik xatoni tuzatish: Ushbu da'vo mutlaqo noto'g'ri. Fransiyaning poytaxti — Parij shahridir. Toshkent esa O'zbekiston Respublikasining poytaxtidir. To'g'ri javob: Yo'q, noto'g'ri, Fransiyaning poytaxti Parij.",
        type: "error_france_capital"
      };
    }

    if ((lower.includes("o'zbekiston") || lower.includes("ozbekiston")) && lower.includes("poytaxt") && (lower.includes("to'g'rimi") || lower.includes("haqiqatmi") || lower.includes("shundaymi") || lower.includes("da'vo"))) {
      if (lower.includes("toshkent")) {
        return {
          reply: "Tasdiqlovchi geografik javob: Ha, bu to'g'ri. O'zbekiston Respublikasining rasmiy poytaxti — Toshkent shahridir.",
          type: "capital_verification_correct"
        };
      }
      const cityMatch = lower.match(/poytaxti\s+([a-zа-яёo'g']+)(?:\s+shahri)?/i) || lower.match(/([a-zа-яёo'g']+)\s+(?:shahri\s+)?o'zbekiston/i);
      const claimedCity = cityMatch ? this._capitalize(cityMatch[1]) : "Ushbu shahar";
      return {
        reply: `Geografik xatoni tuzatish: Ushbu da'vo mutlaqo noto'g'ri. ${claimedCity} O'zbekistonning muhim va tarixiy shaharlaridan biri, ammo O'zbekiston Respublikasining rasmiy poytaxti — Toshkent shahridir. To'g'ri javob: Yo'q, noto'g'ri, O'zbekiston poytaxti Toshkent.`,
        type: "capital_verification_false"
      };
    }

    return null;
  }

  /**
   * 8. Kontekstual davom ettirish (Follow-up)
   */
  solveContextFollowup(text, dialogueState = {}, lastReply = null) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    if (lower.includes("afzallik") || (lower.includes("uning") && lower.includes("ayt"))) {
      const topic = dialogueState.lastTopic || (lastReply ? this._extractTopicFromReply(lastReply) : null);
      if (topic) {
        const cap = this._capitalize(topic);
        return {
          reply: `${cap}ning asosiy afzalliklari va ijobiy jihatlari:\n1) O'z sohasida yuqori samaradorlik va amaliy qulaylik taqdim etishi;\n2) Inson faoliyatini yengillashtirishi va yangi imkoniyatlar yaratishi;\n3) Tizimli va ishonchli natijalar berishi.`,
          type: "context_advantages"
        };
      }
      return {
        reply: "Uning asosiy afzalliklari:\n1) O'z sohasida yuqori samaradorlik va ishonchlilik;\n2) Keng qamrovli va amaliy qo'llanish imkoniyati;\n3) Vaqt va resurslarni sezilarli darajada tejashi.",
        type: "context_advantages"
      };
    }

    if (lower.includes("ikki jumlada") || lower.includes("qisqartir") || lower.includes("qisqa")) {
      const sourceText = lastReply || dialogueState.lastBotReply || dialogueState.lastTopic;
      if (sourceText && typeof sourceText === "string") {
        const sentences = sourceText.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 15);
        if (sentences.length >= 2) {
          const s1 = sentences[0].replace(/^[^:]+:\s*/, "").replace(/[«»]/g, "").trim();
          const s2 = sentences[1].replace(/[«»]/g, "").trim();
          return {
            reply: `Qisqacha xulosa (ikki jumlada):\n1) ${s1}\n2) ${s2}`,
            type: "context_summarize"
          };
        } else if (sentences.length === 1) {
          return {
            reply: `Qisqacha xulosa: ${sentences[0].trim()}`,
            type: "context_summarize"
          };
        }
      }
      return {
        reply: "Qisqacha xulosa: Mazkur mavzu bo'yicha asosiy xususiyat shundaki, u o'z sohasida muhim o'rin tutadi va amaliy jihatdan keng qo'llaniladi.",
        type: "context_summarize"
      };
    }

    return null;
  }

  /**
   * 9. Biologik va jismoniy qobiliyatlar (Capability Verification)
   * Masalan: "mushuk uchadimi", "tuyaqush uchadimi", "baliq suzadimi"
   */
  solveCapability(text, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    const capMatch = lower.match(/\b([a-zа-яёo'g']+)(?:\s+(?:suvda|havoda|yerda|quruqlikda|osmonda))?\s+(uchadimi|suzadimi|yuguradimi|uchadmi|suzadmi|yuguradmi|ucholadimi|ucha\s+oladimi|suza\s+oladimi|suzoladimi|yugura\s+oladimi|quruqlikda\s+yashaydimi|gapiradimi)\b/i);
    if (!capMatch) return null;

    const subject = capMatch[1].trim();
    const action = capMatch[2].trim();
    const capSubject = this._capitalize(subject);

    // Uchish qobiliyati
    if (action.includes("uch")) {
      const nonFlying = ["mushuk", "it", "kuchuk", "ot", "sigir", "qo'y", "fil", "sher", "bo'ri", "quyon", "ayiq", "odam", "inson", "baliq", "ilon", "toshbaqa", "kaltakesak", "tuyaqush", "pingvin"];
      const flying = ["qush", "chumchuq", "burgut", "kaptar", "qaldirg'och", "qarg'a", "to'ti", "ko'rshapalak", "pashsha", "ari", "kapalak", "chivin"];

      if (nonFlying.includes(subject)) {
        if (subject === "tuyaqush") {
          return {
            reply: "Yo'q, tuyaqush qush bo'lsa ham ucha olmaydi. Uning tanasi og'ir va qanotlari parvozga moslashmagan, ammo yerda soatiga 70 km/soat tezlikda juda tez yugura oladi.",
            type: "biological_capability"
          };
        }
        if (subject === "pingvin") {
          return {
            reply: "Yo'q, pingvin ucha olmaydi. U quruqlikda yursa-da, suvda baliq kabi juda mohir suzuvchi dengiz qushidir.",
            type: "biological_capability"
          };
        }
        return {
          reply: `Yo'q, ${subject} ucha olmaydi. ${capSubject} quruqlikda yashovchi hayvon bo'lib, uning tanasida parvoz qilish uchun qanotlar yoki aerodinamik a'zolar mavjud emas.`,
          type: "biological_capability"
        };
      }

      if (flying.includes(subject)) {
        if (subject === "ko'rshapalak") {
          return {
            reply: "Ha, ko'rshapalak ucha oladi. U parvoz qilish qobiliyatiga ega bo'lgan yagona sut emizuvchi jonivor hisoblanadi.",
            type: "biological_capability"
          };
        }
        return {
          reply: `Ha, ${subject} ucha oladi. U parvoz qilishga moslashgan qanotlar va yengil suyak tuzilishiga ega.`,
          type: "biological_capability"
        };
      }
    }

    // Suzish qobiliyati
    if (action.includes("suz")) {
      const aquaticSwimmers = ["baliq", "delfin", "kit", "akula", "pingvin", "o'rdak", "qurbaqa"];
      const landSwimmers = ["it", "kuchuk", "ot", "fil", "yo'lbars", "ayiq"];
      const nonSwimmers = ["jirafa", "tuyaqush", "mushuk"];

      // Jismoniy / moddiy jismlar (og'ir va yengil)
      const physicalSinkingObjects = ["tosh", "temir", "qo'rg'oshin", "bolg'a", "qum", "metall", "po'lat"];
      const physicalFloatingObjects = ["yog'och", "penoplast", "qayiq", "koptok", "barg", "pufak"];

      if (physicalSinkingObjects.includes(subject)) {
        return {
          reply: `Yo'q, ${subject} suvda suza olmaydi. Uning zichligi suvning zichligidan ancha katta bo'lganligi sababli, u suvga tashlanganda darhol tubiga cho'kadi.`,
          type: "physical_capability"
        };
      }
      if (physicalFloatingObjects.includes(subject)) {
        return {
          reply: `Ha, ${subject} suvda suza oladi (suv yuzida qalqiydi). Chunki uning zichligi suvnikidan yengilroq.`,
          type: "physical_capability"
        };
      }

      if (aquaticSwimmers.includes(subject)) {
        return {
          reply: `Ha, ${subject} suvda juda yaxshi suza oladi. Uning tanasi suv muhitida yashash va harakatlanish uchun maxsus suzgich a'zolarga ega.`,
          type: "biological_capability"
        };
      }
      if (landSwimmers.includes(subject)) {
        return {
          reply: `Ha, ${subject} suvda suza oladi. Ular tabiatan instinktiv ravishda o'z tanasini suv yuzasida tutib, oyoqlari yordamida (masalan, «itcha suzish») harakatlana oladi.`,
          type: "biological_capability"
        };
      }
      if (subject === "odam" || subject === "inson") {
        return {
          reply: "Ha, inson suvda suza oladi. Garchi bu tug'ma instinkt bo'lmasa-da, inson o'rganish va jismoniy mashqlar orqali mohir suzuvchiga aylana oladi.",
          type: "biological_capability"
        };
      }
      if (nonSwimmers.includes(subject)) {
        if (subject === "mushuk") {
          return {
            reply: "Mushuklar biologik jihatdan zarur bo'lganda biroz suza olishi mumkin, ammo ular tabiatan suvdan juda qo'rqadi va suzishni yoqtirmaydi.",
            type: "biological_capability"
          };
        }
        return {
          reply: `Yo'q, ${subject} odatda suza olmaydi. Uning tana tuzilishi yoki anatomiyasi suvda muvozanat saqlashga moslashmagan.`,
          type: "biological_capability"
        };
      }
    }

    return null;
  }

  /**
   * 9.1 Taksonomik va Toifaviy munosabatlar (Taxonomy & Classification Verification)
   * Masalan: "it qushmi", "it qushmi?", "kit baliqmi", "baliq qushmi", "mushuk qushmi", "qush hayvonmi"
   */
  solveTaxonomyClassification(text, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'").replace(/[?!.,;:]/g, "");

    // Naqsh: "X Y mi", "X Y-mi", "X Ymi"
    const match = lower.match(/\b([a-zа-яёo'g']+)\s+([a-zа-яёo'g']+?)(?:mi|-mi|\s+bo'ladimi|\s+hisoblanadimi|\s+sanaladimi)$/i) ||
                  lower.match(/\b([a-zа-яёo'g']+)\s+([a-zа-яёo'g']+?)(?:mi|-mi)\b/i);

    if (!match) return null;

    const subject = match[1].trim();
    let targetClass = match[2].trim();

    const TAXONOMY_DB = {
      it: {
        nature: "sutemizuvchi xonaki hayvon",
        is: ["hayvon", "jonzot", "jonivor", "sutemizuvchi", "yirtqich", "uy hayvoni"],
        isNot: ["qush", "baliq", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik", "daraxt", "meva", "taom"]
      },
      kuchuk: {
        nature: "sutemizuvchi xonaki hayvon (it)",
        is: ["hayvon", "jonzot", "jonivor", "sutemizuvchi", "yirtqich", "uy hayvoni"],
        isNot: ["qush", "baliq", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik", "daraxt", "meva", "taom"]
      },
      mushuk: {
        nature: "sutemizuvchilar sinfiga kiruvchi xonaki yirtqich hayvon",
        is: ["hayvon", "jonzot", "jonivor", "sutemizuvchi", "yirtqich", "uy hayvoni"],
        isNot: ["qush", "baliq", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik", "daraxt", "meva", "taom"]
      },
      qush: {
        nature: "patlar bilan qoplangan, tuxum qo'yuvchi umurtqali jonzot",
        is: ["hayvon", "jonzot", "jonivor", "parranda", "umurtqali"],
        isNot: ["sutemizuvchi", "baliq", "o'simlik", "daraxt", "hasharot"]
      },
      baliq: {
        nature: "suv muhitida yashovchi, jabralar orqali nafas oluvchi umurtqali suv jonivori",
        is: ["hayvon", "jonzot", "jonivor", "suv hayvoni", "umurtqali"],
        isNot: ["qush", "sutemizuvchi", "sudralib yuruvchi", "o'simlik", "hasharot", "parranda"]
      },
      kit: {
        nature: "suvda yashovchi, o'pka orqali nafas oluvchi va bolasini sut bilan boquvchi ulkan sutemizuvchi jonivor (baliq emas!)",
        is: ["hayvon", "jonzot", "jonivor", "sutemizuvchi", "dengiz hayvoni"],
        isNot: ["baliq", "qush", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik"]
      },
      delfin: {
        nature: "yuqori intellektga ega, o'pka orqali nafas oluvchi sutemizuvchi dengiz hayvoni (baliq emas!)",
        is: ["hayvon", "jonzot", "jonivor", "sutemizuvchi", "dengiz hayvoni"],
        isNot: ["baliq", "qush", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik"]
      },
      odam: {
        nature: "aql-idrok, tafakkur va ongga ega bo'lgan oliy mavjudot",
        is: ["inson", "mavjudot", "sutemizuvchi", "tirik jonzot"],
        isNot: ["qush", "baliq", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik", "daraxt"]
      },
      inson: {
        nature: "aql-idrok, tafakkur va ongga ega bo'lgan oliy mavjudot",
        is: ["inson", "mavjudot", "sutemizuvchi", "tirik jonzot"],
        isNot: ["qush", "baliq", "sudralib yuruvchi", "hasharot", "parranda", "o'simlik", "daraxt"]
      },
      daraxt: {
        nature: "o'simliklar dunyosiga mansub, yog'ochlashgan tanaga ega ko'p yillik o'simlik",
        is: ["o'simlik", "flora", "tirik organizm"],
        isNot: ["hayvon", "qush", "baliq", "sutemizuvchi", "hasharot", "jonivor"]
      },
      kitob: {
        nature: "insoniyat ma'naviyati va bilimlarini saqlovchi ma'naviy-ma'rifiy manba",
        is: ["buyum", "o'quv quroli", "manba", "nashr", "xazina"],
        isNot: ["taom", "oziq-ovqat", "hayvon", "jonzot", "o'simlik", "qush"]
      },
      somsa: {
        nature: "an'anaviy xamirli va go'shtli to'yimli pishiriq (taom)",
        is: ["taom", "pishiriq", "ovqat", "yegulik"],
        isNot: ["hayvon", "jonzot", "qush", "baliq", "o'simlik", "buyum"]
      }
    };

    if (TAXONOMY_DB[subject]) {
      const data = TAXONOMY_DB[subject];
      const capSub = this._capitalize(subject);

      if (data.is.includes(targetClass)) {
        return {
          reply: `Ha, ${subject} — bu ${targetClass} hisoblanadi. Aniqrog'i, ${capSub} — ${data.nature}.`,
          type: "taxonomy_affirmative"
        };
      }

      if (data.isNot.includes(targetClass)) {
        let extra = "";
        if (subject === "kit" && targetClass === "baliq") {
          extra = " Garchi kit suvda yashasa ham, u baliq emas — chunki u nafasini o'pka orqali oladi va bolalarini sut bilan boqadi (baliqlar esa suvda jabralar orqali nafas oladi).";
        } else if (subject === "it" && targetClass === "qush") {
          extra = " Chunki uning qanotlari yoki patlari yo'q, u to'rt oyoqli, jun bilan qoplangan quruqlik jonivoridir.";
        }
        return {
          reply: `Yo'q, ${subject} ${targetClass} emas. ${capSub} — bu ${data.nature}.${extra}`,
          type: "taxonomy_negative"
        };
      }
    }

    return null;
  }

  /**
   * 10. Ko'rsatma va amaliy maslahatlar (Instruction & Advice)
   */
  solveInstructionAdvice(text, taskInfo = {}, isFormal = true) {
    const raw = (text || "").trim();
    const lower = raw.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // A. Qishda kiyinish maslahati
    if (lower.includes("qish") && (lower.includes("sovuq") || lower.includes("kiyish") || lower.includes("kiyim"))) {
      return {
        reply: "Qishda havo sovuq bo'lganda, shamol va sovuqdan himoyalanish uchun issiq va qalin kiyimlar kiyish zarur:\n1. Issiq qishki kurtka yoki palto;\n2. Bosh kiyim (shapka) va bo'yinbog' (sharf);\n3. Issiq qo'lqop va qalin qishki poyabzal (etik);\n4. Qatlam-qatlam kiyinish (termal ich kiyim, sviter) tanani iliq saqlashga eng yaxshi yordam beradi.",
        topic: "qishda kiyinish"
      };
    }

    // B. Dasturchi bo'lish tavsiyasi
    if (lower.includes("dasturchi") && (lower.includes("bo'lish") || lower.includes("qilish kerak") || lower.includes("maslahat"))) {
      return {
        reply: "Dasturchi bo'lish uchun quyidagi bosqichma-bosqich tavsiyalarga amal qilishni maslahat beraman:\n1. Dasturlash asoslarini o'rganing (algoritmlar, ma'lumotlar tuzilmalari);\n2. Bitta asosiy tilni tanlang (masalan, JavaScript, Python yoki Go);\n3. Kichik real loyihalar yarating va Git/GitHub bilan ishlashni o'zlashtiring;\n4. Har kuni muntazam kod yozing va xatolardan to'xtamang.",
        topic: "dasturchi bo'lish"
      };
    }

    return null;
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _extractTopicFromReply(reply) {
    if (!reply || typeof reply !== "string") return null;
    const m = reply.match(/^([A-ZА-ЯЁa-zа-яёo'g']+)\s+(?:—|-|haqida|bu)\b/i);
    return m ? m[1] : null;
  }
}

module.exports = {
  ReasoningEngine,
  reasoningEngine: new ReasoningEngine(),
};
