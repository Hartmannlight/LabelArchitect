import type { TemplateDoc } from './types'

export function templateLabels(doc: TemplateDoc): NonNullable<TemplateDoc['labels']> {
  return doc.labels?.length ? doc.labels : [{ name: 'Label 1' }]
}

export function labelPreviewTemplate(doc: TemplateDoc, index: number): TemplateDoc {
  const labels = templateLabels(doc)
  const label = labels[index] ?? labels[0]
  return { ...doc, layout: label.layout ?? doc.layout, labels: [{ name: label.name, bindings: label.bindings }] }
}
