import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000'
const LS_ISSUES = 'assignmentai.issues.v1'
const LS_SEQ = 'assignmentai.seq.v1'

/* ---------------------------------- data --------------------------------- */

const SUBJECTS = ['DBMS', 'DSA', 'UHV', 'DLDCA', 'Professional Skills / AWS']

const SUBJECT_META = {
  DBMS: { color: '#0C66E4', bg: '#E9F2FF' },
  DSA: { color: '#1F8455', bg: '#DCFFF1' },
  UHV: { color: '#E56910', bg: '#FFF7D6' },
  DLDCA: { color: '#6E5DC6', bg: '#F3F0FF' },
  'Professional Skills / AWS': { color: '#0E7C86', bg: '#DDF9FB' },
}

const DIFFICULTIES = ['Introductory', 'Intermediate', 'Advanced']

const EXAMPLES = [
  { aim: 'Explore subqueries in SQL', subject: 'DBMS', experimentNumber: '7', technology: 'SQL', description: 'Single-row and multi-row subqueries with IN, EXISTS and derived tables.' },
  { aim: 'Implement binary search tree traversals', subject: 'DSA', experimentNumber: '4', technology: 'Java', description: 'Inorder, preorder and postorder traversals with complexity analysis.' },
  { aim: 'Study harmony in professional relationships', subject: 'UHV', experimentNumber: '3', technology: '', description: 'Trust, respect and affection as foundational values in relationships.' },
]

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

/* --------------------------------- helpers -------------------------------- */

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function timeAgo(iso) {
  const t = new Date(iso ?? '').getTime()
  if (!Number.isFinite(t)) return '—'
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function subjectStyle(subject) {
  return SUBJECT_META[subject] ?? { color: '#44546F', bg: '#F1F2F4' }
}

function priorityOf(difficulty) {
  if (difficulty === 'Advanced') return { label: 'High', color: '#E56910', glyph: '▲' }
  if (difficulty === 'Introductory') return { label: 'Low', color: '#1F8455', glyph: '▼' }
  return { label: 'Medium', color: '#0C66E4', glyph: '＝' }
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/* ---------------------------------- icons --------------------------------- */

const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3v4h-4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-9.5 9.5" />
      <path d="M21 3 14 21l-3.5-7.5L3 10Z" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" />,
}

function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? PATHS.dot}
    </svg>
  )
}

function LogoMark({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#0C66E4" />
      <path d="M10 22.5 16 8l6 14.5h-3.4l-1.1-2.9h-5L11.4 22.5H10Zm4.2-5.4h2.9L16 14l-1.8 3.1Z" fill="#fff" />
      <circle cx="22.6" cy="10.4" r="1.7" fill="#85B8FF" />
    </svg>
  )
}

