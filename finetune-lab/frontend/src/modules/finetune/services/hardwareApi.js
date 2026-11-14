import { hardware } from "./finetuneApi";

export const hardwareApi = {
  getGpus: () => hardware.gpus(),
  estimate: (payload) => hardware.estimate(payload),
};
