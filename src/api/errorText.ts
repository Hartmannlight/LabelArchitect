export function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const body = error.detail
    if (typeof body === 'string' && body.trim()) return body
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string' && body.detail.trim()) return body.detail
  }
  return error instanceof Error ? error.message : String(error)
}