function Avatar({ subject, className = 'h-6 w-6 text-[10px]' }) {
  const s = subjectStyle(subject)
  const initials = subject.split(/[\s/]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', className)} style={{ background: s.bg, color: s.color }}>
      {initials}
    </span>
  )
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#DFE1E6" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#0C66E4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------ shared bits -------------------------------- */

function StatusPill({ status }) {
  const map = {
    todo: 'bg-slate-100 text-slate-600 ring-slate-200',
    inprogress: 'bg-blue-50 text-[#0055CC] ring-blue-200',
    done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-red-50 text-red-700 ring-red-200',
  }
  const label = { todo: 'To Do', inprogress: 'Generating', done: 'Done', failed: 'Failed' }[status] ?? 'To Do'
  const dot = { todo: 'bg-slate-400', inprogress: 'bg-[#0C66E4]', done: 'bg-emerald-500', failed: 'bg-red-500' }[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset', map[status] ?? map.todo)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}

function SubjectTag({ subject }) {
  const s = subjectStyle(subject)
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
      <span className="truncate">{subject}</span>
    </span>
  )
}

function SectionHeading({ icon, children }) {
  return (
    <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#626F86]">
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </h3>
  )
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="overflow-hidden rounded-md border border-[#DFE1E6] bg-[#F7F8FA]">
      <div className="flex items-center justify-between border-b border-[#DFE1E6] bg-[#F1F2F4] px-3 py-1.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#626F86]">{(language || 'code').toLowerCase()}</span>
        <button onClick={copy} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#44546F] hover:bg-[#E9EBEE]">
          <Icon name="copy" className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-[#172B4D]">{code}</pre>
    </div>
  )
}

/* --------------------------------- issue card ------------------------------ */

function IssueCard({ issue, selected, onSelect, onRetry }) {
  const content = issue.record?.content
  const prio = priorityOf(issue.difficulty)
  return (
    <button
      onClick={() => onSelect(issue.key)}
      className={cx(
        'w-full rounded-lg border bg-white p-3 text-left shadow-[0_1px_2px_rgba(9,30,66,0.08)] transition hover:border-[#85B8FF] hover:shadow-[0_3px_8px_rgba(9,30,66,0.12)]',
        selected ? 'border-[#0C66E4] ring-1 ring-[#0C66E4]' : 'border-[#DFE1E6]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-[#626F86]">{issue.key}</span>
        <span className="text-[13px] font-bold leading-none" style={{ color: prio.color }} title={`${prio.label} priority`}>
          {prio.glyph}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-[#172B4D]">{content?.title ?? issue.aim}</p>
      {!content && <p className="mt-0.5 line-clamp-2 text-[12px] text-[#626F86]">{issue.aim}</p>}

      {issue.status === 'inprogress' && (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-[#E9F2FF] px-2 py-1.5 text-[12px] font-medium text-[#0055CC]">
          <Spinner className="h-3.5 w-3.5" />
          Generating assignment…
        </div>
      )}
      {issue.status === 'failed' && (
        <div className="mt-2.5 rounded-md bg-red-50 px-2 py-1.5 text-[12px] text-red-700">
          <span className="font-semibold">Generation failed. </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onRetry(issue.key)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                onRetry(issue.key)
              }
            }}
            className="font-semibold underline underline-offset-2 hover:text-red-900"
          >
            Retry
          </span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <SubjectTag subject={issue.subject} />
          {issue.experimentNumber && (
            <span className="rounded bg-[#F1F2F4] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#44546F]">EXP-{issue.experimentNumber}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {content?.steps?.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#626F86]">
              <Icon name="list" className="h-3.5 w-3.5" />
              {content.steps.length}
            </span>
          )}
          <Avatar subject={issue.subject} className="h-5 w-5 text-[9px]" />
        </span>
      </div>
    </button>
  )
}

/* ---------------------------------- app ------------------------------------ */

export default function App() {
  const [issues, setIssues] = useState(() => loadJSON(LS_ISSUES, []))
  const [seq, setSeq] = useState(() => {
    const v = Number(localStorage.getItem(LS_SEQ))
    return Number.isFinite(v) && v > 0 ? v : 101
  })
  const [selectedKey, setSelectedKey] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefill, setPrefill] = useState(null)
  const [toasts, setToasts] = useState([])
  const [serviceUp, setServiceUp] = useState(null)
  const toastId = useRef(0)

  const pushToast = useCallback((kind, title, message) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, title, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_ISSUES, JSON.stringify(issues))
    } catch {
      /* storage may be full — session only */
    }
  }, [issues])

  useEffect(() => {
    try {
      localStorage.setItem(LS_SEQ, String(seq))
    } catch {
      /* ignore */
    }
  }, [seq])

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/health`)
      .then((r) => setServiceUp(r.ok))
      .catch(() => setServiceUp(false))
  }, [])

  const runGeneration = useCallback(
    async (key) => {
      let payload = null
      setIssues((prev) =>
        prev.map((it) => {
          if (it.key !== key) return it
          payload = {
            aim: it.aim,
            description: it.description || undefined,
            subject: it.subject,
            experimentNumber: it.experimentNumber ? Number(it.experimentNumber) : undefined,
            technology: it.technology || undefined,
            templateId: it.templateId || undefined,
            difficulty: it.difficulty || undefined,
          }
          return { ...it, status: 'inprogress', error: '' }
        }),
      )
      if (!payload) return
      try {
        const res = await fetch(`${API_BASE}/api/v1/assignments/generate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ? String(data.error) : `Request failed (${res.status})`)
        if (!data?.content) throw new Error('Service returned an empty assignment')
        setIssues((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'done', record: data } : it)))
        setSelectedKey(key)
        pushToast('success', `${key} generated`, 'Assignment content is ready for review.')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setIssues((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'failed', error: message } : it)))
        pushToast('error', `${key} failed`, message)
      }
    },
    [pushToast],
  )

  const createIssue = useCallback(
    (form) => {
      const key = `ASG-${seq}`
      setSeq((s) => s + 1)
      setIssues((prev) => [
        {
          key,
          aim: form.aim.trim(),
          description: form.description.trim(),
          subject: form.subject,
          experimentNumber: form.experimentNumber.trim(),
          technology: form.technology.trim(),
          difficulty: form.difficulty,
          templateId: form.templateId,
          status: 'inprogress',
          error: '',
          record: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setCreateOpen(false)
      setPrefill(null)
      setSelectedKey(key)
      runGeneration(key)
    },
    [runGeneration, seq],
  )

  const deleteIssue = useCallback(
    (key) => {
      setIssues((prev) => prev.filter((it) => it.key !== key))
      setSelectedKey(null)
      pushToast('success', `${key} deleted`, 'The assignment was removed.')
    },
    [pushToast],
  )

  async function downloadHtml(issue) {
    const recordId = issue.record?.id
    if (!recordId) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/assignments/${recordId}/html`)
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${issue.key}-assignment.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      pushToast('success', 'Document exported', `${issue.key}-assignment.html downloaded.`)
    } catch (err) {
      pushToast('error', 'Export failed', err instanceof Error ? err.message : String(err))
    }
  }

  const columns = useMemo(
    () => ({
      todo: issues.filter((i) => i.status === 'todo' || i.status === 'failed'),
      inprogress: issues.filter((i) => i.status === 'inprogress'),
      done: issues.filter((i) => i.status === 'done'),
    }),
    [issues],
  )

  const selected = issues.find((it) => it.key === selectedKey) ?? null

  return (
    <div className="flex h-full min-h-screen flex-col bg-white text-[#172B4D]">
      {/* Top bar */}
      <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-[#DFE1E6] bg-white px-3 sm:px-4">
        <span className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">AssignmentAI</span>
        </span>
        <span className="hidden rounded bg-[#E9F2FF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0055CC] sm:inline">Workspace</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setPrefill(null)
              setCreateOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0055CC]"
          >
            <Icon name="plus" className="h-4 w-4" />
            Create
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6E5DC6] text-[12px] font-bold text-white">YO</span>
        </div>
      </header>

      {serviceUp === false && (
        <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">
          The generation service is not responding. Start the API on <span className="font-mono">{API_BASE}</span> to create assignments.
        </div>
      )}

      {/* Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-baseline gap-3 px-4 pt-5 sm:px-6">
          <h1 className="text-[20px] font-semibold tracking-tight">Assignments</h1>
          <span className="text-[13px] text-[#626F86]">{issues.length} work items</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          {issues.length === 0 ? (
            <EmptyState
              onCreate={(ex) => {
                setPrefill(ex ?? null)
                setCreateOpen(true)
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex min-h-[220px] flex-col rounded-xl bg-[#F1F2F4] p-2.5">
                  <p className="px-1.5 pb-2 pt-1 text-[12px] font-semibold uppercase tracking-wide text-[#626F86]">
                    {col.title}{' '}
                    <span className="ml-1 rounded bg-[#E2E5EA] px-1.5 py-0.5 text-[11px]">{columns[col.id].length}</span>
                  </p>
                  <div className="flex flex-1 flex-col gap-2">
                    {columns[col.id].map((issue) => (
                      <IssueCard key={issue.key} issue={issue} selected={selectedKey === issue.key} onSelect={setSelectedKey} onRetry={runGeneration} />
                    ))}
                    {columns[col.id].length === 0 && (
                      <div className="rounded-lg border border-dashed border-[#C1C7D0] bg-white/60 px-3 py-6 text-center text-[12px] text-[#8590A2]">
                        No items here yet
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selected && (
        <DetailDrawer
          key={selected.key}
          issue={selected}
          onClose={() => setSelectedKey(null)}
          onRetry={() => runGeneration(selected.key)}
          onDelete={() => deleteIssue(selected.key)}
          onDownload={() => downloadHtml(selected)}
          onOpenPreview={() => window.open(`${API_BASE}/api/v1/assignments/${selected.record.id}/html`, '_blank', 'noopener')}
          apiBase={API_BASE}
        />
      )}

      {createOpen && (
        <CreateModal
          initial={prefill}
          onClose={() => {
            setCreateOpen(false)
            setPrefill(null)
          }}
          onSubmit={createIssue}
        />
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-[#DFE1E6] bg-white p-3 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
            <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', t.kind === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
              <Icon name={t.kind === 'success' ? 'check' : 'x'} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{t.title}</p>
              <p className="break-words text-[12px] text-[#626F86]">{t.message}</p>
            </div>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-auto rounded p-1 text-[#8590A2] hover:bg-[#F1F2F4]">
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- empty state ------------------------------ */

function EmptyState({ onCreate }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border border-[#DFE1E6] bg-white px-8 py-12 text-center shadow-[0_1px_2px_rgba(9,30,66,0.08)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9F2FF] text-[#0C66E4]">
        <LogoMark className="h-8 w-8" />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold">Create your first assignment</h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[#626F86]">
        Provide an aim, subject and experiment number. AssignmentAI drafts the objectives, theory, steps and
        conclusion, then renders a print-ready department document.
      </p>
      <button onClick={() => onCreate(null)} className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0055CC]">
        <Icon name="plus" className="h-4 w-4" />
        Create assignment
      </button>
      <div className="mt-6 w-full border-t border-[#EBECF0] pt-4 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#626F86]">Or start from an example</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex.aim} onClick={() => onCreate(ex)} className="rounded-md border border-[#DFE1E6] px-3 py-2 text-left text-[13px] hover:border-[#85B8FF] hover:bg-[#F7FAFF]">
              <span className="font-medium">{ex.aim}</span>
              <span className="block text-[12px] text-[#626F86]">
                {ex.subject} · Experiment {ex.experimentNumber}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- detail drawer ----------------------------- */

function DetailDrawer({ issue, onClose, onRetry, onDelete, onDownload, onOpenPreview, apiBase }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)
  const content = issue.record?.content ?? null
  const prov = issue.record?.provenance
  const prio = priorityOf(issue.difficulty)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#091E42]/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-white shadow-[0_0_40px_rgba(9,30,66,0.25)]">
        <div className="flex items-center gap-2 border-b border-[#DFE1E6] px-4 py-3">
          <span className="font-mono text-[12px] text-[#626F86]">{issue.key}</span>
          <StatusPill status={issue.status} />
          <span className="ml-auto flex items-center gap-0.5">
            <button title="Download document" onClick={onDownload} disabled={!issue.record} className="rounded p-1.5 text-[#44546F] hover:bg-[#F1F2F4] disabled:opacity-40">
              <Icon name="download" className="h-4 w-4" />
            </button>
            <button title="Open document" onClick={onOpenPreview} disabled={!issue.record} className="rounded p-1.5 text-[#44546F] hover:bg-[#F1F2F4] disabled:opacity-40">
              <Icon name="external" className="h-4 w-4" />
            </button>
            <button title="Delete" onClick={() => setConfirmDelete(true)} className="rounded p-1.5 text-[#44546F] hover:bg-red-50 hover:text-red-700">
              <Icon name="trash" className="h-4 w-4" />
            </button>
            <button title="Close" onClick={onClose} className="rounded p-1.5 text-[#44546F] hover:bg-[#F1F2F4]">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </span>
        </div>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5">
            <p className="text-[13px] font-medium text-red-800">Delete {issue.key} permanently?</p>
            <span className="flex gap-1.5">
              <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-[#DFE1E6] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#44546F]">
                Keep
              </button>
              <button onClick={() => onDelete(issue.key)} className="rounded-md bg-red-600 px-2.5 py-1.5 text-[13px] font-semibold text-white hover:bg-red-700">
                Delete
              </button>
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight">{content?.title ?? issue.aim}</h2>
          <p className="mt-1 text-[12px] text-[#626F86]">
            Created {timeAgo(issue.createdAt)}
            {issue.experimentNumber ? ` · Experiment ${issue.experimentNumber}` : ''}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3.5 text-[13px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8590A2]">Subject</dt>
              <dd className="mt-1">
                <SubjectTag subject={issue.subject} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8590A2]">Priority</dt>
              <dd className="mt-1 font-medium" style={{ color: prio.color }}>
                {prio.glyph} {prio.label}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8590A2]">Technology</dt>
              <dd className="mt-1 font-medium">{issue.technology || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8590A2]">Template</dt>
              <dd className="mt-1 font-mono text-[12px]">
                {issue.record?.template?.id ?? issue.templateId ?? 'default'}{' '}
                <span className="text-[#8590A2]">v{issue.record?.template?.version ?? 1}</span>
              </dd>
            </div>
            {prov && (
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8590A2]">Provider</dt>
                <dd className="mt-1 font-mono text-[12px]">
                  {prov.provider} · {prov.model}
                </dd>
              </div>
            )}
          </dl>

          {issue.status === 'inprogress' && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-blue-200 bg-[#F7FAFF] p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0055CC]">
                <Spinner />
                Generating assignment content…
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#DFE1E6]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[#0C66E4]" />
              </div>
            </div>
          )}

          {issue.status === 'failed' && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-[13px] font-semibold text-red-800">Generation needs attention</p>
              <p className="mt-1 break-words text-[12px] text-red-700">{issue.error || 'The service could not complete this request.'}</p>
              <button onClick={() => onRetry(issue.key)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-700">
                <Icon name="refresh" className="h-4 w-4" />
                Retry generation
              </button>
            </div>
          )}

          {!content && issue.status !== 'inprogress' && issue.status !== 'failed' && (
            <div className="mt-4 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-4 text-[13px] text-[#44546F]">
              <p className="font-semibold text-[#172B4D]">Aim</p>
              <p className="mt-1">{issue.aim}</p>
              {issue.description && <p className="mt-2 text-[#626F86]">{issue.description}</p>}
              <button onClick={() => onRetry(issue.key)} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-3 py-1.5 font-semibold text-white hover:bg-[#0055CC]">
                <Icon name="send" className="h-4 w-4" />
                Generate assignment
              </button>
            </div>
          )}

          {content && (
            <div className="mt-5 flex flex-col gap-6 pb-2">
              <section>
                <SectionHeading icon="send">Aim</SectionHeading>
                <p className="mt-1.5 rounded-md bg-[#F7F8FA] px-3 py-2.5 text-[13px] leading-relaxed">{content.aim}</p>
              </section>

              <section>
                <SectionHeading icon="check">Objectives · {content.objectives.length}</SectionHeading>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {content.objectives.map((o, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-md border border-[#EBECF0] px-3 py-2 text-[13px]">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      {o}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionHeading icon="book">Theory</SectionHeading>
                <div className="mt-1.5 flex flex-col gap-2.5">
                  {content.theory.map((t, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-[#334155]">
                      {t}
                    </p>
                  ))}
                </div>
              </section>

              <section>
                <SectionHeading icon="list">Procedure · {content.steps.length} steps</SectionHeading>
                <ol className="mt-2 flex flex-col gap-3">
                  {content.steps.map((s) => (
                    <li key={s.number} className="rounded-lg border border-[#DFE1E6]">
                      <div className="flex items-center gap-2.5 border-b border-[#EBECF0] bg-[#FAFBFC] px-3 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0C66E4] font-mono text-[12px] font-bold text-white">
                          {s.number}
                        </span>
                        <p className="text-[13px] font-semibold">{s.title}</p>
                      </div>
                      <div className="px-3 py-2.5">
                        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-[#334155]">
                          {s.description.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                        {s.code && (
                          <div className="mt-2.5">
                            <CodeBlock code={s.code} language={s.language} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <SectionHeading icon="file">Conclusion</SectionHeading>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#334155]">{content.conclusion}</p>
              </section>

              <section>
                <SectionHeading icon="file">Document preview</SectionHeading>
                <p className="mt-1 text-[12px] text-[#626F86]">Department header and watermark applied on every page.</p>
                <div className="mt-2 overflow-hidden rounded-lg border border-[#DFE1E6]">
                  <iframe title={`Document preview for ${issue.key}`} src={`${apiBase}/api/v1/assignments/${issue.record.id}/html`} className="h-[420px] w-full bg-white" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA]">
                    <Icon name="download" className="h-4 w-4" />
                    Download HTML
                  </button>
                  <button onClick={onOpenPreview} className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA]">
                    <Icon name="external" className="h-4 w-4" />
                    Print
                  </button>
                  <button onClick={() => setShowRawJson((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA]">
                    <Icon name="copy" className="h-4 w-4" />
                    {showRawJson ? 'Hide JSON' : 'View JSON'}
                  </button>
                </div>
                {showRawJson && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[#172B4D] p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                    {JSON.stringify({ provenance: issue.record.provenance, content }, null, 2)}
                  </pre>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

/* ------------------------------- create modal ------------------------------ */

function CreateModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    aim: initial?.aim ?? '',
    description: initial?.description ?? '',
    subject: initial?.subject ?? 'DBMS',
    experimentNumber: initial?.experimentNumber ?? '',
    technology: initial?.technology ?? '',
    difficulty: initial?.difficulty ?? 'Intermediate',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e) {
    e.preventDefault()
    if (form.aim.trim().length < 4) {
      setError('Please describe the aim in at least 4 characters.')
      return
    }
    if (form.experimentNumber && !/^\d{1,3}$/.test(form.experimentNumber.trim())) {
      setError('Experiment number must be between 1 and 999.')
      return
    }
    setError('')
    setSubmitting(true)
    onSubmit(form)
  }

  const inputCls =
    'w-full rounded-md border border-[#DFE1E6] bg-white px-2.5 py-2 text-[13px] placeholder:text-[#8590A2] hover:border-[#8590A2] focus:border-[#0C66E4] focus:outline-none focus:ring-1 focus:ring-[#0C66E4]'
  const labelCls = 'mb-1 block text-[12px] font-semibold text-[#44546F]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#091E42]/55" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-[0_16px_48px_rgba(9,30,66,0.32)]">
        <div className="flex items-center gap-2 border-b border-[#DFE1E6] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">Create assignment</h2>
          <button onClick={onClose} className="ml-auto rounded p-1.5 text-[#626F86] hover:bg-[#F1F2F4]" title="Close">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelCls} htmlFor="f-aim">
              Aim <span className="text-red-600">*</span>
            </label>
            <input
              id="f-aim"
              value={form.aim}
              onChange={(e) => set('aim', e.target.value)}
              placeholder="e.g. Explore subqueries in SQL"
              className={inputCls}
              maxLength={2000}
              autoFocus
            />
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="f-desc">
              Description
            </label>
            <textarea
              id="f-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Context, scope or outcomes for this experiment…"
              className={cx(inputCls, 'resize-y')}
              maxLength={4000}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="f-subject">
                Subject
              </label>
              <select id="f-subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} className={inputCls}>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="f-exp">
                Experiment no.
              </label>
              <input
                id="f-exp"
                value={form.experimentNumber}
                onChange={(e) => set('experimentNumber', e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                placeholder="7"
                inputMode="numeric"
                className={cx(inputCls, 'font-mono')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-tech">
                Technology
              </label>
              <input id="f-tech" value={form.technology} onChange={(e) => set('technology', e.target.value)} placeholder="SQL, Java…" className={inputCls} maxLength={64} />
            </div>
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="f-diff">
              Difficulty
            </label>
            <select id="f-diff" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={inputCls}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>}

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#EBECF0] pt-4">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[13px] font-medium text-[#44546F] hover:bg-[#F1F2F4]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-70"
            >
              {submitting ? <Spinner className="h-4 w-4" /> : <Icon name="send" className="h-4 w-4" />}
              {submitting ? 'Creating…' : 'Create & generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
