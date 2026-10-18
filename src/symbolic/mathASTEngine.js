"use strict";

/**
 * =======================================================================
 *  UNIVERSAL ARITHMETIC AST ENGINE (MULTI-STEP MATHEMATICAL PARSER)
 * =======================================================================
 *  Tabiiy tildagi matnli va ifodali arifmetik amallarni daraxtga (AST)
 *  aylantiradi va bosqichma-bosqich isboti bilan hisoblab beradi.
 * =======================================================================
 */

class UniversalMathAST {
  /**
   * Kiruvchi matndan matematik masalani aniqlash va yechish
   * @param {string} text
   * @returns {Object|null}
   */
  solve(text) {
    if (!text || typeof text !== "string") return null;
    const clean = text.toLowerCase().replace(/[`ʼʻ']/g, "'");

    // 1. Foiz hisoblash: "500 ning 20 foizi qancha", "200 ning 15%"
    const percentMatch = clean.match(/(\d+[\d\s]*)\s*(?:ning)?\s*(\d+[\.,]?\d*)\s*(?:foizi|%|protsenti)/i);
    if (percentMatch) {
      const base = parseFloat(percentMatch[1].replace(/\s+/g, ""));
      const pct = parseFloat(percentMatch[2].replace(",", "."));
      const result = (base * pct) / 100;
      return {
        reply: `Foiz hisoblash natijasi:\n` +
          `1-qadam: ${base} ning ${pct}% qismi = (${base} * ${pct}) / 100.\n` +
          `To'g'ri javob: ${result}.`,
        expression: `(${base} * ${pct}) / 100`,
        result,
        type: "math_percentage"
      };
    }

    // 2. Darajalar: "4 ning kvadrati", "5 ning kubi", "2 ning 8-darajasi"
    const powMatch = clean.match(/(\d+)\s*ning\s*(kvadrati|kubi|(\d+)(?:-|\s*)darajasi)/i);
    if (powMatch) {
      const base = parseInt(powMatch[1], 10);
      let exp = 2;
      let expName = "kvadrati (2-darajasi)";
      if (powMatch[2].includes("kub")) {
        exp = 3;
        expName = "kubi (3-darajasi)";
      } else if (powMatch[3]) {
        exp = parseInt(powMatch[3], 10);
        expName = `${exp}-darajasi`;
      }
      const result = Math.pow(base, exp);
      return {
        reply: `Darajaga ko'tarish natijasi:\n` +
          `1-qadam: ${base} ning ${expName} = ${base}^${exp}.\n` +
          `To'g'ri javob: ${result}.`,
        expression: `${base}^${exp}`,
        result,
        type: "math_power"
      };
    }

    // 3. Murakkab zanjirli matnli amallar (Compound 2-step natural language)
    // Namuna A: "(150 dan 30 ni ayirib) 4 ga bo'lsak"
    const subDivMatch = clean.match(/(?:[\(\[]\s*)?(\d+)\s*dan\s*(\d+)\s*(?:ni)?\s*(?:ayirib|ayirsak|ayirilsa)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:bo'lsak|bo'linsa|bo'l)/i);
    if (subDivMatch) {
      const a = parseInt(subDivMatch[1], 10);
      const b = parseInt(subDivMatch[2], 10);
      const c = parseInt(subDivMatch[3], 10);
      if (c === 0) return { reply: "Matematika qoidasiga ko'ra 0 ga bo'lish mumkin emas.", result: null };
      const s1 = a - b;
      const res = s1 / c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} - ${b}) / ${c}.\n` +
          `1-qadam: ${a} dan ${b} ayirilsa: ${a} - ${b} = ${s1}.\n` +
          `2-qadam: ${s1} ni ${c} ga bo'lsak: ${s1} / ${c} = ${res}.\n` +
          `To'g'ri javob: ${res}.`,
        expression: `(${a} - ${b}) / ${c}`,
        result: res,
        type: "math_compound_sub_div"
      };
    }

    // Namuna B: "(A ga B ni qo'shib) C ga bo'lsak"
    const addDivMatch = clean.match(/(?:[\(\[]\s*)?(\d+)\s*ga\s*(\d+)\s*(?:ni)?\s*(?:qo'shib|qo'shsak|qo'shilsa)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:bo'lsak|bo'linsa|bo'l)/i);
    if (addDivMatch) {
      const a = parseInt(addDivMatch[1], 10);
      const b = parseInt(addDivMatch[2], 10);
      const c = parseInt(addDivMatch[3], 10);
      if (c === 0) return { reply: "Matematika qoidasiga ko'ra 0 ga bo'lish mumkin emas.", result: null };
      const s1 = a + b;
      const res = s1 / c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} + ${b}) / ${c}.\n` +
          `1-qadam: ${a} ga ${b} qo'shilsa: ${a} + ${b} = ${s1}.\n` +
          `2-qadam: ${s1} ni ${c} ga bo'lsak: ${s1} / ${c} = ${res}.\n` +
          `To'g'ri javob: ${res}.`,
        expression: `(${a} + ${b}) / ${c}`,
        result: res,
        type: "math_compound_add_div"
      };
    }

