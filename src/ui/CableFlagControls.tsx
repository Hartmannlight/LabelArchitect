import { cableFlagGeometry, type CableFlagConfig } from '../model/cableFlag'
import type { LabelPreviewTarget } from '../model/types'

export default function CableFlagControls({ config, target, onChange, disabled = false }: { config: CableFlagConfig; target: Pick<LabelPreviewTarget, 'width_mm' | 'height_mm'>; onChange: (config: CableFlagConfig) => void; disabled?: boolean }) {
  let description: string
  let error = false
  try {
    const geometry = cableFlagGeometry(target, config)
    description = `Cable wrap: ${geometry.circumference.toFixed(1)} mm. Each face projects ${geometry.faceLength.toFixed(1)} mm; ${geometry.textLength.toFixed(1)} mm remain for text after padding and the 1.5 mm outer margin.`
  } catch (reason) { description = String((reason as Error).message); error = true }
  return <section className='property-card'><header><h3>Cable flag</h3><p>The short edge runs along the cable. Fold across the long edge, then stick the two adhesive faces together.</p></header><div className='property-grid'>
    <label className='property-field'><span>Cable diameter (mm)</span><input type='number' min='0.1' step='0.1' disabled={disabled} value={config.diameter_mm} onChange={(event) => onChange({ ...config, diameter_mm: Number(event.target.value) })} /></label>
    <label className='property-field'><span>Text to cable padding (mm)</span><input type='number' min='0' step='0.1' disabled={disabled} value={config.text_padding_mm} onChange={(event) => onChange({ ...config, text_padding_mm: Number(event.target.value) })} /></label>
  </div><p className={error ? 'text-danger' : 'field-help'} role={error ? 'alert' : undefined}>{description}</p></section>
}
