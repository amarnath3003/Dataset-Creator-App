import { hardware } from "./finetuneApi";

export const hardwareApi = {
  getGpus: () => hardware.gpus(),
};
