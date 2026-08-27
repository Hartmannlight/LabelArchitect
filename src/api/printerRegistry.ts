export type RegistrationForm = { name: string }

export function registrationPayload(baseUrl: string, printerId: string, form: RegistrationForm, agentId?: string | null) {
  return { base_url: baseUrl, printer_id: printerId, ...(agentId ? { agent_id: agentId } : {}), name: form.name.trim() || undefined }
}

export async function registryRequest(base: string, path: string, body?: unknown, method = 'POST') {
  const response = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const detail = error?.detail
    throw new Error(typeof detail === 'string' ? detail : `Printer request failed (${response.status}).`)
  }
  return response.json()
}

export function settingsPayload(printer: Record<string, any>, fields: Record<string, string | boolean>) {
  const numeric = (key: string) => {
    const value = Number(fields[key])
    if (String(fields[key]).trim() === '' || !Number.isFinite(value)) throw new Error(`Invalid ${key}.`)
    return value
  }
  const dynamic = Boolean(printer.media?.dynamic_source)
  if (printer.connection?.protocol === 'zebra_tamer') {
    return { revision: printer.registry.revision, settings: {
      name: String(fields.name).trim(), enabled: Boolean(fields.enabled),
      defaults: { ...printer.defaults, copies: numeric('copies'), rotation: numeric('rotation') },
    } as Record<string, any> }
  }
  const settings: Record<string, unknown> = {
    name: String(fields.name).trim(), enabled: Boolean(fields.enabled),
    alignment: { ...printer.alignment, offset_x_mm: numeric('offsetX'), offset_y_mm: numeric('offsetY'),
      dpi: dynamic ? printer.alignment.dpi : numeric('dpi') },
    zpl: { ...printer.zpl, darkness: numeric('darkness'), print_speed: numeric('speed') },
    defaults: { ...printer.defaults, copies: numeric('copies'), rotation: numeric('rotation') },
  }
  if (!dynamic) settings.media = { ...printer.media, loaded: { ...printer.media.loaded, width_mm: numeric('width'), height_mm: numeric('height') } }
  return { revision: printer.registry.revision, settings }
}
