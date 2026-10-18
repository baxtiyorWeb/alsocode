#!/usr/bin/env python3
"""
=======================================================================
 HIGH-SPEED GPU TRAINING ENGINE FOR UZBEK CAUSAL TRANSFORMER (COLAB)
=======================================================================
 - Noldan yaratilgan Causal Decoder-Only Transformer (Pre-LayerNorm, Multi-Head Attention, GELU FFN);
 - NVIDIA CUDA GPU (Tesla T4 / V100 / A100) orqali 100x tezlik (~1-2 daqiqada 25 epoxa);
 - V2 Arxitekturasi: 192 d_model, 4 qatlam, 6 bosh, 768 d_ffn, 2048 BPE vocab (~2.5M parametr);
 - Target Loss Masking: Faqat bot javobiga loss hisoblanadi (savol qismiga loss=0);
 - AdamW Weight Decay + Cosine Annealing LR Scheduler + Dropout (Anti-Overfitting);
 - Model vaznlarini 100% CausalTransformerModel.fromJSON() schema formatida
   'data/checkpoints/transformer_best.json' ga saqlaydi;
 - Mahalliy kompyuterda Python talab qilinmaydi: Sof JavaScript / Node.js da ishlaydi.
=======================================================================
"""

import os
import sys
import json
import math
import time
import argparse
from datetime import datetime, timezone

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class CausalSelfAttention(nn.Module):
    def __init__(self, d_model, n_heads, head_dim, max_seq_len, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = head_dim

        # W_q, W_k, W_v, W_o proyeksiyalari (bias=False, sof JS modeli bilan 100% bir xil)
        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)
        self.attn_dropout = nn.Dropout(dropout)
        self.resid_dropout = nn.Dropout(dropout)

        # Causal mask (j > i bo'lganda kelajak tokenlarni ko'rishni taqiqlash)
        mask = torch.triu(torch.full((max_seq_len, max_seq_len), float('-inf')), diagonal=1)
        self.register_buffer("causal_mask", mask)

    def forward(self, x):
        B, T, D = x.size()
        H = self.n_heads
        Dh = self.head_dim

        q = self.q_proj(x).view(B, T, H, Dh).transpose(1, 2)  # (B, H, T, Dh)
        k = self.k_proj(x).view(B, T, H, Dh).transpose(1, 2)  # (B, H, T, Dh)
        v = self.v_proj(x).view(B, T, H, Dh).transpose(1, 2)  # (B, H, T, Dh)

        scale = 1.0 / math.sqrt(Dh)
        scores = (q @ k.transpose(-2, -1)) * scale  # (B, H, T, T)
        scores = scores + self.causal_mask[:T, :T]

        attn = F.softmax(scores, dim=-1)
        attn = self.attn_dropout(attn)
        out = attn @ v  # (B, H, T, Dh)

        # Boshlarni birlashtirish: (B, H, T, Dh) -> (B, T, H, Dh) -> (B, T, D)
        out = out.transpose(1, 2).contiguous().view(B, T, D)
        out = self.out_proj(out)
        return self.resid_dropout(out)


class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, head_dim, d_ffn, max_seq_len, dropout=0.1):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model, eps=1e-5)
        self.attn = CausalSelfAttention(d_model, n_heads, head_dim, max_seq_len, dropout=dropout)
        self.ln2 = nn.LayerNorm(d_model, eps=1e-5)

        # Feed-Forward Network: d_model -> d_ffn -> d_model
        self.fc1 = nn.Linear(d_model, d_ffn, bias=True)
        self.fc2 = nn.Linear(d_ffn, d_model, bias=True)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        # Pre-LayerNorm 1 + Residual
        x = x + self.attn(self.ln1(x))
        # Pre-LayerNorm 2 + GELU (tanh approx) + Residual
        ffn = self.fc2(F.gelu(self.fc1(self.ln2(x)), approximate='tanh'))
        ffn = self.dropout(ffn)
        x = x + ffn
        return x


