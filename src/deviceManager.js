/**
 * =======================================================================
 *  HARDWARE ACCELERATION & DEVICE MANAGER (GPU / CPU Dual-Engine)
 * =======================================================================
 *  Professional darajadagi apparat resurslarini boshqaruvchi modul:
 *  - Tizimda diskret yoki integratsiyalangan GPU (NVIDIA / WebGL) ni aniqlaydi;
 *  - CLI flaglari (--gpu, --cpu, --device=gpu/cpu) va ENV sozlamalarini tahlil qiladi;
 *  - GPU yoki CPU rejimini xavfsiz initsializatsiya qiladi;
 *  - Agar GPU drayveri yoki apparati mavjud bo'lmasa, dastur to'xtab qolmasdan
 *    avtomatik va xavfsiz CPU rejimiga o'tadi (Graceful Fallback).
 * =======================================================================
 */

const { execSync } = require("child_process");

class DeviceManager {
  constructor() {
    this._cachedInfo = null;
  }

  /**
   * Tizimda GPU mavjudligi va modelini aniqlash
   */
  getHardwareInfo() {
    if (this._cachedInfo) return this._cachedInfo;

    let gpuName = null;
    let hasNvidia = false;

    // 1. NVIDIA GPU ni aniqlashga urinish (Linux / Windows)
    try {
      const out = execSync("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1500,
      });
      if (out && out.trim()) {
        const parts = out.trim().split("\n")[0].split(",");
        gpuName = parts[0] ? parts[0].trim() : "NVIDIA GPU";
        if (parts[1]) gpuName += ` (${parts[1].trim()})`;
        hasNvidia = true;
      }
    } catch (e) {
      // nvidia-smi yo'q bo'lsa davom etadi
    }

    // 2. gpu.js HeadlessGL / WebGL qo'llab-quvvatlanishini tekshirish
    let gpuJsSupported = false;
    let gpuMode = "cpu";
    try {
      const { GPU } = require("gpu.js");
      gpuJsSupported = !!GPU.isGPUSupported;
      if (gpuJsSupported) {
        const testGpu = new GPU({ mode: "gpu" });
        gpuMode = testGpu.mode;
        testGpu.destroy();
      }
    } catch (e) {
      gpuJsSupported = false;
      gpuMode = "cpu";
    }

    const isAvailable = (hasNvidia || gpuJsSupported) && gpuMode === "gpu";

    this._cachedInfo = {
      hasGPU: isAvailable,
      gpuName: gpuName || (isAvailable ? "Hardware WebGL GPU" : "Mavjud emas"),
      hasNvidia,
      gpuJsSupported,
      gpuMode,
      cpuArch: process.arch,
      platform: process.platform,
    };

    return this._cachedInfo;
  }

  /**
   * Alias for getHardwareInfo
   */
  getDeviceInfo() {
    return this.getHardwareInfo();
  }

  /**
   * Foydalanuvchi tanlagan yoki avtomatik aniqlangan rejimni olish
   * @param {Object} options - { device?: 'gpu' | 'cpu' | 'auto' }
   * @returns {{ device: 'gpu' | 'cpu', name: string, isGPU: boolean, reason: string }}
   */
  resolveDevice(options = {}) {
    const hw = this.getHardwareInfo();

    // 1. CLI flaglarini tekshirish (--gpu, --cpu, --device=gpu, --device=cpu)
    const args = process.argv.slice(2);
    let requested = options.device || process.env.DEVICE || null;

    if (!requested) {
      if (args.includes("--gpu") || args.some((a) => a.startsWith("--device=gpu"))) {
        requested = "gpu";
      } else if (args.includes("--cpu") || args.some((a) => a.startsWith("--device=cpu"))) {
        requested = "cpu";
      }
    }

    if (requested) {
      requested = requested.toLowerCase().trim();
    }

    // 2. Tanlov mantiqi
    if (requested === "gpu") {
      if (hw.hasGPU) {
        return {
          device: "gpu",
          name: hw.gpuName,
          isGPU: true,
          reason: `Foydalanuvchi talabi bo'yicha (${hw.gpuName}) tanlandi.`,
        };
      } else {
        return {
          device: "cpu",
          name: `CPU Optimized (${process.arch})`,
          isGPU: false,
          reason: "GPU so'ralgan, lekin apparat yoki drayver topilmadi. Avtomatik CPU ga o'tildi.",
        };
      }
    }

    if (requested === "cpu") {
      return {
        device: "cpu",
        name: `CPU Optimized (${process.arch})`,
        isGPU: false,
        reason: "Foydalanuvchi buyrug'i bo'yicha CPU tanlandi.",
      };
    }

    // 3. Auto-rejim (agar GPU bo'lsa GPU, aks holda CPU)
    if (hw.hasGPU) {
      return {
        device: "gpu",
        name: hw.gpuName,
        isGPU: true,
        reason: `Avtomatik: Apparat tezlatgichi (${hw.gpuName}) aniqlandi.`,
      };
    }

    return {
      device: "cpu",
      name: `CPU Optimized (${process.arch})`,
      isGPU: false,
      reason: "Avtomatik: CPU rejimi tanlandi.",
    };
  }
}

module.exports = new DeviceManager();
