import { forwardRef } from 'react'

/**
 * Kitchen ticket for a 58/80mm thermal roll.
 *
 * Monospace, big type, no prices — the kitchen needs table, quantity and item,
 * and nothing that costs a second glance at 2am.
 */
const ThermalKOT = forwardRef(function ThermalKOT({ kot }, ref) {
  if (!kot) return null

  const stamp = new Date(kot.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div ref={ref} className="thermal-slip font-mono text-black">
      <div className="text-center">
        <p className="text-lg font-bold">** KOT **</p>
        <p className="text-2xl font-bold">#{kot.number}</p>
        {(!kot.table_number || kot.table_number === 'Takeaway') && (
          <p className="text-sm font-black bg-black text-white px-2 py-0.5 mt-1 inline-block">
            *** TAKEAWAY / PARCEL ***
          </p>
        )}
      </div>

      <Divider />

      <div className="flex justify-between text-sm font-bold">
        <span>{(!kot.table_number || kot.table_number === 'Takeaway') ? '🛍️ TAKEAWAY' : `TABLE ${kot.table_number}`}</span>
        <span>{stamp}</span>
      </div>
      <p className="text-[11px]">By: {kot.created_by_name}</p>

      <Divider />

      <table className="w-full text-sm">
        <tbody>
          {kot.items.map((line) => (
            <tr key={line.id} className="align-top">
              <td className="w-8 pb-1.5 font-bold">{line.quantity}x</td>
              <td className="pb-1.5">
                <span className="font-bold">{line.item_name}</span>
                {line.portion === 'HALF' && <span className="ml-1">(Half)</span>}
                {line.portion === 'FULL' && <span className="ml-1">(Full)</span>}
                {line.note && <div className="text-[11px] italic">↳ {line.note}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Divider />
      <p className="text-center text-[11px]">
        {kot.items.reduce((n, l) => n + l.quantity, 0)} items
      </p>
    </div>
  )
})

function Divider() {
  return <p className="my-1.5 overflow-hidden text-[10px] leading-none">{'-'.repeat(64)}</p>
}

export default ThermalKOT
