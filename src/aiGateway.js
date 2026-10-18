
"use strict";

const https = require("https");
require("dotenv").config();

class ModelNode {
  constructor(id, name, provider) {
    this.id = id;
    this.name = name;
    this.provider = provider;
    this.totalGenerated = 0;
    this.batchCount = 0;
    this.status = "ready";
    this.lastError = null;
  }

  recordSuccess(itemCount = 1) {
    this.batchCount += itemCount;
    this.totalGenerated += itemCount;
    this.status = "ready";
    this.lastError = null;
  }

  recordError(err) {
    this.lastError = err.message || String(err);
    const msg = this.lastError.toLowerCase();

    // Doimiy konfiguratsiya yoki model mavjudligi xatolari.
    if (
      msg.includes("404") ||
      msg.includes("not found") ||
      msg.includes("model not found") ||
      msg.includes("user not found") ||
      msg.includes("api_key yo'q") ||
      msg.includes("api key yo'q") ||
      msg.includes("invalid api key") ||
      msg.includes("api key not valid") ||
      msg.includes("api key is invalid") ||
      msg.includes("invalid_api_key")
    ) {
      this.status = "disabled";
      console.warn(
        `🛑 [${this.name}] faol ro'yxatdan chiqarildi: ${this.lastError}`
      );
      return;
    }

    // 429, quota, timeout va boshqa vaqtinchalik xatolarda
    // cooldown yo'q. Keyingi so'rovda model qayta sinab ko'rilishi mumkin.
    this.status = "error";
  }
}

class NonStopAIGateway {
  constructor() {
    this.geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
    this.openRouterKey = process.env.OPEN_ROUTER_API_KEY;

    this.pool = [
      new ModelNode(
        "gemini-flash-lite-latest",
        "Gemini Flash Lite",
        "google"
      ),
      new ModelNode(
        "gemini-3.5-flash",
        "Gemini 3.5 Flash",
        "google"
      ),
      new ModelNode(
        "gemini-3.5-flash-lite",
        "Gemini 3.5 Flash Lite",
        "google"
      ),
      new ModelNode(
        "gemini-2.5-flash",
        "Gemini 2.5 Flash",
        "google"
      ),

      // Kerak bo'lsa OpenRouter modellarini ham qo'shing:
      // new ModelNode("provider/model-id", "Model nomi", "openrouter"),
    ];

    this.currentIndex = 0;
  }

  /**
   * Shu so'rovda hali sinab ko'rilmagan keyingi modelni tanlaydi.
   * Kutish va cooldown ishlatilmaydi.
   */
  acquireReadyModel(triedIds = new Set()) {
    const total = this.pool.length;

    for (let offset = 0; offset < total; offset++) {
      const index = (this.currentIndex + offset) % total;
      const model = this.pool[index];

      if (
        model.status !== "disabled" &&
        !triedIds.has(model.id)
      ) {
        this.currentIndex = (index + 1) % total;
        return model;
      }
    }

    return null;
  }

