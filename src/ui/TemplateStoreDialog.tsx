import type { TemplateDetailResponse, TemplateListItem } from '@printhub/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBackendSdk } from '../api/sdk'
import { extractTemplateVariables } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'

type TemplateDetails = TemplateDetailResponse

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

function updateJsonField(source: string, name: string, value: string, removeEmpty: boolean): string | null {
  const parsed = parseJson<Record<string, unknown>>(source, {})
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return null
  const next = { ...parsed.value }
  if (removeEmpty && !value) delete next[name]
  else next[name] = value
  return JSON.stringify(next, null, 2)
}

function normalizeVariableDefs(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<Record<string, unknown> & { name: string; mode?: string; default?: unknown }>
  const out: Array<Record<string, unknown> & { name: string; mode?: string; default?: unknown }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = (item as any).name
    if (typeof name !== 'string' || !name.trim()) continue
    const mode = typeof (item as any).mode === 'string' ? (item as any).mode : undefined
    const def = (item as any).default
    out.push({ ...(item as Record<string, unknown>), name: name.trim(), mode, default: def })
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
  const setVariableValue = useTemplateEditorStore((s) => s.setVariableValue)

  const [items, setItems] = useState<TemplateListItem[]>([])
  const [filterTags, setFilterTags] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(backendTemplateId)
  const [details, setDetails] = useState<TemplateDetails | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const detailsRequest = useRef(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [name, setName] = useState(doc.name ?? '')
  const [description, setDescription] = useState('')
  const [usageContext, setUsageContext] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [archived, setArchived] = useState(false)
  const [tags, setTags] = useState('')
  const [variablesText, setVariablesText] = useState('[]')
  const [sampleDataText, setSampleDataText] = useState('{}')
  const [printDefaultsText, setPrintDefaultsText] = useState('{}')
  const [variablesTouched, setVariablesTouched] = useState(false)
  const [sampleDataTouched, setSampleDataTouched] = useState(false)

  const { variables: requiredVariables } = useMemo(() => extractTemplateVariables(doc), [doc])

  const embeddedMetadata = useMemo(() => {
    const value = doc.extensions?.printhub
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  }, [doc.extensions])

  const defaultVariableDefs = useMemo(
    () => {
      const embedded = normalizeVariableDefs(embeddedMetadata.variables)
      return embedded.length ? embedded : requiredVariables.map((name) => ({ name, mode: 'required' }))
    },
    [embeddedMetadata.variables, requiredVariables]
  )
  const defaultSampleData = useMemo(() => {
    const embedded = embeddedMetadata.sample_data
    if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
      return embedded as Record<string, unknown>
    }
    const out: Record<string, unknown> = {}
    requiredVariables.forEach((name) => {
      out[name] = variableValues[name] ?? ''
    })
    return out
  }, [embeddedMetadata.sample_data, requiredVariables, variableValues])

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

  const refreshList = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const tagsQuery = parseTags(filterTags)
      const payload = await getBackendSdk().templates.list({
        tags: tagsQuery.length ? tagsQuery.join(',') : undefined
      })
      setItems(payload)
      setStatus('idle')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }, [filterTags])

  const populateForm = useCallback((payload: TemplateDetails) => {
    setName(payload.name ?? '')
    setDescription(payload.description ?? '')
    setUsageContext(payload.usage_context ?? '')
    setFavorite(payload.favorite ?? false)
    setArchived(payload.archived ?? false)
    setTags((payload.tags ?? []).join(', '))
    setVariablesText(JSON.stringify(payload.variables ?? [], null, 2))
    setSampleDataText(JSON.stringify(payload.sample_data ?? {}, null, 2))
    setPrintDefaultsText(JSON.stringify(payload.print_defaults ?? {}, null, 2))
  }, [])

  const loadDetails = useCallback(async (id: string) => {
    const request = ++detailsRequest.current
    setStatus('loading')
    setError(null)
    setDetails(null)
    try {
      const payload = (await getBackendSdk().templates.get(id)) as TemplateDetails
      if (request !== detailsRequest.current) return
      setDetails(payload)
      if (id === backendTemplateId) populateForm(payload)
      setStatus('idle')
    } catch (e: any) {
      if (request !== detailsRequest.current) return
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }, [backendTemplateId, populateForm])

  const handleLoadIntoEditor = () => {
    if (!details || details.id !== selectedId || status === 'loading' || status === 'saving') return
    loadTemplate(details.template as any)
    setBackendTemplateId(details.id)
    Object.entries(details.sample_data ?? {}).forEach(([name, value]) => setVariableValue(name, String(value ?? '')))
    populateForm(details)
    if (details.preview_target) {
      setPreviewTarget({
        width_mm: Number(details.preview_target.width_mm),
        height_mm: Number(details.preview_target.height_mm),
        dpi: Number(details.preview_target.dpi)
      })
    }
  }

  const handleSave = async (mode: 'create' | 'update') => {
    if (status === 'loading' || status === 'saving') return
    if (mode === 'update' && (!backendTemplateId || selectedId !== backendTemplateId || details?.id !== backendTemplateId)) return
    setStatus('saving')
    setError(null)
    setSaveNotice(null)
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
    const missingExamples = requiredVariables.filter((name) => !String(sampleDataObj[name] ?? '').trim())
    if (missingExamples.length) {
      setStatus('error')
      setError(`Enter preview examples for: ${missingExamples.join(', ')}`)
      return
    }
    const printDefaultsRes = parseJson(printDefaultsText, {})
    if (!printDefaultsRes.ok || !printDefaultsRes.value || typeof printDefaultsRes.value !== 'object' || Array.isArray(printDefaultsRes.value)) {
      setStatus('error')
      setError(printDefaultsRes.ok ? 'Print defaults must be a JSON object.' : `Print defaults JSON error: ${printDefaultsRes.error}`)
      return
    }
    try {
      const body = {
        name: name || doc.name || 'Untitled',
        description,
        usage_context: usageContext,
        favorite,
        archived,
        tags: parseTags(tags),
        variables: resolvedVariables,
        template: doc,
        sample_data: sampleDataObj,
        print_defaults: printDefaultsRes.value as Record<string, unknown>,
        preview_target: previewTarget
      }
      const payload =
        mode === 'update' && backendTemplateId
          ? await getBackendSdk().templates.update(backendTemplateId, body)
          : await getBackendSdk().templates.create(body)
      if (payload?.id) setBackendTemplateId(payload.id)
      if (payload?.id) {
        setSelectedId(payload.id)
        setDetails(payload as TemplateDetails)
        populateForm(payload as TemplateDetails)
      }
      await refreshList()
      setStatus('idle')
      const warning = (payload as TemplateDetails & { preview_warning?: string | null }).preview_warning
      setSaveNotice(warning ? `Template saved. Thumbnail unavailable: ${warning}` : 'Template saved.')
    } catch (e: any) {
      setStatus('error')
      setError(String(e?.message ?? e))
    }
  }

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    if (!selectedId) { detailsRequest.current += 1; setDetails(null); return }
    loadDetails(selectedId)
  }, [loadDetails, selectedId])

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
    getBackendSdk()
      .templates.getPreview(details.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        if (controller.signal.aborted) { URL.revokeObjectURL(url); return }
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
  }, [details?.id, details?.preview_available])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!details && !backendTemplateId) {
      setName(doc.name ?? '')
      const embeddedTags = embeddedMetadata.tags
      if (Array.isArray(embeddedTags)) setTags(embeddedTags.map(String).join(', '))
      if (typeof embeddedMetadata.description === 'string') setDescription(embeddedMetadata.description)
      if (typeof embeddedMetadata.usage_context === 'string') setUsageContext(embeddedMetadata.usage_context)
      if (embeddedMetadata.print_defaults && typeof embeddedMetadata.print_defaults === 'object' && !Array.isArray(embeddedMetadata.print_defaults)) {
        setPrintDefaultsText(JSON.stringify(embeddedMetadata.print_defaults, null, 2))
      }
    }
  }, [backendTemplateId, details, doc.name, embeddedMetadata])

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

  const parsedVariables = parseJson(variablesText, [])
  const parsedSamples = parseJson<Record<string, unknown>>(sampleDataText, {})
  const parsedDefaults = parseJson<Record<string, unknown>>(printDefaultsText, {})
  const sampleValues = parsedSamples.ok && parsedSamples.value && !Array.isArray(parsedSamples.value) ? parsedSamples.value : {}
  const defaultValues = parsedDefaults.ok && parsedDefaults.value && !Array.isArray(parsedDefaults.value) ? parsedDefaults.value : {}
  const valueFields = Array.from(new Set([
    ...requiredVariables,
    ...(parsedVariables.ok ? normalizeVariableDefs(parsedVariables.value).map((item) => item.name) : []),
    ...Object.keys(sampleValues),
    ...Object.keys(defaultValues),
  ]))

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-6'>
      <div className='w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded border panel' role='dialog' aria-modal='true' aria-label='Template Store'>
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
              <div className='text-xs text-muted'>Current editor template</div>
              {selectedId && selectedId !== backendTemplateId && <div className='text-xs text-muted'>A different library template is selected. Use “Load Selected” before updating it.</div>}
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
              <div className='text-muted'>Description</div>
              <textarea className='border rounded px-2 py-1 text-xs bg-[var(--panel-muted)] border-[var(--border)]' rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder='What is this label for?' />
              <div className='text-muted'>Usage context</div>
              <textarea className='border rounded px-2 py-1 text-xs bg-[var(--panel-muted)] border-[var(--border)]' rows={3} maxLength={4000} value={usageContext} onChange={(e) => setUsageContext(e.target.value)} placeholder='Where, when and with which data should it be used?' />
              <div className='text-muted'>Library</div>
              <div className='flex gap-4'><label><input type='checkbox' checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> Favorite</label><label><input type='checkbox' checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived</label></div>
              <div className='text-muted'>Preview</div>
              <div>
                {previewTarget.width_mm} x {previewTarget.height_mm} mm @ {previewTarget.dpi} dpi
              </div>
            </div>

            <div className='space-y-2 text-xs'>
              <div className='font-semibold'>Values by field</div>
              <p className='text-muted'>Preview examples appear in saved thumbnails. Print start values fill the print form; leave them blank to start empty.</p>
              {valueFields.length === 0 && <p className='text-muted'>Add a variable to the layout to enter values here.</p>}
              <div className='template-value-grid'>
                {valueFields.map((field) => <div className='template-value-row' key={field}>
                  <code>{field}</code>
                  <label><span>Preview example</span><input value={String(sampleValues[field] ?? '')} onChange={(e) => {
                    const next = updateJsonField(sampleDataText, field, e.target.value, false)
                    if (next !== null) { setSampleDataTouched(true); setSampleDataText(next) }
                  }} /></label>
                  <label><span>Print start value</span><input value={String(defaultValues[field] ?? '')} onChange={(e) => {
                    const next = updateJsonField(printDefaultsText, field, e.target.value, true)
                    if (next !== null) setPrintDefaultsText(next)
                  }} placeholder='Empty' /></label>
                </div>)}
              </div>
              <details><summary>Advanced JSON and variable definitions</summary>
                <div className='grid grid-cols-3 gap-3 mt-2'>
                  <label>Variables (JSON)<textarea className='w-full h-[140px] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]' value={variablesText} onChange={(e) => { setVariablesTouched(true); setVariablesText(e.target.value) }} /></label>
                  <label>Preview examples (JSON)<textarea className='w-full h-[140px] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]' value={sampleDataText} onChange={(e) => { setSampleDataTouched(true); setSampleDataText(e.target.value) }} /></label>
                  <label>Print start values (JSON)<textarea className='w-full h-[140px] border rounded p-2 text-xs font-mono bg-[var(--panel-muted)] border-[var(--border)]' value={printDefaultsText} onChange={(e) => setPrintDefaultsText(e.target.value)} /></label>
                </div>
              </details>
            </div>

            <div className='space-y-2'>
              <div className='text-xs text-muted'>Selected library preview</div>
              {previewStatus === 'loading' && <div className='text-xs text-muted'>Loading preview...</div>}
              {previewStatus === 'error' && <div className='text-xs text-danger'>Preview failed: {previewError}</div>}
              {previewStatus === 'idle' && previewUrl && (
                <img src={previewUrl} alt='Template preview' className='max-h-[200px] rounded border' />
              )}
              {previewStatus === 'idle' && !previewUrl && <div className='text-xs text-muted'>No preview available.</div>}
            </div>

            <div className='flex items-center gap-2'>
              <button className='px-2 py-1 text-xs rounded border btn' onClick={() => handleSave('create')} type='button' disabled={status === 'loading' || status === 'saving'}>
                Save New
              </button>
              <button
                className='px-2 py-1 text-xs rounded border btn'
                onClick={() => handleSave('update')}
                type='button'
                disabled={!backendTemplateId || selectedId !== backendTemplateId || details?.id !== backendTemplateId || status === 'loading' || status === 'saving'}
              >
                Update
              </button>
              <button
                className='px-2 py-1 text-xs rounded border btn'
                onClick={handleLoadIntoEditor}
                type='button'
                disabled={!details || details.id !== selectedId || status === 'loading' || status === 'saving'}
              >
                Load Selected
              </button>
              {status === 'loading' && <span className='text-xs text-muted'>Loading...</span>}
              {status === 'saving' && <span className='text-xs text-muted'>Saving...</span>}
              {status === 'error' && <span className='text-xs text-danger'>Error: {error}</span>}
              {saveNotice && <span className='text-xs' role='status'>{saveNotice}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
