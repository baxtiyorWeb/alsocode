#!/usr/bin/env bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
echo "======================================================================="
echo "  AVTOMATIK BILIM GENERATSIYASI VA CPU ORQALI O'QITISH"
echo "======================================================================="
node scripts/autotrain_cpu.js
