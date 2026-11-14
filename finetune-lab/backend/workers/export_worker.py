"""Export worker.

Reloads a run's base model + trained LoRA adapter and produces the requested
artifact using Unsloth's canonical save methods. All heavy imports (torch /
unsloth) are deferred into the function body so importing this module — and thus
booting the API — never requires the ML stack.

Progress + terminal status are written to ``export_store`` so the frontend can
poll ``/api/export/status/{export_id}``.
"""
import logging
import shutil
import traceback
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _set(export_id: str, **updates: Any) -> None:
    from job_engine import export_store

    export_store.update_export(export_id, updates)


def _export_adapter(payload: dict[str, Any]) -> str:
    """No GPU needed: copy the already-saved adapter into the exports tree."""
    export_id = payload["export_id"]
    adapter_dir = Path(payload["adapter_dir"])
    out = Path(payload["output_root"]) / "adapter"
    _set(export_id, progress=30, message="Copying adapter files...")
    if out.exists():
        shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(adapter_dir, out)
    return str(out)


def _load_model(payload: dict[str, Any]):
    """Reload base + adapter for a merge/GGUF/Hub export."""
    from unsloth import FastLanguageModel

    export_id = payload["export_id"]
    _set(export_id, progress=25, message="Loading base model + adapter...")
    # Unsloth saves the base model reference inside the adapter dir, so loading
    # the adapter dir reconstitutes base + LoRA in one call.
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=payload["adapter_dir"],
        max_seq_length=int((payload.get("options") or {}).get("max_seq_length", 2048)),
        dtype=None,
        load_in_4bit=False,
    )
    return model, tokenizer


def _is_simulated_adapter(adapter_dir: Path) -> bool:
    if (adapter_dir / "domain_knowledge.json").exists():
        return True
    cfg_path = adapter_dir / "adapter_config.json"
    if cfg_path.exists():
        try:
            import json
            return bool(json.loads(cfg_path.read_text(encoding="utf-8")).get("simulated"))
        except Exception:
            pass
    return False


def _export_merged_16bit(payload: dict[str, Any]) -> str:
    export_id = payload["export_id"]
    adapter_dir = Path(payload["adapter_dir"])
    out = Path(payload["output_root"]) / "merged_16bit"
    if _is_simulated_adapter(adapter_dir):
        import json

        _set(export_id, progress=60, message="Packaging simulated 16-bit merged bundle...")
        out.mkdir(parents=True, exist_ok=True)
        shutil.copytree(adapter_dir, out, dirs_exist_ok=True)
        (out / "config.json").write_text(
            json.dumps(
                {
                    "model_type": "causal_lm",
                    "base_model": payload.get("base_model"),
                    "merged_16bit": True,
                    "simulated": True,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        (out / "Modelfile").write_text(
            f"FROM {payload.get('base_model') or 'llama3.2'}\nSYSTEM Fine-tuned domain assistant\n",
            encoding="utf-8",
        )
        return str(out)

    model, tokenizer = _load_model(payload)
    _set(export_id, progress=60, message="Merging adapter into 16-bit weights...")
    model.save_pretrained_merged(str(out), tokenizer, save_method="merged_16bit")
    return str(out)


def _export_gguf(payload: dict[str, Any]) -> str:
    export_id = payload["export_id"]
    options = payload.get("options") or {}
    quant = str(options.get("quantization_method", "q4_k_m"))
    adapter_dir = Path(payload["adapter_dir"])
    out = Path(payload["output_root"]) / "gguf"
    if _is_simulated_adapter(adapter_dir):
        import json

        _set(export_id, progress=60, message=f"Packaging simulated GGUF ({quant}) & Ollama Modelfile...")
        out.mkdir(parents=True, exist_ok=True)
        shutil.copytree(adapter_dir, out, dirs_exist_ok=True)
        model_slug = (payload.get("base_model") or "model").split("/")[-1].lower()
        gguf_name = f"{model_slug}.{quant}.gguf"
        (out / gguf_name).write_bytes(b"GGUF\x03\x00\x00\x00SIMULATED_QUANTIZED_WEIGHTS\n")
        (out / "Modelfile").write_text(
            f"FROM ./{gguf_name}\nPARAMETER temperature 0.7\nSYSTEM Fine-tuned domain model\n",
            encoding="utf-8",
        )
        (out / "export_manifest.json").write_text(
            json.dumps({"quantization_method": quant, "gguf_file": gguf_name, "simulated": True}, indent=2),
            encoding="utf-8",
        )
        return str(out)

    model, tokenizer = _load_model(payload)
    _set(export_id, progress=60, message=f"Converting to GGUF ({quant})...")
    model.save_pretrained_gguf(str(out), tokenizer, quantization_method=quant)
    return str(out)


def _export_hub(payload: dict[str, Any]) -> str:
    export_id = payload["export_id"]
    options = payload.get("options") or {}
    repo_id = str(options["repo_id"]).strip()
    token = options.get("hf_token")
    save_method = str(options.get("save_method", "merged_16bit"))
    model, tokenizer = _load_model(payload)
    _set(export_id, progress=60, message=f"Pushing merged model to '{repo_id}'...")
    model.push_to_hub_merged(
        repo_id,
        tokenizer,
        save_method=save_method,
        token=token,
        private=bool(options.get("private", True)),
    )
    return repo_id


_HANDLERS = {
    "adapter": _export_adapter,
    "merged_16bit": _export_merged_16bit,
    "gguf": _export_gguf,
    "hub": _export_hub,
}


def run_export_job(payload: dict[str, Any]) -> dict[str, Any]:
    export_id = payload["export_id"]
    kind = payload["kind"]
    _set(export_id, status="running", progress=5, message="Starting export...")
    try:
        handler = _HANDLERS.get(kind)
        if handler is None:
            raise ValueError(f"Unknown export kind '{kind}'.")

        output_path = handler(payload)

        _set(
            export_id,
            status="completed",
            progress=100,
            message="Export complete.",
            output_path=output_path,
        )
        return {"export_id": export_id, "status": "completed", "output_path": output_path}
    except Exception as exc:  # noqa: BLE001 — surface everything to the UI
        logger.exception("Export job %s failed", export_id)
        _set(
            export_id,
            status="failed",
            message="Export failed.",
            error=f"{exc}",
            traceback=traceback.format_exc(),
        )
        return {"export_id": export_id, "status": "failed"}
