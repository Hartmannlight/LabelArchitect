import type { Element, LeafNode, Node, TemplateDoc } from './types'

export const TEMPLATE_MACROS = new Set([
  '_now_iso',
  '_date_yyyy_mm_dd',
  '_date_dd_mm_yyyy',
  '_time_hh_mm',
  '_time_hh_mm_ss',
  '_timestamp_ms',
  '_uuid',
  '_short_id',
  '_printer_id',
  '_template_name',
  '_counter_global',
  '_counter_daily',
  '_counter_printer',
  '_counter_printer_daily',
  '_counter_template',
  '_counter_template_daily'
])

function extractPlaceholdersFromText(text: string): string[] {
  const cleaned = text.replace(/{{/g, '').replace(/}}/g, '')
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  const hits: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(cleaned))) {
    hits.push(match[1])
  }
  return hits
}

function collectPlaceholdersFromElement(element: Element, bucket: Set<string>) {
  if (element.type === 'text') {
    extractPlaceholdersFromText(element.text).forEach((name) => bucket.add(name))
    return
  }
  if (element.type === 'qr') {
    extractPlaceholdersFromText(element.data).forEach((name) => bucket.add(name))
    return
  }
  if (element.type === 'datamatrix') {
    extractPlaceholdersFromText(element.data).forEach((name) => bucket.add(name))
  }
}

function collectFromNode(node: Node, bucket: Set<string>) {
  if (node.kind === 'split') {
    collectFromNode(node.children[0], bucket)
    collectFromNode(node.children[1], bucket)
    return
  }
  const leaf = node as LeafNode
  leaf.elements.forEach((el) => collectPlaceholdersFromElement(el, bucket))
}

export function extractTemplateVariables(doc: TemplateDoc): { variables: string[]; macros: string[] } {
  const bucket = new Set<string>()
  collectFromNode(doc.layout, bucket)
  const variables: string[] = []
  const macros: string[] = []
  for (const name of bucket) {
    if (TEMPLATE_MACROS.has(name)) macros.push(name)
    else variables.push(name)
  }
  return {
    variables: variables.sort(),
    macros: macros.sort()
  }
}
