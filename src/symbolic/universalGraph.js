"use strict";

/**
 * =======================================================================
 *  UNIVERSAL COMPARISON GRAPH (DIRECTED ACYCLIC GRAPH & TOPOLOGICAL SORT)
 * =======================================================================
 *  Har qanday subyektlar (insonlar, hayvonlar, tog'lar, transport, sonlar)
 *  o'rtasidagi qiyosiy munosabatlarni aniqlab, tranzitiv graf tuzadi va
 *  eng yuqori/quyi yoki to'liq tartiblangan zanjirni chiqaradi.
 * =======================================================================
 */

const DESCENDING_TRAITS = new Set([
  "katta", "kattaroq", "baland", "balandroq", "tez", "tezroq", "chaqqon", "chaqqonroq",
  "kuchli", "kuchliroq", "og'ir", "og'irroq", "uzun", "uzunroq", "aqlli", "aqlliroq",
  "qimmat", "qimmatroq", "issiq", "issiqroq", "keng", "kengroq", "chuqur", "chuqurroq"
]);

const ASCENDING_TRAITS = new Set([
  "kichik", "kichikroq", "past", "pastroq", "sekin", "sekinroq", "sust", "sustroq",
  "zaif", "zaifroq", "kuchsiz", "kuchsizroq", "yengil", "yengilroq", "kalta", "kaltaroq",
  "arzon", "arzonroq", "sovuq", "sovuqroq", "tor", "torroq", "sayoz", "sayozroq"
]);

const PRONOUNS = new Set([
  "qaysi", "biri", "har", "barcha", "kim", "nima", "bu", "shu", "u", "esa", "biror", "hech", "faqat", "aniq"
]);

class UniversalComparisonGraph {
  constructor() {
    this.nodes = new Set();
    this.adj = new Map(); // u -> Set(v)  (u > v)
    this.inDegree = new Map();
    this.outDegree = new Map();
  }

  clear() {
    this.nodes.clear();
    this.adj.clear();
    this.inDegree.clear();
    this.outDegree.clear();
  }

  addNode(node) {
    if (!this.nodes.has(node)) {
      this.nodes.add(node);
      this.adj.set(node, new Set());
      this.inDegree.set(node, 0);
      this.outDegree.set(node, 0);
    }
  }

  addEdge(u, v) {
    this.addNode(u);
    this.addNode(v);
    if (!this.adj.get(u).has(v)) {
      this.adj.get(u).add(v);
      this.inDegree.set(v, (this.inDegree.get(v) || 0) + 1);
      this.outDegree.set(u, (this.outDegree.get(u) || 0) + 1);
    }
  }

