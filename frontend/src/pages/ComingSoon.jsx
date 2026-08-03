import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'

/**
 * Placeholder for pages that land in later build sessions. Keeping the routes
 * real (instead of hiding the nav) means the shell, guards and layout are
 * already proven by the time the feature arrives.
 */
export default function ComingSoon({ icon = '🚧', title, session, features = [] }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <span className="text-6xl" aria-hidden>
        {icon}
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      {session && (
        <p className="text-brand-700 bg-brand-50 mt-2 rounded-full px-3 py-1 text-xs font-semibold">
          Build Session {session}
        </p>
      )}

      {features.length > 0 && (
        <ul className="mt-6 w-full space-y-2 text-left">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600"
            >
              <span className="text-slate-300">○</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      <Link to="/" className="mt-8">
        <Button variant="secondary">← Back to Dashboard</Button>
      </Link>
    </div>
  )
}
