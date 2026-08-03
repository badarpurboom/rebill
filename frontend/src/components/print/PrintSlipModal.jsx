import { useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

const WIDTHS = [
  { value: '80', label: '80mm' },
  { value: '58', label: '58mm' },
]

/**
 * Shows a thermal slip at true paper width and prints it.
 *
 * The preview is the same DOM that goes to the printer, so a cashier can catch
 * a wrong table or a missing item before wasting a roll.
 */
export default function PrintSlipModal({ title, subtitle, onClose, footerExtra, children }) {
  const slipRef = useRef(null)
  const [width, setWidth] = useState('80')

  const print = useReactToPrint({
    contentRef: slipRef,
    pageStyle: `
      @page { size: ${width}mm auto; margin: 0; }
      @media print { body { margin: 0; } }
    `,
  })

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          {footerExtra}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={print}>🖨 Print</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {WIDTHS.map((w) => (
          <button
            key={w.value}
            onClick={() => setWidth(w.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              width === w.value ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            {w.label} roll
          </button>
        ))}
      </div>

      <div className="flex justify-center rounded-lg bg-slate-100 p-4">
        {/* data-slip-width drives the paper width in CSS, so the preview and
            the printed roll stay a single source of truth. */}
        <div ref={slipRef} data-slip-width={width} className="shadow-lg">
          {children}
        </div>
      </div>
    </Modal>
  )
}
