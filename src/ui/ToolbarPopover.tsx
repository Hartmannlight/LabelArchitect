import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

export default function ToolbarPopover({ label, trigger, children, align = 'left' }: {
  label: string
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return <div ref={root} className={`toolbar-popover toolbar-popover-${align}`} onKeyDown={(event) => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    button.current?.focus()
  }} onBlur={(event) => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button ref={button} type='button' className='toolbar-popover-trigger' aria-label={label} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}>{trigger}</button>
    {open && <div id={panelId} className='toolbar-popover-panel' role='group' aria-label={label}>
      {typeof children === 'function' ? children(() => setOpen(false)) : children}
    </div>}
  </div>
}
