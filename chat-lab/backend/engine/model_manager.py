"""Single-GPU model manager.

Holds the currently-loaded model(s) in memory and swaps them on demand. Designed
for a local, single-user, single-GPU box:

  * By default **one** model is resident at a time (``capacity=1``). Loading a
    second evicts the least-recently-used one and frees its VRAM. Compare mode
    can bump capacity to 2 when the GPU has room.
  * All heavy imports (torch / unsloth / transformers / peft) are deferred into
    method bodies, so importing this module — and booting the API — never needs
    the ML stack installed. ``torch_available()`` lets routes report that.
  * A per-model generation lock serializes ``generate`` calls on the same model
    (HF generation is not safely reentrant on one model instance).

The manager is a module-level singleton (``MANAGER``).
"""
from __future__ import annotations

import gc
import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Capability probe (no hard dependency on torch)
# ---------------------------------------------------------------------------
_OLLAMA_CACHE: dict[str, Any] = {"ts": 0.0, "ok": False}


def torch_available() -> bool:
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


def ollama_available() -> bool:
    now = time.time()
    if now - _OLLAMA_CACHE["ts"] < 5.0:
        return bool(_OLLAMA_CACHE["ok"])
    ok = False
    try:
        import urllib.request
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=0.8) as resp:
            ok = resp.status == 200
    except Exception:
        ok = False
    _OLLAMA_CACHE["ts"] = now
    _OLLAMA_CACHE["ok"] = ok
    return ok


