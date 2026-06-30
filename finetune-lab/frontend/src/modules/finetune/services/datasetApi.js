const API = "http://localhost:8000/api";

export const datasetApi = {
  list: async () => {
    const res = await fetch(`${API}/datasets/`);
    if (!res.ok) throw new Error("Failed to list datasets");
    const data = await res.json();
    return data.datasets || [];
  },

  upload: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/datasets/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
};
