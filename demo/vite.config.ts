import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    visualizer()
  ],
  build: {
    rollupOptions: {
      external: ['fabric'],
      output: {
        paths: {
          fabric: 'https://cdn.jsdelivr.net/npm/fabric@5.3.0/+esm'
        }
      },
    },
  },
  base: '/', // change if you're deploying to github pages
  resolve: {
    preserveSymlinks: true // necessary for yarn link to work
  }
})
