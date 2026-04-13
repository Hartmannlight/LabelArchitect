import { type MouseEvent, type SyntheticEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getRenderSdk } from '../api/sdk'
import { computeLayout } from '../model/layout'
import { extractTemplateVariables } from '../model/variables'
import { useTemplateEditorStore } from '../state/store'

type RenderStatus = 'idle' | 'loading' | 'error'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function LabelPreviewPanel() {
  const doc = useTemplateEditorStore((s) => s.history.present)
  const preview = useTemplateEditorStore((s) => s.preview)
  const variableValues = useTemplateEditorStore((s) => s.variableValues)
  const selectNode = useTemplateEditorStore((s) => s.selectNode)
  const settings = useTemplateEditorStore((s) => s.settings)
  const setSettings = useTemplateEditorStore((s) => s.setSettings)
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const zoom = settings.previewZoom
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const minZoom = 0.25
  const maxZoom = 5
  const { variables: requiredVariables } = useMemo(() => extractTemplateVariables(doc), [doc])
  const renderVariables = useMemo(() => {
    const out: Record<string, string> = {}
    requiredVariables.forEach((key) => {
      out[key] = variableValues[key] ?? ''
    })
    return out
  }, [requiredVariables, variableValues])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      const startedAt = Date.now()
      setStatus('loading')
      setError(null)
      try {
        const blob = await getRenderSdk().renders.renderPng({
          template: doc,
          target: {
            width_mm: preview.width_mm,
            height_mm: preview.height_mm,
            dpi: preview.dpi,
            origin_x_mm: 0,
            origin_y_mm: 0
          },
          variables: renderVariables,
          debug: false
        })
        const nextUrl = URL.createObjectURL(blob)
        if (!active) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return nextUrl
        })
        setStatus('idle')
      } catch (e: any) {
        if (controller.signal.aborted) return
        console.warn('[preview] render pipeline failed', {
          message: String(e?.message ?? e),
          elapsedMs: Date.now() - startedAt
        })
        setStatus('error')
        setError(String(e?.message ?? e))
      }
    }, 2000)

    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [doc, preview.width_mm, preview.height_mm, preview.dpi, renderVariables])

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
  }

  const handleImageClick = (event: MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return

    const scalePxPerMm = rect.width / preview.width_mm
    const layout = computeLayout(doc.layout, preview.width_mm, preview.height_mm, { scalePxPerMm })
    const inRect = (rx: number, ry: number, r: { x: number; y: number; w: number; h: number }) =>
      rx >= r.x && ry >= r.y && rx <= r.x + r.w && ry <= r.y + r.h
    const hit =
      layout.leaves.find((leaf) => inRect(x, y, leaf.contentRect)) ??
      layout.leaves.find((leaf) => inRect(x, y, leaf.rect))
    if (hit) selectNode(hit.nodeId)
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY / 300)
    const next = clamp(Number((zoom * factor).toFixed(3)), minZoom, maxZoom)
    setSettings({ previewZoom: next })
  }

  return (
    <div className='h-full min-h-0 flex flex-col'>
      <div className='px-2 py-1 text-xs border-b border-[var(--border)] flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='text-muted'>Zoom</span>
          <input
            type='range'
            min={minZoom}
            max={maxZoom}
            step={0.05}
            value={zoom}
            onChange={(e) => setSettings({ previewZoom: Number(e.target.value) })}
          />
          <div className='text-muted w-10 text-right'>{Math.round(zoom * 100)}%</div>
          <button className='px-2 py-1 text-xs rounded border btn' onClick={() => setSettings({ previewZoom: 1 })} type='button'>
            Reset
          </button>
        </div>
        <div>
          {status === 'loading' && <span className='text-muted'>Rendering...</span>}
          {status === 'error' && <span className='text-danger'>Render failed: {error}</span>}
          {status === 'idle' && <span className='text-subtle'>Updates 2s after last change</span>}
        </div>
      </div>

      <div className='flex-1 min-h-0 bg-[var(--panel-muted)]'>
        <div className='w-full h-full overflow-auto' onWheel={handleWheel}>
          <div className='min-h-full min-w-full flex items-center justify-center'>
            {imageUrl ? (
              <img
                ref={imgRef}
                src={imageUrl}
                alt='ZPL preview'
                onLoad={handleImageLoad}
                onClick={handleImageClick}
                className='block cursor-pointer'
                style={
                  imageSize
                    ? {
                        width: Math.max(1, Math.round(imageSize.w * zoom)),
                        height: Math.max(1, Math.round(imageSize.h * zoom))
                      }
                    : undefined
                }
              />
            ) : (
              <div className='text-sm text-muted'>No preview yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
