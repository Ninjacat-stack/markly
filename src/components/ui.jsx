// Minimal shadcn-style primitives (Button/Card/Input/Textarea/Field/Badge).
export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-jira-600 text-white hover:bg-jira-700',
    secondary: 'border border-line bg-white text-ink-900 hover:bg-rail',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return <button className={`${base} ${styles[variant] ?? styles.primary} ${className}`} {...props} />
}

export function Card({ className = '', ...props }) {
  return <div className={`rounded-lg border border-line bg-white p-4 shadow-sm ${className}`} {...props} />
}

export function Field({ label, children }) {
  return (
    <label className="mb-3 flex flex-col gap-1 text-left text-sm">
      <span className="font-medium text-ink-700">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'rounded-md border border-line bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-jira-600 focus:outline-none'

export function Badge({ children }) {
  return (
    <span className="inline-block rounded-full bg-jira-50 px-2.5 py-0.5 text-xs font-medium text-jira-700">
      {children}
    </span>
  )
}

export function ErrorText({ error }) {
  if (!error) return null
  return <p className="mt-2 text-sm text-red-600">{String(error.message ?? error)}</p>
}

export function StatusBadge({ status }) {
  const colors = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  const cls = colors[status] ?? 'bg-slate-100 text-slate-700'
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
}
