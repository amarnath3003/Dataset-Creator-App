const API = "http://localhost:8000/api";

export const hardwareApi = {
  getGpus: async () => {
    const res = await fetch(`${API}/hardware/gpus`);
    if (!res.ok) throw new Error("Failed to detect GPUs");
    return res.json(); // { gpus: [{id,name,vram_total(MB)}], cuda, count }
  },
};
