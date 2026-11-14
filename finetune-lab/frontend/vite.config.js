import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Finetune Lab frontend runs on 5174 to stay clear of Dataset Lab (5173) and Chat Lab (5273).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
})
