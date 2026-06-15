from core.dataset_engine.detector import DatasetFormat

class DatasetFormatter:
    
    @staticmethod
    def format_dataset(dataset, detected_format: DatasetFormat, tokenizer=None):
        if detected_format == DatasetFormat.COMPLETION:
            # Already formatted as raw text
            return dataset
            
        if detected_format == DatasetFormat.INSTRUCTION:
            def format_instruction(example):
                instruction = example.get("instruction", "")
                inp = example.get("input", "")
                output = example.get("output", "")
                
                if inp:
                    text = f"### Instruction:\n{instruction}\n\n### Input:\n{inp}\n\n### Response:\n{output}"
                else:
                    text = f"### Instruction:\n{instruction}\n\n### Response:\n{output}"
                return {"text": text}
                
            return dataset.map(format_instruction, remove_columns=dataset.column_names)
            
        if detected_format == DatasetFormat.CHATML:
            def format_chatml(example):
                if tokenizer and hasattr(tokenizer, "apply_chat_template"):
                    try:
                        text = tokenizer.apply_chat_template(
                            example["messages"],
                            tokenize=False,
                            add_generation_prompt=False
                        )
                        return {"text": text}
                    except Exception:
                        pass
                
                # Fallback mapping
                text = ""
                for msg in example.get("messages", []):
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    text += f"<|im_start|>{role}\n{content}<|im_end|>\n"
                return {"text": text}
                
            return dataset.map(format_chatml, remove_columns=dataset.column_names)
            
        if detected_format == DatasetFormat.SHAREGPT:
            def format_sharegpt(example):
                text = ""
                for turn in example.get("conversations", []):
                    role = turn.get("from", turn.get("role", "user"))
                    val = turn.get("value", turn.get("content", ""))
                    if role == "human": role = "user"
                    if role == "gpt": role = "assistant"
                    text += f"<|im_start|>{role}\n{val}<|im_end|>\n"
                return {"text": text}
                
            return dataset.map(format_sharegpt, remove_columns=dataset.column_names)
            
        if detected_format == DatasetFormat.PREFERENCE:
            # Leave as is, DPO trainer needs prompt/chosen/rejected columns
            return dataset
            
        raise ValueError(f"Cannot format unknown dataset structure. Columns found: {dataset.column_names}")
