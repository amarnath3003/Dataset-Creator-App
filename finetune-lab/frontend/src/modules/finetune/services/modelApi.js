const API_BASE = 'http://localhost:8000/api';

export const modelApi = {
  getModels: async () => {
    const response = await fetch(`${API_BASE}/models/`);
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    return response.json();
  },
  
  getModelDetails: async (modelId) => {
    const response = await fetch(`${API_BASE}/models/${encodeURIComponent(modelId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch model details');
    }
    return response.json();
  }
};
