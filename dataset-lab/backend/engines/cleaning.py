import re
from collections import Counter


class CleaningEngine:
    def process(self, text: str) -> str:
        # Initial normalize
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = text.split("\n")

        # 1. Remove Page Numbers (standalone digits)
        # Regex: optional whitespace, one or more digits, optional whitespace, end of line
        lines = [line for line in lines if not re.match(r"^\s*\d+\s*$", line)]

        # 2. Remove Repeated Headers
        # Heuristic: Identify lines that appear frequently (e.g., > 3 times) and are likely headers/footers
        # We only look at lines that are somewhat short (< 10 words) to avoid removing recurring long sentences
        stripped_lines = [line_item.strip() for line_item in lines if line_item.strip()]
        if stripped_lines:
            line_counts = Counter(stripped_lines)
            # Threshold: repeated more than max(3, 5% of total lines) - logic can be tuned
            # For this MVP, let's hardcode > 3 repetitions for non-empty lines
            repeated_headers = {
                line
                for line, count in line_counts.items()
                if count > 3 and len(line.split()) < 10
            }
            lines = [line for line in lines if line.strip() not in repeated_headers]

        cleaned_lines = []
        short_line_buffer = []

        for line in lines:
            line = line.strip()

            # 4. Artifact Removal
            # Remove non-printable characters (keep ASCII + common unicode)
            line = "".join(ch for ch in line if ch.isprintable())

            # 5. Bullet Normalization
            if re.match(r"^[\u2022\-\*]\s+", line):
                line = re.sub(r"^[\u2022\-\*]\s+", "* ", line)

            # 6. Noise Filtering
            # Instead of dropping < 3 word lines (which deletes headings),
            # we buffer them if they contain alphanumeric content, and prepend them to the next valid line.
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
            if cleaned_lines:
                cleaned_lines[-1] += " " + " ".join(short_line_buffer)
            else:
                cleaned_lines.append(" ".join(short_line_buffer))

        text = "\n".join(cleaned_lines)

        # 3. Normalize Whitespace
        # Collapse multiple spaces
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse multiple newlines (max 2)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()


cleaning_engine = CleaningEngine()
