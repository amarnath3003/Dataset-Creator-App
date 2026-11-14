import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const projectApi = {
    list: () => api.get('/projects/').then(res => res.data),
    create: (name) => api.post('/projects/', { name }).then(res => res.data),
    getStatus: (name) => api.get(`/projects/${name}/status`).then(res => res.data),
    upload: (name, fileOrFiles, mode = 'overwrite') => {
        const formData = new FormData();
        const list = fileOrFiles instanceof FileList || Array.isArray(fileOrFiles)
            ? Array.from(fileOrFiles)
            : [fileOrFiles];
        if (list.length === 1) {
            formData.append('file', list[0]);
        } else {
            list.forEach((f) => formData.append('files', f));
        }
        return api.post(`/projects/${name}/upload`, formData, {
            params: { mode },
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(res => res.data);
    },
    getRawText: (name) => api.get(`/projects/${name}/raw_text`).then(res => res.data),
    saveRawText: (name, text, mode = 'overwrite') =>
        api.post(`/projects/${name}/raw_text`, { text, mode }).then(res => res.data),
    runPipeline: (name, config, resume = false) =>
        api.post(`/projects/${name}/run`, { ...config, resume }).then(res => res.data),
    stopPipeline: (name) => api.post(`/projects/${name}/stop`).then(res => res.data),
    export: (name, format) => api.get(`/projects/${name}/export`, {
        params: { format },
        responseType: 'blob'
    }).then(res => res),
    exportToFinetune: (name, format = 'alpaca') =>
        api.post(`/projects/${name}/export/to-finetune`, null, { params: { format } }).then(res => res.data),
    getCleanedText: (name) => api.get(`/projects/${name}/data/cleaned`).then(res => res.data),
    getChunks: (name) => api.get(`/projects/${name}/data/chunks`).then(res => res.data),
    deleteChunk: (name, chunkId) => api.delete(`/projects/${name}/data/chunks/${chunkId}`).then(res => res.data),
    getQAPairs: (name) => api.get(`/projects/${name}/data/qa`).then(res => res.data),
    addQAPair: (name, payload) => api.post(`/projects/${name}/data/qa`, payload).then(res => res.data),
    updateQAPair: (name, index, payload) => api.put(`/projects/${name}/data/qa/${index}`, payload).then(res => res.data),
    deleteQAPair: (name, index) => api.delete(`/projects/${name}/data/qa/${index}`).then(res => res.data),
    getLogs: (name) => api.get(`/projects/${name}/logs`).then(res => res.data),
    delete: (name) => api.delete(`/projects/${name}`).then(res => res.data),
};

export const llmApi = {
    getOllamaModels: () => api.get('/llm/ollama/models').then(res => res.data),
    getPrompt: () => api.get('/prompt/').then(res => res.data),
    savePrompt: (prompt) => api.post('/prompt/', { prompt }).then(res => res.data),
};

export default api;
