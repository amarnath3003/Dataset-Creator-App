import { models } from "./finetuneApi";

export const modelApi = {
  getModels: () => models.list(),
  getModelDetails: (modelId) => models.get(modelId),
};
