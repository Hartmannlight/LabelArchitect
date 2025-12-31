import { type WheelEvent, useMemo } from 'react'
import { Circle, Group, Layer, Rect, Stage, Text as KText } from 'react-konva'
import { computeLayout } from '../model/layout'
import { useTemplateEditorStore } from '../state/store'
import { useSize } from './useSize'

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function snapRatio(ratio: number, stepPercent: number) {
  if (!stepPercent || stepPercent <= 0) return ratio
  const step = stepPercent / 100
  return Math.round(ratio / step) * step
}

export default function CanvasEditor() {
  const { ref, size } = useSize<HTMLDivElement>()
  const doc = useTemplateEditorStore((s) => s.history.present)
  const preview = useTemplateEditorStore((s) => s.preview)
  const settings = useTemplateEditorStore((s) => s.settings)
  const theme = useTemplateEditorStore((s) => s.theme)
  const selection = useTemplateEditorStore((s) => s.selection)
  const tool = useTemplateEditorStore((s) => s.tool)
  const selectNode = useTemplateEditorStore((s) => s.selectNode)
  const setTool = useTemplateEditorStore((s) => s.setTool)
  const splitLeafAt = useTemplateEditorStore((s) => s.splitLeafAt)
  const placeElementOnLeaf = useTemplateEditorStore((s) => s.placeElementOnLeaf)
  const setSplitRatio = useTemplateEditorStore((s) => s.setSplitRatio)
  const setSettings = useTemplateEditorStore((s) => s.setSettings)

  const effectiveScale = settings.scalePxPerMm * settings.previewZoom
  const layout = useMemo(() => computeLayout(doc.layout, preview.width_mm, preview.height_mm, { scalePxPerMm: effectiveScale }), [
    doc.layout,
    preview.width_mm,
    preview.height_mm,
    effectiveScale
  ])

  const artboardW = layout.rootRect.w
  const artboardH = layout.rootRect.h
  const stageW = size.width
  const stageH = size.height
  const ox = Math.max(0, (stageW - artboardW) / 2)
  const oy = Math.max(0, (stageH - artboardH) / 2)

  const applyToolOnLeaf = (nodeId: string, keepTool: boolean) => {
    if (tool === 'split_v') splitLeafAt(nodeId, 'v')
    else if (tool === 'split_h') splitLeafAt(nodeId, 'h')
    else if (tool === 'place_text') placeElementOnLeaf(nodeId, 'text')
    else if (tool === 'place_qr') placeElementOnLeaf(nodeId, 'qr')
    else if (tool === 'place_dm') placeElementOnLeaf(nodeId, 'datamatrix')
    else if (tool === 'place_image') placeElementOnLeaf(nodeId, 'image')
    else if (tool === 'place_line') placeElementOnLeaf(nodeId, 'line')
    if (tool !== 'select' && !keepTool) setTool('select')
  }

  const snapStep = Math.max(5, settings.snapPercentStep || 5)
  const colors =
    theme === 'light'
      ? {
          artboard: '#f1f5f9',
          artboardStroke: '#cbd5e1',
          leafFill: '#ffffff',
          leafStroke: '#94a3b8',
          leafStrokeSelected: '#0f172a',
          contentStroke: '#cbd5e1',
          label: '#2563eb',
          sublabel: '#64748b',
          gutter: '#e2e8f0',
          gutterSelected: '#cbd5e1',
          divider: '#0f172a',
          handle: '#64748b',
          handleSelected: '#0f172a'
        }
      : {
          artboard: '#0b0b0b',
          artboardStroke: '#2a2a2a',
          leafFill: '#0b0b0b',
          leafStroke: '#374151',
          leafStrokeSelected: '#e5e7eb',
          contentStroke: '#111827',
          label: '#93c5fd',
          sublabel: '#9ca3af',
          gutter: '#0f172a',
          gutterSelected: '#111827',
          divider: '#e5e7eb',
          handle: '#9ca3af',
          handleSelected: '#e5e7eb'
        }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY / 300)
    const next = clamp(settings.previewZoom * factor, 0.25, 5)
    setSettings({ previewZoom: Math.round(next * 100) / 100 })
  }

  return (
    <div ref={ref} className='h-full w-full' onWheel={handleWheel}>
      <Stage width={stageW} height={stageH}>
        <Layer>
          <Rect x={ox} y={oy} width={artboardW} height={artboardH} fill={colors.artboard} stroke={colors.artboardStroke} strokeWidth={1} />

          {layout.leaves.map((leaf) => {
            const isSelected = selection?.nodeId === leaf.nodeId
            const x = ox + leaf.rect.x
            const y = oy + leaf.rect.y
            const w = leaf.rect.w
            const h = leaf.rect.h

            const cx = ox + leaf.contentRect.x
            const cy = oy + leaf.contentRect.y
            const cw = leaf.contentRect.w
            const ch = leaf.contentRect.h

            const label =
              leaf.element.type === 'text'
                ? 'Text'
                : leaf.element.type === 'qr'
                  ? 'QR'
                  : leaf.element.type === 'datamatrix'
                    ? 'DataMatrix'
                    : leaf.element.type === 'image'
                      ? 'Image'
                      : 'Line'

            const onLeafActivate = (e: any) => {
              e.cancelBubble = true
              selectNode(leaf.nodeId)
              if (tool !== 'select') applyToolOnLeaf(leaf.nodeId, Boolean(e?.evt?.ctrlKey))
            }

            const showDebugBorder = leaf.node.debug_border ?? false
            const showLeafStroke = showDebugBorder || isSelected
            const leafStroke = showLeafStroke ? (isSelected ? colors.leafStrokeSelected : colors.leafStroke) : undefined
            const leafStrokeWidth = showLeafStroke ? (isSelected ? 2 : 1) : 0
            return (
              <Group key={leaf.nodeId} onClick={onLeafActivate} onTap={onLeafActivate}>
                <Rect
                  key={leaf.nodeId + ':leaf'}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={leafStroke}
                  strokeWidth={leafStrokeWidth}
                  fill={colors.leafFill}
                />
                <Rect key={leaf.nodeId + ':content'} x={cx} y={cy} width={cw} height={ch} stroke={colors.contentStroke} strokeWidth={1} />
                <KText key={leaf.nodeId + ':label'} x={cx + 4} y={cy + 4} text={label} fontSize={12} fill={colors.label} />
                <KText
                  key={leaf.nodeId + ':id'}
                  x={cx + 4}
                  y={cy + 18}
                  text={leaf.alias ? `${leaf.alias} (${leaf.nodeId})` : leaf.nodeId}
                  fontSize={10}
                  fill={colors.sublabel}
                />
              </Group>
            )
          })}

          {layout.splits.map((s) => {
            const isSelected = selection?.nodeId === s.nodeId
            const gx = ox + s.gutterRect.x
            const gy = oy + s.gutterRect.y
            const gw = s.gutterRect.w
            const gh = s.gutterRect.h
            const parentRect = { x: ox + s.rect.x, y: oy + s.rect.y, w: s.rect.w, h: s.rect.h }
            const gutterPx = s.node.direction === 'v' ? s.gutterRect.w : s.gutterRect.h

            const hitW = Math.max(gw, s.node.direction === 'v' ? 10 : gw)
            const hitH = Math.max(gh, s.node.direction === 'h' ? 10 : gh)
            const hitX = s.node.direction === 'v' ? gx + gw / 2 - hitW / 2 : gx
            const hitY = s.node.direction === 'h' ? gy + gh / 2 - hitH / 2 : gy

            const dragBoundFunc = (pos: { x: number; y: number }) => {
              if (s.node.direction === 'v') {
                const minX = parentRect.x + (gutterPx > 0 ? gutterPx / 2 : 0) - hitW / 2
                const maxX = parentRect.x + parentRect.w - (gutterPx > 0 ? gutterPx / 2 : 0) - hitW / 2
                return { x: clamp(pos.x, minX, maxX), y: hitY }
              }
              const minY = parentRect.y + (gutterPx > 0 ? gutterPx / 2 : 0) - hitH / 2
              const maxY = parentRect.y + parentRect.h - (gutterPx > 0 ? gutterPx / 2 : 0) - hitH / 2
              return { x: hitX, y: clamp(pos.y, minY, maxY) }
            }

            const onDragMove = (e: any) => {
              const x = e.target.x() + hitW / 2
              const y = e.target.y() + hitH / 2
              if (s.node.direction === 'v') {
                const available = Math.max(1, parentRect.w - gutterPx)
                const child0End = x - parentRect.x - gutterPx / 2
                let ratio = child0End / available
                ratio = snapRatio(ratio, snapStep)
                ratio = clamp(ratio, 0.01, 0.99)
                setSplitRatio(s.nodeId, ratio)
                return
              }

              const available = Math.max(1, parentRect.h - gutterPx)
              const child0End = y - parentRect.y - gutterPx / 2
              let ratio = child0End / available
              ratio = snapRatio(ratio, snapStep)
              ratio = clamp(ratio, 0.01, 0.99)
              setSplitRatio(s.nodeId, ratio)
            }

            const gutterFill = isSelected ? colors.gutterSelected : colors.gutter
            const showGutterVisual = isSelected && gutterPx > 0
            return (
              <Group key={s.nodeId}>
                {showGutterVisual && (
                  <Rect
                    key={s.nodeId + ':gutter-visual'}
                    x={gx}
                    y={gy}
                    width={gw}
                    height={gh}
                    fill={gutterFill}
                    opacity={0.6}
                  />
                )}
                {s.dividerRect && (
                  <Rect
                    key={s.nodeId + ':divider'}
                    x={ox + s.dividerRect.x}
                    y={oy + s.dividerRect.y}
                    width={s.dividerRect.w}
                    height={s.dividerRect.h}
                    fill={colors.divider}
                    opacity={0.8}
                  />
                )}
                <Rect
                  key={s.nodeId + ':gutter-hit'}
                  x={hitX}
                  y={hitY}
                  width={hitW}
                  height={hitH}
                  fill='rgba(0,0,0,0)'
                  onMouseDown={(e) => {
                    e.cancelBubble = true
                    selectNode(s.nodeId)
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true
                    selectNode(s.nodeId)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    selectNode(s.nodeId)
                  }}
                  draggable
                  dragBoundFunc={dragBoundFunc}
                  onDragStart={() => selectNode(s.nodeId)}
                  onDragMove={onDragMove}
                />

                <SplitHandle
                  splitId={s.nodeId}
                  direction={s.node.direction}
                  parentRect={parentRect}
                  gutterPx={gutterPx}
                  handleCenter={{ x: gx + gw / 2, y: gy + gh / 2 }}
                  selected={isSelected}
                  snapStep={snapStep}
                  colors={colors}
                  onChangeRatio={(r) => setSplitRatio(s.nodeId, r)}
                  onSelect={() => selectNode(s.nodeId)}
                />
              </Group>
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}

type HandleProps = {
  splitId: string
  direction: 'v' | 'h'
  parentRect: { x: number; y: number; w: number; h: number }
  gutterPx: number
  handleCenter: { x: number; y: number }
  selected: boolean
  snapStep: number
  colors: { handle: string; handleSelected: string }
  onChangeRatio: (ratio: number) => void
  onSelect: () => void
}

function SplitHandle(props: HandleProps) {
  const size = props.selected ? 9 : 7
  const minRatio = 0.01
  const maxRatio = 0.99

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    if (props.direction === 'v') {
      const minX = props.parentRect.x + (props.gutterPx > 0 ? props.gutterPx / 2 : 0)
      const maxX = props.parentRect.x + props.parentRect.w - (props.gutterPx > 0 ? props.gutterPx / 2 : 0)
      return { x: clamp(pos.x, minX, maxX), y: props.handleCenter.y }
    }
    const minY = props.parentRect.y + (props.gutterPx > 0 ? props.gutterPx / 2 : 0)
    const maxY = props.parentRect.y + props.parentRect.h - (props.gutterPx > 0 ? props.gutterPx / 2 : 0)
    return { x: props.handleCenter.x, y: clamp(pos.y, minY, maxY) }
  }

  const onDragMove = (e: any) => {
    const { x, y } = e.target.position()
    const gutter = props.gutterPx
    if (props.direction === 'v') {
      const available = Math.max(1, props.parentRect.w - gutter)
      const child0End = x - props.parentRect.x - gutter / 2
      let ratio = child0End / available
      ratio = snapRatio(ratio, props.snapStep)
      ratio = clamp(ratio, minRatio, maxRatio)
      props.onChangeRatio(ratio)
      return
    }

    const available = Math.max(1, props.parentRect.h - gutter)
    const child0End = y - props.parentRect.y - gutter / 2
    let ratio = child0End / available
    ratio = snapRatio(ratio, props.snapStep)
    ratio = clamp(ratio, minRatio, maxRatio)
    props.onChangeRatio(ratio)
  }

  return (
    <Circle
      x={props.handleCenter.x}
      y={props.handleCenter.y}
      radius={size}
      fill={props.selected ? props.colors.handleSelected : props.colors.handle}
      opacity={0.9}
      draggable
      dragBoundFunc={dragBoundFunc}
      onDragMove={onDragMove}
      onDragStart={props.onSelect}
      onMouseDown={(e) => {
        e.cancelBubble = true
        props.onSelect()
      }}
    />
  )
}
