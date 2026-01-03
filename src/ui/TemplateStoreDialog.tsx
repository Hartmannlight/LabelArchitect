import { useEffect, useMemo, useState } from 'react'
import { backendBase, buildApiUrl } from '../api/config'
import { extractTemplateVariables } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'

type TemplateListItem = {
  id: string
  name: string
  tags?: string[]
  preview_available?: boolean
}

type TemplateDetails = {
  id: string
  name: string
  tags?: string[]
  variables?: Array<{ name: string; mode?: string; default?: unknown }>
  preview_available?: boolean
  template: unknown
  sample_data?: Record<string, unknown>
  preview_target?: { width_mm: number; height_mm: number; dpi: number; origin_x_mm?: number; origin_y_mm?: number }
}

type Props = {
  onClose: () => void
}

function parseJson<T>(value: string, fallback: T): { ok: true; value: T } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, value: fallback }
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) }
  }
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function normalizeVariableDefs(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ name: string; mode?: string; default?: unknown }>
  const out: Array<{ name: string; mode?: string; default?: unknown }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = (item as any).name
    if (typeof name !== 'string' || !name.trim()) continue
    const mode = typeof (item as any).mode === 'string' ? (item as any).mode : undefined
    const def = (item as any).default
    out.push({ name: name.trim(), mode, default: def })
  }
  return out
}

