from .unsloth_loader import UnslothModelLoader


class ModelFactory:
    @staticmethod
    def load(model_name: str):

        return UnslothModelLoader(model_name)