    // Namuna C: "(A ga B ni qo'shib) C ga ko'paytirsak"
    const addMulMatch = clean.match(/(?:[\(\[]\s*)?(\d+)\s*ga\s*(\d+)\s*(?:ni)?\s*(?:qo'shib|qo'shsak|qo'shilsa)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:ko'paytirsak|ko'paytirilsa|ko'paytir)/i);
    if (addMulMatch) {
      const a = parseInt(addMulMatch[1], 10);
      const b = parseInt(addMulMatch[2], 10);
      const c = parseInt(addMulMatch[3], 10);
      const s1 = a + b;
      const res = s1 * c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} + ${b}) * ${c}.\n` +
          `1-qadam: ${a} ga ${b} qo'shilsa: ${a} + ${b} = ${s1}.\n` +
          `2-qadam: ${s1} ni ${c} ga ko'paytirsak: ${s1} * ${c} = ${res}.\n` +
          `To'g'ri javob: ${res}.`,
        expression: `(${a} + ${b}) * ${c}`,
        result: res,
        type: "math_compound_add_mul"
      };
    }

    // Namuna D: "(A dan B ni ayirib) C ga ko'paytirsak"
    const subMulMatch = clean.match(/(?:[\(\[]\s*)?(\d+)\s*dan\s*(\d+)\s*(?:ni)?\s*(?:ayirib|ayirsak|ayirilsa)(?:[\s\)\]\,]+)?(\d+)\s*(?:ga)?\s*(?:ko'paytirsak|ko'paytirilsa|ko'paytir)/i);
    if (subMulMatch) {
      const a = parseInt(subMulMatch[1], 10);
      const b = parseInt(subMulMatch[2], 10);
      const c = parseInt(subMulMatch[3], 10);
      const s1 = a - b;
      const res = s1 * c;
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} - ${b}) * ${c}.\n` +
          `1-qadam: ${a} dan ${b} ayirilsa: ${a} - ${b} = ${s1}.\n` +
          `2-qadam: ${s1} ni ${c} ga ko'paytirsak: ${s1} * ${c} = ${res}.\n` +
          `To'g'ri javob: ${res}.`,
        expression: `(${a} - ${b}) * ${c}`,
        result: res,
        type: "math_compound_sub_mul"
      };
    }

    // Namuna E: "(A ni B ga ko'paytirib) C ni ayirsak / qo'shsak"
    const mulSubMatch = clean.match(/(?:[\(\[]\s*)?(\d+)\s*(?:ni)?\s*(\d+)\s*(?:ga)?\s*(?:ko'paytirib|ko'paytirsak)(?:[\s\)\]\,]+)?(\d+)\s*(?:ni)?\s*(ayirsak|ayirilsa|qo'shsak|qo'shilsa)/i);
    if (mulSubMatch) {
      const a = parseInt(mulSubMatch[1], 10);
      const b = parseInt(mulSubMatch[2], 10);
      const c = parseInt(mulSubMatch[3], 10);
      const isSub = mulSubMatch[4].includes("ayir");
      const s1 = a * b;
      const res = isSub ? s1 - c : s1 + c;
      const op = isSub ? "-" : "+";
      return {
        reply: `Arifmetik hisob-kitob natijasi: (${a} * ${b}) ${op} ${c}.\n` +
          `1-qadam: ${a} ni ${b} ga ko'paytirsak: ${a} * ${b} = ${s1}.\n` +
          `2-qadam: ${s1} ${isSub ? "dan " + c + " ayirilsa" : "ga " + c + " qo'shilsa"}: ${s1} ${op} ${c} = ${res}.\n` +
          `To'g'ri javob: ${res}.`,
        expression: `(${a} * ${b}) ${op} ${c}`,
        result: res,
        type: "math_compound_mul_op"
      };
    }

    // 4. Infix tabiiy tildagi amallar: "12 ko'paytiruv 4", "100 bo'luv 5", "20 qo'shuv 5", "50 ayiruv 10"
    const infixOpMatch = clean.match(/(\d+)\s*(ko'paytiruv|ko'paytirilgan|zarb|karra|bo'luv|bo'lingan|qo'shuv|plyus|ayiruv|minus)\s*(\d+)/i);
    if (infixOpMatch) {
      const a = parseInt(infixOpMatch[1], 10);
      const opWord = infixOpMatch[2].toLowerCase();
      const b = parseInt(infixOpMatch[3], 10);
      let res, symbol, opName;
      if (opWord.includes("ko'pay") || opWord === "zarb" || opWord === "karra") {
        res = a * b;
        symbol = "*";
        opName = "ko'paytiruv";
      } else if (opWord.includes("bo'l")) {
        if (b === 0) return { reply: "Matematika qoidasiga ko'ra 0 ga bo'lish mumkin emas.", result: null };
        res = a / b;
        symbol = "/";
        opName = "bo'luv";
      } else if (opWord.includes("qo'sh") || opWord === "plyus") {
        res = a + b;
        symbol = "+";
        opName = "qo'shuv";
      } else {
        res = a - b;
        symbol = "-";
        opName = "ayiruv";
      }
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} ${symbol} ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} ${symbol} ${b}`,
        result: res,
        type: `math_infix_${opName}`
      };
    }

    // 5. Standart oddiy bitta amalli savollar:
    // Qo'shuv: "A ga B qo'shsak"
    const simpleAdd = clean.match(/(\d+)\s*ga\s*(\d+)\s*(?:ni)?\s*(?:qo'sh|qo'shsak|qo'shilsa)/i);
    if (simpleAdd) {
      const a = parseInt(simpleAdd[1], 10);
      const b = parseInt(simpleAdd[2], 10);
      const res = a + b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} + ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} + ${b}`,
        result: res,
        type: "math_simple_add"
      };
    }

    // Ayiruv: "A dan B ayirsak"
    const simpleSub = clean.match(/(\d+)\s*dan\s*(\d+)\s*(?:ni)?\s*(?:ayir|ayirsak|ayirilsa)/i);
    if (simpleSub) {
      const a = parseInt(simpleSub[1], 10);
      const b = parseInt(simpleSub[2], 10);
      const res = a - b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} - ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} - ${b}`,
        result: res,
        type: "math_simple_sub"
      };
    }

    // Ko'paytirish: "A ni B ga ko'paytirsak"
    const simpleMul = clean.match(/(\d+)\s+(?:ni\s+)?(\d+)\s*(?:ga)?\s*(?:ko'paytir|ko'paytirsak|karra)/i);
    if (simpleMul) {
      const a = parseInt(simpleMul[1], 10);
      const b = parseInt(simpleMul[2], 10);
      const res = a * b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} * ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} * ${b}`,
        result: res,
        type: "math_simple_mul"
      };
    }

    // Bo'lish: "A ni B ga bo'lsak"
    const simpleDiv = clean.match(/(\d+)\s+(?:ni\s+)?(\d+)\s*(?:ga)?\s*(?:bo'l|bo'lsak|bo'linsa)/i);
    if (simpleDiv) {
      const a = parseInt(simpleDiv[1], 10);
      const b = parseInt(simpleDiv[2], 10);
      if (b === 0) return { reply: "Matematika qoidasiga ko'ra 0 ga bo'lish mumkin emas.", result: null };
      const res = a / b;
      return {
        reply: `Arifmetik hisob-kitob natijasi: ${a} / ${b} = ${res}. To'g'ri javob: ${res}.`,
        expression: `${a} / ${b}`,
        result: res,
        type: "math_simple_div"
      };
    }

    // 5. To'g'ridan-to'g'ri ifodalar: "(100 + 50) / 3", "25 * 4 - 20"
    const exprMatch = text.match(/([\(\d][0-9\+\-\*\/\.\s\(\)]+[\)\d])/);
    if (exprMatch && /[\+\-\*\/]/.test(exprMatch[0])) {
      try {
        const sanitized = exprMatch[0].replace(/[^0-9\+\-\*\/\.\s\(\)]/g, "");
        const res = Function(`'use strict'; return (${sanitized})`)();
        if (typeof res === "number" && !isNaN(res)) {
          return {
            reply: `Matematik ifoda hisob-kitobi: ${sanitized.trim()} = ${res}. To'g'ri javob: ${res}.`,
            expression: sanitized.trim(),
            result: res,
            type: "math_eval"
          };
        }
      } catch (e) {}
    }

    return null;
  }
}

module.exports = UniversalMathAST;
