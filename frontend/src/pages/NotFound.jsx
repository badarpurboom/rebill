import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="text-lg font-semibold text-slate-800">Page not found</h1>
      <p className="text-sm text-slate-500">The link is incorrect or the page does not exist yet.</p>
      <Link to="/" className="mt-3">
        <Button variant="secondary">← Back to Dashboard</Button>
      </Link>
    </div>
  )
}
