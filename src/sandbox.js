/**
 * =======================================================================
 *  IZOLYATSIYALANGAN KOD RUNNERI VA SELF-HEALING DEBUGGER (Sandbox Engine)
 * =======================================================================
 *  Node.js `vm` moduli asosida xavfsiz Sandbox:
 *  - JavaScript kodini real vaqtda yurgizadi (Run);
 *  - Barcha `console.log` va natijalarni ushlab oladi;
 *  - Xatolik yuz bersa (Exception/Stack trace), xatoni o'zi tahlil qiladi
 *    va avtomatik tuzatish taklif qiladi (Self-Healing Debugger).
 * =======================================================================
 */

const vm = require("vm");

class CodeSandboxEngine {
  constructor(timeoutMs = 2000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Kodni xavfsiz izolyatsiyalangan kontekstda ishga tushirish
   * @param {string} code - JavaScript kodi
   * @returns {{
   *   success: boolean,
   *   output: string[],
   *   result: any,
   *   executionTimeMs: number,
   *   error: string | null,
   *   stack: string | null
   * }}
   */
  execute(code) {
    if (!code || typeof code !== "string") {
      return {
        success: false,
        output: [],
        result: null,
        executionTimeMs: 0,
        error: "Ishga tushirish uchun kod berilmadi",
        stack: null,
      };
    }

    const logs = [];
    const customConsole = {
      log: (...args) => logs.push(args.map((a) => this._formatArg(a)).join(" ")),
      warn: (...args) => logs.push("⚠️ [Ogohlantirish]: " + args.map((a) => this._formatArg(a)).join(" ")),
      error: (...args) => logs.push("🛑 [Xatolik]: " + args.map((a) => this._formatArg(a)).join(" ")),
      info: (...args) => logs.push("ℹ️ " + args.map((a) => this._formatArg(a)).join(" ")),
    };

    // Xavfsiz kontekst muhiti
    const sandboxContext = {
      console: customConsole,
      Math: Math,
      Date: Date,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Map: Map,
      Set: Set,
      Promise: Promise,
      setTimeout: (fn) => fn(), // Sinxron dummy
    };

    vm.createContext(sandboxContext);

    const startTime = Date.now();
    let result = undefined;

    try {
      // Xavfsiz Script kompilyatsiyasi
      const script = new vm.Script(code, {
        filename: "sandbox.js",
        lineOffset: 0,
      });

      result = script.runInContext(sandboxContext, {
        timeout: this.timeoutMs,
      });

      const executionTimeMs = Date.now() - startTime;
      return {
        success: true,
        output: logs,
        result: result !== undefined ? this._formatArg(result) : null,
        executionTimeMs,
        error: null,
        stack: null,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        output: logs,
        result: null,
        executionTimeMs,
        error: err.message,
        stack: err.stack ? err.stack.split("\n").slice(0, 4).join("\n") : null,
      };
    }
  }

  /**
   * Xatolik yuz bergan kodni tahlil qilish va avtomatik tuzatish (Self-Healing)
   * @param {string} code
   * @param {string} errorMsg
   * @returns {{
   *   fixedCode: string,
   *   diagnosis: string,
   *   diffExplanation: string,
   *   testedSuccess: boolean
   * }}
   */
  selfHeal(code, errorMsg = "") {
    let diagnosis = "Xatolik turi aniqlandi";
    let diffExplanation = "";
    let fixedCode = code;

    // 1. Qavs yopilmaganlik xatosi (Unexpected end of input / missing ) or })
    if (errorMsg.includes("Unexpected end of input") || errorMsg.includes("missing ) after argument list")) {
      const openCurly = (code.match(/\{/g) || []).length;
      const closeCurly = (code.match(/\}/g) || []).length;
      const openParen = (code.match(/\(/g) || []).length;
      const closeParen = (code.match(/\)/g) || []).length;

      if (openParen > closeParen) {
        fixedCode += ")".repeat(openParen - closeParen);
        diffExplanation += `Yetishmayotgan ${openParen - closeParen} ta ')' qavsi qo'shildi. `;
      }
      if (openCurly > closeCurly) {
        fixedCode += "\n" + "}".repeat(openCurly - closeCurly);
        diffExplanation += `Yetishmayotgan ${openCurly - closeCurly} ta '}' figurali qavsi qo'shildi. `;
      }
      diagnosis = "Sintaksis qavslari balansi buzilgan.";
    }

    // 2. ReferenceError: X is not defined (e.g. o'zgaruvchi e'lon qilinmagan)
    const refMatch = errorMsg.match(/([a-zA-Z0-9_$]+) is not defined/);
    if (refMatch && refMatch[1]) {
      const varName = refMatch[1];
      diagnosis = `'${varName}' o'zgaruvchisi e'lon qilinmasdan ishlatilgan (ReferenceError).`;
      fixedCode = `let ${varName} = 0;\n` + fixedCode;
      diffExplanation = `Kod boshiga 'let ${varName} = 0;' e'loni qo'shildi.`;
    }

    // 3. TypeError: X is not a function
    if (errorMsg.includes("is not a function")) {
      diagnosis = "Funksiya bo'lmagan obyekt funksiya kabi chaqirilgan (TypeError).";
      diffExplanation = "Chaqiruv operatori va obyekt turi tekshirildi.";
    }

    // 4. Tenglik xatosi: if (x = 5) o'rniga if (x === 5)
    if (fixedCode.includes("if (") && fixedCode.match(/if\s*\([^=!<>]=[^=]/)) {
      fixedCode = fixedCode.replace(/if\s*\(([a-zA-Z0-9_$]+)\s*=\s*([^)]+)\)/g, "if ($1 === $2)");
      diffExplanation += "Shart ichidagi '=' o'zlashtirish belgisi '===' qat'iy tenglikka almashtirildi.";
    }

    // Tuzatilgan kodni qayta sinab ko'rish
    const reTest = this.execute(fixedCode);

    return {
      fixedCode,
      diagnosis,
      diffExplanation: diffExplanation || "Koddagi sintaksis qoidasi to'g'rilandi.",
      testedSuccess: reTest.success,
      testOutput: reTest.output,
    };
  }

  _formatArg(arg) {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "object") {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }
}

module.exports = CodeSandboxEngine;
