import json


class DatasetDetector:

    @staticmethod
    def detect(file_path: str):

        with open(file_path, "r", encoding="utf-8") as f:
            first = json.loads(f.readline())

        if "instruction" in first and "output" in first:
            return "instruction"

        if "messages" in first:
            return "chatml"

        if "prompt" in first and "chosen" in first:
            return "preference"

        if "text" in first:
            return "completion"

        raise ValueError("Unknown dataset format")
