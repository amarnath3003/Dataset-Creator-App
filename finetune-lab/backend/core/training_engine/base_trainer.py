from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseTrainer(ABC):
    def __init__(
        self,
        model_name: str,
        dataset_path: str,
        config: Dict[str, Any]
    ):
        self.model_name = model_name
        self.dataset_path = dataset_path
        self.config = config
        self.model = None
        self.tokenizer = None
        self.dataset = None

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def train(self):
        pass

    @abstractmethod
    def save(self):
        pass

    @abstractmethod
    def export(self):
        pass
