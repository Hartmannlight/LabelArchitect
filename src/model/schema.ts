import { z } from 'zod'
import type { TemplateDoc } from './types'

const paddingMmSchema = z.tuple([
  z.number().min(0),
  z.number().min(0),
  z.number().min(0),
  z.number().min(0),
])

const dividerSchema = z.object({
  visible: z.boolean().optional(),
  thickness_mm: z.number().positive().optional(),
})

const elementBaseSchema = z.object({
  id: z.string().min(1).optional(),
  padding_mm: paddingMmSchema.optional(),
  min_size_mm: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  max_size_mm: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  extensions: z.record(z.unknown()).optional(),
})

const textElementSchema = elementBaseSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  font_height_mm: z.number().positive().optional(),
  font_width_mm: z.number().positive().optional(),
  wrap: z.enum(['none', 'word', 'char']).optional(),
  fit: z.enum(['overflow', 'wrap', 'shrink_to_fit', 'truncate']).optional(),
  max_lines: z.number().int().min(1).optional(),
  align_h: z.enum(['left', 'center', 'right']).optional(),
  align_v: z.enum(['top', 'center', 'bottom']).optional(),
})

const qrElementSchema = elementBaseSchema.extend({
  type: z.literal('qr'),
  data: z.string(),
  magnification: z.number().int().min(1).max(10).optional(),
  size_mode: z.enum(['fixed', 'max']).optional(),
  render_mode: z.enum(['zpl', 'image']).optional(),
  align_h: z.enum(['left', 'center', 'right']).optional(),
  align_v: z.enum(['top', 'center', 'bottom']).optional(),
  error_correction: z.enum(['L', 'M', 'Q', 'H']).optional(),
  input_mode: z.enum(['A', 'M']).optional(),
  character_mode: z.enum(['N', 'A']).optional(),
  quiet_zone_mm: z.number().min(0).optional(),
  theme: z
    .object({
      preset: z.enum(['classic', 'dots', 'rounded']).optional(),
      module_shape: z.enum(['square', 'circle', 'rounded']).optional(),
      finder_shape: z.enum(['square', 'circle', 'rounded']).optional(),
    })
    .optional(),
})

const dataMatrixElementSchema = elementBaseSchema.extend({
  type: z.literal('datamatrix'),
  data: z.string(),
  module_size_mm: z.number().positive().optional(),
  size_mode: z.enum(['fixed', 'max']).optional(),
  render_mode: z.enum(['zpl', 'image']).optional(),
  align_h: z.enum(['left', 'center', 'right']).optional(),
  align_v: z.enum(['top', 'center', 'bottom']).optional(),
  quality: z.literal(200).optional(),
  columns: z.number().int().min(0).max(49).optional(),
  rows: z.number().int().min(0).max(49).optional(),
  format_id: z.number().int().min(0).max(6).optional(),
  escape_char: z.string().min(1).max(1).optional(),
  quiet_zone_mm: z.number().min(0).optional(),
})

const imageSourceSchema = z.object({
  kind: z.enum(['base64', 'url']),
  data: z.string().min(1),
})

const imageElementSchema = elementBaseSchema.extend({
  type: z.literal('image'),
  source: imageSourceSchema,
  fit: z.enum(['none', 'contain', 'cover', 'stretch']).optional(),
  align_h: z.enum(['left', 'center', 'right']).optional(),
  align_v: z.enum(['top', 'center', 'bottom']).optional(),
  input_dpi: z.number().int().min(1).optional(),
  threshold: z.number().int().min(0).max(255).optional(),
  dither: z.enum(['none', 'floyd_steinberg', 'bayer']).optional(),
  invert: z.boolean().optional(),
})

const lineElementSchema = elementBaseSchema.extend({
  type: z.literal('line'),
  orientation: z.enum(['h', 'v']),
  thickness_mm: z.number().positive(),
  align: z.enum(['start', 'center', 'end']).optional(),
})

const elementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  qrElementSchema,
  dataMatrixElementSchema,
  imageElementSchema,
  lineElementSchema,
])

const leafSchemaRaw = z.object({
  kind: z.literal('leaf'),
  alias: z.string().min(1).optional(),
  padding_mm: paddingMmSchema.optional(),
  debug_border: z.boolean().optional(),
  elements: z.tuple([elementSchema]),
  extensions: z.record(z.unknown()).optional(),
})

let nodeSchemaRaw: z.ZodTypeAny

const splitSchemaRaw: z.ZodTypeAny = z.lazy(() =>
  z.object({
    kind: z.literal('split'),
    alias: z.string().min(1).optional(),
    direction: z.enum(['v', 'h']),
    ratio: z.number().gt(0).lt(1),
    gutter_mm: z.number().min(0).optional(),
    divider: dividerSchema.optional(),
    children: z.tuple([nodeSchemaRaw, nodeSchemaRaw]),
    extensions: z.record(z.unknown()).optional(),
  }),
)

nodeSchemaRaw = z.lazy(() => z.union([splitSchemaRaw, leafSchemaRaw]))

