import { useState } from 'react'
import { parse } from 'yaml'
import { backendBase, buildApiUrl } from '../api/config'
import { registryRequest, registrationPayload, settingsPayload } from '../api/printerRegistry'
import { errorText } from '../api/errorText'

type Notice = { tone: 'success' | 'error' | 'info'; text: string }
type Props = { onChanged: () => Promise<void>; onNotice: (notice: Notice) => void }

export function PrinterDiscoveryControls({ onChanged, onNotice }: Props) {
  const [agents, setAgents] = useState<Array<Record<string, any>>>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [url, setUrl] = useState('')
  const [candidate, setCandidate] = useState<{ baseUrl: string; id: string; agentId?: string } | null>(null)
  const [form, setForm] = useState({ name: '' })
  const scan = async (manual = false) => {
    setBusy(true)
    try {
      const result = manual
        ? await registryRequest(backendBase, '/v1/zebra-tamer/discover', { base_url: url })
        : await registryRequest(backendBase, '/v1/zebra-tamer/agents', undefined, 'GET')
      setAgents(result.agents ?? []); setSearched(true)
      await onChanged()
      if (result.warning) onNotice({ tone: 'info', text: result.warning })
    } catch (error) { onNotice({ tone: 'error', text: errorText(error) }) }
    finally { setBusy(false) }
  }
  const register = async () => {
    if (!candidate) return
    setBusy(true)
    try {
      const result = await registryRequest(backendBase, '/v1/printers/register', registrationPayload(candidate.baseUrl, candidate.id, form, candidate.agentId))
      setCandidate(null)
      setAgents((current) => current.map((agent) => ({ ...agent, printers: agent.printers.map((printer: any) =>
        agent.base_url === candidate.baseUrl && printer.id === candidate.id ? { ...printer, registered_id: result.id } : printer) })))
      await onChanged()
      onNotice({ tone: 'success', text: `${result.name} registered. Existing settings were preserved.` })
    } catch (error) { onNotice({ tone: 'error', text: errorText(error) }) }
    finally { setBusy(false) }
  }
  const importFile = async (file: File) => {
    setBusy(true)
    try {
      await registryRequest(backendBase, '/v1/printer-registry/import', parse(await file.text()))
      await onChanged()
      onNotice({ tone: 'success', text: 'YAML imported. Existing printers were not overwritten.' })
    } catch (error) { onNotice({ tone: 'error', text: errorText(error) }) }
    finally { setBusy(false) }
  }
  return <section className='discovery-panel'>
    <h2>Add and discover printers</h2>
    <p>Discovery refreshes addresses and availability. It never replaces saved printer settings.</p>
    <div className='registry-actions'>
      <button type='button' className='primary-action' disabled={busy} onClick={() => void scan()}>{busy ? 'Working…' : 'Discover / refresh agents'}</button>
      <a href={buildApiUrl(backendBase, '/v1/printer-registry/export')} download='printers.yml'>Export YAML</a>
      <label className='registry-import'>Import YAML<input type='file' accept='.yml,.yaml' disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }} /></label>
    </div>
    <form className='registry-actions' onSubmit={(event) => { event.preventDefault(); void scan(true) }}>
      <label className='field'><span>Manual ZebraTamer URL</span><input type='url' value={url} placeholder='http://192.168.1.50:8080' required onChange={(event) => setUrl(event.target.value)} /></label>
      <button type='submit' disabled={busy || !url}>Find at address</button>
    </form>
    {searched && agents.length === 0 && <p>No agents found. Registered printers remain available below. Try a manual URL if multicast is unavailable.</p>}
    {agents.map((agent) => <div className='agent-row' key={agent.base_url}>
      <div><strong>{agent.base_url}</strong><span>{agent.available ? agent.agent_id ?? 'Legacy agent: address-bound identity; update ZebraTamer for safe IP changes.' : agent.error}</span></div>
      <div>{(agent.printers ?? []).map((printer: any) => <div key={printer.id}>
        <button type='button' disabled={busy || Boolean(printer.registered_id) || Boolean(printer.registration_conflict)} onClick={() => {
          setCandidate({ baseUrl: agent.base_url, id: printer.id, agentId: agent.agent_id }); setForm({ name: printer.display_name ?? printer.id })
        }}>{printer.registered_id ? 'Registered: ' : 'Add '}{printer.display_name ?? printer.id}</button>
        {printer.registration_conflict && <p role='alert'>{printer.registration_conflict}</p>}
      </div>)}</div>
    </div>)}
    {candidate && <form className='registry-editor' onSubmit={(event) => { event.preventDefault(); void register() }}>
      <h3>Add ZebraTamer printer</h3><p>Media and resolution are read from ZebraTamer. Set up the loaded roll there before adding this printer. <a href={`${candidate.baseUrl}/ui/?printer=${encodeURIComponent(candidate.id)}`} target='_blank' rel='noreferrer'>Open ZebraTamer</a></p>
      <div className='registry-fields'>{([['name', 'Name']] as const).map(([key, label]) =>
        <label className='field' key={key}><span>{label}</span><input required type='text' value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}</div>
      <div className='registry-actions'><button type='submit' disabled={busy}>Confirm and add</button><button type='button' disabled={busy} onClick={() => setCandidate(null)}>Cancel</button></div>
    </form>}
  </section>
}