class UzbekCausalTransformer(nn.Module):
    def __init__(self, vocab_size, d_model, n_heads, head_dim, d_ffn, n_layers, max_seq_len, dropout=0.1):
        super().__init__()
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = head_dim
        self.d_ffn = d_ffn
        self.n_layers = n_layers
        self.max_seq_len = max_seq_len

        # Token va Pozitsion embeddinglar
        self.wte = nn.Embedding(vocab_size, d_model)
        self.wpe = nn.Embedding(max_seq_len, d_model)
        self.drop = nn.Dropout(dropout)

        # Qatlam bloklari
        self.blocks = nn.ModuleList([
            TransformerBlock(d_model, n_heads, head_dim, d_ffn, max_seq_len, dropout=dropout)
            for _ in range(n_layers)
        ])

        # Yakuniy LayerNorm va LM Head (bias=False)
        self.ln_f = nn.LayerNorm(d_model, eps=1e-5)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

        # Dastlabki og'irliklarni initsializatsiya qilish
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.LayerNorm):
            torch.nn.init.ones_(module.weight)
            torch.nn.init.zeros_(module.bias)

    def forward(self, input_ids):
        B, T = input_ids.size()
        pos = torch.arange(0, T, dtype=torch.long, device=input_ids.device).unsqueeze(0)  # (1, T)
        x = self.drop(self.wte(input_ids) + self.wpe(pos))  # (B, T, D)

        for block in self.blocks:
            x = block(x)

        x = self.ln_f(x)
        logits = self.lm_head(x)  # (B, T, vocab_size)
        return logits

    def export_to_json_format(self, config_dict):
        """
        PyTorch vaznlarini to'g'ridan-to'g'ri sof JS 'CausalTransformerModel.fromJSON()'
        kutadigan JSON strukturasiga o'tkazish.
        V8 512MB limitini oldini olish uchun float og'irliklar 5 xonagacha yaxlitlanadi (~220MB).
        """
        def to_rounded_list(t):
            return np.round(t.detach().cpu().float().numpy(), 5).tolist()

        blocks_data = []
        for b in self.blocks:
            blocks_data.append({
                "W_q": to_rounded_list(b.attn.q_proj.weight.T),
                "W_k": to_rounded_list(b.attn.k_proj.weight.T),
                "W_v": to_rounded_list(b.attn.v_proj.weight.T),
                "W_o": to_rounded_list(b.attn.out_proj.weight.T),
                "ln1_gamma": to_rounded_list(b.ln1.weight),
                "ln1_beta": to_rounded_list(b.ln1.bias),
                "W_f1": to_rounded_list(b.fc1.weight.T),
                "b_f1": to_rounded_list(b.fc1.bias),
                "W_f2": to_rounded_list(b.fc2.weight.T),
                "b_f2": to_rounded_list(b.fc2.bias),
                "ln2_gamma": to_rounded_list(b.ln2.weight),
                "ln2_beta": to_rounded_list(b.ln2.bias),
            })

        model_data = {
            "config": config_dict,
            "vocabSize": self.vocab_size,
            "dModel": self.d_model,
            "nHeads": self.n_heads,
            "headDim": self.head_dim,
            "dFfn": self.d_ffn,
            "nLayers": self.n_layers,
            "maxSeqLen": self.max_seq_len,
            "wte": to_rounded_list(self.wte.weight),
            "wpe": to_rounded_list(self.wpe.weight),
            "ln_f_gamma": to_rounded_list(self.ln_f.weight),
            "ln_f_beta": to_rounded_list(self.ln_f.bias),
            "lm_head": to_rounded_list(self.lm_head.weight.T),
            "blocks": blocks_data,
        }
        return model_data


def collate_batch(batch_samples, max_seq_len, device):
    batch_tokens = []
    batch_masks = []
    max_len = 0

    for s in batch_samples:
        toks = s.get("tokenIds", [])
        mask = s.get("mask", [1] * len(toks))
        if len(toks) > max_seq_len:
            toks = toks[:max_seq_len]
            mask = mask[:max_seq_len]
        batch_tokens.append(toks)
        batch_masks.append(mask)
        if len(toks) > max_len:
            max_len = len(toks)

    B = len(batch_tokens)
    input_tensor = torch.zeros((B, max_len), dtype=torch.long, device=device)
    mask_tensor = torch.zeros((B, max_len), dtype=torch.float, device=device)

    for b in range(B):
        cur_len = len(batch_tokens[b])
        input_tensor[b, :cur_len] = torch.tensor(batch_tokens[b], dtype=torch.long, device=device)
        mask_tensor[b, :cur_len] = torch.tensor(batch_masks[b], dtype=torch.float, device=device)

    return input_tensor, mask_tensor


