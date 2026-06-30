import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chat Lab frontend runs on 5273 to stay clear of Dataset/Finetune Lab.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
  },
})