export function PrinterSettingsEditor({ printer, onChanged, onNotice, onClose }: Props & { printer: Record<string, any>; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const zplDriver = printer.driver === 'zpl' || Boolean(printer.zpl)
  const [fields, setFields] = useState<Record<string, string | boolean>>({ name: printer.name, enabled: printer.enabled,
    width: String(printer.media.loaded.width_mm), height: String(printer.media.loaded.height_mm), dpi: String(printer.alignment.dpi),
    offsetX: String(printer.alignment.offset_x_mm), offsetY: String(printer.alignment.offset_y_mm),
    darkness: String(printer.zpl?.darkness ?? ''), speed: String(printer.zpl?.print_speed ?? ''), copies: String(printer.defaults.copies), rotation: String(printer.defaults.rotation) })
  const dynamic = Boolean(printer.media.dynamic_source)
  const agentManaged = printer.connection?.protocol === 'zebra_tamer'
  const save = async () => {
    setBusy(true)
    try {
      await registryRequest(backendBase, `/v1/printers/${encodeURIComponent(printer.id)}`, settingsPayload(printer, fields), 'PATCH')
      await onChanged(); onClose(); onNotice({ tone: 'success', text: 'Printer settings saved.' })
    } catch (error) { onNotice({ tone: 'error', text: errorText(error) }) }
    finally { setBusy(false) }
  }
  return <section className='discovery-panel registry-editor'>
    <form onSubmit={(event) => { event.preventDefault(); void save() }}>
      <h2>Edit {printer.name}</h2><p>Device identity and connection are managed separately. Saving never reassigns this printer.</p>
      {dynamic && <p>Label size and DPI come from the emulator. Change them in the emulator settings.</p>}
      {agentManaged && <p>Loaded media, color, alignment and device settings are managed by ZebraTamer. <a href={`${printer.connection.base_url}/ui/?printer=${encodeURIComponent(printer.connection.printer_id)}`} target='_blank' rel='noreferrer'>Open ZebraTamer settings</a> (requires its optional WebUI).</p>}
      {!zplDriver && <p>Driver-specific settings are owned by the {printer.driver} adapter and are not interpreted by PrintHub Studio.</p>}
      <div className='registry-fields'>{[['name', 'Name'], ['width', 'Label width (mm)'], ['height', 'Label height (mm)'], ['dpi', 'Resolution (dpi)'], ['offsetX', 'X offset (mm)'], ['offsetY', 'Y offset (mm)'], ['darkness', 'Darkness'], ['speed', 'Print speed'], ['copies', 'Copies'], ['rotation', 'Rotation (0, 90, 180, 270)']].filter(([key]) => (!agentManaged || ['name', 'copies', 'rotation'].includes(key)) && (zplDriver || !['darkness', 'speed'].includes(key))).map(([key, label]) =>
        <label className='field' key={key}><span>{label}</span><input required disabled={dynamic && ['width', 'height', 'dpi'].includes(key)} type={key === 'name' ? 'text' : 'number'} step='any' value={String(fields[key])} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /></label>)}</div>
      <label className='registry-enabled'><input type='checkbox' checked={Boolean(fields.enabled)} onChange={(event) => setFields({ ...fields, enabled: event.target.checked })} /> Enabled for printing</label>
      <div className='registry-actions'><button type='submit' disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button><button type='button' disabled={busy} onClick={onClose}>Cancel</button></div>
    </form>
  </section>
}
