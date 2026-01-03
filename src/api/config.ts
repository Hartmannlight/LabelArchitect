type RuntimeConfig = {
  backendBase?: string
  renderBase?: string
  operatorBase?: string
}

const runtimeConfig = (globalThis as { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__

const envBackendBase = import.meta.env.VITE_BACKEND_API_BASE as string | undefined
const envRenderBase = import.meta.env.VITE_RENDER_API_BASE as string | undefined
const envOperatorBase = import.meta.env.VITE_OPERATOR_APP_BASE as string | undefined

export const backendBase = runtimeConfig?.backendBase ?? envBackendBase ?? ''
export const renderBase = runtimeConfig?.renderBase ?? envRenderBase ?? backendBase
export const operatorBase =
  runtimeConfig?.operatorBase ?? envOperatorBase ?? 'http://localhost:5174'

export function normalizeBase(base: string) {
  return base.replace(/\/+$/, '')
}

export function buildApiUrl(base: string, path: string) {
  const trimmed = normalizeBase(base)
  if (!trimmed) return path
  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`
}