  /**
   * Matndan barcha taqqoslash juftliklarini chiqarib oladi va graf quradi.
   * @param {string} text
   * @returns {boolean}
   */
  parseText(text) {
    this.clear();
    const clean = (text || "").toLowerCase().replace(/[`ʼʻ']/g, "'");

    // Pattern 1: "A B dan [sifat] [fe'l]?"
    // Misol: "Bobur Anvardan tezroq yuguradi", "Sher bo'ridan kuchliroq"
    const pairRegex = /\b([a-zа-яёo'g'0-9]+)\s+(?:esa\s+)?([a-zа-яёo'g'0-9]+)\s*dan\s+([a-zа-яёo'g']+)(?:roq)?(?:\s+[a-zа-яёo'g']+)?/gi;
    let match;
    let foundAny = false;

    while ((match = pairRegex.exec(clean)) !== null) {
      const subj1 = this._capitalize(match[1]);
      const subj2 = this._capitalize(match[2]);
      const trait = match[3].toLowerCase();

      if (subj1.toLowerCase() === subj2.toLowerCase()) continue;
      if (PRONOUNS.has(subj1.toLowerCase()) || PRONOUNS.has(subj2.toLowerCase())) continue;

      if (DESCENDING_TRAITS.has(trait) || DESCENDING_TRAITS.has(trait + "roq")) {
        // subj1 > subj2
        this.addEdge(subj1, subj2);
        foundAny = true;
      } else if (ASCENDING_TRAITS.has(trait) || ASCENDING_TRAITS.has(trait + "roq")) {
        // subj1 < subj2  =>  subj2 > subj1
        this.addEdge(subj2, subj1);
        foundAny = true;
      }
    }

    // Pattern 2: Zichlik va suzish/cho'kish munosabatlari (Physics density):
    // "Yog'och suv yuzida suzadi" => Suv > Yog'och (yog'och yengil)
    // "Temir suvga cho'kadi" => Temir > Suv (temir og'ir)
    const floatMatch = clean.match(/\b([a-zа-яёo'g'0-9]+)\s+(?:esa\s+)?suv(?:\s+yuzida)?\s+suzadi/gi);
    if (floatMatch) {
      for (const fm of floatMatch) {
        const m = fm.match(/\b([a-zа-яёo'g'0-9]+)\s+(?:esa\s+)?suv/i);
        if (m && !PRONOUNS.has(m[1].toLowerCase()) && m[1].toLowerCase() !== "suv") {
          const item = this._capitalize(m[1]);
          this.addEdge("Suv", item);
          foundAny = true;
        }
      }
    }

    const sinkMatch = clean.match(/\b([a-zа-яёo'g'0-9]+)\s+(?:esa\s+)?suvga\s+cho'kadi/gi);
    if (sinkMatch) {
      for (const sm of sinkMatch) {
        const m = sm.match(/\b([a-zа-яёo'g'0-9]+)\s+(?:esa\s+)?suvga/i);
        if (m && !PRONOUNS.has(m[1].toLowerCase()) && m[1].toLowerCase() !== "suv") {
          const item = this._capitalize(m[1]);
          this.addEdge(item, "Suv");
          foundAny = true;
        }
      }
    }

    return foundAny && this.nodes.size >= 2;
  }

  /**
   * Topologik tartiblash (Kahn algoritmi)
   * @returns {string[]}
   */
  topologicalSort() {
    const inDeg = new Map(this.inDegree);
    const queue = [];

    for (const node of this.nodes) {
      if ((inDeg.get(node) || 0) === 0) {
        queue.push(node);
      }
    }

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);

      const neighbors = this.adj.get(u) || new Set();
      for (const v of neighbors) {
        inDeg.set(v, inDeg.get(v) - 1);
        if (inDeg.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    return order.length === this.nodes.size ? order : Array.from(this.nodes);
  }

  /**
   * Savolga qarab eng to'g'ri javobni yechish
   * @param {string} text
   * @returns {Object|null}
   */
  solve(text) {
    if (!this.parseText(text)) {
      return null;
    }

    const lower = (text || "").toLowerCase().replace(/[`ʼʻ']/g, "'");
    const sorted = this.topologicalSort();
    if (!sorted || sorted.length < 2) return null;

    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    // Savol nimani so'rayotganini aniqlash:
    const asksLowest = /\b(?:eng\s+(?:pasti|kichigi|sekin|sust|kaltasi|yengili|kuchsizi|arzoni|sovuqi|oxirgi)|kim\s+(?:past|kichik|sekin|kuchsiz|yengil)|suvdan\s+yengil|qaysi\s+biri\s+suvdan\s+yengil|oxirgi)\b/i.test(lower) || lower.includes("yengil");
    const targetWinner = asksLowest ? lowest : highest;

    const steps = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      steps.push(`${sorted[i]} > ${sorted[i + 1]}`);
    }

    return {
      reply: `Tranzitiv deduktiv tahlil (Universal Mantiqiy Graf):\n` +
        `1) Aniqlangan mantiqiy tartib: ${steps.join(", ")}.\n` +
        `2) To'liq zanjir: ${sorted.join(" > ")}.\n` +
        `To'g'ri javob: ${targetWinner}.`,
      winner: targetWinner,
      chain: sorted,
      type: "universal_comparison_graph"
    };
  }

  _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = UniversalComparisonGraph;
