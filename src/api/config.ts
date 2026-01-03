export const backendBase = (import.meta.env.VITE_BACKEND_API_BASE as string | undefined) ?? ''
export const renderBase = (import.meta.env.VITE_RENDER_API_BASE as string | undefined) ?? backendBase
export const operatorBase = (import.meta.env.VITE_OPERATOR_APP_BASE as string | undefined) ?? 'http://localhost:5174'

export function normalizeBase(base: string) {
  return base.replace(/\/+$/, '')
}

export function buildApiUrl(base: string, path: string) {
  const trimmed = normalizeBase(base)
  if (!trimmed) return path
  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`
}
