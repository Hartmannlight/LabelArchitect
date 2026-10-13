import type { Element, ImageBackground, LeafNode, Node, RotationDeg, SplitNode } from './types'

export type RectPx = { x: number; y: number; w: number; h: number }
export type Transform = { a: number; b: number; c: number; d: number; x: number; y: number }
export const identity: Transform = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }
export const transformPoint = (t: Transform, x: number, y: number) => ({ x: t.a * x + t.c * y + t.x, y: t.b * x + t.d * y + t.y })
export const rotationOf = (t: Transform): RotationDeg => t.a === 1 ? 0 : t.b === 1 ? 90 : t.a === -1 ? 180 : -90
export function transformRect(t: Transform, r: RectPx): RectPx {
  const points = [transformPoint(t, r.x, r.y), transformPoint(t, r.x + r.w, r.y), transformPoint(t, r.x, r.y + r.h), transformPoint(t, r.x + r.w, r.y + r.h)]
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
function childTransform(parent: Transform, r: RectPx, angle: number): { transform: Transform; rect: RectPx } {
  const turn = ((angle % 360) + 360) % 360 / 90
  const [a, b, c, d, x, y] = [[1, 0, 0, 1, r.x, r.y], [0, 1, -1, 0, r.x + r.w, r.y], [-1, 0, 0, -1, r.x + r.w, r.y + r.h], [0, -1, 1, 0, r.x, r.y + r.h]][turn]
  const origin = transformPoint(parent, x, y)
  return { transform: { a: parent.a*a + parent.c*b, b: parent.b*a + parent.d*b, c: parent.a*c + parent.c*d, d: parent.b*c + parent.d*d, ...origin }, rect: { x: 0, y: 0, w: turn % 2 ? r.h : r.w, h: turn % 2 ? r.w : r.h } }
}
export type LeafRender = { nodeId: string; alias?: string; node: LeafNode; rect: RectPx; contentRect: RectPx; localContentRect: RectPx; transform: Transform; element: Element }
export type SplitRender = { nodeId: string; alias?: string; node: SplitNode; rect: RectPx; gutterRect: RectPx; dividerRect?: RectPx; direction: 'v' | 'h'; reversed: boolean }
export type BackgroundRender = { nodeId: string; background: ImageBackground; rect: RectPx }
export type LayoutRender = { rootRect: RectPx; backgrounds: BackgroundRender[]; leaves: LeafRender[]; splits: SplitRender[]; aliasToId: Record<string, string> }
export type LayoutOptions = { scalePxPerMm: number; leafPaddingMm?: [number, number, number, number] }

export function computeLayout(root: Node, widthMm: number, heightMm: number, opts: LayoutOptions): LayoutRender {
  const scale = opts.scalePxPerMm
  const rootRect: RectPx = { x: 0, y: 0, w: widthMm * scale, h: heightMm * scale }
  const backgrounds: BackgroundRender[] = [], leaves: LeafRender[] = [], splits: SplitRender[] = []
  const aliasToId: Record<string, string> = {}
  const inset = (r: RectPx, p: number[]): RectPx => ({ x: r.x + p[3] * scale, y: r.y + p[0] * scale, w: Math.max(0, r.w - (p[3] + p[1]) * scale), h: Math.max(0, r.h - (p[0] + p[2]) * scale) })
  const walk = (node: Node, nodeId: string, allocated: RectPx, parent: Transform) => {
    const { transform, rect } = childTransform(parent, allocated, node.rotation_deg ?? 0)
    const world = transformRect(transform, rect)
    if (node.alias) aliasToId[node.alias] = nodeId
    if (node.background) backgrounds.push({ nodeId, background: node.background, rect: world })
    if (node.kind === 'leaf') {
      const element = node.elements[0]
      const localContentRect = inset(inset(rect, node.padding_mm ?? opts.leafPaddingMm ?? [0, 0, 0, 0]), element.padding_mm ?? [0, 0, 0, 0])
      leaves.push({ nodeId, alias: node.alias, node, rect: world, contentRect: transformRect(transform, localContentRect), localContentRect, transform, element })
      return
    }
    const gutter = (node.gutter_mm ?? 0) * scale, vertical = node.direction === 'v'
    const available = Math.max(0, (vertical ? rect.w : rect.h) - gutter)
    const first = Math.floor(available * node.ratio), second = available - first
    const children: [RectPx, RectPx] = vertical
      ? [{ x: 0, y: 0, w: first, h: rect.h }, { x: first + gutter, y: 0, w: second, h: rect.h }]
      : [{ x: 0, y: 0, w: rect.w, h: first }, { x: 0, y: first + gutter, w: rect.w, h: second }]
    const gap = vertical ? { x: first, y: 0, w: gutter, h: rect.h } : { x: 0, y: first, w: rect.w, h: gutter }
    const axis = vertical ? { x: transform.a, y: transform.b } : { x: transform.c, y: transform.d }
    const direction = axis.x ? 'v' : 'h'
    let dividerRect: RectPx | undefined
    if (node.divider?.visible) {
      const thickness = Math.max(1, (node.divider.thickness_mm ?? 0.3) * scale)
      dividerRect = transformRect(transform, vertical ? { x: first + (gutter - thickness) / 2, y: 0, w: thickness, h: rect.h } : { x: 0, y: first + (gutter - thickness) / 2, w: rect.w, h: thickness })
    }
    splits.push({ nodeId, alias: node.alias, node, rect: world, gutterRect: transformRect(transform, gap), dividerRect, direction, reversed: (axis.x || axis.y) < 0 })
    walk(node.children[0], `${nodeId}/0`, children[0], transform)
    walk(node.children[1], `${nodeId}/1`, children[1], transform)
  }
  walk(root, 'r', rootRect, identity)
  return { rootRect, backgrounds, leaves, splits, aliasToId }
}