const templateDefaultsSchema = z.object({
  leaf_padding_mm: paddingMmSchema.optional(),
  text: z
    .object({
      font_height_mm: z.number().positive().optional(),
      font_width_mm: z.number().positive().optional(),
      wrap: z.enum(['none', 'word', 'char']).optional(),
      fit: z.enum(['overflow', 'wrap', 'shrink_to_fit', 'truncate']).optional(),
      max_lines: z.number().int().min(1).optional(),
      align_h: z.enum(['left', 'center', 'right']).optional(),
      align_v: z.enum(['top', 'center', 'bottom']).optional(),
    })
    .superRefine((value, ctx) => {
      const fit = value.fit
      const wrap = value.wrap
      if (fit === 'overflow' && wrap && wrap !== 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wrap must be none when fit is overflow',
          path: ['wrap'],
        })
      }
      if ((fit === 'wrap' || fit === 'truncate' || fit === 'shrink_to_fit') && wrap === 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wrap must be word or char when fit is wrap, truncate, or shrink_to_fit',
          path: ['wrap'],
        })
      }
      if (wrap === 'none' && fit && fit !== 'overflow') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fit must be overflow when wrap is none',
          path: ['fit'],
        })
      }
    })
    .optional(),
  code2d: z
    .object({
      quiet_zone_mm: z.number().min(0).optional(),
      size_mode: z.enum(['fixed', 'max']).optional(),
      align_h: z.enum(['left', 'center', 'right']).optional(),
      align_v: z.enum(['top', 'center', 'bottom']).optional(),
      render_mode: z.enum(['zpl', 'image']).optional(),
    })
    .optional(),
  image: z
    .object({
      fit: z.enum(['none', 'contain', 'cover', 'stretch']).optional(),
      align_h: z.enum(['left', 'center', 'right']).optional(),
      align_v: z.enum(['top', 'center', 'bottom']).optional(),
      input_dpi: z.number().int().min(1).optional(),
      threshold: z.number().int().min(0).max(255).optional(),
      dither: z.enum(['none', 'floyd_steinberg', 'bayer']).optional(),
      invert: z.boolean().optional(),
    })
    .optional(),
  render: z
    .object({
      missing_variables: z.enum(['error', 'empty']).optional(),
      emit_ci28: z.boolean().optional(),
      debug_padding_guides: z.boolean().optional(),
      debug_gutter_guides: z.boolean().optional(),
    })
    .optional(),
})

const templateSchema = z
  .object({
    schema_version: z.literal(1),
    name: z.string().min(1).optional(),
    defaults: templateDefaultsSchema.optional(),
    layout: nodeSchemaRaw,
    extensions: z.record(z.unknown()).optional(),
  })
  .superRefine((doc, ctx) => {
    const aliases = new Set<string>()
    const validateFitWrap = (fit: any, wrap: any, path: (string | number)[]) => {
      if (fit === 'overflow' && wrap && wrap !== 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wrap must be none when fit is overflow',
          path: [...path, 'wrap'],
        })
      }
      if ((fit === 'wrap' || fit === 'truncate' || fit === 'shrink_to_fit') && wrap === 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wrap must be word or char when fit is wrap, truncate, or shrink_to_fit',
          path: [...path, 'wrap'],
        })
      }
      if (wrap === 'none' && fit && fit !== 'overflow') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fit must be overflow when wrap is none',
          path: [...path, 'fit'],
        })
      }
    }

    const walk = (node: any, path: (string | number)[]) => {
      if (node.alias) {
        if (aliases.has(node.alias)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate alias: ${node.alias}`,
            path: [...path, 'alias'],
          })
        } else {
          aliases.add(node.alias)
        }
      }

      if (node.kind === 'split') {
        const gutter = node.gutter_mm ?? 0
        const divider = node.divider
        if (divider?.visible) {
          const thick = divider.thickness_mm ?? 0.3
          if (gutter < thick) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'gutter_mm must be >= divider.thickness_mm when divider is visible',
              path: [...path, 'divider'],
            })
          }
        }
        walk(node.children[0], [...path, 'children', 0])
        walk(node.children[1], [...path, 'children', 1])
      } else if (node.kind === 'leaf') {
        const element = node.elements?.[0]
        if (element?.type === 'text') {
          validateFitWrap(element.fit, element.wrap, [...path, 'elements', 0])
        }
        if (element?.type === 'qr') {
          if (element.input_mode === 'M' && !element.character_mode) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'character_mode is required when input_mode is M',
              path: [...path, 'elements', 0, 'character_mode'],
            })
          }
          if (element.character_mode && element.input_mode !== 'M') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'input_mode must be M when character_mode is set',
              path: [...path, 'elements', 0, 'input_mode'],
            })
          }
        }
      }
    }

    if (doc.defaults?.text) {
      validateFitWrap(doc.defaults.text.fit, doc.defaults.text.wrap, ['defaults', 'text'])
    }
    walk(doc.layout, ['layout'])
  })

export function validateTemplate(
  value: unknown,
): { ok: true; doc: TemplateDoc } | { ok: false; issues: string[] } {
  const res = templateSchema.safeParse(value)
  if (res.success) return { ok: true, doc: res.data as TemplateDoc }
  return {
    ok: false,
    issues: res.error.issues.map((i) => `${i.path.join('.') || '$'}: ${i.message}`),
  }
}
