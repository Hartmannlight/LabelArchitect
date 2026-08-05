import { parse } from 'yaml'
import defaultsSource from './designer-defaults.yml?raw'
import type { TemplateDefaults } from '../model/types'

type ProjectDefaultsFile = {
  template_defaults: TemplateDefaults
  element_defaults?: {
    qr?: { render_mode?: 'zpl' | 'image' }
    datamatrix?: { render_mode?: 'zpl' | 'image' }
  }
}

function readProjectDefaults(): ProjectDefaultsFile {
  const parsed = parse(defaultsSource)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('designer-defaults.yml must contain a YAML object')
  }
  if (!('template_defaults' in parsed)) {
    throw new Error('designer-defaults.yml must define template_defaults')
  }
  return parsed as ProjectDefaultsFile
}

const projectConfig = readProjectDefaults()

export const PROJECT_DEFAULTS = projectConfig.template_defaults
export const PROJECT_ELEMENT_DEFAULTS = projectConfig.element_defaults ?? {}

export function cloneProjectDefaults(): TemplateDefaults {
  return structuredClone(PROJECT_DEFAULTS)
}
