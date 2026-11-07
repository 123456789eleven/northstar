import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/liquid.css'
import App from './App'
import { applyStoredDensity } from './components/density'
import { installSpecular } from './lib/specular'

applyStoredDensity()
installSpecular()

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
