from abc import ABC, abstractmethod

class BaseTrainer(ABC):

    def __init__(self, config, sink):
        self.config = config
        self.sink = sink

    @abstractmethod
    def load_model(self):
        pass

    @abstractmethod
    def load_dataset(self):
        pass

    @abstractmethod
    def build_trainer(self):
        pass

    def train(self):
        self.load_model()
        self.load_dataset()
        self.build_trainer()
        self.run()

    @abstractmethod
    def run(self):
        pass

    def emit(self, data):
        self.sink.emit(data)