def gpu_info() -> dict[str, Any]:
    """Best-effort GPU snapshot; safe when torch/CUDA are absent."""
    try:
        import torch
        if not torch.cuda.is_available():
            return {"cuda": False}
        idx = torch.cuda.current_device()
        free, total = torch.cuda.mem_get_info(idx)
        return {
            "cuda": True,
            "device": torch.cuda.get_device_name(idx),
            "vram_total_mb": round(total / 1024 / 1024),
            "vram_free_mb": round(free / 1024 / 1024),
            "vram_used_mb": round((total - free) / 1024 / 1024),
        }
    except Exception as exc:  # noqa: BLE001
        return {"cuda": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Loaded model handle
# ---------------------------------------------------------------------------
@dataclass
class LoadedModel:
    key: str
    target: dict[str, Any]
    model: Any
    tokenizer: Any
    loaded_at: float
    last_used: float
    load_seconds: float
    backend: str  # "unsloth" | "transformers"
    gen_lock: threading.Lock = field(default_factory=threading.Lock)

    def public(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.target.get("label"),
            "base_model": self.target.get("base_model"),
            "kind": self.target.get("kind"),
            "backend": self.backend,
            "load_seconds": round(self.load_seconds, 1),
            "max_seq_length": self.target.get("max_seq_length"),
        }


def _target_key(target: dict[str, Any]) -> str:
    return target.get("run_id") or f"base:{target.get('base_model')}"


class ModelManager:
    def __init__(self, capacity: int = 1):
        self.capacity = capacity
        self._models: dict[str, LoadedModel] = {}
        self._lock = threading.RLock()  # guards the registry + load/evict

    # -- introspection ------------------------------------------------------
    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "torch_available": torch_available(),
                "ollama_available": ollama_available(),
                "sim_available": True,
                "capacity": self.capacity,
                "loaded": [m.public() for m in self._models.values()],
                "gpu": gpu_info(),
            }

    def is_loaded(self, key: str) -> bool:
        with self._lock:
            return key in self._models

    # -- loading / eviction -------------------------------------------------
    def get(self, target: dict[str, Any], min_capacity: int = 1) -> LoadedModel:
        """Return a loaded handle for ``target``, loading + evicting as needed."""
        key = _target_key(target)
        with self._lock:
            existing = self._models.get(key)
            if existing is not None:
                existing.last_used = time.time()
                return existing

            # Make room. Compare mode may ask for capacity 2.
            cap = max(self.capacity, min_capacity)
            while len(self._models) >= cap:
                self._evict_lru()

            handle = self._load(target, key)
            self._models[key] = handle
            return handle

    def unload(self, key: str) -> bool:
        with self._lock:
            handle = self._models.pop(key, None)
        if handle is None:
            return False
        self._free(handle)
        return True

    def unload_all(self) -> int:
        with self._lock:
            handles = list(self._models.values())
            self._models.clear()
        for h in handles:
            self._free(h)
        return len(handles)

    def set_capacity(self, capacity: int) -> None:
        with self._lock:
            self.capacity = max(1, int(capacity))
            while len(self._models) > self.capacity:
                self._evict_lru()

    # -- internals ----------------------------------------------------------
    def _evict_lru(self) -> None:
        if not self._models:
            return
        lru_key = min(self._models, key=lambda k: self._models[k].last_used)
        handle = self._models.pop(lru_key)
        self._free(handle)

    def _free(self, handle: LoadedModel) -> None:
        try:
            del handle.model
            del handle.tokenizer
        except Exception:
            pass
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass
        gc.collect()

    def _load(self, target: dict[str, Any], key: str) -> LoadedModel:
        t0 = time.time()
        adapter_dir = target.get("adapter_dir")
        base_model = str(target.get("base_model") or "")
        load_in_4bit = bool(target.get("load_in_4bit", True))
        max_seq_length = int(target.get("max_seq_length", 2048) or 2048)

        # 1) Local Ollama backend
        if base_model.startswith("ollama:") or target.get("backend") == "ollama":
            model_name = base_model.split("ollama:", 1)[1] if base_model.startswith("ollama:") else base_model
            now = time.time()
            return LoadedModel(
                key=key,
                target=target,
                model={"ollama_model": model_name},
                tokenizer=None,
                loaded_at=now,
                last_used=now,
                load_seconds=now - t0,
                backend="ollama",
            )

        # 2) Explicit simulated adapter runs or explicit sim: prefix
        is_sim = bool(target.get("simulated")) or base_model.startswith("sim:")
        if adapter_dir and (Path(adapter_dir) / "domain_knowledge.json").exists():
            is_sim = True

        model = None
        tokenizer = None
        backend = "simulator"

        if not is_sim and torch_available():
            # Prefer Unsloth, fall back to Transformers, and if weights aren't cached/offline,
            # fall back cleanly to the domain-grounded simulator rather than failing.
            try:
                model, tokenizer = self._load_unsloth(
                    adapter_dir or base_model, max_seq_length, load_in_4bit
                )
                backend = "unsloth"
            except Exception:
                try:
                    model, tokenizer = self._load_transformers(
                        adapter_dir, base_model, load_in_4bit
                    )
                    backend = "transformers"
                except Exception as exc:
                    model = self._load_sim_knowledge(adapter_dir, target, fallback_reason=str(exc))
                    backend = "simulator"
        else:
            model = self._load_sim_knowledge(adapter_dir, target)
            backend = "simulator"

        if tokenizer is not None and getattr(tokenizer, "pad_token", None) is None and getattr(tokenizer, "eos_token", None):
            tokenizer.pad_token = tokenizer.eos_token

        now = time.time()
        return LoadedModel(
            key=key,
            target=target,
            model=model,
            tokenizer=tokenizer,
            loaded_at=now,
            last_used=now,
            load_seconds=now - t0,
            backend=backend,
        )

    @staticmethod
    def _load_sim_knowledge(adapter_dir: Optional[str], target: dict[str, Any], fallback_reason: str = "") -> dict[str, Any]:
        records: list[dict[str, str]] = []
        if adapter_dir:
            dk = Path(adapter_dir) / "domain_knowledge.json"
            if dk.is_file():
                try:
                    data = json.loads(dk.read_text(encoding="utf-8"))
                    if isinstance(data, dict) and isinstance(data.get("records"), list):
                        records = data["records"]
                except Exception:
                    pass
        return {
            "simulated": True,
            "fallback_reason": fallback_reason,
            "kind": target.get("kind", "base"),
            "label": target.get("label") or target.get("base_model"),
            "records": records,
        }

    def _load_unsloth(self, name: str, max_seq_length: int, load_in_4bit: bool):
        from unsloth import FastLanguageModel
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=name,
            max_seq_length=max_seq_length,
            dtype=None,
            load_in_4bit=load_in_4bit,
        )
        FastLanguageModel.for_inference(model)  # 2x faster native inference path
        return model, tokenizer

    def _load_transformers(self, adapter_dir: Optional[str], base_model: Optional[str], load_in_4bit: bool):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        # The adapter_config records the exact base it was trained on — trust it.
        resolved_base = base_model
        if adapter_dir:
            cfg = self._read_adapter_config(adapter_dir)
            resolved_base = cfg.get("base_model_name_or_path") or base_model
        if not resolved_base:
            raise ValueError("No base model could be resolved for loading.")

        quant_cfg = None
        if load_in_4bit:
            from transformers import BitsAndBytesConfig
            quant_cfg = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
            )

        model = AutoModelForCausalLM.from_pretrained(
            resolved_base,
            quantization_config=quant_cfg,
            torch_dtype=torch.bfloat16 if not load_in_4bit else None,
            device_map="auto",
            trust_remote_code=True,
        )

        if adapter_dir:
            from peft import PeftModel
            model = PeftModel.from_pretrained(model, adapter_dir)

        tokenizer = AutoTokenizer.from_pretrained(
            adapter_dir or resolved_base, trust_remote_code=True
        )
        model.eval()
        return model, tokenizer

    @staticmethod
    def _read_adapter_config(adapter_dir: str) -> dict[str, Any]:
        try:
            with open(Path(adapter_dir) / "adapter_config.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}


# Module-level singleton used by the routes.
MANAGER = ModelManager(capacity=1)
