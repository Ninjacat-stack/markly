import Editor from '@monaco-editor/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../lib/api.js'
import { Button, Card, ErrorText, inputCls } from '../components/ui.jsx'

const SECTIONS = ['title', 'aim', 'objectives', 'theory', 'steps', 'conclusion']

function toText(section, value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function fromText(section, text) {
  if (['title', 'aim', 'conclusion'].includes(section)) return text
  return JSON.parse(text) // objectives/theory/steps are JSON arrays
}

export default function AssignmentEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'latex' ? 'latex' : 'sections')
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [latex, setLatex] = useState(null)
  const qc = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => apiGet(`/api/v1/assignments/${id}`),
  })

  async function loadLatex() {
    setBusy('latex-load')
    setError('')
    try {
      const res = await apiGet(`/api/v1/assignments/${id}/latex`)
      setLatex(res.latex)
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy('')
    }
  }

  async function saveLatex() {
    setBusy('latex-save')
    setError('')
    try {
      await apiPut(`/api/v1/assignments/${id}/latex`, { latex })
      await qc.invalidateQueries({ queryKey: ['assignment', id] })
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy('')
    }
  }

  async function regenerate(section) {
    setBusy(`regen-${section}`)
    setError('')
    try {
      const updated = await apiPost(`/api/v1/assignments/${id}/regenerate-section`, { section })
      setDrafts((d) => ({ ...d, [section]: undefined }))
      await qc.invalidateQueries({ queryKey: ['assignment', id] })
      return updated
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy('')
    }
  }

  async function saveAll() {
    setBusy('save')
    setError('')
    try {
      const content = { ...data.content }
      for (const s of SECTIONS) {
        if (drafts[s] !== undefined) content[s] = fromText(s, drafts[s])
      }
      await apiPut(`/api/v1/assignments/${id}`, { content })
      setDrafts({})
      await qc.invalidateQueries({ queryKey: ['assignment', id] })
    } catch (e) {
      setError(String(e.message ?? e))
    } finally {
      setBusy('')
    }
  }

  if (isPending) return <p className="px-6 py-10">Loading…</p>

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="text-2xl font-bold">Edit assignment</h2>
      <div className="mt-3 flex gap-2">
        <Button variant={tab === 'sections' ? 'primary' : 'secondary'} onClick={() => setTab('sections')}>Sections</Button>
        <Button variant={tab === 'latex' ? 'primary' : 'secondary'} onClick={() => { setTab('latex'); if (latex === null) loadLatex() }}>LaTeX</Button>
      </div>

      {tab === 'sections' && (
        <div className="mt-4">
          {SECTIONS.map((s) => (
            <Card key={s} className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold capitalize">{s}</h3>
                <Button variant="secondary" disabled={busy !== ''} onClick={() => regenerate(s)}>
                  {busy === `regen-${s}` ? 'Regenerating…' : 'Regenerate'}
                </Button>
              </div>
              <textarea
                className={`${inputCls} font-mono text-xs`} rows={s === 'title' || s === 'aim' ? 2 : 6}
                value={drafts[s] ?? toText(s, data.content[s])}
                onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))}
              />
              {!['title', 'aim', 'conclusion'].includes(s) && (
                <p className="mt-1 text-xs text-ink-400">JSON array — keep valid JSON for objectives / theory / steps.</p>
              )}
            </Card>
          ))}
          <Button disabled={busy !== ''} onClick={saveAll}>{busy === 'save' ? 'Saving…' : 'Save all sections'}</Button>
          <ErrorText error={error} />
        </div>
      )}

      {tab === 'latex' && (
        <Card className="mt-4">
          <p className="mb-2 text-sm text-ink-500">Edit LaTeX source, save, then export PDF from the preview page. Compiles in an isolated container.</p>
          <Editor height="60vh" language="latex" value={latex ?? 'Loading…'} onChange={(v) => setLatex(v ?? '')}
            options={{ minimap: { enabled: false }, wordWrap: 'on' }} />
          <div className="mt-3 flex gap-2">
            <Button disabled={busy !== ''} onClick={saveLatex}>{busy === 'latex-save' ? 'Saving…' : 'Save LaTeX'}</Button>
            <Button variant="secondary" disabled={busy !== ''} onClick={loadLatex}>Reload</Button>
          </div>
          <ErrorText error={error} />
        </Card>
      )}
    </div>
  )
}
