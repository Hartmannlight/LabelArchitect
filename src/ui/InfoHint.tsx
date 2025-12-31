type Props = {
  text: string
}

export default function InfoHint(props: Props) {
  return (
    <span className='relative group inline-flex items-center overflow-visible'>
      <span className='ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-strong)] text-[10px] leading-none text-subtle'>
        ?
      </span>
      <span className='pointer-events-none absolute left-0 top-5 z-20 hidden w-60 max-w-[240px] rounded border panel p-2 text-xs text-strong shadow-lg group-hover:block'>
        {props.text}
      </span>
    </span>
  )
}
