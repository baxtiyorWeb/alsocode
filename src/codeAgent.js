/**
 * =======================================================================
 *  KOGNITIV DASTURLASH INTELEKTI (Code Intelligence & Syntax Engine)
 * =======================================================================
 *  Senior darajadagi dasturlash assistenti:
 *  - JavaScript va Python kodlarini tahlil qiladi (Static Syntax Check);
 *  - Qavslar, sintaksis xatolar va potensial muammolarni aniqlaydi;
 *  - Dasturlash bo'yicha toza arxitekturali shablonlar (Snippets) yaratadi;
 *  - Har qanday kodni qadamma-qadam tushuntirib beradi.
 * =======================================================================
 */

class CodeIntelligenceAgent {
  constructor() {
    // Tayyor production-ready kod shablonlari bazasi (O'zbekcha izohlar bilan)
    this.snippets = {
      http_server: {
        title: "Node.js Pure HTTP Server",
        lang: "javascript",
        code: `const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'active', timestamp: Date.now() }));
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint topilmadi' }));
});

server.listen(3000, () => {
  console.log(' Server ishga tushdi: http://localhost:3000');
});`,
      },
      binary_search: {
        title: "Ikkilik Qidiruv Algoritmi (Binary Search - O(log N))",
        lang: "javascript",
        code: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid; // Indeks topildi
    if (arr[mid] < target) {
      left = mid + 1; // O'ng yarmidan qidirish
    } else {
      right = mid - 1; // Chap yarmidan qidirish
    }
  }
  return -1; // Topilmadi
}`,
      },
      neuron_forward: {
        title: "Neyron Tarmoq: Forward Pass va Sigmoid",
        lang: "javascript",
        code: `class SimpleNeuron {
  constructor(weights, bias) {
    this.weights = weights; // number[]
    this.bias = bias;       // number
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  activate(inputs) {
    let sum = this.bias;
    for (let i = 0; i < this.weights.length; i++) {
      sum += inputs[i] * this.weights[i];
    }
    return this.sigmoid(sum);
  }
}`,
      },
      async_retry: {
        title: "Qayta urinish bilan xavfsiz Async Fetch (Retry Pattern)",
        lang: "javascript",
        code: `async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(\`HTTP xatosi: \${res.status}\`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(\`Urinish \${attempt} muvaffaqiyatsiz. Qayta urinilmoqda...\`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}`,
      },
    };
  }

  /**
   * Foydalanuvchi matnida dasturlash kodi yoki dasturlash so'rovi borligini tekshirish
   * @param {string} text
   * @returns {boolean}
   */
  isCodeRequest(text) {
    const codeKeywords = [
      "kod", "code", "funksiya", "function", "javascript", "python",
      "server", "algoritm", "bug", "xato", "class", "const", "let", "return",
      "binary search", "neyron", "api", "endpoint", "array", "massiv"
    ];
    const lower = text.toLowerCase();
    return codeKeywords.some((kw) => lower.includes(kw));
  }

  /**
   * Matn ichidagi kod bloklarini ajratib olish (Markdown ``` code ``` yoki kalit so'zlar)
   * @param {string} text
   * @returns {string | null}
   */
  extractCodeBlock(text) {
    const blockMatch = text.match(/```(?:[a-z]*\n)?([\s\S]*?)```/);
    if (blockMatch && blockMatch[1]) {
      return blockMatch[1].trim();
    }
    // Agar butun matn kodga o'xshasa
    if (text.includes("function") || text.includes("const ") || text.includes("let ") || text.includes("def ") || text.includes("import ")) {
      return text.trim();
    }
    return null;
  }