export default function TemplateStoreDialog(props: Props) {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const preview = useTemplateEditorStore((s) => s.preview)
  const backendTemplateId = useTemplateEditorStore((s) => s.backendTemplateId)
  const setBackendTemplateId = useTemplateEditorStore((s) => s.setBackendTemplateId)
  const loadTemplate = useTemplateEditorStore((s) => s.loadTemplate)
  const setPreviewTarget = useTemplateEditorStore((s) => s.setPreviewTarget)
  const variableValues = useTemplateEditorStore((s) => s.variableValues)

  const [items, setItems] = useState<TemplateListItem[]>([])
  const [filterTags, setFilterTags] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(backendTemplateId)
  const [details, setDetails] = useState<TemplateDetails | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [name, setName] = useState(doc.name ?? '')
  const [tags, setTags] = useState('')
  const [variablesText, setVariablesText] = useState('[]')
  const [sampleDataText, setSampleDataText] = useState('{}')
  const [variablesTouched, setVariablesTouched] = useState(false)
  const [sampleDataTouched, setSampleDataTouched] = useState(false)

  const apiBase = backendBase
  const { variables: requiredVariables } = useMemo(() => extractTemplateVariables(doc), [doc])

  const defaultVariableDefs = useMemo(
    () => requiredVariables.map((name) => ({ name, mode: 'required' })),
    [requiredVariables]
  )
  const defaultSampleData = useMemo(() => {
    const out: Record<string, unknown> = {}
    requiredVariables.forEach((name) => {
      out[name] = variableValues[name] ?? ''
    })
    return out
  }, [requiredVariables, variableValues])
  const listUrl = useMemo(() => {
    const tagsQuery = parseTags(filterTags)
    const base = buildApiUrl(apiBase, '/v1/templates')
    if (!tagsQuery.length) return base
    return `${base}?tags=${encodeURIComponent(tagsQuery.join(','))}`
  }, [apiBase, filterTags])

  const previewTarget = useMemo(
    () => ({
      width_mm: preview.width_mm,
      height_mm: preview.height_mm,
      dpi: preview.dpi,
      origin_x_mm: 0,
      origin_y_mm: 0
    }),
    [preview.dpi, preview.height_mm, preview.width_mm]
  )

  const refreshList = async () => {
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch(listUrl)
      if (!res.ok) throw new Error(await res.text())
      const payload = await res.json()
      if (!Array.isArray(payload)) throw new Error('Invalid template list response')
      setItems(payload)
      setStatus('idle')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }

  const loadDetails = async (id: string) => {
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch(buildApiUrl(apiBase, `/v1/templates/${encodeURIComponent(id)}`))
      if (!res.ok) throw new Error(await res.text())
      const payload = (await res.json()) as TemplateDetails
      setDetails(payload)
      setName(payload.name ?? '')
      setTags((payload.tags ?? []).join(', '))
      setVariablesText(JSON.stringify(payload.variables ?? [], null, 2))
      setSampleDataText(JSON.stringify(payload.sample_data ?? {}, null, 2))
      setStatus('idle')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }

  const handleLoadIntoEditor = () => {
    if (!details) return
    loadTemplate(details.template as any)
    setBackendTemplateId(details.id)
    if (details.preview_target) {
      setPreviewTarget({
        width_mm: details.preview_target.width_mm,
        height_mm: details.preview_target.height_mm,
        dpi: details.preview_target.dpi
      })
    }
  }

  const handleSave = async (mode: 'create' | 'update') => {
    setStatus('saving')
    setError(null)
    const varsRes = parseJson(variablesText, [])
    if (!varsRes.ok) {
      setStatus('error')
      setError(`Variables JSON error: ${varsRes.error}`)
      return
    }
    const baseVariables = normalizeVariableDefs(varsRes.value)
    const byName = new Map(baseVariables.map((v) => [v.name, v]))
    requiredVariables.forEach((name) => {
      if (!byName.has(name)) {
        byName.set(name, { name, mode: 'required' })
      }
    })
    const resolvedVariables = Array.from(byName.values())
    const sampleRes = parseJson(sampleDataText, {})
    if (!sampleRes.ok) {
      setStatus('error')
      setError(`Sample data JSON error: ${sampleRes.error}`)
      return
    }
    const sampleDataBase = sampleRes.value
    const sampleDataObj =
      sampleDataBase && typeof sampleDataBase === 'object' && !Array.isArray(sampleDataBase)
        ? (sampleDataBase as Record<string, unknown>)
        : {}
    requiredVariables.forEach((name) => {
      if (!(name in sampleDataObj)) {
        sampleDataObj[name] = variableValues[name] ?? ''
      }
    })
    try {
      const body = {
        name: name || doc.name || 'Untitled',
        tags: parseTags(tags),
        variables: resolvedVariables,
        template: doc,
        sample_data: sampleDataObj,
        preview_target: previewTarget
      }
      const url =
        mode === 'update' && backendTemplateId
          ? buildApiUrl(apiBase, `/v1/templates/${encodeURIComponent(backendTemplateId)}`)
          : buildApiUrl(apiBase, '/v1/templates')
      const res = await fetch(url, {
        method: mode === 'update' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error(await res.text())
      const payload = await res.json()
      if (payload?.id) setBackendTemplateId(payload.id)
      await refreshList()
      setStatus('idle')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }

  useEffect(() => {
    refreshList()
  }, [listUrl])

  useEffect(() => {
    if (!selectedId) return
    loadDetails(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (!details?.id) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    if (details.preview_available === false) {
      setPreviewStatus('idle')
      setPreviewError(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const controller = new AbortController()
    setPreviewStatus('loading')
    setPreviewError(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    fetch(buildApiUrl(apiBase, `/v1/templates/${encodeURIComponent(details.id)}/preview`), {
      signal: controller.signal,
      headers: { Accept: 'image/png' }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text()) || res.statusText)
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setPreviewStatus('idle')
      })
      .catch((e: any) => {
        if (controller.signal.aborted) return
        setPreviewStatus('error')
        setPreviewError(String(e?.message ?? e))
      })
    return () => controller.abort()
  }, [apiBase, details?.id, details?.preview_available])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!details) {
      setName(doc.name ?? '')
    }
  }, [details, doc.name])

  useEffect(() => {
    if (variablesTouched) return
    if (defaultVariableDefs.length === 0) return
    const trimmed = variablesText.trim()
    if (trimmed && trimmed !== '[]') return
    setVariablesText(JSON.stringify(defaultVariableDefs, null, 2))
  }, [defaultVariableDefs, variablesText, variablesTouched])

  useEffect(() => {
    if (sampleDataTouched) return
    if (Object.keys(defaultSampleData).length === 0) return
    const trimmed = sampleDataText.trim()
    if (trimmed && trimmed !== '{}' && trimmed !== '[]') return
    setSampleDataText(JSON.stringify(defaultSampleData, null, 2))
  }, [defaultSampleData, sampleDataText, sampleDataTouched])

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-6'>
      <div className='w-full max-w-5xl rounded border panel overflow-hidden'>
        <div className='px-3 py-2 border-b app-bar flex items-center justify-between'>
          <div className='text-sm font-semibold'>Template Store</div>
          <button className='px-2 py-1 text-sm rounded border btn' onClick={props.onClose} type='button'>
            Close
          </button>
        </div>

        <div className='grid grid-cols-[260px_minmax(0,1fr)] gap-3 p-3'>
          <div className='space-y-2'>
            <div className='text-xs text-muted'>Backend templates</div>
            <div className='flex items-center gap-2'>
              <input
                className='border rounded px-2 py-1 text-xs w-full bg-[var(--panel-muted)] border-[var(--border)]'
                placeholder='Filter tags (comma)'
                value={filterTags}
                onChange={(e) => setFilterTags(e.target.value)}
              />
              <button className='px-2 py-1 text-xs rounded border btn' onClick={refreshList} type='button'>
                Refresh
              </button>
            </div>
            <div className='max-h-[55vh] overflow-auto rounded border panel-muted'>
              {items.length === 0 ? (
                <div className='p-2 text-xs text-muted'>No templates found.</div>
              ) : (
                <ul className='divide-y'>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        className={
                          'w-full text-left px-2 py-2 text-xs hover:bg-[var(--panel-muted)] ' +
                          (selectedId === item.id ? 'bg-[var(--panel-muted)]' : '')
                        }
                        onClick={() => setSelectedId(item.id)}
                        type='button'
                      >
                        <div className='font-semibold'>{item.name}</div>
                        <div className='text-[11px] text-muted'>{item.tags?.join(', ') || 'No tags'}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className='space-y-3'>
            <div className='text-xs text-muted'>Current template</div>
            <div className='grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-xs items-center'>
              <div className='text-muted'>Backend ID</div>
              <div>{backendTemplateId ?? 'not linked'}</div>
              <div className='text-muted'>Name</div>
              <input
                className='border rounded px-2 py-1 text-xs bg-[var(--panel-muted)] border-[var(--border)]'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className='text-muted'>Tags</div>
              <input
                className='border rounded px-2 py-1 text-xs bg-[var(--panel-muted)] border-[var(--border)]'
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <div className='text-muted'>Preview</div>
              <div>
                {previewTarget.width_mm} x {previewTarget.height_mm} mm @ {previewTarget.dpi} dpi
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <div className='text-xs text-muted mb-1'>Variables (JSON)</div>
                <textarea
                  className='w-full h-[140px] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]'
                  value={variablesText}
                  onChange={(e) => {
                    setVariablesTouched(true)
                    setVariablesText(e.target.value)
                  }}
                />
              </div>
              <div>
                <div className='text-xs text-muted mb-1'>Sample data (JSON)</div>
                <textarea
                  className='w-full h-[140px] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]'
                  value={sampleDataText}
                  onChange={(e) => {
                    setSampleDataTouched(true)
                    setSampleDataText(e.target.value)
                  }}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <div className='text-xs text-muted'>Preview</div>
              {previewStatus === 'loading' && <div className='text-xs text-muted'>Loading preview...</div>}
              {previewStatus === 'error' && <div className='text-xs text-danger'>Preview failed: {previewError}</div>}
              {previewStatus === 'idle' && previewUrl && (
                <img src={previewUrl} alt='Template preview' className='max-h-[200px] rounded border' />
              )}
              {previewStatus === 'idle' && !previewUrl && <div className='text-xs text-muted'>No preview available.</div>}
            </div>

            <div className='flex items-center gap-2'>
              <button className='px-2 py-1 text-xs rounded border btn' onClick={() => handleSave('create')} type='button'>
                Save New
              </button>
              <button
                className='px-2 py-1 text-xs rounded border btn'
                onClick={() => handleSave('update')}
                type='button'
                disabled={!backendTemplateId}
              >
                Update
              </button>
              <button
                className='px-2 py-1 text-xs rounded border btn'
                onClick={handleLoadIntoEditor}
                type='button'
                disabled={!details}
              >
                Load Selected
              </button>
              {status === 'loading' && <span className='text-xs text-muted'>Loading...</span>}
              {status === 'saving' && <span className='text-xs text-muted'>Saving...</span>}
              {status === 'error' && <span className='text-xs text-danger'>Error: {error}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
