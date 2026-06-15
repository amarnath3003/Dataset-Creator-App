from datasets import load_dataset


class DatasetFormatter:

    @staticmethod
    def load_jsonl(path):

        dataset = load_dataset(
            "json",
            data_files=path,
            split="train"
        )

        return dataset