  /**
   * Kodni statik sintaktik tahlil qilish (Static Syntax & Brackets Checker)
   * @param {string} code
   * @returns {{
   *   valid: boolean,
   *   issues: Array<{ line: number, type: string, message: string }>,
   *   stats: { lines: number, functions: number, variables: number, complexity: string },
   *   recommendation: string
   * }}
   */
  analyzeCode(code) {
    if (!code || typeof code !== "string") {
      return {
        valid: false,
        issues: [{ line: 1, type: "error", message: "Tahlil qilish uchun kod kiritilmadi" }],
        stats: { lines: 0, functions: 0, variables: 0, complexity: "Noma'lum" },
        recommendation: "Iltimos, tekshirish uchun JavaScript yoki Python kodini kiriting.",
      };
    }

    const lines = code.split("\n");
    const issues = [];
    const bracketStack = [];
    const bracketPairs = { "}": "{", "]": "[", ")": "(" };

    let functionCount = 0;
    let varCount = 0;
    let loopCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Statistika hisoblash
      if (line.match(/\b(function|def|=>)\b/)) functionCount++;
      if (line.match(/\b(const|let|var)\b/)) varCount++;
      if (line.match(/\b(for|while)\b/)) loopCount++;

      // Qavslarni tekshirish (stringlar ichidagilardan tashqari sodda tahlil)
      for (let ch of line) {
        if (ch === "{" || ch === "[" || ch === "(") {
          bracketStack.push({ char: ch, line: lineNum });
        } else if (ch === "}" || ch === "]" || ch === ")") {
          const expected = bracketPairs[ch];
          if (bracketStack.length === 0) {
            issues.push({
              line: lineNum,
              type: "syntax_error",
              message: `Ortiqcha yoki ochilmagan yopuvchi qavs '${ch}'`,
            });
          } else {
            const last = bracketStack.pop();
            if (last.char !== expected) {
              issues.push({
                line: lineNum,
                type: "syntax_error",
                message: `'${last.char}' (qator: ${last.line}) bilan ochilgan qavs '${ch}' bilan noto'g'ri yopildi`,
              });
            }
          }
        }
      }

      // Xavfli holatlar: masalan, `==` o'rniga `=` shart operatorida
      if (line.match(/if\s*\([^=!<>]=[^=]/)) {
        issues.push({
          line: lineNum,
          type: "warning",
          message: "Shart ichida tenglik tekshiruvi (===) o'rniga o'zlashtirish (=) ishlatilgan bo'lishi mumkin.",
        });
      }

      // Qator oxiridagi yopilmagan qatorlar tekshiruvi (oddiy)
      const quotesCount = (line.match(/'/g) || []).length;
      const doubleQuotesCount = (line.match(/"/g) || []).length;
      if (quotesCount % 2 !== 0 && !line.includes("\\'")) {
        issues.push({
          line: lineNum,
          type: "syntax_warning",
          message: "Yopilmagan yakka tirnoq (') aniqlandi.",
        });
      }
      if (doubleQuotesCount % 2 !== 0 && !line.includes('\\"')) {
        issues.push({
          line: lineNum,
          type: "syntax_warning",
          message: "Yopilmagan qo'sh tirnoq (\") aniqlandi.",
        });
      }
    }

    // Yopilmay qolgan qavslar
    while (bracketStack.length > 0) {
      const unclosed = bracketStack.pop();
      issues.push({
        line: unclosed.line,
        type: "syntax_error",
        message: `'${unclosed.char}' qavsi oxirigacha yopilmagan.`,
      });
    }

    let complexity = "Oson (Oddiy skript)";
    if (loopCount > 1 || (functionCount > 2 && lines.length > 30)) {
      complexity = "O'rta (Algoritmik / Modulli)";
    }
    if (lines.length > 70 || loopCount > 3) {
      complexity = "Murakkab (Ko'p qatlamli kod)";
    }

    const valid = issues.filter((iss) => iss.type.includes("error")).length === 0;
    const recommendation = valid
      ? "Kod sintaksisi to'g'ri va tuzilishi toza ko'rinmoqda!"
      : `Kodda ${issues.length} ta tuzatish talab etiladigan joy topildi.`;

    return {
      valid,
      issues,
      stats: {
        lines: lines.length,
        functions: functionCount,
        variables: varCount,
        loops: loopCount,
        complexity,
      },
      recommendation,
    };
  }

  /**
   * So'ralgan mavzu bo'yicha tayyor kod shablonini olish
   * @param {string} topic
   */
  getSnippet(topic) {
    const lower = topic.toLowerCase();
    if (lower.includes("server") || lower.includes("http") || lower.includes("backend")) {
      return this.snippets.http_server;
    }
    if (lower.includes("qidiruv") || lower.includes("search") || lower.includes("binary")) {
      return this.snippets.binary_search;
    }
    if (lower.includes("neyron") || lower.includes("ai") || lower.includes("neural") || lower.includes("forward")) {
      return this.snippets.neuron_forward;
    }
    if (lower.includes("async") || lower.includes("fetch") || lower.includes("promise") || lower.includes("retry")) {
      return this.snippets.async_retry;
    }
    // Standart
    return this.snippets.http_server;
  }

  /**
   * Kodni qisqacha o'zbek tilida tushuntirib berish
   * @param {string} code
   */
  explainCode(code) {
    const analysis = this.analyzeCode(code);
    const steps = [];

    steps.push(`1. Hajmi: Kod ${analysis.stats.lines} ta satrdan va ${analysis.stats.functions} ta funksiyadan iborat.`);
    if (analysis.stats.variables > 0) {
      steps.push(`2. O'zgaruvchilar: ${analysis.stats.variables} ta o'zgaruvchi e'lon qilingan.`);
    }
    if (analysis.stats.loops > 0) {
      steps.push(`3. Takrorlanish: ${analysis.stats.loops} ta sikl (loop) mavjud, bu iterativ algoritmdan foydalanilganini bildiradi.`);
    }
    steps.push(`4. Murakkablik darajasi: ${analysis.stats.complexity}.`);
    steps.push(`5. Xulosa: ${analysis.recommendation}`);

    return steps.join("\n");
  }
}

module.exports = CodeIntelligenceAgent;
