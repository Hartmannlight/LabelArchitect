import type { PrinterStatusResponse } from '@printhub/sdk'

type PrinterDetails = Record<string, any>
type PrinterClient = {
  get: (id: string) => Promise<PrinterDetails>
  getStatus: (id: string) => Promise<PrinterStatusResponse>
}

export function supportsLiveStatus(printer: PrinterDetails): boolean {
  return printer.enabled !== false && printer.capabilities?.supports_status === true
}

export async function refreshPrinter(printerId: string, client: PrinterClient) {
  // Reload capabilities and media first; they may have changed since the page opened.
  const printer = await client.get(printerId)
  const status = supportsLiveStatus(printer) ? await client.getStatus(printerId) : null
  return { printer, status }
}
