#!/usr/bin/env bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
echo "======================================================================="
echo "  SUN'IY INTELLEKTNI GPU (GRAFIK KARTA) BILAN O'QITISH"
echo "======================================================================="
node scripts/legacy_mlp/train_gpu.js
