import { datasets } from "./finetuneApi";

export const datasetApi = {
  list: () => datasets.list(),
  upload: (file) => datasets.upload(file),
};