  _requestGoogle(modelId, prompt) {
    if (!this.geminiKey) {
      return Promise.reject(
        new Error("GOOGLE_GEMINI_API_KEY yo'q")
      );
    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
        },
      });

      const req = https.request(
        {
          hostname: "generativelanguage.googleapis.com",
          path:
            `/v1beta/models/${encodeURIComponent(modelId)}` +
            `:generateContent?key=${encodeURIComponent(this.geminiKey)}`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 25000,
        },
        (res) => {
          let raw = "";

          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });

          res.on("end", () => {
            let json;

            try {
              json = JSON.parse(raw);
            } catch {
              return reject(
                new Error(`Gemini noto'g'ri JSON qaytardi: HTTP ${res.statusCode}`)
              );
            }

            if (res.statusCode >= 400 || json.error) {
              const err = new Error(
                json.error?.message || `HTTP ${res.statusCode}`
              );
              err.statusCode = res.statusCode;
              return reject(err);
            }

            const text = json.candidates?.[0]?.content?.parts
              ?.map((part) => part.text || "")
              .join("")
              .trim();

            if (!text) {
              return reject(
                new Error("Gemini bo'sh javob qaytardi")
              );
            }

            resolve(text);
          });
        }
      );

      req.on("error", reject);

      req.on("timeout", () => {
        req.destroy(new Error("Gemini so'rovi vaqti tugadi"));
      });

      req.write(body);
      req.end();
    });
  }

  _requestOpenRouter(modelId, prompt) {
    if (!this.openRouterKey) {
      return Promise.reject(
        new Error("OPEN_ROUTER_API_KEY yo'q")
      );
    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.85,
      });

      const req = https.request(
        {
          hostname: "openrouter.ai",
          path: "/api/v1/chat/completions",
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.openRouterKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 25000,
        },
        (res) => {
          let raw = "";

          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });

          res.on("end", () => {
            let json;

            try {
              json = JSON.parse(raw);
            } catch {
              return reject(
                new Error(
                  `OpenRouter noto'g'ri JSON qaytardi: HTTP ${res.statusCode}`
                )
              );
            }

            if (res.statusCode >= 400 || json.error) {
              const err = new Error(
                json.error?.message || `HTTP ${res.statusCode}`
              );
              err.statusCode = res.statusCode;
              return reject(err);
            }

            const content = json.choices?.[0]?.message?.content;

            const text = Array.isArray(content)
              ? content
                .map((part) =>
                  typeof part === "string"
                    ? part
                    : part?.text || ""
                )
                .join("")
                .trim()
              : typeof content === "string"
                ? content.trim()
                : "";

            if (!text) {
              return reject(
                new Error("OpenRouter bo'sh javob qaytardi")
              );
            }

            resolve(text);
          });
        }
      );

      req.on("error", reject);

      req.on("timeout", () => {
        req.destroy(new Error("OpenRouter so'rovi vaqti tugadi"));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Model muvaffaqiyatli javob berguncha keyingi modelni sinaydi.
   * Har bir model bitta so'rovda ko'pi bilan bir marta chaqiriladi.
   */
  async generateText(prompt, itemsInBatch = 5) {
    const triedIds = new Set();
    const errors = [];

    while (triedIds.size < this.pool.length) {
      const model = this.acquireReadyModel(triedIds);

      if (!model) break;

      triedIds.add(model.id);

      // Kalit yo'q bo'lsa, HTTP so'rovi yubormasdan keyingi
      // modelga o'tamiz.
      if (
        (model.provider === "google" && !this.geminiKey) ||
        (model.provider === "openrouter" && !this.openRouterKey)
      ) {
        const err = new Error(
          model.provider === "google"
            ? "GOOGLE_GEMINI_API_KEY yo'q"
            : "OPEN_ROUTER_API_KEY yo'q"
        );

        model.recordError(err);
        errors.push(`${model.name}: ${err.message}`);
        continue;
      }

      try {
        let text;

        if (model.provider === "google") {
          text = await this._requestGoogle(model.id, prompt);
        } else if (model.provider === "openrouter") {
          text = await this._requestOpenRouter(model.id, prompt);
        } else {
          throw new Error(
            `Noma'lum provider: ${model.provider}`
          );
        }

        model.recordSuccess(itemsInBatch);

        console.log(`✅ [${model.name}] muvaffaqiyatli javob berdi`);

        return {
          text,
          usedModel: model.name,
          modelId: model.id,
          modelBatchCount: model.batchCount,
          modelTotalGenerated: model.totalGenerated,
          isCooling: false,
          cooldownSec: 0,
        };
      } catch (err) {
        model.recordError(err);
        errors.push(`${model.name}: ${err.message}`);

        console.warn(
          `⚠️ [${model.name}] xato: ${err.message}`
        );
        console.log("➡️ Keyingi model darhol sinab ko'riladi.");
      }
    }

    throw new Error(
      "Mavjud modellar bilan generatsiya bajarilmadi:\n" +
      errors.join("\n")
    );
  }

  getPoolStatus() {
    return this.pool.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      status: model.status,
      batchCount: model.batchCount,
      totalGenerated: model.totalGenerated,
      lastError: model.lastError,
    }));
  }
}

module.exports = new NonStopAIGateway();