def compute_target_masked_loss(logits, input_ids, mask):
    shift_logits = logits[:, :-1, :].contiguous()
    shift_targets = input_ids[:, 1:].contiguous()
    shift_mask = mask[:, 1:].contiguous()

    vocab_size = shift_logits.size(-1)
    loss_all = F.cross_entropy(
        shift_logits.view(-1, vocab_size),
        shift_targets.view(-1),
        reduction='none'
    )
    weighted_loss = loss_all * shift_mask.view(-1)
    total_tokens = shift_mask.sum()
    if total_tokens > 0:
        return weighted_loss.sum() / total_tokens
    else:
        return weighted_loss.mean()


def evaluate_model(model, val_samples, max_seq_len, batch_size, device):
    model.eval()
    total_loss = 0.0
    total_tokens = 0.0

    eval_samples = val_samples[:300] if len(val_samples) > 300 else val_samples

    with torch.no_grad():
        for i in range(0, len(eval_samples), batch_size):
            chunk = eval_samples[i:i + batch_size]
            input_tensor, mask_tensor = collate_batch(chunk, max_seq_len, device)
            if input_tensor.size(1) < 2:
                continue

            logits = model(input_tensor)
            shift_logits = logits[:, :-1, :].contiguous()
            shift_targets = input_tensor[:, 1:].contiguous()
            shift_mask = mask_tensor[:, 1:].contiguous()

            vocab_size = shift_logits.size(-1)
            loss_all = F.cross_entropy(shift_logits.view(-1, vocab_size), shift_targets.view(-1), reduction='none')
            weighted = loss_all * shift_mask.view(-1)
            weight_sum = shift_mask.sum().item()

            total_loss += weighted.sum().item()
            total_tokens += weight_sum

    avg_loss = total_loss / max(1.0, total_tokens)
    ppl = math.exp(min(avg_loss, 20.0))
    return avg_loss, ppl


