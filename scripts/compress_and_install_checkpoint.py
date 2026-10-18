#!/usr/bin/env python3
"""
Compress and Install Checkpoint
Rounds 64-bit float weights in JSON to 5 decimal places (FP16 equivalent).
Reduces file size from ~616MB to ~160MB to comply with Node.js V8 512MB string limit.
"""

import json
import os
import sys
import time

def round_floats(obj):
    if isinstance(obj, float):
        r = round(obj, 5)
        return 0.0 if r == -0.0 else r
    elif isinstance(obj, list):
        return [round_floats(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: round_floats(v) for k, v in obj.items()}
    return obj

def main():
    candidates = [
        "transformer_best.json",
        "data/checkpoints/transformer_best.json",
        "data/checkpoints/v3/transformer_best.json"
    ]
    src_file = None
    for c in candidates:
        if os.path.exists(c) and os.path.getsize(c) > 300 * 1024 * 1024:
            src_file = c
            break
            
    if not src_file:
        print(f"Xatolik: 300MB dan katta manba checkpoint topilmadi.")
        sys.exit(1)
        
    dest_file = "data/checkpoints/transformer_best.json"
    v3_dest_file = "data/checkpoints/v3/transformer_best.json"
        
    orig_size_mb = os.path.getsize(src_file) / (1024 * 1024)
    print(f"1. Manba model yuklanmoqda: {src_file} ({orig_size_mb:.2f} MB)...")
    t0 = time.time()
    
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"   Yuklandi: {time.time() - t0:.2f} soniya.")
    
    print("2. Og'irliklar (weights) 5 xonagacha aniqlikda optimizatsiya qilinmoqda...")
    t1 = time.time()
    if "modelData" in data:
        data["modelData"] = round_floats(data["modelData"])
    else:
        data = round_floats(data)
    print(f"   Optimizatsiya qilindi: {time.time() - t1:.2f} soniya.")
    
    os.makedirs(os.path.dirname(dest_file), exist_ok=True)
    os.makedirs(os.path.dirname(v3_dest_file), exist_ok=True)
    
    print(f"3. Yangi checkpoint yozilmoqda: {dest_file}...")
    t2 = time.time()
    with open(dest_file, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(',', ':'))
        
    print(f"4. v3 papkasiga nusxalanmoqda: {v3_dest_file}...")
    with open(v3_dest_file, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(',', ':'))
        
    new_size_mb = os.path.getsize(dest_file) / (1024 * 1024)
    print(f"   Yozildi: {time.time() - t2:.2f} soniya.")
    print("--------------------------------------------------")
    print(f"Natija:")
    print(f"  Asl hajm:  {orig_size_mb:.2f} MB")
    print(f"  Yangi hajm: {new_size_mb:.2f} MB (V8 512MB limitidan ancha kichik!)")
    print(f"  Tejalgan hajm: {orig_size_mb - new_size_mb:.2f} MB ({((orig_size_mb - new_size_mb) / orig_size_mb) * 100:.1f}%)")
    print("Muvaffaqiyatli yakunlandi!")

if __name__ == "__main__":
    main()
