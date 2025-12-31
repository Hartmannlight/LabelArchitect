import type { Element, LeafNode, Node, SplitNode, TemplateDefaults, TemplateDoc } from '../model/types'
import { getNodeById, isLeaf, isSplit, updateNodeById } from '../model/ids'

export type SplitDirection = 'v' | 'h'

export function setTemplateName(doc: TemplateDoc, name: string): TemplateDoc {
  return { ...doc, name }
}

export function setDefaults(doc: TemplateDoc, defaults: TemplateDefaults): TemplateDoc {
  return { ...doc, defaults }
}

export function setNodeAlias(doc: TemplateDoc, nodeId: string, alias: string | undefined): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => ({ ...n, alias })) }
}

export function setLeafPadding(doc: TemplateDoc, nodeId: string, padding_mm: [number, number, number, number] | undefined): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'leaf' ? { ...n, padding_mm } : n)) }
}

export function toggleLeafDebugBorder(doc: TemplateDoc, nodeId: string, value: boolean): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'leaf' ? { ...n, debug_border: value } : n)) }
}

export function setSplitRatio(doc: TemplateDoc, nodeId: string, ratio: number): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'split' ? { ...n, ratio } : n)) }
}

export function setSplitGutter(doc: TemplateDoc, nodeId: string, gutter_mm: number | undefined): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'split' ? { ...n, gutter_mm } : n)) }
}

export function setSplitDivider(doc: TemplateDoc, nodeId: string, divider: SplitNode['divider'] | undefined): TemplateDoc {
  return { ...doc, layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'split' ? { ...n, divider } : n)) }
}

export function splitLeaf(doc: TemplateDoc, nodeId: string, direction: SplitDirection): TemplateDoc {
  const target = getNodeById(doc.layout, nodeId)
  if (!target || !isLeaf(target)) return doc

  const left: LeafNode = target
  const right: LeafNode = {
    kind: 'leaf',
    padding_mm: left.padding_mm,
    debug_border: left.debug_border,
    elements: [{ type: 'text', text: '' }]
  }

  const split: SplitNode = {
    kind: 'split',
    direction,
    ratio: 0.5,
    gutter_mm: 0,
    divider: { visible: false, thickness_mm: 0.3 },
    children: [left, right]
  }

  return { ...doc, layout: updateNodeById(doc.layout, nodeId, () => split) }
}

export function unsplit(doc: TemplateDoc, nodeId: string): TemplateDoc {
  const target = getNodeById(doc.layout, nodeId)
  if (!target || !isSplit(target)) return doc

  const firstLeaf = findFirstLeaf(target.children[0]) ?? findFirstLeaf(target.children[1])
  if (!firstLeaf) return doc

  const merged: LeafNode = {
    kind: 'leaf',
    padding_mm: firstLeaf.padding_mm,
    debug_border: firstLeaf.debug_border,
    elements: firstLeaf.elements
  }

  return { ...doc, layout: updateNodeById(doc.layout, nodeId, () => merged) }
}

function findFirstLeaf(node: Node): LeafNode | null {
  if (node.kind === 'leaf') return node
  return findFirstLeaf(node.children[0]) ?? findFirstLeaf(node.children[1])
}

export function setLeafElement(doc: TemplateDoc, nodeId: string, element: Element): TemplateDoc {
  return {
    ...doc,
    layout: updateNodeById(doc.layout, nodeId, (n) => (n.kind === 'leaf' ? { ...n, elements: [element] } : n))
  }
}

export function updateLeafElement(doc: TemplateDoc, nodeId: string, patch: Partial<Element>): TemplateDoc {
  const node = getNodeById(doc.layout, nodeId)
  if (!node || node.kind !== 'leaf') return doc
  const cur = node.elements[0]
  const next = { ...cur, ...patch } as Element
  return setLeafElement(doc, nodeId, next)
}

export function makeDefaultElement(type: Element['type']): Element {
  if (type === 'text') return { type: 'text', text: '' }
  if (type === 'qr') return { type: 'qr', data: '' }
  if (type === 'datamatrix') return { type: 'datamatrix', data: '', module_size_mm: 0.5, quality: 200 }
  if (type === 'image') return { type: 'image', source: { kind: 'base64', data: '' } }
  return { type: 'line', orientation: 'h', thickness_mm: 0.3, align: 'center' }
}
