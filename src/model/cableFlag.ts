import type { LabelPreviewTarget, LeafNode, Node, TemplateDoc } from './types'

export type CableFlagConfig = { diameter_mm: number; text_padding_mm: number; wrap_axis: 'long' | 'short' }
export const defaultCableFlag: CableFlagConfig = { diameter_mm: 6, text_padding_mm: 2, wrap_axis: 'long' }
export function cableFlagConfig(doc: TemplateDoc): CableFlagConfig | null {
  const config = doc.extensions?.cable_flag
  return config && typeof config === 'object' ? { ...defaultCableFlag, ...config } as CableFlagConfig : null
}
export function cableFlagGeometry(target: Pick<LabelPreviewTarget, 'width_mm' | 'height_mm'>, config: CableFlagConfig) {
  if (!Number.isFinite(config.diameter_mm) || config.diameter_mm <= 0 || !Number.isFinite(config.text_padding_mm) || config.text_padding_mm < 0) throw new Error('Cable diameter must be positive; text padding must be zero or greater.')
  const horizontal = config.wrap_axis === 'long' ? target.width_mm > target.height_mm : target.width_mm <= target.height_mm
  const circumference = Math.PI * config.diameter_mm
  const length = horizontal ? target.width_mm : target.height_mm
  const faceLength = (length - circumference) / 2
  const textLength = faceLength - config.text_padding_mm - 1.5
  if (textLength < 6) throw new Error('Cable circumference and padding leave less than 6 mm for text on each face.')
  return { horizontal, circumference, faceLength, textLength }
}
export function configureCableFlag(doc: TemplateDoc, target: Pick<LabelPreviewTarget, 'width_mm' | 'height_mm'>, config: CableFlagConfig): TemplateDoc {
  const geometry = cableFlagGeometry(target, config)
  if (doc.layout.kind !== 'split' || (doc.layout.rotation_deg ?? 0) % 360) throw new Error('Cable flag needs an unrotated root split; rotate its face areas instead.')
  const pad = (node: Node, edge: number | null): Node => {
    const localEdge = edge === null ? null : ((edge - (node.rotation_deg ?? 0) / 90) % 4 + 4) % 4
    if (node.kind === 'leaf') {
      const padding: [number, number, number, number] = [1.5, 1.5, 1.5, 1.5]
      if (localEdge !== null) padding[localEdge] = config.text_padding_mm
      return { ...node, padding_mm: padding }
    }
    const children = node.children.map((child, index) => {
      const touches = !((node.direction === 'v' && (localEdge === 1 || localEdge === 3) && index !== (localEdge === 1 ? 1 : 0)) || (node.direction === 'h' && (localEdge === 0 || localEdge === 2) && index !== (localEdge === 2 ? 1 : 0)))
      return pad(child, touches ? localEdge : null)
    }) as [Node, Node]
    return { ...node, children }
  }
  return { ...doc, extensions: { ...doc.extensions, cable_flag: config }, layout: { ...doc.layout, direction: geometry.horizontal ? 'v' : 'h', ratio: .5, gutter_mm: geometry.circumference, children: [pad(doc.layout.children[0], geometry.horizontal ? 1 : 2), pad(doc.layout.children[1], geometry.horizontal ? 3 : 0)] } }
}

export function cableFlagPreviewLayout(doc: TemplateDoc, target: Pick<LabelPreviewTarget, 'width_mm' | 'height_mm'>): Node {
  const config = cableFlagConfig(doc)
  if (!config) return doc.layout
  try { return configureCableFlag(doc, target, config).layout } catch { return doc.layout }
}
export function swapCableEnds(values: Record<string, string>): Record<string, string> {
  const result = { ...values }
  if ('from' in values || 'to' in values) { result.from = values.to ?? ''; result.to = values.from ?? '' }
  for (const key of ['device', 'port', 'bundle']) {
    result[`from_${key}`] = values[`to_${key}`] ?? ''
    result[`to_${key}`] = values[`from_${key}`] ?? ''
  }
  return result
}
export function createCableFlagTemplate(target = { width_mm: 75, height_mm: 50 }, config = defaultCableFlag): TemplateDoc {
  const face = (alias: string): LeafNode => ({ kind: 'leaf', alias, rotation_deg: alias === 'front' ? 90 : -90, padding_mm: [1.5, 1.5, 1.5, 1.5], elements: [{ type: 'text', text: 'VON: {from}\nZU: {to}', font_height_mm: 4.2, fit: 'shrink_to_fit', wrap: 'none', max_lines: 16, align_h: 'center', align_v: 'center' }] })
  return configureCableFlag({ schema_version: 1, name: 'Kabel-Fähnchen 75 × 50 mm', labels: [{ name: 'Ende A' }, { name: 'Ende B', bindings: { from: 'to', to: 'from' } }], defaults: { leaf_padding_mm: [1.5, 1.5, 1.5, 1.5], render: { emit_ci28: true, missing_variables: 'error' } }, layout: { kind: 'split', alias: 'cable-wrap', direction: 'v', ratio: .5, divider: { visible: true, thickness_mm: 0.2 }, children: [face('front'), face('back')] } }, target, config)
}
