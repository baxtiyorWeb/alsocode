/**
 * =======================================================================
 *  FRONTEND ENGINE: SAAS ADMIN, VOICE (STT/TTS), RAG, SANDBOX & MULTI-HEAD
 * =======================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";

  // --- 1. SAAS SIDEBAR & SAHIFA BOSHQARUVI ---
  const navItems = document.querySelectorAll(".nav-item");
  const pageViews = document.querySelectorAll(".page-view");
  const currentPageTitle = document.getElementById("current-page-title");
  const mobileToggleBtn = document.getElementById("mobile-toggle-btn");
  const adminSidebar = document.getElementById("admin-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  const pageTitles = {
    "tab-chat": "Chat & Humanoid Conversational Agent",
    "tab-memory": "Kognitiv Xotira & Bilimlar Grafi",
    "tab-rag": "RAG Hujjatlar Kutubxonasi & Qidiruv",
    "tab-attention": "4-Head Multi-Head Attention & Heatmap",
    "tab-code": "Code Studio & Sandbox Runner",
    "tab-neural": "Neyron Tarmoq & Morfologik Tahlil",
    "tab-llm": "Transformer Mini-LLM Generator",
    "tab-embeddings": "Word Embeddings & Semantika",
  };

  function closeMobileSidebar() {
    if (adminSidebar) adminSidebar.classList.remove("sidebar-open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("overlay-open");
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("active"));
      pageViews.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      const targetPage = document.getElementById(targetId);

      if (targetPage) {
        targetPage.classList.add("active");
        if (currentPageTitle && pageTitles[targetId]) {
          currentPageTitle.textContent = pageTitles[targetId];
        }

        if (targetId === "tab-memory") fetchMemoryData();
        if (targetId === "tab-rag") fetchRagDocs();
        if (targetId === "tab-attention") computeMultiHeadAttention();
      }

      closeMobileSidebar();
    });
  });

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener("click", () => {
      adminSidebar.classList.toggle("sidebar-open");
      sidebarOverlay.classList.toggle("overlay-open");
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
  }

  // --- 2. TEZKOR QAYTA O'QITISH (GPU & CPU DUAL-ENGINE) ---
  const quickTrainBtn = document.getElementById("quick-train-btn");
  const trainDeviceSelect = document.getElementById("train-device-select");
  const hardwareBadge = document.getElementById("hardware-badge");
  const modelStats = document.getElementById("model-stats");

  // Apparat va model ma'lumotlarini yuklash
  async function loadSystemHardwareInfo() {
    try {
      const res = await fetch(`${API_BASE}/api/info`);
      const data = await res.json();
      if (data) {
        if (hardwareBadge && data.hardware) {
          hardwareBadge.textContent = data.hardware.hasGPU ? "⚡ GPU Faol" : "🖥️ CPU Faol";
          hardwareBadge.title = data.hardware.gpuName || "CPU Mode";
          if (!data.hardware.hasGPU) {
            hardwareBadge.style.background = "rgba(156, 163, 175, 0.15)";
            hardwareBadge.style.color = "#9ca3af";
          }
        }
        if (modelStats) {
          const devLabel = data.deviceName || (data.device === "gpu" ? "GPU" : "CPU");
          modelStats.textContent = `${data.inputNodes} Kirish • ${data.hiddenNodes} Yashirin • ${data.outputNodes} Chiqish • ${devLabel}`;
        }
      }
    } catch (e) {}
  }
  loadSystemHardwareInfo();

  if (quickTrainBtn) {
    quickTrainBtn.addEventListener("click", async () => {
      const selectedDevice = trainDeviceSelect ? trainDeviceSelect.value : "auto";
      const devName = selectedDevice === "gpu" ? "GPU ⚡" : (selectedDevice === "cpu" ? "CPU 🖥️" : "Avto 🎯");
      quickTrainBtn.textContent = `O'qitilmoqda (${devName})... ⏳`;
      quickTrainBtn.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/train`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device: selectedDevice }),
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ ${data.message}\nAniqlik (Accuracy): ${data.accuracy || 'Yuqori'}\nLug'at hajmi: ${data.vocabSize} ta so'z`);
          location.reload();
        } else {
          alert("Xatolik: " + data.error);
        }
      } catch (e) {
        alert("Server bilan ulanishda xatolik: " + e.message);
      } finally {
        quickTrainBtn.textContent = "⚡ Modelni O'qitish";
        quickTrainBtn.disabled = false;
      }
    });
  }

  // --- 3. OVOZLI INTERFEYS (STT & TTS) ---
  const voiceSttBtn = document.getElementById("voice-stt-btn");
  const voiceTtsToggle = document.getElementById("voice-tts-toggle");
  const sttStatus = document.getElementById("stt-status");
  let ttsEnabled = true;

  if (voiceTtsToggle) {
    voiceTtsToggle.addEventListener("click", () => {
      ttsEnabled = !ttsEnabled;
      voiceTtsToggle.classList.toggle("active", ttsEnabled);
      voiceTtsToggle.textContent = ttsEnabled ? "🔊 Ovozli Javob: Yoqiq" : "🔇 Ovozli Javob: O'chiq";
    });
  }

  function speakText(text) {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    // HTML teglari va Markdown belgilarini tozalash
    const clean = text.replace(/<[^>]*>/g, "").replace(/[`*#_]/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "uz-UZ";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // Speech-to-Text (STT)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && voiceSttBtn) {
    const recognition = new SpeechRecognition();
    recognition.lang = "uz-UZ";
    recognition.interimResults = false;

    let isRecording = false;

    voiceSttBtn.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
      } else {
        try {
          recognition.start();
          isRecording = true;
          voiceSttBtn.classList.add("recording");
          if (sttStatus) sttStatus.textContent = "🎙️ Tinglamoqda... Gapiring!";
        } catch (e) {
          console.warn("STT xatosi:", e);
        }
      }
    });

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (chatInput) chatInput.value = transcript;
      if (sttStatus) sttStatus.textContent = `Aniqlangan nutq: "${transcript}"`;
    };

    recognition.onerror = (e) => {
      console.warn("Nutq aniqlanmadi:", e.error);
      if (sttStatus) sttStatus.textContent = "Nutq aniqlanmadi, qaytadan urining.";
    };

    recognition.onend = () => {
      isRecording = false;
      voiceSttBtn.classList.remove("recording");
      if (sttStatus) sttStatus.textContent = "Enter — yuborish • 🎙️ — ovozli kiritish";
    };
  }

  // --- 4. AQLLI KOGNITIV CHATBOT ---
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const exportChatBtn = document.getElementById("export-chat-btn");

  if (exportChatBtn) {
    exportChatBtn.addEventListener("click", () => {
      window.open(`${API_BASE}/api/sessions/export`, "_blank");
    });
  }

  function appendChatMessage(sender, text, metadata = {}) {
    const msg = document.createElement("div");
    msg.className = `message msg-${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = sender === "user" ? "ME" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    let formattedText = text.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    formattedText = formattedText.replace(/\n/g, "<br>");
    bubble.innerHTML = formattedText;

    if (sender === "bot") {
      const badgesContainer = document.createElement("div");
      badgesContainer.style.marginTop = "8px";
      badgesContainer.style.display = "flex";
      badgesContainer.style.gap = "6px";
      badgesContainer.style.flexWrap = "wrap";

      if (metadata.toolUsed) {
        badgesContainer.innerHTML += `<span class="badge-status">⚙️ ${metadata.toolUsed}</span>`;
      }
      if (metadata.intent && metadata.intent !== "noma'lum") {
        badgesContainer.innerHTML += `<span class="badge-status">🎯 ${metadata.intent} (${metadata.confidence || 0}%)</span>`;
      }
      if (metadata.emotion && metadata.emotion.primaryEmotion !== "neutral") {
        badgesContainer.innerHTML += `<span class="badge-status">${metadata.emotion.icon} ${metadata.emotion.label}</span>`;
      }

      if (badgesContainer.children.length > 0) {
        bubble.appendChild(badgesContainer);
      }

      // Reasoning Chain (Chain of Thought)
      if (metadata.reasoning && metadata.reasoning.steps && metadata.reasoning.steps.length > 0) {
        const reasoningBox = document.createElement("div");
        reasoningBox.className = "reasoning-box";

        const summary = document.createElement("div");
        summary.className = "reasoning-summary";
        summary.innerHTML = `<span>🧠 Mulohaza Zanjiri (Chain of Thought) • ${metadata.reasoning.executionTimeMs || 5}ms</span> <span>▾</span>`;

        const details = document.createElement("div");
        details.className = "reasoning-details";
        details.style.display = "none";

        let stepsHtml = metadata.reasoning.steps.map((st) => `• ${st}`).join("<br>");
        if (metadata.reasoning.attentionFocus) {
          stepsHtml += `<br>• Attention: "${metadata.reasoning.attentionFocus.from}" ➔ "${metadata.reasoning.attentionFocus.to}" (${metadata.reasoning.attentionFocus.score}%)`;
        }
        details.innerHTML = stepsHtml;

        summary.addEventListener("click", () => {
          const isHidden = details.style.display === "none";
          details.style.display = isHidden ? "block" : "none";
          summary.innerHTML = `<span>🧠 Mulohaza Zanjiri (Chain of Thought) • ${metadata.reasoning.executionTimeMs || 5}ms</span> <span>${isHidden ? "▴" : "▾"}</span>`;
        });

        reasoningBox.appendChild(summary);
        reasoningBox.appendChild(details);
        bubble.appendChild(reasoningBox);
      }

      // Ovoz chiqarish
      speakText(text);
    }

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  }

  function createBotStreamingMessage() {
    const msg = document.createElement("div");
    msg.className = "message msg-bot";

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = "AI";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    const textSpan = document.createElement("span");
    textSpan.className = "streaming-content";
    bubble.appendChild(textSpan);

    const cursor = document.createElement("span");
    cursor.className = "streaming-cursor";
    cursor.textContent = "▋";
    cursor.style.display = "inline-block";
    cursor.style.opacity = "0.7";
    bubble.appendChild(cursor);

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return {
      msg,
      bubble,
      textSpan,
      cursor,
      update(accumulatedText) {
        let formatted = accumulatedText.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        formatted = formatted.replace(/\n/g, "<br>");
        textSpan.innerHTML = formatted;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      finalize(finalText, metadata = {}) {
        cursor.remove();
        let formatted = (finalText || "").replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        formatted = formatted.replace(/\n/g, "<br>");
        textSpan.innerHTML = formatted;

        const badgesContainer = document.createElement("div");
        badgesContainer.style.marginTop = "8px";
        badgesContainer.style.display = "flex";
        badgesContainer.style.gap = "6px";
        badgesContainer.style.flexWrap = "wrap";

        if (metadata.toolUsed) {
          badgesContainer.innerHTML += `<span class="badge-status">⚙️ ${metadata.toolUsed}</span>`;
        }
        if (metadata.intent && metadata.intent !== "noma'lum") {
          badgesContainer.innerHTML += `<span class="badge-status">🎯 ${metadata.intent} (${metadata.confidence || 0}%)</span>`;
        }
        if (metadata.emotion && metadata.emotion.primaryEmotion !== "neutral") {
          badgesContainer.innerHTML += `<span class="badge-status">${metadata.emotion.icon} ${metadata.emotion.label}</span>`;
        }
        if (badgesContainer.children.length > 0) {
          bubble.appendChild(badgesContainer);
        }

        if (metadata.reasoning && metadata.reasoning.steps && metadata.reasoning.steps.length > 0) {
          const reasoningBox = document.createElement("div");
          reasoningBox.className = "reasoning-box";
          const summary = document.createElement("div");
          summary.className = "reasoning-summary";
          summary.innerHTML = `<span>🧠 Mulohaza Zanjiri (Chain of Thought) • ${metadata.reasoning.executionTimeMs || 5}ms</span> <span>▾</span>`;
          const details = document.createElement("div");
          details.className = "reasoning-details";
          details.style.display = "none";
          let stepsHtml = metadata.reasoning.steps.map((st) => `• ${st}`).join("<br>");
          if (metadata.reasoning.attentionFocus) {
            stepsHtml += `<br>• Attention: "${metadata.reasoning.attentionFocus.from}" ➔ "${metadata.reasoning.attentionFocus.to}" (${metadata.reasoning.attentionFocus.score}%)`;
          }
          details.innerHTML = stepsHtml;
          summary.addEventListener("click", () => {
            const isHidden = details.style.display === "none";
            details.style.display = isHidden ? "block" : "none";
            summary.innerHTML = `<span>🧠 Mulohaza Zanjiri (Chain of Thought) • ${metadata.reasoning.executionTimeMs || 5}ms</span> <span>${isHidden ? "▴" : "▾"}</span>`;
          });
          reasoningBox.appendChild(summary);
          reasoningBox.appendChild(details);
          bubble.appendChild(reasoningBox);
        }

        speakText(finalText || "");
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    };
  }

  async function sendChatMessage(customText = null) {
    const message = (customText || chatInput.value).trim();
    if (!message) return;

    appendChatMessage("user", message);
    if (!customText) chatInput.value = "";

    const streamMsg = createBotStreamingMessage();
    let accumulatedText = "";
    let finalMetadata = null;

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server xatosi (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break;

          try {
            const chunk = JSON.parse(dataStr);
            if (chunk.tokenStr) {
              accumulatedText += chunk.tokenStr;
              streamMsg.update(accumulatedText);
            }
            if (chunk.reply) {
              accumulatedText = chunk.reply;
              streamMsg.update(accumulatedText);
            }
            if (chunk.isFinal) {
              finalMetadata = chunk;
            }
          } catch (e) {}
        }
      }

      streamMsg.finalize(accumulatedText || "...", finalMetadata || {});
      if (finalMetadata && (finalMetadata.learned || finalMetadata.userProfile)) {
        updateProfileUI(finalMetadata.userProfile);
      }
    } catch (err) {
      // Fallback agar /api/chat/stream ishlamasa
      try {
        const fallbackRes = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const data = await fallbackRes.json();
        streamMsg.finalize(data.reply, data);
        if (data.learned || data.userProfile) {
          updateProfileUI(data.userProfile);
        }
      } catch (e2) {
        streamMsg.finalize(`⚠️ Xatolik: ${err.message}. Server faolligini tekshiring.`);
      }
    }
  }

  // Universal Fayl O'quvchi (Text, Markdown, JSON, CSV, PDF va Kod fayllar)
  async function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const reader = new FileReader();

      if (isPdf) {
        reader.readAsArrayBuffer(file);
        reader.onload = () => {
          try {
            const buffer = new Uint8Array(reader.result);
            let rawStr = "";
            for (let i = 0; i < buffer.length; i++) {
              rawStr += String.fromCharCode(buffer[i]);
            }
            const textMatches = [];
            const streamRegex = /BT[\s\S]*?ET/g;
            let match;
            while ((match = streamRegex.exec(rawStr)) !== null) {
              const block = match[0];
              const tjRegex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
              let tMatch;
              while ((tMatch = tjRegex.exec(block)) !== null) {
                const chunk = tMatch[1] || tMatch[2] || "";
                const cleanChunk = chunk.replace(/\\([()\\])/g, "$1").trim();
                if (cleanChunk) textMatches.push(cleanChunk);
              }
            }

            let extracted = textMatches.join(" ").trim();
            if (extracted.length < 50) {
              const asciiMatches = rawStr.match(/[a-zA-Zа-яА-ЯёЁo'g'0-9\s.,!?:;'"\-]{6,}/g) || [];
              extracted = asciiMatches
                .filter((s) => !/^(Obj|endobj|stream|endstream|xref|trailer|startxref)/i.test(s.trim()))
                .join(" ");
            }

            if (!extracted || extracted.length < 10) {
              resolve(`[PDF Hujjati: ${file.name}] Matn ajratib bo'lmadi`);
            } else {
              resolve(extracted);
            }
          } catch (err) {
            reject(new Error("PDF faylni o'qishda xatolik: " + err.message));
          }
        };
        reader.onerror = () => reject(new Error("Faylni o'qishda xatolik"));
      } else {
        reader.readAsText(file, "UTF-8");
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => reject(new Error("Faylni o'qishda xatolik"));
      }
    });
  }

  // Chat ichidan to'g'ridan-to'g'ri fayl yuklash (📎 Tugmasi)
  const chatFileBtn = document.getElementById("chat-file-btn");
  const chatFileInput = document.getElementById("chat-file-input");

  if (chatFileBtn && chatFileInput) {
    chatFileBtn.addEventListener("click", () => chatFileInput.click());

    chatFileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      appendChatMessage("user", `📎 Fayl yuklandi: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`);

      const loadingBubble = appendChatMessage("bot", `⏳ «${file.name}» o'qilmoqda va RAG tizimiga indekslanmoqda...`);

      try {
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        let uploadPayload;

        if (isPdf) {
          const fileBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          uploadPayload = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            fileBase64,
            isPdf: true,
            category: "darslik",
          };
        } else {
          const textContent = await readUploadedFile(file);
          if (!textContent || textContent.trim().length === 0) {
            throw new Error("Fayl ichida o'qilishi mumkin bo'lgan matn topilmadi.");
          }
          uploadPayload = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: textContent,
            category: "chat_hujjat",
          };
        }

        const res = await fetch(`${API_BASE}/api/rag/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadPayload),
        });

        const data = await res.json();
        if (data.success) {
          const docInfo = data.doc;
          loadingBubble.innerHTML = `
            <div class="msg-file-pill">
              <span class="file-icon">📄</span>
              <div>
                <div class="file-name">${file.name}</div>
                <div class="file-meta">${docInfo.chunksCount} ta mantiqiy bo'lak • ${(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <p>✅ <strong>«${file.name}»</strong> hujjati muvaffaqiyatli o'rganildi!</p>
            <p style="margin-top:6px; font-size:12.5px; color:var(--slate-300);">Endi ushbu fayl bo'yicha istalgan savolingizni berishingiz mumkin (masalan: <em>"ushbu matn nima haqida?"</em> yoki undagi aniq bir fakt bo'yicha).</p>
          `;
          if (typeof fetchRagDocs === "function") fetchRagDocs();
          if (chatInput) chatInput.focus();
        } else {
          loadingBubble.innerHTML = `⚠️ Hujjatni indekslashda xatolik: ${data.error}`;
        }
      } catch (err) {
        loadingBubble.innerHTML = `⚠️ Faylni yuklashda xatolik: ${err.message}`;
      } finally {
        chatFileInput.value = "";
      }
    });
  }

  if (chatSendBtn) chatSendBtn.addEventListener("click", () => sendChatMessage());
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
  }

  document.querySelectorAll(".chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      sendChatMessage(chip.dataset.prompt);
    });
  });

  // --- 5. KOGNITIV XOTIRA ---
  const profName = document.getElementById("prof-name");
  const profProfession = document.getElementById("prof-profession");
  const profInterests = document.getElementById("prof-interests");
  const factsCount = document.getElementById("facts-count");
  const navFactsCount = document.getElementById("nav-facts-count");
  const factsListContainer = document.getElementById("facts-list-container");
  const learnSubject = document.getElementById("learn-subject");
  const learnObject = document.getElementById("learn-object");
  const learnFactBtn = document.getElementById("learn-fact-btn");

  const sidebarUserName = document.getElementById("sidebar-user-name");
  const sidebarUserRole = document.getElementById("sidebar-user-role");
  const sidebarUserAvatar = document.getElementById("sidebar-user-avatar");

  function updateProfileUI(profile) {
    if (!profile) return;
    const name = profile.name || "Foydalanuvchi";
    const profession = profile.profession || "Kiritilmagan";

    if (profName) profName.textContent = profile.name || "Hali aytilmadi";
    if (profProfession) profProfession.textContent = profile.profession || "Hali aytilmadi";

    if (sidebarUserName) sidebarUserName.textContent = name;
    if (sidebarUserRole) sidebarUserRole.textContent = profession;
    if (sidebarUserAvatar) sidebarUserAvatar.textContent = profile.name ? profile.name.charAt(0).toUpperCase() : "👤";

    if (profInterests) {
      if (profile.interests && profile.interests.length > 0) {
        profInterests.innerHTML = profile.interests
          .map((int) => `<span class="tag-solid">${int}</span>`)
          .join("");
      } else {
        profInterests.innerHTML = `<span style="color: var(--text-muted); font-size: 12px;">Hali aniqlanmagan</span>`;
      }
    }
  }

  async function fetchMemoryData() {
    try {
      const res = await fetch(`${API_BASE}/api/memory`);
      const data = await res.json();
      updateProfileUI(data.userProfile);

      const count = data.factsCount || (data.factsSample ? data.factsSample.length : 0);
      if (factsCount) factsCount.textContent = count;
      if (navFactsCount) navFactsCount.textContent = count;

      if (factsListContainer) {
        factsListContainer.innerHTML = "";
        const facts = data.factsSample || [];
        if (facts.length === 0) {
          factsListContainer.innerHTML = "<p style='color: var(--slate-500); font-size: 12px; padding: 10px;'>Hozircha saqlangan faktlar yo'q.</p>";
          return;
        }

        facts.forEach((f) => {
          const item = document.createElement("div");
          item.className = "fact-item";
          item.innerHTML = `
            <div class="fact-header">
              <span class="fact-subject">${f.subject}</span>
              <span class="fact-meta">Foydalanildi: ${f.usageCount || 0} marta</span>
            </div>
            <div class="fact-object">${f.relation} ${f.object}</div>
          `;
          factsListContainer.appendChild(item);
        });
      }
    } catch (e) {
      console.warn("Xotira yuklashda xatolik:", e);
    }
  }

  if (learnFactBtn) {
    learnFactBtn.addEventListener("click", async () => {
      const subject = learnSubject.value.trim();
      const object = learnObject.value.trim();
      if (!subject || !object) {
        alert("Iltimos, mavzu va uning mazmunini to'liq kiriting!");
        return;
      }

      learnFactBtn.textContent = "O'rganilmoqda... ⏳";
      learnFactBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/memory/learn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, relation: "bu", object }),
        });
        const data = await res.json();
        if (data.success) {
          alert(` Yangi fakt xotiraga muhrlandi:\n[${data.fact.subject}] — ${data.fact.object}`);
          learnSubject.value = "";
          learnObject.value = "";
          fetchMemoryData();
        }
      } catch (err) {
        alert("Xatolik: " + err.message);
      } finally {
        learnFactBtn.textContent = "Xotiraga Saqlash 🧠";
        learnFactBtn.disabled = false;
      }
    });
  }

  // --- 6. RAG HUJJATLAR KUTUBXONASI ---
  const ragDocTitle = document.getElementById("rag-doc-title");
  const ragDocCat = document.getElementById("rag-doc-cat");
  const ragDocContent = document.getElementById("rag-doc-content");
  const ragUploadBtn = document.getElementById("rag-upload-btn");
  const ragDocsTotal = document.getElementById("rag-docs-total");
  const navDocsCount = document.getElementById("nav-docs-count");
  const ragDocsList = document.getElementById("rag-docs-list");
  const ragQueryInput = document.getElementById("rag-query-input");
  const ragQueryBtn = document.getElementById("rag-query-btn");
  const ragQueryResult = document.getElementById("rag-query-result");
  const ragDropzone = document.getElementById("rag-dropzone");
  const ragFilePicker = document.getElementById("rag-file-picker");
  const ragContentStats = document.getElementById("rag-content-stats");

  // Matn hajmini real-vaqtda hisoblash
  if (ragDocContent && ragContentStats) {
    ragDocContent.addEventListener("input", () => {
      const len = ragDocContent.value.length;
      ragContentStats.textContent = `${len.toLocaleString()} belgi (~${Math.ceil(len / 300)} bo'lak)`;
    });
  }

  // RAG Drag & Drop zonasi hodisalari
  if (ragDropzone && ragFilePicker) {
    ragDropzone.addEventListener("click", () => ragFilePicker.click());

    ragDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      ragDropzone.classList.add("dragover");
    });

    ragDropzone.addEventListener("dragleave", () => {
      ragDropzone.classList.remove("dragover");
    });

    ragDropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      ragDropzone.classList.remove("dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleRagFileSelection(file);
    });

    ragFilePicker.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleRagFileSelection(file);
    });
  }

  async function handleRagFileSelection(file) {
    if (!file) return;
    const dropText = ragDropzone ? ragDropzone.querySelector(".dropzone-text") : null;
    try {
      if (dropText) dropText.textContent = `O'qilmoqda: ${file.name}... ⏳`;
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      let text = "";
      if (isPdf) {
        const fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const parseRes = await fetch(`${API_BASE}/api/rag/parse-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64, filename: file.name }),
        });
        const parseData = await parseRes.json();
        if (!parseRes.ok || !parseData.text) {
          throw new Error(parseData.error || "PDF matnini ajratib bo'lmadi");
        }
        text = parseData.text;
      } else {
        text = await readUploadedFile(file);
      }

      if (ragDocTitle) ragDocTitle.value = file.name.replace(/\.[^/.]+$/, "");
      if (ragDocCat) ragDocCat.value = "yuklangan";
      if (ragDocContent) {
        ragDocContent.value = text;
        if (ragContentStats) {
          ragContentStats.textContent = `${text.length.toLocaleString()} belgi (~${Math.ceil(text.length / 300)} bo'lak)`;
        }
      }
      if (dropText) dropText.innerHTML = `✅ <strong>${file.name}</strong> tanlandi (${(file.size / 1024).toFixed(1)} KB)`;
    } catch (err) {
      alert("Faylni o'qishda xatolik: " + err.message);
      if (dropText) dropText.innerHTML = `Faylni bu yerga sudrab tashlang yoki <span class="dropzone-link">tanlang</span>`;
    }
  }

  async function fetchRagDocs() {
    try {
      const res = await fetch(`${API_BASE}/api/rag/docs`);
      const data = await res.json();

      if (ragDocsTotal) ragDocsTotal.textContent = data.documentsCount || 0;
      if (navDocsCount) navDocsCount.textContent = data.documentsCount || 0;

      if (ragDocsList) {
        ragDocsList.innerHTML = "";
        const docs = data.documents || [];
        if (docs.length === 0) {
          ragDocsList.innerHTML = "<p style='color: var(--slate-500); font-size: 12px; padding: 10px;'>Yuklangan hujjatlar yo'q.</p>";
          return;
        }

        docs.forEach((doc) => {
          const card = document.createElement("div");
          card.className = "rag-doc-card";
          card.innerHTML = `
            <div class="rag-doc-info">
              <h5>📄 ${doc.title}</h5>
              <p>Toifasi: ${doc.category} • Hajmi: ${doc.length} belgi</p>
            </div>
            <button class="btn btn-secondary btn-xs btn-delete-doc" data-id="${doc.id}">O'chirish</button>
          `;
          ragDocsList.appendChild(card);
        });

        // O'chirish tugmalari
        document.querySelectorAll(".btn-delete-doc").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const docId = e.target.dataset.id;
            if (confirm("Hujjatni o'chirishga ishonchingiz komilmi?")) {
              await fetch(`${API_BASE}/api/rag/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docId }),
              });
              fetchRagDocs();
            }
          });
        });
      }
    } catch (e) {
      console.warn("RAG yuklashda xatolik:", e);
    }
  }

  if (ragUploadBtn) {
    ragUploadBtn.addEventListener("click", async () => {
      const title = ragDocTitle.value.trim();
      const content = ragDocContent.value.trim();
      const category = ragDocCat.value.trim();

      if (!title || !content) {
        alert("Iltimos, hujjat nomi va matnini kiriting!");
        return;
      }

      ragUploadBtn.textContent = "Indekslanmoqda... ⏳";
      ragUploadBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/rag/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, category }),
        });
        const data = await res.json();
        if (data.success) {
          alert(` Hujjat muvaffaqiyatli indekslandi!\n[${data.doc.title}] (${data.doc.chunksCount} ta bo'lakka ajratildi)`);
          ragDocTitle.value = "";
          ragDocContent.value = "";
          fetchRagDocs();
        } else {
          alert("Xatolik: " + data.error);
        }
      } catch (e) {
        alert("Xatolik: " + e.message);
      } finally {
        ragUploadBtn.textContent = "Indekslash va Saqlash 📚";
        ragUploadBtn.disabled = false;
      }
    });
  }

  if (ragQueryBtn) {
    ragQueryBtn.addEventListener("click", async () => {
      const query = ragQueryInput.value.trim();
      if (!query) return;

      ragQueryBtn.textContent = "Qidirilmoqda... ⏳";
      ragQueryBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/rag/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();

        let html = `<div class="rag-result-box"><strong>Qidiruv natijasi:</strong><br>${data.reply}</div>`;
        if (data.sources && data.sources.length > 0) {
          html += `<div style="margin-top: 8px;"><strong>Manbalar:</strong>`;
          data.sources.forEach((src) => {
            html += `
              <div class="rag-chunk-card" style="margin-top: 6px;">
                <div class="rag-chunk-header">
                  <span>${src.title}</span>
                  <span class="rag-chunk-score">Moslik: ${src.score}%</span>
                </div>
                <div>"${src.text}"</div>
              </div>
            `;
          });
          html += `</div>`;
        }
        ragQueryResult.innerHTML = html;
      } catch (e) {
        ragQueryResult.innerHTML = `<p style="color: var(--rose);">Xatolik: ${e.message}</p>`;
      } finally {
        ragQueryBtn.textContent = "Qidirish 🔍";
        ragQueryBtn.disabled = false;
      }
    });
  }

  // --- 7. 4-HEAD MULTI-HEAD ATTENTION ---
  const attentionInput = document.getElementById("attention-input");
  const attentionBtn = document.getElementById("attention-btn");
  const attentionTable = document.getElementById("attention-table");
  const attentionPairs = document.getElementById("attention-pairs");
  const headBtns = document.querySelectorAll(".head-btn");

  let multiHeadDataCache = null;
  let selectedHead = "avg";

  headBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      headBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedHead = btn.dataset.head;
      renderCurrentHeadView();
    });
  });

  function renderCurrentHeadView() {
    if (!multiHeadDataCache) return;

    let matrix = multiHeadDataCache.averagedMatrix;
    let pairs = [];

    if (selectedHead !== "avg") {
      const headIdx = parseInt(selectedHead, 10) - 1;
      const hData = multiHeadDataCache.headsData[headIdx];
      if (hData) {
        matrix = hData.matrix;
        pairs = [hData.topPair];
      }
    } else {
      // Barcha boshlardan eng kuchli juftliklar
      multiHeadDataCache.headsData.forEach((h) => pairs.push(h.topPair));
    }

    // Jadvalni chizish
    attentionTable.innerHTML = "";
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>Tokens</th>" + multiHeadDataCache.tokens.map((t) => `<th>${t}</th>`).join("");
    attentionTable.appendChild(headerRow);

    matrix.forEach((row, i) => {
      const tr = document.createElement("tr");
      let rowHtml = `<th>${multiHeadDataCache.tokens[i]}</th>`;
      row.forEach((score) => {
        const alpha = Math.min(Math.max(score * 2.2, 0.08), 0.95);
        rowHtml += `<td style="background: rgba(2, 132, 199, ${alpha}); color: ${score > 0.3 ? '#fff' : '#cbd5e1'}; font-weight: ${score > 0.2 ? '600' : 'normal'}">${score}</td>`;
      });
      tr.innerHTML = rowHtml;
      attentionTable.appendChild(tr);
    });

    // Juftliklar
    attentionPairs.innerHTML = "";
    pairs.forEach((pair) => {
      const card = document.createElement("div");
      card.className = "pair-card";
      card.innerHTML = `
        <div class="pair-tokens">
          <strong>${pair.from}</strong>
          <span class="pair-arrow">➔</span>
          <strong>${pair.to}</strong>
        </div>
        <span class="pair-score">${pair.score}%</span>
      `;
      attentionPairs.appendChild(card);
    });
  }

  async function computeMultiHeadAttention() {
    const text = attentionInput.value.trim() || "Sun'iy intellekt dasturlash kelajagini tubdan o'zgartiradi";
    attentionBtn.textContent = "Hisoblanmoqda... ⏳";
    attentionBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/attention/multihead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      multiHeadDataCache = await res.json();
      renderCurrentHeadView();
    } catch (e) {
      attentionPairs.innerHTML = `<p style="color: var(--rose); font-size: 12px;">Xatolik: ${e.message}</p>`;
    } finally {
      attentionBtn.textContent = "Hisoblash ⚡";
      attentionBtn.disabled = false;
    }
  }

  if (attentionBtn) {
    attentionBtn.addEventListener("click", computeMultiHeadAttention);
    attentionInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") computeMultiHeadAttention();
    });
  }

  // --- 8. CODE STUDIO & SANDBOX RUNNER ---
  const codeInput = document.getElementById("code-input");
  const runSandboxBtn = document.getElementById("run-sandbox-btn");
  const analyzeCodeBtn = document.getElementById("analyze-code-btn");
  const healCodeBtn = document.getElementById("heal-code-btn");
  const terminalConsole = document.getElementById("terminal-console");
  const sandboxStatusBadge = document.getElementById("sandbox-status-badge");
  const codeAnalysisResults = document.getElementById("code-analysis-results");

  let lastRunError = null;

  async function runSandboxCode() {
    const code = codeInput.value;
    runSandboxBtn.textContent = "Bajarilmoqda... ⏳";
    runSandboxBtn.disabled = true;
    if (healCodeBtn) healCodeBtn.style.display = "none";

    terminalConsole.innerHTML = `<span class="terminal-muted">// VM Sandbox ishga tushirilmoqda...</span>\n`;

    try {
      const res = await fetch(`${API_BASE}/api/sandbox/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      let terminalHtml = "";
      if (data.output && data.output.length > 0) {
        terminalHtml += data.output.map((line) => `<div>${line}</div>`).join("");
      }

      if (data.success) {
        if (data.result !== null) {
          terminalHtml += `<div style="color: var(--primary);">➔ Qaytarilgan qiymat: ${data.result}</div>`;
        }
        terminalHtml += `<div class="terminal-muted" style="margin-top: 8px;">✓ Bajarildi (${data.executionTimeMs} ms)</div>`;
        if (sandboxStatusBadge) {
          sandboxStatusBadge.textContent = "Muvaffaqiyatli";
          sandboxStatusBadge.style.color = "var(--emerald)";
        }
      } else {
        lastRunError = data.error;
        terminalHtml += `<div class="terminal-error">🛑 Xatolik: ${data.error}</div>`;
        if (data.stack) {
          terminalHtml += `<div class="terminal-muted">${data.stack}</div>`;
        }
        if (sandboxStatusBadge) {
          sandboxStatusBadge.textContent = "Xatolik bor";
          sandboxStatusBadge.style.color = "var(--rose)";
        }
        if (healCodeBtn) healCodeBtn.style.display = "inline-flex";
      }

      terminalConsole.innerHTML = terminalHtml || `<span class="terminal-muted">// Kod hech qanday natija chiqarmadi</span>`;
    } catch (err) {
      terminalConsole.innerHTML = `<div class="terminal-error">Aloqa xatosi: ${err.message}</div>`;
    } finally {
      runSandboxBtn.textContent = "Yurgizish ▶";
      runSandboxBtn.disabled = false;
    }
  }

  if (runSandboxBtn) runSandboxBtn.addEventListener("click", runSandboxCode);

  // Self-Healing Debugger
  if (healCodeBtn) {
    healCodeBtn.addEventListener("click", async () => {
      const code = codeInput.value;
      healCodeBtn.textContent = "Tuzatilmoqda... 🩹";
      healCodeBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/sandbox/debug`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, error: lastRunError }),
        });
        const data = await res.json();

        codeInput.value = data.fixedCode;
        terminalConsole.innerHTML += `
          <div style="margin-top: 10px; color: var(--emerald); border-top: 1px dashed var(--slate-800); padding-top: 6px;">
            🩹 <strong>Avto-Tuzatish Natijasi:</strong> ${data.diffExplanation}<br>
            Diagnoz: ${data.diagnosis}
          </div>
        `;
        healCodeBtn.style.display = "none";
        // Qayta ishga tushirib ko'rish
        runSandboxCode();
      } catch (e) {
        alert("Avto-tuzatishda xatolik: " + e.message);
      } finally {
        healCodeBtn.textContent = "Avto-Tuzatish 🩹";
        healCodeBtn.disabled = false;
      }
    });
  }

  // Statik analizator
  async function analyzeCodeContent() {
    const code = codeInput.value;
    analyzeCodeBtn.textContent = "Tahlil... ⏳";
    analyzeCodeBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/code/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      let html = `
        <div class="analysis-stat-row">
          <div class="stat-box"><small>Qatorlar</small><strong>${data.stats.lines}</strong></div>
          <div class="stat-box"><small>Funksiyalar</small><strong>${data.stats.functions}</strong></div>
          <div class="stat-box"><small>O'zgaruvchilar</small><strong>${data.stats.variables}</strong></div>
          <div class="stat-box"><small>Sikllar</small><strong>${data.stats.loops}</strong></div>
        </div>
        <p style="margin-bottom: 8px; font-size: 12px; color: var(--slate-300);">
          <strong>Murakkablik:</strong> <span class="badge-status">${data.stats.complexity}</span>
        </p>
      `;

      if (data.valid) {
        html += `<div class="issue-card issue-success"> ${data.recommendation}</div>`;
      } else {
        html += `<div class="issue-card issue-error">⚠️ ${data.recommendation}</div>`;
      }

      if (data.issues && data.issues.length > 0) {
        data.issues.forEach((iss) => {
          const typeClass = iss.type.includes("error") ? "issue-error" : "issue-warning";
          html += `<div class="issue-card ${typeClass}">[Qator ${iss.line}] ${iss.message}</div>`;
        });
      }

      codeAnalysisResults.innerHTML = html;
    } catch (err) {
      codeAnalysisResults.innerHTML = `<p style="color: var(--rose); font-size: 12px;">Tahlilda xatolik: ${err.message}</p>`;
    } finally {
      analyzeCodeBtn.textContent = "Statik Tekshirish 🛠️";
      analyzeCodeBtn.disabled = false;
    }
  }

  if (analyzeCodeBtn) analyzeCodeBtn.addEventListener("click", analyzeCodeContent);

  async function loadSnippet(topic) {
    try {
      const res = await fetch(`${API_BASE}/api/code/snippet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.code) {
        codeInput.value = data.code;
        runSandboxCode();
      }
    } catch (e) {
      console.warn("Snippet yuklashda xatolik:", e);
    }
  }

  const snipServer = document.getElementById("code-snippet-server");
  const snipSearch = document.getElementById("code-snippet-search");
  const snipNeuron = document.getElementById("code-snippet-neuron");

  if (snipServer) snipServer.addEventListener("click", () => loadSnippet("server"));
  if (snipSearch) snipSearch.addEventListener("click", () => loadSnippet("search"));
  if (snipNeuron) snipNeuron.addEventListener("click", () => loadSnippet("neuron"));

  // --- 9. NEYRON TARMOQ CANVAS VIZUALIZATORI & MORFOLOGIYA ---
  const canvas = document.getElementById("neuralCanvas");
  const ctx = canvas.getContext("2d");

  const layers = { inputs: 8, hidden: 10, outputs: 4 };
  let activeInputs = [];
  let hiddenValues = [];
  let outputValues = [];
  let signalProgress = 1;

  function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paddingX = 60;
    const paddingY = 36;
    const colWidth = (canvas.width - paddingX * 2) / 2;

    const getX = (col) => paddingX + col * colWidth;
    const getY = (row, total) => {
      const spacing = (canvas.height - paddingY * 2) / (total - 1 || 1);
      return paddingY + row * spacing;
    };

    // Sinapslar: Kirish -> Yashirin
    for (let i = 0; i < layers.inputs; i++) {
      const x1 = getX(0);
      const y1 = getY(i, layers.inputs);
      const isInputActive = activeInputs.includes(i);

      for (let j = 0; j < layers.hidden; j++) {
        const x2 = getX(1);
        const y2 = getY(j, layers.hidden);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isInputActive ? `rgba(2, 132, 199, 0.45)` : `rgba(255, 255, 255, 0.04)`;
        ctx.lineWidth = isInputActive ? 1.5 : 0.8;
        ctx.stroke();

        if (isInputActive && signalProgress < 1) {
          const px = x1 + (x2 - x1) * signalProgress;
          const py = y1 + (y2 - y1) * signalProgress;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();
        }
      }
    }

    // Sinapslar: Yashirin -> Chiqish
    for (let j = 0; j < layers.hidden; j++) {
      const x1 = getX(1);
      const y1 = getY(j, layers.hidden);
      for (let k = 0; k < layers.outputs; k++) {
        const x2 = getX(2);
        const y2 = getY(k, layers.outputs);
        const oVal = outputValues[k] || 0.1;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = oVal > 0.4 ? `rgba(168, 85, 247, ${Math.min(oVal, 0.8)})` : `rgba(255, 255, 255, 0.04)`;
        ctx.lineWidth = oVal > 0.4 ? 1.8 : 0.8;
        ctx.stroke();
      }
    }

    // Neyronlar
    for (let i = 0; i < layers.inputs; i++) {
      const x = getX(0);
      const y = getY(i, layers.inputs);
      const isActive = activeInputs.includes(i);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#0284c7" : "#1b263b";
      ctx.strokeStyle = isActive ? "#38bdf8" : "#41526d";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    for (let j = 0; j < layers.hidden; j++) {
      const x = getX(1);
      const y = getY(j, layers.hidden);
      const val = hiddenValues[j] || 0;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = val > 0.4 ? "#a855f7" : "#1b263b";
      ctx.strokeStyle = val > 0.4 ? "#c084fc" : "#41526d";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    const categories = ["salom", "dastur", "ob_havo", "xayr"];
    for (let k = 0; k < layers.outputs; k++) {
      const x = getX(2);
      const y = getY(k, layers.outputs);
      const val = outputValues[k] || 0;
      const isWinner = val > 0.5;

      ctx.beginPath();
      ctx.arc(x, y, isWinner ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isWinner ? "#10b981" : "#1b263b";
      ctx.strokeStyle = isWinner ? "#34d399" : "#41526d";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isWinner ? "#10b981" : "#8fa0b8";
      ctx.font = isWinner ? "600 11px Inter" : "11px Inter";
      ctx.fillText(categories[k], x + 14, y + 4);
    }
  }

  function animateSignal() {
    if (signalProgress < 1) {
      signalProgress += 0.05;
      drawNetwork();
      requestAnimationFrame(animateSignal);
    }
  }
  drawNetwork();

  const neuralBtn = document.getElementById("neural-btn");
  const neuralInput = document.getElementById("neural-input");
  const predCategory = document.getElementById("pred-category");
  const predConfidence = document.getElementById("pred-confidence");
  const probBarsContainer = document.getElementById("prob-bars-container");
  const lemmasContainer = document.getElementById("lemmas-container");

  async function analyzeText() {
    const text = neuralInput.value.trim();
    if (!text) return;

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      predCategory.textContent = data.category;
      predConfidence.textContent = `${data.confidence}%`;

      if (lemmasContainer && data.lemmas) {
        lemmasContainer.innerHTML = data.lemmas
          .map((lem) => `<span class="tag-solid">${lem}</span>`)
          .join("");
      }

      probBarsContainer.innerHTML = "";
      Object.entries(data.probabilities).forEach(([cat, pct]) => {
        const item = document.createElement("div");
        item.className = "prob-item";
        item.innerHTML = `
          <div class="prob-header">
            <span>${cat}</span>
            <strong>${pct}%</strong>
          </div>
          <div class="prob-track">
            <div class="prob-fill" style="width: ${pct}%"></div>
          </div>
        `;
        probBarsContainer.appendChild(item);
      });

      activeInputs = [1, 3, 5];
      hiddenValues = data.hiddenActivations.slice(0, 10);
      outputValues = data.outputActivations;
      signalProgress = 0;
      animateSignal();
    } catch (err) {
      console.error(err);
    }
  }

  if (neuralBtn) neuralBtn.addEventListener("click", analyzeText);
  if (neuralInput) {
    neuralInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") analyzeText();
    });
  }
  analyzeText();

  // --- 10. MINI-LLM GENERATOR ---
  const promptInput = document.getElementById("prompt-input");
  const tempSlider = document.getElementById("temp-slider");
  const tempVal = document.getElementById("temp-val");
  const tokensSlider = document.getElementById("tokens-slider");
  const tokensVal = document.getElementById("tokens-val");
  const generateBtn = document.getElementById("generate-btn");
  const generatedOutput = document.getElementById("generated-output");

  if (tempSlider) tempSlider.addEventListener("input", () => (tempVal.textContent = tempSlider.value));
  if (tokensSlider) tokensSlider.addEventListener("input", () => (tokensVal.textContent = tokensSlider.value));

  async function generateText() {
    const prompt = promptInput.value.trim() || "dasturlash";
    const temperature = parseFloat(tempSlider.value);
    const maxTokens = parseInt(tokensSlider.value, 10);

    generateBtn.textContent = "To'qilmoqda... ⏳";
    generateBtn.disabled = true;
    generatedOutput.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/api/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, temperature, maxTokens }),
      });

      if (!res.ok || !res.body) throw new Error("Stream connection failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullGenerated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break;

          try {
            const chunk = JSON.parse(dataStr);
            if (chunk.tokenStr) {
              fullGenerated += chunk.tokenStr;
              generatedOutput.textContent = `"${fullGenerated}"`;
            }
          } catch (e) {}
        }
      }

      if (!fullGenerated) {
        generatedOutput.textContent = '""';
      }
    } catch (err) {
      try {
        const res = await fetch(`${API_BASE}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, temperature, maxTokens }),
        });
        const data = await res.json();
        generatedOutput.textContent = `"${data.generatedText}"`;
      } catch (e2) {
        generatedOutput.textContent = "Generatsiya jarayonida xatolik yuz berdi.";
      }
    } finally {
      generateBtn.textContent = "Yangi Matn Yaratish ✨";
      generateBtn.disabled = false;
    }
  }

  if (generateBtn) generateBtn.addEventListener("click", generateText);

  // --- 11. WORD EMBEDDINGS ---
  const embeddingInput = document.getElementById("embedding-input");
  const embeddingBtn = document.getElementById("embedding-btn");
  const currentEmbeddingWord = document.getElementById("current-embedding-word");
  const similarityGrid = document.getElementById("similarity-grid");

  async function fetchEmbeddings() {
    const word = embeddingInput.value.trim();
    if (!word) return;

    currentEmbeddingWord.textContent = word;
    similarityGrid.innerHTML = "Yuklanmoqda...";

    try {
      const res = await fetch(`${API_BASE}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();

      similarityGrid.innerHTML = "";
      if (data.similar.length === 0) {
        similarityGrid.innerHTML = "<p style='color: var(--slate-500); font-size: 12px;'>Bu so'z lug'atda topilmadi (masalan: dasturlash, havo, salom, kod).</p>";
        return;
      }

      data.similar.forEach((item) => {
        const card = document.createElement("div");
        card.className = "sim-card";
        const pct = Math.max(0, Math.round(item.similarity * 100));
        card.innerHTML = `
          <span class="sim-word">${item.word}</span>
          <div class="sim-score-box">
            <span>O'xshashlik:</span>
            <strong>${item.similarity} (${pct}%)</strong>
          </div>
          <div class="prob-track">
            <div class="prob-fill" style="width: ${pct}%"></div>
          </div>
        `;
        similarityGrid.appendChild(card);
      });
    } catch (err) {
      similarityGrid.innerHTML = "<p style='color: var(--rose); font-size: 12px;'>Xatolik yuz berdi.</p>";
    }
  }

  if (embeddingBtn) embeddingBtn.addEventListener("click", fetchEmbeddings);
  if (embeddingInput) {
    embeddingInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") fetchEmbeddings();
    });
  }

  // Dastlabki yuklashlar
  fetchMemoryData();
  fetchRagDocs();
});
