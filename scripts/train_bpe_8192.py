#!/usr/bin/env python3
"""
=======================================================================
 HIGH-SPEED BPE TOKENIZER TRAINER (8,192 VOCABULARY FOR UZBEK SLM)
=======================================================================
 - 20M–30M tokenlik katta o'zbek tili korpusida BPE (Byte-Pair Encoding)
   lug'atini soniyalar ichida yuqori tezlikda o'qitadi.
 - Maxsus tokenlar: <pad>, <bos>, <eos>, <unk>, <human>, <bot>,
                    <context>, </context>, <think>, </think>
 - Natijani to'g'ridan-to'g'ri 'src/uzbekTokenizer.js' (loadFromFile)
   talab qiladigan 'data/bpe_vocab.json' formatida saqlaydi.
=======================================================================
"""

import os
import sys
import json
import argparse
from collections import Counter

SPECIAL_TOKENS = {
    "<pad>": 0,
    "<bos>": 1,
    "<eos>": 2,
    "<unk>": 3,
    "<human>": 4,
    "<bot>": 5,
    "<context>": 6,
    "</context>": 7,
    "<think>": 8,
    "</think>": 9,
}

BASE_CHARS = [
    " ", "a", "b", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "x", "y", "z", "'",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "+", "-", "*", "/", "=", "%", "<", ">",
    ".", ",", "!", "?", ":", ";", "(", ")", "[", "]", "{", "}",
    "\"", "_", "@", "#", "$", "&", "\n"
]

def normalize_uzbek(text):
    if not text:
        return ""
    import re
    text = re.sub(r"[\u02BB\u02BC\u2018\u2019\u0060\u00B4\u201B\u2032`ʻʼ’‘]", "'", text)
    text = text.lower()
    text = re.sub(r"[ \t\r]+", " ", text)
    return text.strip()

def train_bpe_fast(texts, target_vocab_size=8192):
    print(f"[*] BPE Lug'at o'qitilmoqda (Maqsad: {target_vocab_size} token)...")
    
    token_to_id = {}
    id_to_token = {}

    # 1. Maxsus tokenlarni ro'yxatga olish
    for name, tid in SPECIAL_TOKENS.items():
        token_to_id[name] = tid
        id_to_token[tid] = name

    # 2. Boshlang'ich harflar
    for ch in BASE_CHARS:
        if ch not in token_to_id:
            tid = len(token_to_id)
            token_to_id[ch] = tid
            id_to_token[tid] = ch

    # 3. So'zlar chastotasi
    print("[*] So'zlar chastotasini tahlil qilish...")
    word_freqs = Counter()
    for text in texts:
        norm = normalize_uzbek(text)
        if not norm:
            continue
        words = norm.split(" ")
        for w in words:
            if not w:
                continue
            word_freqs[" " + w] += 1

    # Har bir so'zni boshlang'ich belgilar ro'yxatiga bo'lish
    splits = {w: list(w) for w in word_freqs.keys()}
    merges = []

    print(f"[*] Noyob so'zlar: {len(splits):,} ta. BPE juftliklarini birlashtirish boshlandi...")
    step = 0

    while len(token_to_id) < target_vocab_size:
        pair_counts = Counter()
        for w, freq in word_freqs.items():
            split = splits[w]
            for i in range(len(split) - 1):
                pair = (split[i], split[i + 1])
                pair_counts[pair] += freq

        if not pair_counts:
            break

        best_pair, max_count = pair_counts.most_common(1)[0]
        if max_count < 2:
            break

        part_a, part_b = best_pair
        new_token = part_a + part_b

        if new_token not in token_to_id:
            tid = len(token_to_id)
            token_to_id[new_token] = tid
            id_to_token[tid] = new_token
            merges.append([part_a, part_b, new_token])

        # So'zlarni yangilash
        for w in word_freqs.keys():
            split = splits[w]
            new_split = []
            i = 0
            while i < len(split):
                if i < len(split) - 1 and split[i] == part_a and split[i + 1] == part_b:
                    new_split.append(new_token)
                    i += 2
                else:
                    new_split.append(split[i])
                    i += 1
            splits[w] = new_split

        step += 1
        if step % 500 == 0 or len(token_to_id) == target_vocab_size:
            print(f"  ⚡ Bosqich: {len(token_to_id)}/{target_vocab_size} token tayyor ({step} birlashtirish)")

    print(f"[OK] BPE Lug'at tayyor! Jami tokenlar: {len(token_to_id)}")
    return token_to_id, merges


def main():
    parser = argparse.ArgumentParser(description="O'zbekcha BPE Lug'at Treneri (8192)")
    parser.add_argument("--corpus", type=str, default="data/uzbek_pretrain_corpus.txt", help="Xom matnlar fayli")
    parser.add_argument("--output", type=str, default="data/bpe_vocab.json", help="Chiqish bpe_vocab.json fayli")
    parser.add_argument("--vocab_size", type=int, default=8192, help="Maqsadli lug'at hajmi (8192)")
    args = parser.parse_args()

    lines = []
    if os.path.exists(args.corpus):
        print(f"[*] Korpus yuklanmoqda: {args.corpus}")
        with open(args.corpus, "r", encoding="utf-8") as f:
            for line in f:
                l = line.strip()
                if l:
                    lines.append(l)
    else:
        print("[-] Katta korpus topilmadi, mavjud datasetlardan tayyorlanmoqda...")
        for cand in ["data/uzbek_training_data_expanded.json", "data/knowledge.json", "data/dataset_splits.json"]:
            if os.path.exists(cand):
                with open(cand, "r", encoding="utf-8") as f:
                    try:
                        data = json.load(f)
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict) and "text" in item:
                                    lines.append(item["text"])
                                elif isinstance(item, str):
                                    lines.append(item)
                    except Exception:
                        pass

    if not lines:
        print("[ERROR] Trening uchun hech qanday matn topilmadi!")
        sys.exit(1)

    print(f"[*] Jami matnlar: {len(lines):,} ta qator.")
    token_to_id, merges = train_bpe_fast(lines, target_vocab_size=args.vocab_size)

    vocab_data = {
        "vocabSize": len(token_to_id),
        "specialTokens": SPECIAL_TOKENS,
        "merges": merges,
        "tokens": list(token_to_id.items())
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(vocab_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Muvaffaqiyatli saqlandi: {args.output} ({len(token_to_id)} token)")

if __name__ == "__main__":
    main()
