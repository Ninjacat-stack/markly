import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { apiGet } from '../lib/api.js'
import { Badge, Card, ErrorText, StatusBadge } from '../components/ui.jsx'

export default function History() {
  const { data, isPending, error } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => apiGet('/api/v1/assignments'),
  })
  if (isPending) return <p className="px-6 py-10">Loading…</p>
  if (error) return <div className="px-6 py-10"><ErrorText error={error} /></div>
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="text-2xl font-bold">Generation history</h2>
      {!data.assignments.length && <p className="mt-4 text-ink-500">Nothing yet — <Link className="underline" to="/create">create one</Link>.</p>}
      <div className="mt-4 grid gap-3">
        {data.assignments.map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between gap-2">
              <Link className="font-semibold hover:underline" to={`/assignments/${a.id}`}>
                {a.title || a.aim}
              </Link>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">{a.aim}</p>
            <div className="mt-2 flex gap-2 text-xs">
              <Badge>{a.template?.id} v{a.template?.version}</Badge>
              <Badge>{new Date(a.createdAt).toLocaleString()}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function Templates() {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet('/api/v1/templates'),
  })

  async function upload(e) {
    e.preventDefault()
    setMsg('')
    if (!file) { setMsg('Choose a sample PDF first.'); return }
    try {
      const { apiUploadPdf } = await import('../lib/api.js')
      const out = await apiUploadPdf('/api/v1/templates/from-pdf', file, { name })
      setMsg(`Draft saved: ${out.template.name} (v${out.template.version}, ${out.template.status}). Detected: ${out.analysis.detectedHeadings.join(', ')}`)
      setFile(null)
      setName('')
      refetch()
    } catch (err) {
      setMsg(String(err.message ?? err))
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="text-2xl font-bold">Templates</h2>
      {isPending && <p className="mt-4">Loading…</p>}
      {error && <ErrorText error={error} />}
      <div className="mt-4 grid gap-3">
        {data?.templates.map((t) => (
          <Card key={`${t.id}@${t.version}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t.name}</span>
              <Badge>v{t.version} · {t.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-500">{t.id} · tenant {t.tenantId ?? '—'} · dept {t.departmentId ?? '—'}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h3 className="font-semibold">Create template from sample PDF</h3>
        <form className="mt-2 flex flex-col gap-2" onSubmit={upload}>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input className="rounded-md border border-line px-3 py-2 text-sm" placeholder="Template name (optional)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="inline-flex w-fit items-center rounded-md bg-jira-600 px-4 py-2 text-sm font-medium text-white hover:bg-jira-700">
            Analyze & save draft
          </button>
        </form>
        {msg && <p className="mt-2 text-sm text-ink-700">{msg}</p>}
      </Card>
    </div>
  )
}
