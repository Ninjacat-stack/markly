import { useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000'
const SUBJECTS = ['DBMS', 'DSA', 'UHV', 'DLDCA', 'Professional Skills / AWS']

const field = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, textAlign: 'left' }

export default function App() {
  const [aim, setAim] = useState('Explore subqueries in SQL')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('DBMS')
  const [experimentNumber, setExperimentNumber] = useState('7')
  const [technology, setTechnology] = useState('SQL')
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function onGenerate(e) {
    e.preventDefault()
    setStatus('generating')
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/v1/assignments/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          aim,
          description: description || undefined,
          subject,
          experimentNumber: experimentNumber ? Number(experimentNumber) : undefined,
          technology: technology || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      setResult(data)
      setStatus('completed')
    } catch (err) {
      setError(String(err.message ?? err))
      setStatus('failed')
    }
  }

  const content = result?.content

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>AssignmentAI — Phase 1 POC</h1>
      <p style={{ color: '#555' }}>
        React → Express → FastAPI → Qwen → validated Assignment JSON. No search, RAG, DOCX, or PDF yet.
      </p>

      <form onSubmit={onGenerate} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <div style={field}>
          <label><strong>Aim *</strong></label>
          <input value={aim} onChange={(e) => setAim(e.target.value)} required minLength={4}
            style={{ padding: 8 }} placeholder="e.g. Explore subqueries in SQL" />
        </div>
        <div style={field}>
          <label>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ padding: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...field, flex: 1 }}>
            <label>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ padding: 8 }}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label>Experiment number</label>
            <input value={experimentNumber} onChange={(e) => setExperimentNumber(e.target.value)} style={{ padding: 8 }} inputMode="numeric" />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label>Technology</label>
            <input value={technology} onChange={(e) => setTechnology(e.target.value)} style={{ padding: 8 }} />
          </div>
        </div>
        <button type="submit" disabled={status === 'generating'} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          {status === 'generating' ? 'Generating…' : 'Generate assignment JSON'}
        </button>
        <span style={{ marginLeft: 12, color: '#666' }}>Status: {status}</span>
      </form>

      {error && <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>}

      {content && (
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <h2>{content.experimentNumber ? `Experiment ${content.experimentNumber}: ` : ''}{content.title}</h2>
          <p><strong>Aim:</strong> {content.aim}</p>
          <h3>Objectives</h3>
          <ul>{content.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Theory</h3>
          {content.theory.map((t, i) => <p key={i}>{t}</p>)}
          <h3>Steps</h3>
          <ol>
            {content.steps.map((s) => (
              <li key={s.number} style={{ marginBottom: 8 }}>
                <strong>{s.title}</strong>
                <ul>{s.description.map((d, j) => <li key={j}>{d}</li>)}</ul>
                {s.code && <pre style={{ background: '#f4f4f4', padding: 8, overflowX: 'auto' }}>{s.code}</pre>}
              </li>
            ))}
          </ol>
          <h3>Conclusion</h3>
          <p>{content.conclusion}</p>
          <details>
            <summary>Provenance & raw JSON</summary>
            <pre style={{ background: '#111', color: '#eee', padding: 12, overflowX: 'auto', fontSize: 12 }}>
              {JSON.stringify({ provenance: result.provenance, content }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
