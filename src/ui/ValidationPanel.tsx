type Props = { issues: string[] }

export default function ValidationPanel(props: Props) {
  return (
    <div className='px-3 py-2'>
      {props.issues.length === 0 ? (
        <div className='text-sm text-success'>Valid template</div>
      ) : (
        <div className='space-y-1'>
          <div className='text-sm text-warn'>Validation issues ({props.issues.length})</div>
          <div className='max-h-28 overflow-auto text-xs text-strong'>
            <ul className='list-disc pl-5 space-y-1'>
              {props.issues.map((i, idx) => (
                <li key={idx} className='font-mono'>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
