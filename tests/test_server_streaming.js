"use strict";

const http = require("http");
const assert = require("assert");
const server = require("../server");

async function testStreamingEndpoints() {
  return new Promise((resolve, reject) => {
    // Port 0 gives an ephemeral available port
    const testServer = server.listen(0, async () => {
      const port = testServer.address().port;

      try {
        // 1. Test POST /api/chat/stream
        await new Promise((resChat, rejChat) => {
          const body = JSON.stringify({ message: "Salom, qandaysiz?", sessionId: "sess_test_stream" });
          const req = http.request(
            {
              hostname: "127.0.0.1",
              port,
              path: "/api/chat/stream",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              },
            },
            (res) => {
              assert.strictEqual(res.statusCode, 200, "Status must be 200");
              assert.ok(
                res.headers["content-type"].includes("text/event-stream"),
                "Content-Type must be text/event-stream"
              );

              let data = "";
              res.on("data", (chunk) => {
                data += chunk.toString();
              });
              res.on("end", () => {
                assert.ok(data.includes("data:"), "Must contain SSE data");
                assert.ok(data.includes("[DONE]"), "Must terminate with [DONE]");
                resChat();
              });
            }
          );
          req.on("error", rejChat);
          req.write(body);
          req.end();
        });

        // 2. Test POST /api/generate/stream
        await new Promise((resGen, rejGen) => {
          const body = JSON.stringify({ prompt: "dasturlash", maxTokens: 6 });
          const req = http.request(
            {
              hostname: "127.0.0.1",
              port,
              path: "/api/generate/stream",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              },
            },
            (res) => {
              assert.strictEqual(res.statusCode, 200, "Status must be 200");
              assert.ok(
                res.headers["content-type"].includes("text/event-stream"),
                "Content-Type must be text/event-stream"
              );

              let data = "";
              res.on("data", (chunk) => {
                data += chunk.toString();
              });
              res.on("end", () => {
                assert.ok(data.includes("data:"), "Must contain SSE data");
                assert.ok(data.includes("[DONE]"), "Must terminate with [DONE]");
                resGen();
              });
            }
          );
          req.on("error", rejGen);
          req.write(body);
          req.end();
        });

        if (server.sessionManager) {
          server.sessionManager.deleteSession("sess_test_stream");
        }

        testServer.close(() => {
          resolve();
        });
      } catch (err) {
        if (server.sessionManager) {
          server.sessionManager.deleteSession("sess_test_stream");
        }
        testServer.close(() => {
          reject(err);
        });
      }
    });

    testServer.on("error", reject);
  });
}

if (require.main === module) {
  testStreamingEndpoints()
    .then(() => {
      console.log("✅ test_server_streaming.js muvaffaqiyatli o'tdi!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ test_server_streaming.js da xatolik:", err);
      process.exit(1);
    });
}

module.exports = testStreamingEndpoints;
