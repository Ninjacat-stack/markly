import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { API_BASE, apiDownload, apiGet } from '../lib/api.js'
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx'

export default function AssignmentView() {
  const { id } = useParams()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const { data, isPending, error: loadError } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => apiGet(`/api/v1/assignments/${id}`),
  })

  async function download(kind) {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'docx') await apiDownload(`/api/v1/assignments/${id}/docx`, `assignment-${id}.docx`)
      if (kind === 'pdf') await apiDownload(`/api/v1/assignments/${id}/pdf`, `assignment-${id}.pdf`)
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy('')
    }
  }

  if (isPending) return <p className="px-6 py-10">Loading…</p>
  if (loadError) return <div className="px-6 py-10"><ErrorText error={loadError} /></div>

  const c = data.content
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold">{c.experimentNumber ? `Experiment ${c.experimentNumber}: ` : ''}{c.title}</h2>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink-500">
        <Badge>{data.template?.id ?? 'default'} v{data.template?.version ?? 1}</Badge>
        <Badge>{data.provenance?.provider}/{data.provenance?.model}</Badge>
        <Badge>prompt {data.provenance?.promptVersion}</Badge>
        {data.editedByUser && <Badge>user-edited</Badge>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/assignments/${id}/edit`}><Button variant="secondary">Edit sections</Button></Link>
        <Link to={`/assignments/${id}/edit?tab=latex`}><Button variant="secondary">LaTeX (Monaco)</Button></Link>
        <Button variant="secondary" disabled={busy !== ''} onClick={() => download('docx')}>
          {busy === 'docx' ? 'Preparing…' : 'Export DOCX'}
        </Button>
        <Button variant="secondary" disabled={busy !== ''} onClick={() => download('pdf')}>
          {busy === 'pdf' ? 'Compiling…' : 'Export PDF'}
        </Button>
      </div>
      <ErrorText error={error} />

      {(data.sources?.length > 0) && (
        <Card className="mt-4">
          <h3 className="font-semibold">Sources used ({data.sources.length})</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {data.sources.map((s, i) => (
              <li key={i}><a className="text-jira-600 underline" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a></li>
            ))}
          </ul>
        </Card>
      )}

      <h3 className="mt-6 font-semibold">Document preview (header + watermark on every page)</h3>
      <iframe title="Assignment document" src={`${API_BASE}/api/v1/assignments/${id}/html`}
        className="mt-2 h-[640px] w-full rounded-md border border-line bg-white" />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-500">Provenance & raw JSON</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-ink-900 p-3 text-xs text-white">
          {JSON.stringify({ provenance: data.provenance, content: c }, null, 2)}
        </pre>
      </details>
    </div>
  )
}
