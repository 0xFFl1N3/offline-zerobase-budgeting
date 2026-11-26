import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative paths, so the built app works under any folder, e.g. https://<user>.github.io/<repo>/.
  base: './',
});
