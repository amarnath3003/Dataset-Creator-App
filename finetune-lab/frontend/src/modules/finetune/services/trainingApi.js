import { training } from "./finetuneApi";

export const createTrainingJob = (data) => training.create(data);
export const getTrainingStatus = (jobId) => training.status(jobId);
export const listRuns = () => training.listRuns();
export const stopRun = (jobId) => training.stop(jobId);
export const deleteRun = (jobId) => training.remove(jobId);
