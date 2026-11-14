import { datasets } from "./finetuneApi";

export const datasetApi = {
  list: () => datasets.list(),
  upload: (file) => datasets.upload(file),
  remove: (id) => datasets.remove(id),
  searchHf: (q) => datasets.searchHf(q),
};
