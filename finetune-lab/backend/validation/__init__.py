"""GPU validation harness for Finetune Lab.

Runs each training method (SFT / LoRA / QLoRA / CPT / Full / Vision) end-to-end
through the *real* production path (run_service -> gpu_worker -> UnslothSFTRunner)
on a machine with the ML stack installed, and asserts that each one starts,
streams advancing loss/progress, completes, and writes loadable artifacts.

Entry point: ``python -m validation.gpu_validate`` (run from the backend dir).
"""
