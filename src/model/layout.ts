import type { Element, LeafNode, Node, SplitNode } from './types'

export type RectPx = { x: number; y: number; w: number; h: number }

export type LeafRender = {
  nodeId: string
  alias?: string
  node: LeafNode
  rect: RectPx
  contentRect: RectPx
  element: Element
}

export type SplitRender = {
  nodeId: string
  alias?: string
  node: SplitNode
  rect: RectPx
  gutterRect: RectPx
  dividerRect?: RectPx
}

export type LayoutRender = {
  rootRect: RectPx
  leaves: LeafRender[]
  splits: SplitRender[]
  aliasToId: Record<string, string>
}

export type LayoutOptions = {
  scalePxPerMm: number
}

export function computeLayout(root: Node, widthMm: number, heightMm: number, opts: LayoutOptions): LayoutRender {
  const scale = opts.scalePxPerMm
  const rootRect: RectPx = { x: 0, y: 0, w: widthMm * scale, h: heightMm * scale }
  const leaves: LeafRender[] = []
  const splits: SplitRender[] = []
  const aliasToId: Record<string, string> = {}

  const inset = (r: RectPx, left: number, top: number, right: number, bottom: number): RectPx => ({
    x: r.x + left,
    y: r.y + top,
    w: Math.max(0, r.w - left - right),
    h: Math.max(0, r.h - top - bottom)
  })

  const walk = (node: Node, nodeId: string, rect: RectPx) => {
    const alias = (node as any).alias as string | undefined
    if (alias) aliasToId[alias] = nodeId

    if (node.kind === 'leaf') {
      const pad = node.padding_mm ?? [0, 0, 0, 0]
      const contentRect = inset(rect, pad[3] * scale, pad[0] * scale, pad[1] * scale, pad[2] * scale)
      const element = node.elements[0]
      const ep = element.padding_mm ?? [0, 0, 0, 0]
      const elementRect = inset(contentRect, ep[3] * scale, ep[0] * scale, ep[1] * scale, ep[2] * scale)
      leaves.push({ nodeId, alias, node, rect, contentRect: elementRect, element })
      return
    }

    const gutterMm = node.gutter_mm ?? 0
    const gutter = gutterMm * scale
    if (node.direction === 'v') {
      const available = Math.max(0, rect.w - gutter)
      const child0w = Math.floor(available * node.ratio)
      const child1w = available - child0w
      const child0: RectPx = { x: rect.x, y: rect.y, w: child0w, h: rect.h }
      const gutterRect: RectPx = { x: rect.x + child0w, y: rect.y, w: gutter, h: rect.h }
      const child1: RectPx = { x: rect.x + child0w + gutter, y: rect.y, w: child1w, h: rect.h }

      const divider = node.divider
      let dividerRect: RectPx | undefined
      if (divider?.visible) {
        const t = Math.max(1, (divider.thickness_mm ?? 0.3) * scale)
        dividerRect = { x: gutterRect.x + (gutterRect.w - t) / 2, y: rect.y, w: t, h: rect.h }
      }

      splits.push({ nodeId, alias, node, rect, gutterRect, dividerRect })
      walk(node.children[0], `${nodeId}/0`, child0)
      walk(node.children[1], `${nodeId}/1`, child1)
      return
    }

    const available = Math.max(0, rect.h - gutter)
    const child0h = Math.floor(available * node.ratio)
    const child1h = available - child0h
    const child0: RectPx = { x: rect.x, y: rect.y, w: rect.w, h: child0h }
    const gutterRect: RectPx = { x: rect.x, y: rect.y + child0h, w: rect.w, h: gutter }
    const child1: RectPx = { x: rect.x, y: rect.y + child0h + gutter, w: rect.w, h: child1h }

    const divider = node.divider
    let dividerRect: RectPx | undefined
    if (divider?.visible) {
      const t = Math.max(1, (divider.thickness_mm ?? 0.3) * scale)
      dividerRect = { x: rect.x, y: gutterRect.y + (gutterRect.h - t) / 2, w: rect.w, h: t }
    }

    splits.push({ nodeId, alias, node, rect, gutterRect, dividerRect })
    walk(node.children[0], `${nodeId}/0`, child0)
    walk(node.children[1], `${nodeId}/1`, child1)
  }

  walk(root, 'r', rootRect)
  return { rootRect, leaves, splits, aliasToId }
}
