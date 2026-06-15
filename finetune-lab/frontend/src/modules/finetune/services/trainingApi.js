import axios from "axios";

const API = "http://localhost:8000/api";

export const createTrainingJob = async (data) => {
  const response = await axios.post(
    `${API}/training/create`,
    data
  );

  return response.data;
};
