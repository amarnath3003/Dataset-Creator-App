import re
from collections import Counter


class CleaningEngine:
    def process(self, text: str) -> str:
        # Initial normalize
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = text.split("\n")

        # 1. Remove Page Numbers (standalone digits outside code blocks)
        lines = [line for line in lines if not re.match(r"^\s*\d{1,4}\s*$", line)]

        # 2. Remove Repeated Headers/Footers (short lines appearing > 3 times, skipping markdown structural lines)
        stripped_lines = [
            line_item.strip()
            for line_item in lines
            if line_item.strip()
            and not line_item.strip().startswith(("#", "```", "|", "*", "-"))
        ]
        if stripped_lines:
            line_counts = Counter(stripped_lines)
            threshold = max(3, int(len(stripped_lines) * 0.05))
            repeated_headers = {
                line
                for line, count in line_counts.items()
                if count > threshold and len(line.split()) < 10
            }
            lines = [line for line in lines if line.strip() not in repeated_headers]

        cleaned_lines = []
        short_line_buffer = []
        in_code_block = False

        def flush_buffer():
            nonlocal short_line_buffer
            if short_line_buffer:
                cleaned_lines.append(" ".join(short_line_buffer))
                short_line_buffer = []

        for raw_line in lines:
            if raw_line.strip().startswith("```"):
                flush_buffer()
                in_code_block = not in_code_block
                cleaned_lines.append(raw_line.rstrip())
                continue

            if in_code_block:
                cleaned_lines.append(raw_line.rstrip())
                continue

            line = "".join(ch for ch in raw_line.strip() if ch.isprintable() or ch == "\t")

            # Preserve blank paragraph separators
            if not line:
                flush_buffer()
                cleaned_lines.append("")
                continue

            # Preserve markdown headings, blockquotes, lists, tables as standalone structural lines
            if re.match(r"^(#{1,6}\s|>\s|\|\s*.*\||\d+\.\s)", line):
                flush_buffer()
                cleaned_lines.append(line)
                continue

            # Bullet Normalization
            if re.match(r"^[\u2022\-\*]\s+", line):
                flush_buffer()
                line = re.sub(r"^[\u2022\-\*]\s+", "- ", line)
                cleaned_lines.append(line)
                continue

            # Buffer orphan 1-2 word fragments (excluding headers/lists handled above) to merge with next prose line
            words = line.split()
            if len(words) < 3:
                if re.search(r"[a-zA-Z0-9]", line):
                    short_line_buffer.append(line)
                continue

            if short_line_buffer:
                line = " ".join(short_line_buffer) + " " + line
                short_line_buffer = []

            cleaned_lines.append(line)

        if short_line_buffer:
            if cleaned_lines and cleaned_lines[-1]:
                cleaned_lines[-1] += " " + " ".join(short_line_buffer)
            else:
                cleaned_lines.append(" ".join(short_line_buffer))

        text = "\n".join(cleaned_lines)

        # Normalize horizontal whitespace outside indentation & collapse excessive blank lines
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()


cleaning_engine = CleaningEngine()
