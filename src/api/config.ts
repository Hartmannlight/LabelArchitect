type RuntimeConfig = {
  backendBase?: string
  renderBase?: string
  operatorBase?: string
  labelSizePresets?: string
}

const runtimeConfig = (globalThis as { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__

const envBackendBase = import.meta.env.VITE_BACKEND_API_BASE as string | undefined
const envRenderBase = import.meta.env.VITE_RENDER_API_BASE as string | undefined
const envOperatorBase = import.meta.env.VITE_OPERATOR_APP_BASE as string | undefined

export const backendBase = runtimeConfig?.backendBase ?? envBackendBase ?? ''
export const renderBase = runtimeConfig?.renderBase ?? envRenderBase ?? backendBase
export const operatorBase =
  runtimeConfig?.operatorBase ?? envOperatorBase ?? 'http://localhost:5174'

const defaultLabelSizes = '50x25,40x30,20x10,50x50,50x30,30x20,72x26,74x26,100x50,100x150'

function parseLabelSizes(source: string) {
  return source.split(',').flatMap((entry) => {
    const match = entry.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i)
    if (!match) return []
    const width_mm = Number(match[1]); const height_mm = Number(match[2])
    if (!Number.isFinite(width_mm) || !Number.isFinite(height_mm) || width_mm < 1 || height_mm < 1) return []
    return [{ id: `${width_mm}x${height_mm}`, width_mm, height_mm }]
  }).filter((preset, index, presets) => presets.findIndex((entry) => entry.id === preset.id) === index)
}

const configuredLabelSizes = parseLabelSizes(runtimeConfig?.labelSizePresets ?? import.meta.env.VITE_LABEL_SIZE_PRESETS ?? '')
export const labelSizePresets = configuredLabelSizes.length ? configuredLabelSizes : parseLabelSizes(defaultLabelSizes)

export function normalizeBase(base: string) {
  return base.replace(/\/+$/, '')
}

export function buildApiUrl(base: string, path: string) {
  const trimmed = normalizeBase(base)
  if (!trimmed) return path
  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`
}