class FastBPETokenizer:
    def __init__(self, vocab_path):
        with open(vocab_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.special_tokens = data.get("specialTokens", {})
        self.token_to_id = {t: i for t, i in data.get("tokens", [])}
        self.merges = data.get("merges", [])

    def encode(self, text):
        import re
        norm = re.sub(r"[\u02BB\u02BC\u2018\u2019\u0060\u00B4\u201B\u2032`ʻʼ’‘]", "'", text.lower())
        norm = re.sub(r"[ \t\r]+", " ", norm).strip()
        words = norm.split(" ")
        ids = []
        for w_idx, w in enumerate(words):
            if not w:
                continue
            prefix = w if (w_idx == 0 and not norm.startswith(" ")) else " " + w
            pieces = list(prefix)
            for m in self.merges:
                p_a, p_b, new_t = m[0], m[1], m[2]
                if len(pieces) < 2:
                    break
                new_pieces = []
                i = 0
                while i < len(pieces):
                    if i < len(pieces) - 1 and pieces[i] == p_a and pieces[i + 1] == p_b:
                        new_pieces.append(new_t)
                        i += 2
                    else:
                        new_pieces.append(pieces[i])
                        i += 1
                pieces = new_pieces
            for p in pieces:
                if p in self.token_to_id:
                    ids.append(self.token_to_id[p])
                else:
                    for ch in p:
                        ids.append(self.token_to_id.get(ch, self.special_tokens.get("<unk>", 3)))
        return ids


def main():
    parser = argparse.ArgumentParser(description="O'zbekcha Causal Transformer High-Speed Colab GPU Trainer")
    parser.add_argument("--version", type=str, default="v3", choices=["v1", "v2", "v3"], help="Model versiyasi (v1 / v2 / v3)")
    parser.add_argument("--stage", type=str, default="sft", choices=["pretrain", "sft"], help="Trening bosqichi (pretrain / sft)")
    parser.add_argument("--pretrain_corpus", type=str, default="data/uzbek_pretrain_corpus.txt", help="Xom matnlar korpusi")
    parser.add_argument("--epochs", type=int, default=None, help="Epoxalar soni")
    parser.add_argument("--batch_size", "--batchSize", type=int, default=32, dest="batch_size", help="Batch hajmi")
    parser.add_argument("--lr", type=float, default=None, help="Boshlang'ich learning rate")
    parser.add_argument("--weight_decay", type=float, default=0.02, help="AdamW weight decay regulyarizatsiyasi")
    parser.add_argument("--d_model", type=int, default=None, help="Hidden Dimension")
    parser.add_argument("--n_layers", type=int, default=None, help="Decoder bloklar soni")
    parser.add_argument("--n_heads", type=int, default=None, help="Attention boshlar soni")
    parser.add_argument("--d_ff", "--d_ffn", type=int, default=None, dest="d_ff", help="FFN Dimension")
    parser.add_argument("--dropout", type=float, default=None, help="Dropout ehtimoli")
    parser.add_argument("--splits", type=str, default="data/dataset_splits.json", help="Dataset splits fayli")
    parser.add_argument("--vocab", type=str, default="data/bpe_vocab.json", help="BPE vocab fayli")
    parser.add_argument("--checkpoint_dir", type=str, default="data/checkpoints", help="Saqlash manzili")
    args = parser.parse_args()

    # Model konfiguratsiyasini aniqlash (V1, V2 yoki V3)
    if args.version == "v3":
        d_model = args.d_model or 384
        n_heads = args.n_heads or 12
        head_dim = d_model // n_heads  # 32
        d_ffn = args.d_ff or 1536       # 4 * 384 = 1536
        n_layers = args.n_layers or 12
        max_seq_len = 256
        epochs = args.epochs or (3 if args.stage == "pretrain" else 25)
        lr = args.lr or (0.0008 if args.stage == "pretrain" else 0.00025)
        dropout = args.dropout if args.dropout is not None else 0.1
        name = "UzbekCausalTransformer-v3"
    elif args.version == "v2":
        d_model = args.d_model or 192
        n_heads = args.n_heads or 6
        head_dim = d_model // n_heads  # 32
        d_ffn = args.d_ff or 768       # 4 * 192 = 768
        n_layers = args.n_layers or 4
        max_seq_len = 128
        epochs = args.epochs or 25
        lr = args.lr or 0.0012
        dropout = args.dropout if args.dropout is not None else 0.1
        name = "UzbekCausalTransformer-v2"
    else:
        d_model = args.d_model or 64
        n_heads = args.n_heads or 4
        head_dim = d_model // n_heads  # 16
        d_ffn = args.d_ff or 256
        n_layers = args.n_layers or 3
        max_seq_len = 64
        epochs = args.epochs or 10
        lr = args.lr or 0.003
        dropout = args.dropout if args.dropout is not None else 0.0
        name = "UzbekCausalTransformer-v1"

    # 1. Qurilma (Device) tanlash
    if torch.cuda.is_available():
        device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        gpu_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        device_info = f"CUDA GPU: {gpu_name} ({gpu_vram:.1f} GB VRAM)"
    else:
        device = torch.device("cpu")
        device_info = "CPU Rejimi"

    print("=========================================================================")
    print(f"  🚀 O'ZBEKCHA SHAXSIY LLM HIGH-SPEED GPU TRENINGI ({args.version.upper()})")
    print("=========================================================================")
    print(f"  ✔ Apparat / GPU:      {device_info}")
    print(f"  ✔ Model versiyasi:    {args.version.upper()}")
    print(f"  ✔ Epoxalar:           {epochs}")
    print(f"  ✔ Batch hajmi:        {args.batch_size}")
    print(f"  ✔ Boshlang'ich LR:    {lr}")
    print(f"  ✔ Anti-Overfitting:   Target Loss Masking + AdamW Decay ({args.weight_decay}) + Dropout ({dropout})")
    print("-------------------------------------------------------------------------\n")

    # 2. Dataset va Vocab yuklash
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    splits_path = os.path.join(root_dir, args.splits) if not os.path.isabs(args.splits) else args.splits
    vocab_path = os.path.join(root_dir, args.vocab) if not os.path.isabs(args.vocab) else args.vocab
    corpus_path = os.path.join(root_dir, args.pretrain_corpus) if not os.path.isabs(args.pretrain_corpus) else args.pretrain_corpus

    print(f"--- 1. MA'LUMOTLAR VA LUG'ATNI YUKLASH (Bosqich: {args.stage.upper()}) ---")

    vocab_size = 8192 if args.version == "v3" else (2048 if args.version == "v2" else 512)
    if os.path.exists(vocab_path):
        with open(vocab_path, "r", encoding="utf-8") as f:
            v_data = json.load(f)
            vocab_size = max(vocab_size, v_data.get("vocabSize", 0))

    if args.stage == "pretrain":
        if not os.path.exists(corpus_path):
            print(f"❌ Xatolik: Pre-train korpus topilmadi: {corpus_path}")
            sys.exit(1)

        print(f"- Xom korpus yuklanmoqda: {corpus_path}")
        tokenizer = FastBPETokenizer(vocab_path) if os.path.exists(vocab_path) else None
        
        all_token_ids = []
        with open(corpus_path, "r", encoding="utf-8") as f:
            for line in f:
                l = line.strip()
                if not l:
                    continue
                if tokenizer:
                    toks = tokenizer.encode(l)
                else:
                    toks = [ord(c) % vocab_size for c in l]
                if toks:
                    all_token_ids.extend(toks)
                    all_token_ids.append(2)  # <eos> token

        print(f"- Jami tokenlar: {len(all_token_ids):,} ta")
        packed_samples = []
        for i in range(0, len(all_token_ids) - max_seq_len, max_seq_len):
            chunk = all_token_ids[i:i + max_seq_len]
            packed_samples.append({
                "tokenIds": chunk,
                "mask": [1] * len(chunk)
            })

        split_idx = int(len(packed_samples) * 0.95)
        train_samples = packed_samples[:split_idx]
        val_samples = packed_samples[split_idx:]
        test_samples = val_samples

        print(f"- Packed 256-token bloklar: {len(packed_samples):,} ta")
        print(f"- Train to'plami:     {len(train_samples):,} ta blok")
        print(f"- Validation to'plami:{len(val_samples):,} ta blok")
        print(f"- Vocab hajmi:        {vocab_size} ta BPE token\n")
    else:
        if not os.path.exists(splits_path):
            print(f"❌ Xatolik: Dataset splits topilmadi: {splits_path}")
            sys.exit(1)

        with open(splits_path, "r", encoding="utf-8") as f:
            splits_data = json.load(f)

        train_samples = splits_data["splits"]["train"]
        val_samples = splits_data["splits"]["val"]
        test_samples = splits_data["splits"]["test"]
        summary = splits_data["summary"]

        max_token_found = 0
        for s in train_samples:
            for t in s.get("tokenIds", []):
                if t > max_token_found:
                    max_token_found = t
        vocab_size = max(vocab_size, max_token_found + 1)

        print(f"- SFT namunalar:      {len(train_samples) + len(val_samples) + len(test_samples):,} ta")
        print(f"- Train to'plami:     {len(train_samples):,} ta")
        print(f"- Validation to'plami:{len(val_samples):,} ta")
        print(f"- Test to'plami:      {len(test_samples):,} ta")
        print(f"- Vocab hajmi:        {vocab_size} ta BPE token\n")

    config_dict = {
        "name": name,
        "version": "3.0.0" if args.version == "v3" else ("2.0.0" if args.version == "v2" else "1.0.0"),
        "dModel": d_model,
        "nHeads": n_heads,
        "headDim": head_dim,
        "dFfn": d_ffn,
        "nLayers": n_layers,
        "maxSeqLen": max_seq_len,
        "vocabSize": vocab_size,
        "dropoutRate": dropout,
        "tieWordEmbeddings": False,
    }

    model = UzbekCausalTransformer(
        vocab_size=vocab_size,
        d_model=d_model,
        n_heads=n_heads,
        head_dim=head_dim,
        d_ffn=d_ffn,
        n_layers=n_layers,
        max_seq_len=max_seq_len,
        dropout=dropout
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print("--- 2. MODEL ARXITEKTURASI VA PARAMETRLAR ---")
    print(f"- Model nomi:         {name}")
    print(f"- Qatlamlar soni:     {n_layers} ta Transformer Decoder Block")
    print(f"- Attention boshlari: {n_heads} ta (Head Dim: {head_dim})")
    print(f"- Hidden Dimension:   {d_model}")
    print(f"- FFN Dimension:      {d_ffn}")
    print(f"- Jami parametrlar:   {total_params:,} ta ({total_params/1_000_000:.2f}M parametr)")
    print(f"- Optimizator:        PyTorch AdamW (Weight Decay={args.weight_decay}, Grad Clip=1.0)\n")

    # 4. Optimizator va Scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=args.weight_decay)
    steps_per_epoch = math.ceil(len(train_samples) / args.batch_size)
    total_steps = epochs * steps_per_epoch
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_steps, eta_min=lr * 0.1)

    # 5. Trening Sikli (Training Loop)
    print("--- 3. YUQORI TEZLIKDAGI GPU TRENINGI ---")
    best_val_loss = float("inf")
    best_model_data = None
    start_total_time = time.time()
    checkpoint_dir = os.path.join(root_dir, args.checkpoint_dir)
    os.makedirs(checkpoint_dir, exist_ok=True)
    os.makedirs(os.path.join(checkpoint_dir, args.version), exist_ok=True)

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_start_time = time.time()
        running_loss = 0.0
        processed_tokens = 0

        indices = torch.randperm(len(train_samples)).tolist()
        batch_idx = 0

        for i in range(0, len(train_samples), args.batch_size):
            batch_idx += 1
            batch_indices = indices[i:i + args.batch_size]
            batch_items = [train_samples[idx] for idx in batch_indices]

            input_tensor, mask_tensor = collate_batch(batch_items, max_seq_len, device)
            if input_tensor.size(1) < 2:
                continue

            optimizer.zero_grad()
            logits = model(input_tensor)
            loss = compute_target_masked_loss(logits, input_tensor, mask_tensor)
            loss.backward()

            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()

            cur_lr = scheduler.get_last_lr()[0]
            loss_val = loss.item()
            running_loss += loss_val * len(batch_items)
            processed_tokens += input_tensor.numel()

            if batch_idx % 25 == 0 or (i + args.batch_size >= len(train_samples)):
                elapsed = time.time() - epoch_start_time
                throughput = int(processed_tokens / max(0.1, elapsed))
                cur_avg_loss = running_loss / (i + len(batch_items))
                percent = ((i + len(batch_items)) / len(train_samples)) * 100
                print(f"  ⏳ [Epoxa {epoch}/{epochs}] Qadam {batch_idx}/{steps_per_epoch} ({percent:.1f}%) | "
                      f"Loss: {cur_avg_loss:.4f} | LR: {cur_lr:.6f} | {throughput:,} tok/s")
                sys.stdout.flush()

        epoch_duration = time.time() - epoch_start_time
        train_loss = running_loss / len(train_samples)

        # Validation baholash
        val_loss, val_ppl = evaluate_model(model, val_samples, max_seq_len, args.batch_size, device)
        is_best = val_loss < best_val_loss

        best_marker = " 🌟 [ENG YAXSHI MODEL]" if is_best else ""
        bar_len = 20
        filled = int((epoch / epochs) * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)

        print(f"\n[{bar}] {int((epoch/epochs)*100)}% | Epoxa {epoch}/{epochs} ({epoch_duration:.1f}s) | "
              f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} (PPL: {val_ppl:.1f}){best_marker}\n")
        sys.stdout.flush()

        if is_best:
            best_val_loss = val_loss
            best_model_data = model.export_to_json_format(config_dict)

            payload = {
                "modelData": best_model_data,
                "currentEpoch": epoch,
                "globalStep": epoch * steps_per_epoch,
                "bestValLoss": best_val_loss,
                "config": config_dict,
                "history": [],
                "savedAt": datetime.now(timezone.utc).isoformat()
            }

            best_paths = [
                os.path.join(checkpoint_dir, "transformer_best.json"),
                os.path.join(checkpoint_dir, args.version, "transformer_best.json"),
            ]
            for bp in best_paths:
                with open(bp, "w", encoding="utf-8") as out_f:
                    json.dump(payload, out_f)
            print(f"  💾 Checkpoint saqlandi: {best_paths[0]} (Val Loss: {val_loss:.4f})\n")
            sys.stdout.flush()

    total_time = time.time() - start_total_time
    m, s = divmod(int(total_time), 60)
    print("=========================================================================")
    print(f"🎉 TRENING MUVAFFAQIYATLI YAKUNLANDI! Jami vaqt: {m}m {s}s")
    print(f"✔ Eng yaxshi Val Loss: {best_val_loss:.4f} (Perplexity: {math.exp(min(best_val_loss, 20)):.2f})")
    print(f"✔ Checkpoint: data/checkpoints/transformer_best.json tayyor!")
    print("=========================================================================\n")


if __name__ == "__main__":
    main()
