import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url)

// Ensure all react imports resolve to the same copy, preventing
// duplicate-react errors (e.g. minified error #525) if a dependency
// ever ships or peers a different version.
const reactPath = path.dirname(require.resolve('react/package.json'))
const reactDomPath = path.dirname(require.resolve('react-dom/package.json'))

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      react: reactPath,
      'react-dom': reactDomPath,
    },
  },
})
