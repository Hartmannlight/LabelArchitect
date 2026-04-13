import { createPrinthubSdk } from '@printhub/sdk'

import { backendBase, renderBase } from './config'

const REQUEST_TIMEOUT_MS = 15000

let backendSdkCache: ReturnType<typeof createPrinthubSdk> | null = null
let backendSdkBase = ''
let renderSdkCache: ReturnType<typeof createPrinthubSdk> | null = null
let renderSdkBase = ''

export function getBackendSdk() {
  if (!backendSdkCache || backendSdkBase !== backendBase) {
    backendSdkBase = backendBase
    backendSdkCache = createPrinthubSdk({ baseUrl: backendBase, timeoutMs: REQUEST_TIMEOUT_MS })
  }
  return backendSdkCache
}

export function getRenderSdk() {
  if (!renderSdkCache || renderSdkBase !== renderBase) {
    renderSdkBase = renderBase
    renderSdkCache = createPrinthubSdk({ baseUrl: renderBase, timeoutMs: REQUEST_TIMEOUT_MS })
  }
  return renderSdkCache
}
