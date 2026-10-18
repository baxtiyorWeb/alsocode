#!/usr/bin/env python3
"""
=======================================================================
 MASSIVE UZBEK PRE-TRAINING CORPUS PREPARATION PIPELINE (20M–30M TOKENS)
=======================================================================
 - O'zbek tili Vikipediyasi, ensiklopedik manbalar, badiiy va ilmiy
   matnlarni yig'adi, tozalaydi va Pre-training uchun tayyorlaydi.
 - Colab va bulut muhitida: HuggingFace / Wikimedia o'zbek bo'limidan
   to'g'ridan-to'g'ri xom matnlarni yuklay oladi.
 - Mahalliy / oflayn muhitda: mavjud barcha bilimlar bazasi va
   boyitilgan matnlarni birlashtirib, unifikatsiya qiladi.
 - Chiqish: 'data/uzbek_pretrain_corpus.txt'
=======================================================================
"""

import os
import sys
import re
import json
import argparse

def clean_uzbek_text(text):
    if not text or not isinstance(text, str):
        return ""
    # 1. HTML teglarni olib tashlash
    text = re.sub(r"<[^>]+>", " ", text)
    # 2. Apostroflarni yagona ' ga keltirish
    text = re.sub(r"[\u02BB\u02BC\u2018\u2019\u0060\u00B4\u201B\u2032`ʻʼ’‘]", "'", text)
    # 3. Katta harflarni kichikka o'tkazish
    text = text.lower()
    # 4. Ortiqcha probellarni tozalash
    text = re.sub(r"[\r\t\v\f]+", " ", text)
    text = re.sub(r"[ ]{2,}", " ", text)
    return text.strip()


def stream_wikimedia_uzbek(max_samples=150000):
    """
    Colab / Python muhitida HuggingFace datasets orqali o'zbekcha Vikipediyani yuklash.
    """
    print("[*] Wikimedia o'zbek tili bo'limini tekshirish...")
    try:
        from datasets import load_dataset
        print("[*] 'datasets' kutubxonasi orqali 'wikimedia/wikipedia' yuklanmoqda...")
        ds = load_dataset("wikimedia/wikipedia", "20231101.uz", split="train", streaming=True)
        count = 0
        for row in ds:
            text = row.get("text", "")
            clean = clean_uzbek_text(text)
            if len(clean) > 50:
                yield clean
                count += 1
                if count >= max_samples:
                    break
        print(f"[OK] Wikimedia'dan {count:,} ta maqola muvaffaqiyatli olindi!")
    except Exception as e:
        print(f"[-] Wikimedia onlayn yuklash imkonsiz ({e}). Mahalliy manbalarga o'tilmoqda.")


def main():
    parser = argparse.ArgumentParser(description="20M-30M Tokenlik O'zbek Korpusini Tayyorlash")
    parser.add_argument("--output", type=str, default="data/uzbek_pretrain_corpus.txt", help="Chiqish matn fayli")
    parser.add_argument("--online", action="store_true", help="Wikimedia o'zbek bo'limidan onlayn yuklash")
    parser.add_argument("--max_samples", type=int, default=150000, help="Maksimal namunalar soni")
    args = parser.parse_args()

    collected_texts = []
    total_words = 0

    print("=========================================================================")
    print("  📚 O'ZBEKCHA KATTA PRE-TRAINING KORPUSINI YIG'ISH VA TOZALASH")
    print("=========================================================================\n")

    # 1. Onlayn manbalar (agar --online berilgan bo'lsa yoki Colab da ishlasa)
    if args.online:
        for text in stream_wikimedia_uzbek(args.max_samples):
            collected_texts.append(text)
            total_words += len(text.split())

    # 2. Mahalliy manbalar (data/knowledge.json, uzbek_training_data_expanded.json, documents.json)
    local_files = [
        "data/uzbek_training_data_expanded.json",
        "data/knowledge.json",
        "data/documents.json",
        "data/dataset_splits.json"
    ]

    for lf in local_files:
        if os.path.exists(lf):
            print(f"- 📁 Mahalliy fayl o'qilmoqda: {lf}")
            try:
                with open(lf, "r", encoding="utf-8") as f:
                    content = json.load(f)
                    if isinstance(content, list):
                        for item in content:
                            raw = item.get("text", "") if isinstance(item, dict) else str(item)
                            cl = clean_uzbek_text(raw)
                            if len(cl) > 15:
                                collected_texts.append(cl)
                                total_words += len(cl.split())
                    elif isinstance(content, dict):
                        # documents.json yoki boshqa lug'atlar
                        if "chunks" in content:
                            for ch in content["chunks"]:
                                cl = clean_uzbek_text(ch.get("text", ""))
                                if len(cl) > 15:
                                    collected_texts.append(cl)
                                    total_words += len(cl.split())
                        for k, v in content.items():
                            if isinstance(v, list):
                                for item in v:
                                    if isinstance(item, dict) and "text" in item:
                                        cl = clean_uzbek_text(item["text"])
                                        if len(cl) > 15:
                                            collected_texts.append(cl)
                                            total_words += len(cl.split())
            except Exception as e:
                print(f"  ⚠️ Faylni o'qishda ogohlantirish ({lf}): {e}")

    # Agar kam bo'lsa, mavjud namunalar asosida parafraza va sintaktik kengaytirish
    print(f"\n[*] Hozircha yig'ilgan xom paragraflar soni: {len(collected_texts):,} ta.")
    print(f"[*] Jami so'zlar: {total_words:,} ta (~{int(total_words * 1.35):,} BPE token).")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as out_f:
        for item in collected_texts:
            out_f.write(item + "\n")

    print(f"\n✅ Korpus fayli muvaffaqiyatli saqlandi: {args.output}")
    print(f"📊 Hajmi: {os.path.getsize(args.output) / (1024*1024):.2f} MB")

if __name__ == "__main__":
    main()
