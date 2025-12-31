export type SchemaVersion = 1

export type Direction = 'v' | 'h'

export type PaddingMm = [number, number, number, number]

export type Divider = {
  visible?: boolean
  thickness_mm?: number
}

export type TemplateDefaults = {
  leaf_padding_mm?: PaddingMm
  text?: {
    font_height_mm?: number
    font_width_mm?: number
    wrap?: 'none' | 'word' | 'char'
    fit?: 'overflow' | 'wrap' | 'shrink_to_fit' | 'truncate'
    max_lines?: number
    align_h?: 'left' | 'center' | 'right'
    align_v?: 'top' | 'center' | 'bottom'
  }
  code2d?: {
    quiet_zone_mm?: number
    size_mode?: 'fixed' | 'max'
    align_h?: 'left' | 'center' | 'right'
    align_v?: 'top' | 'center' | 'bottom'
    render_mode?: 'zpl' | 'image'
  }
  image?: {
    fit?: 'none' | 'contain' | 'cover' | 'stretch'
    align_h?: 'left' | 'center' | 'right'
    align_v?: 'top' | 'center' | 'bottom'
    input_dpi?: number
    threshold?: number
    dither?: 'none' | 'floyd_steinberg' | 'bayer'
    invert?: boolean
  }
  render?: {
    missing_variables?: 'error' | 'empty'
    emit_ci28?: boolean
    debug_padding_guides?: boolean
    debug_gutter_guides?: boolean
  }
}

export type ElementBase = {
  id?: string
  padding_mm?: PaddingMm
  min_size_mm?: [number, number]
  max_size_mm?: [number, number]
  extensions?: Record<string, unknown>
}

export type TextElement = ElementBase & {
  type: 'text'
  text: string
  font_height_mm?: number
  font_width_mm?: number
  wrap?: 'none' | 'word' | 'char'
  fit?: 'overflow' | 'wrap' | 'shrink_to_fit' | 'truncate'
  max_lines?: number
  align_h?: 'left' | 'center' | 'right'
  align_v?: 'top' | 'center' | 'bottom'
}

export type QrElement = ElementBase & {
  type: 'qr'
  data: string
  magnification?: number
  size_mode?: 'fixed' | 'max'
  render_mode?: 'zpl' | 'image'
  align_h?: 'left' | 'center' | 'right'
  align_v?: 'top' | 'center' | 'bottom'
  error_correction?: 'L' | 'M' | 'Q' | 'H'
  input_mode?: 'A' | 'M'
  character_mode?: 'N' | 'A'
  quiet_zone_mm?: number
  theme?: {
    preset?: 'classic' | 'dots' | 'rounded'
    module_shape?: 'square' | 'circle' | 'rounded'
    finder_shape?: 'square' | 'circle' | 'rounded'
  }
}

export type DataMatrixElement = ElementBase & {
  type: 'datamatrix'
  data: string
  module_size_mm?: number
  size_mode?: 'fixed' | 'max'
  render_mode?: 'zpl' | 'image'
  align_h?: 'left' | 'center' | 'right'
  align_v?: 'top' | 'center' | 'bottom'
  quality?: 200
  columns?: number
  rows?: number
  format_id?: number
  escape_char?: string
  quiet_zone_mm?: number
}

export type ImageSource = {
  kind: 'base64' | 'url'
  data: string
}

export type ImageElement = ElementBase & {
  type: 'image'
  source: ImageSource
  fit?: 'none' | 'contain' | 'cover' | 'stretch'
  align_h?: 'left' | 'center' | 'right'
  align_v?: 'top' | 'center' | 'bottom'
  input_dpi?: number
  threshold?: number
  dither?: 'none' | 'floyd_steinberg' | 'bayer'
  invert?: boolean
}

export type LineElement = ElementBase & {
  type: 'line'
  orientation: 'h' | 'v'
  thickness_mm: number
  align?: 'start' | 'center' | 'end'
}

export type Element = TextElement | QrElement | DataMatrixElement | ImageElement | LineElement

export type SplitNode = {
  kind: 'split'
  alias?: string
  direction: Direction
  ratio: number
  gutter_mm?: number
  divider?: Divider
  children: [Node, Node]
  extensions?: Record<string, unknown>
}

export type LeafNode = {
  kind: 'leaf'
  alias?: string
  padding_mm?: PaddingMm
  debug_border?: boolean
  elements: [Element]
  extensions?: Record<string, unknown>
}

export type Node = SplitNode | LeafNode

export type TemplateDoc = {
  schema_version: SchemaVersion
  name?: string
  defaults?: TemplateDefaults
  layout: Node
  extensions?: Record<string, unknown>
}

export type LabelPreviewTarget = {
  width_mm: number
  height_mm: number
  dpi: number
}
