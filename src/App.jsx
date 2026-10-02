import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000'

// No browser storage anywhere in this app: board state lives in React state
// (gone on reload), records live in MongoDB via the API, and the auth token
// lives in memory (reloading logs you out — by design).

// Auth headers for every API call (no-op when logged out; API runs open dev mode).
let memoryToken = ''
function authHeaders(extra = {}) {
  return memoryToken ? { ...extra, Authorization: `Bearer ${memoryToken}` } : extra
}

// credentials:'include' lets the httpOnly session cookie ride along
// (required cross-site in production, harmless same-origin in dev).
function apiFetch(url, options = {}) {
  return fetch(url, { credentials: 'include', ...options })
}

// Server record -> board card (keyed by record id so reloads stay consistent).
function recordToIssue(record) {
  const c = record.content ?? {}
  return {
    key: record.id,
    aim: c.aim ?? 'Imported assignment',
    description: '',
    subject: record.input?.subject ?? 'DBMS',
    experimentNumber: c.experimentNumber ? String(c.experimentNumber) : '',
    technology: record.input?.technology ?? '',
    difficulty: 'Intermediate',
    templateId: record.template?.id ?? '',
    includeVivaTitle: record.options?.includeVivaTitle ?? false,
    typedConclusion: record.options?.typedConclusion ?? true,
    status: 'done',
    error: '',
    stale: false,
    record,
    createdAt: record.createdAt ?? new Date().toISOString(),
  }
}

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

const EDITABLE_SECTIONS = ['title', 'aim', 'objectives', 'theory', 'steps', 'conclusion']

function sectionToText(section, value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function sectionFromText(section, text) {
  if (['title', 'aim', 'conclusion'].includes(section)) return text
  return JSON.parse(text)
}

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
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 21h16" />
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

function RetryLink({ onRetry, label, className }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onRetry()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
          onRetry()
        }
      }}
      className={cx('cursor-pointer font-semibold underline underline-offset-2', className)}
    >
      {label}
    </span>
  )
}

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
          <RetryLink onRetry={() => onRetry(issue.key)} label="Retry" className="text-red-700 hover:text-red-900" />
        </div>
      )}
      {issue.stale && issue.status === 'done' && (
        <div className="mt-2.5 rounded-md bg-amber-50 px-2 py-1.5 text-[12px] text-amber-800">
          <span className="font-semibold">Document cleared. </span>
          <RetryLink onRetry={() => onRetry(issue.key)} label="Regenerate" className="text-amber-800 hover:text-amber-950" />
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
  const [issues, setIssues] = useState([])
  const [seq, setSeq] = useState(101)
  const [selectedKey, setSelectedKey] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefill, setPrefill] = useState(null)
  const [toasts, setToasts] = useState([])
  const [serviceUp, setServiceUp] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [session, setSession] = useState(null)
  const toastId = useRef(0)

  function saveSession(next) {
    setSession(next)
    memoryToken = next?.token ?? ''
  }

  const pushToast = useCallback((kind, title, message) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, title, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  // Logged-out actions must invite login instead of failing with a 401:
  // the API enforces tokens when AUTH_REQUIRED=1.
  const handleAuthRequired = useCallback(() => {
    setLoginOpen(true)
    pushToast('error', 'Login required', 'Please log in to continue — then retry the action.')
  }, [pushToast])

  const ensureSession = useCallback(() => {
    if (session?.token) return true
    handleAuthRequired()
    return false
  }, [handleAuthRequired, session])

  useEffect(() => {
    apiapiFetch(`${API_BASE}/api/v1/health`)
      .then((r) => setServiceUp(r.ok))
      .catch(() => setServiceUp(false))
    apiFetch(`${API_BASE}/api/v1/templates`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
    // Board boots from the server (Mongo-backed history), never the browser.
    apiFetch(`${API_BASE}/api/v1/assignments`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setIssues((d.assignments ?? []).map(recordToIssue)))
      .catch(() => { /* service banner covers unreachable servers */ })
    // Restore a still-valid cookie session (nothing stored in the browser).
    apiFetch(`${API_BASE}/api/v1/auth/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.email) setSession({ email: d.user.email }) })
      .catch(() => { /* logged out is a valid state */ })
  }, [])

  // Payload is built from the issue object itself — never captured inside a
  // setIssues updater (React only runs the first updater of an event
  // synchronously; capturing later leaves payload null and no request is sent).
  const startGeneration = useCallback(
    async (issue) => {
      const key = issue.key
      // Don't burn the card on a guaranteed 401: invite login first.
      if (!ensureSession()) return
      const payload = {
        aim: issue.aim,
        description: issue.description || undefined,
        subject: issue.subject,
        experimentNumber: issue.experimentNumber ? Number(issue.experimentNumber) : undefined,
        technology: issue.technology || undefined,
        templateId: issue.templateId || undefined,
        difficulty: issue.difficulty || undefined,
        includeVivaTitle: issue.includeVivaTitle ?? issue.record?.options?.includeVivaTitle ?? false,
        typedConclusion: issue.typedConclusion ?? issue.record?.options?.typedConclusion ?? true,
      }
      setIssues((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'inprogress', error: '', stale: false } : it)))
      let status = 0
      try {
        const res = await apiFetch(`${API_BASE}/api/v1/assignments/generate`, {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify(payload),
          // Never spin forever: a stalled gateway fails here instead of hanging the card.
          signal: AbortSignal.timeout(180000),
        })
        status = res.status
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ? String(data.error) : `Request failed (${res.status})`)
        if (!data?.content) throw new Error('Service returned an empty assignment')
        // Rekey the card onto the server record id so reloads stay consistent.
        setIssues((prev) => prev.map((it) => (it.key === key ? { ...recordToIssue(data), key: data.id } : it)))
        setSelectedKey(data.id)
        pushToast('success', `${data.id} generated`, 'Assignment content is ready for review.')
      } catch (err) {
        // Token may have expired mid-session: same login invitation, friendlier message.
        let message = err instanceof Error ? err.message : String(err)
        if (status === 401) {
          message = 'Please log in to continue — then retry generation.'
          handleAuthRequired()
        }
        setIssues((prev) => prev.map((it) => (it.key === key ? { ...it, status: 'failed', error: message } : it)))
        pushToast('error', `${key} failed`, message)
      }
    },
    [pushToast, ensureSession, handleAuthRequired],
  )

  const runGeneration = useCallback(
    (key) => {
      const issue = issues.find((it) => it.key === key)
      if (!issue || issue.status === 'inprogress') return
      return startGeneration(issue)
    },
    [issues, startGeneration],
  )

  const markStale = useCallback((key) => {
    setIssues((prev) => prev.map((it) => (it.key === key && !it.stale ? { ...it, stale: true } : it)))
  }, [])

  const issuesRef = useRef(issues)

  // Records live in the service process; after a restart old ids 404. Detect on
  // load so preview/export controls degrade gracefully instead of failing.
  useEffect(() => {
    const withRecord = issuesRef.current.filter((it) => it.record?.id)
    if (withRecord.length === 0) return undefined
    let cancelled = false
    Promise.all(
      withRecord.map(async (it) => {
        try {
          const res = await apiFetch(`${API_BASE}/api/v1/assignments/${it.record.id}`, { signal: AbortSignal.timeout(10000) })
          return res.status === 404 ? it.key : null
        } catch {
          return null // network trouble ≠ record gone
        }
      }),
    ).then((keys) => {
      const missing = new Set(keys.filter(Boolean))
      if (!cancelled && missing.size > 0) {
        setIssues((prev) => prev.map((it) => (missing.has(it.key) && !it.stale ? { ...it, stale: true } : it)))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const createIssue = useCallback(
    (form) => {
      const key = `ASG-${seq}`
      setSeq((s) => s + 1)
      const issue = {
        key,
        aim: form.aim.trim(),
        description: form.description.trim(),
        subject: form.subject,
        experimentNumber: form.experimentNumber.trim(),
        technology: form.technology.trim(),
        difficulty: form.difficulty,
          templateId: form.templateId || undefined,
          includeVivaTitle: form.includeVivaTitle,
          typedConclusion: form.typedConclusion,
        status: 'inprogress',
        error: '',
        stale: false,
        record: null,
        createdAt: new Date().toISOString(),
      }
      setIssues((prev) => [issue, ...prev])
      setCreateOpen(false)
      setPrefill(null)
      setSelectedKey(key)
      startGeneration(issue)
    },
    [startGeneration, seq],
  )

  const deleteIssue = useCallback(
    async (key) => {
      const target = issues.find((it) => it.key === key)
      const recordId = target?.record?.id
      // Server-side delete (memory + Mongo); cards without records only exist locally.
      if (recordId) {
        try {
          const res = await apiFetch(`${API_BASE}/api/v1/assignments/${recordId}`, {
            method: 'DELETE',
            headers: authHeaders(),
            signal: AbortSignal.timeout(30000),
          })
          if (!res.ok && res.status !== 404) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data?.error ?? `Delete failed (${res.status})`)
          }
        } catch (err) {
          pushToast('error', `${key} not deleted`, err instanceof Error ? err.message : String(err))
          return
        }
      }
      setIssues((prev) => prev.filter((it) => it.key !== key))
      setSelectedKey(null)
      pushToast('success', `${key} deleted`, 'The assignment was removed.')
    },
    [pushToast, issues],
  )

  const refreshTemplates = useCallback(async () => {
    try {
      const d = await apiFetch(`${API_BASE}/api/v1/templates`, { headers: authHeaders() }).then((r) => r.json())
      setTemplates(d.templates ?? [])
    } catch {
      /* keep stale list */
    }
  }, [])

  // Pull a server-side record onto the board as a finished card.
  const importRecordToBoard = useCallback(
    async (recordId) => {
      try {
        const record = await apiFetch(`${API_BASE}/api/v1/assignments/${recordId}`, { headers: authHeaders() }).then((r) => {
          if (!r.ok) throw new Error(`Load failed (${r.status})`)
          return r.json()
        })
        // One card per server record: skip when already on the board.
        setIssues((prev) => (prev.some((it) => it.key === record.id) ? prev : [recordToIssue(record), ...prev]))
        setHistoryOpen(false)
        setSelectedKey(record.id)
      } catch (err) {
        pushToast('error', 'Import failed', err instanceof Error ? err.message : String(err))
      }
    },
    [pushToast, seq],
  )

  async function downloadHtml(issue) {
    const recordId = issue.record?.id
    if (!recordId) return
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/assignments/${recordId}/html`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(180000),
      })
      if (res.status === 401) {
        handleAuthRequired()
        return
      }
      if (res.status === 404) {
        markStale(issue.key)
        pushToast('error', 'Document cleared', 'The service no longer has this record — regenerate the assignment to restore exports.')
        return
      }
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
          <span className="text-[15px] font-semibold tracking-tight">Markly</span>
        </span>
        <span className="hidden rounded bg-[#E9F2FF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0055CC] sm:inline">Workspace</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setHistoryOpen(true)}
            title="Server history"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F1F2F4]"
          >
            <Icon name="clock" className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </button>
          <button
            onClick={() => setTemplatesOpen(true)}
            title="Templates"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F1F2F4]"
          >
            <Icon name="grid" className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </button>
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
          {session ? (
            <button
              onClick={async () => {
                try { await apiFetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST' }) } catch { /* cookie may already be gone */ }
                saveSession(null)
                pushToast('success', 'Logged out', 'Session cleared.')
              }}
              title={`Logged in as ${session.email} — click to log out`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6E5DC6] text-[12px] font-bold text-white"
            >
              {(session.email?.[0] ?? 'U').toUpperCase()}
            </button>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              title="Log in"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F1F2F4]"
            >
              <Icon name="user" className="h-4 w-4" />
              <span className="hidden sm:inline">Log in</span>
            </button>
          )}
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
          onRecordUpdate={(key, record) => setIssues((prev) => prev.map((it) => (it.key === key ? { ...it, record, stale: false } : it)))}
          onMarkStale={markStale}
          onAuthRequired={handleAuthRequired}
          onOpenPreview={() => window.open(`${API_BASE}/api/v1/assignments/${selected.record.id}/html`, '_blank', 'noopener')}
          apiBase={API_BASE}
        />
      )}

      {createOpen && (
        <CreateModal
          initial={prefill}
          templates={templates}
          onClose={() => {
            setCreateOpen(false)
            setPrefill(null)
          }}
          onSubmit={createIssue}
        />
      )}

      {templatesOpen && (
        <TemplatesModal
          templates={templates}
          onRefresh={refreshTemplates}
          notify={pushToast}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {historyOpen && (
        <HistoryModal onImport={importRecordToBoard} onClose={() => setHistoryOpen(false)} />
      )}

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={(s) => {
            saveSession(s)
            setLoginOpen(false)
            refreshTemplates()
            pushToast('success', 'Logged in', s.email)
          }}
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
        Provide an aim, subject and experiment number. Markly drafts the objectives, theory, steps and
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

function DetailDrawer({ issue, onClose, onRetry, onDelete, onDownload, onOpenPreview, onRecordUpdate, onMarkStale, onAuthRequired, apiBase }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)
  const [exportBusy, setExportBusy] = useState('')
  const [exportError, setExportError] = useState('')
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [regenBusy, setRegenBusy] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [latex, setLatex] = useState(null)
  const [latexBusy, setLatexBusy] = useState(false)
  const [latexError, setLatexError] = useState('')
  const [copiedLatex, setCopiedLatex] = useState(false)
  const [optBusy, setOptBusy] = useState(false)
  const [optError, setOptError] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [recordGone, setRecordGone] = useState(false)

  // Records live in server memory: after an API restart old cards point at
  // nothing. Detect it explicitly instead of showing a dead preview.
  useEffect(() => {
    const recordId = issue.record?.id
    if (!recordId) return
    setRecordGone(false)
    apiFetch(`${apiBase}/api/v1/assignments/${recordId}`, { headers: authHeaders() })
      .then((r) => { if (r.status === 404) setRecordGone(true) })
      .catch(() => { /* offline banner covers unreachable servers */ })
  }, [issue.record?.id, apiBase])
  const content = issue.record?.content ?? null
  const prov = issue.record?.provenance
  const prio = priorityOf(issue.difficulty)
  const stale = issue.stale === true

  // 404 means the service lost this record (restart) — flag it so the UI offers regeneration.
  function failMessage(res, data) {
    if (res.status === 404) {
      onMarkStale(issue.key)
      return 'This record was cleared on the service — regenerate the assignment to restore this feature.'
    }
    return data?.error ?? `Request failed (${res.status})`
  }

  // 401 (missing/expired token) must invite login, not just stain the drawer with an error.
  function throwIfAuth(res) {
    if (res.status === 401) {
      onAuthRequired?.()
      throw new Error('Please log in to continue — then retry.')
    }
  }

  async function exportFile(kind) {
    const recordId = issue.record?.id
    if (!recordId) return
    setExportBusy(kind)
    setExportError('')
    try {
      const res = await apiFetch(`${apiBase}/api/v1/assignments/${recordId}/${kind}`, {
        method: kind === 'pdf' ? 'POST' : 'GET',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: kind === 'pdf' ? '{}' : undefined,
        signal: AbortSignal.timeout(180000),
      })
      throwIfAuth(res)
      if (res.status === 404) {
        onMarkStale(issue.key)
        throw new Error('This record was cleared on the service — regenerate the assignment to restore exports.')
      }
      const ctype = res.headers.get('content-type') ?? ''
      if (!res.ok || ctype.includes('application/json')) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${issue.key}-assignment.${kind === 'docx' ? 'docx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExportBusy('')
    }
  }

  async function regenSection(section) {
    const recordId = issue.record?.id
    if (!recordId) return
    setRegenBusy(section)
    setEditError('')
    try {
      const res = await apiFetch(`${apiBase}/api/v1/assignments/${recordId}/regenerate-section`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ section }),
        signal: AbortSignal.timeout(180000),
      })
      throwIfAuth(res)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(failMessage(res, data))
      onRecordUpdate(issue.key, data)
      setDrafts((d) => ({ ...d, [section]: undefined }))
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setRegenBusy('')
    }
  }

  async function saveAllSections() {
    const recordId = issue.record?.id
    if (!recordId) return
    setEditError('')
    let next
    try {
      next = { ...issue.record.content }
      for (const s of EDITABLE_SECTIONS) {
        if (drafts[s] !== undefined) next[s] = sectionFromText(s, drafts[s])
      }
    } catch {
      setEditError('Invalid JSON in objectives / theory / steps — fix the syntax and retry.')
      return
    }
    setSaveBusy(true)
    try {
      const res = await apiFetch(`${apiBase}/api/v1/assignments/${recordId}`, {
        method: 'PUT',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ content: next }),
        signal: AbortSignal.timeout(60000),
      })
      throwIfAuth(res)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(failMessage(res, data))
      onRecordUpdate(issue.key, data)
      setDrafts({})
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaveBusy(false)
    }
  }

  async function loadLatex() {
    const recordId = issue.record?.id
    if (!recordId) return
    setLatexBusy(true)
    setLatexError('')
    try {
      const res = await apiFetch(`${apiBase}/api/v1/assignments/${recordId}/latex`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(60000),
      })
      throwIfAuth(res)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(failMessage(res, data))
      setLatex(data.latex ?? '')
    } catch (err) {
      setLatexError(err instanceof Error ? err.message : String(err))
    } finally {
      setLatexBusy(false)
    }
  }

  async function saveOptions(patch) {
    const recordId = issue.record?.id
    if (!recordId) return
    setOptBusy(true)
    setOptError('')
    try {
      const res = await apiFetch(`${apiBase}/api/v1/assignments/${recordId}/options`, {
        method: 'PATCH',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(30000),
      })
      throwIfAuth(res)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Options save failed (${res.status})`)
      onRecordUpdate(issue.key, data)
      setPreviewKey((k) => k + 1)
    } catch (err) {
      setOptError(err instanceof Error ? err.message : String(err))
    } finally {
      setOptBusy(false)
    }
  }

  async function copyLatex() {
    if (latex === null) return
    try {
      await navigator.clipboard.writeText(latex)
    } catch {
      // Clipboard API unavailable (permissions) — legacy fallback.
      const ta = document.createElement('textarea')
      ta.value = latex
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedLatex(true)
    setTimeout(() => setCopiedLatex(false), 1500)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#091E42]/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-white shadow-[0_0_40px_rgba(9,30,66,0.25)]">
        <div className="flex items-center gap-2 border-b border-[#DFE1E6] px-4 py-3">
          <span className="font-mono text-[12px] text-[#626F86]">{issue.key}</span>
          <StatusPill status={issue.status} />
          <span className="ml-auto flex items-center gap-0.5">
            <button title="Download document" onClick={onDownload} disabled={!issue.record || stale} className="rounded p-1.5 text-[#44546F] hover:bg-[#F1F2F4] disabled:opacity-40">
              <Icon name="download" className="h-4 w-4" />
            </button>
            <button title="Open document" onClick={onOpenPreview} disabled={!issue.record || stale} className="rounded p-1.5 text-[#44546F] hover:bg-[#F1F2F4] disabled:opacity-40">
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

          {stale && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13px] font-semibold text-amber-900">Stored document was cleared</p>
              <p className="mt-1 text-[12px] text-amber-800">
                The service restarted and no longer has this record. The content below stays readable — regenerate to
                restore the document preview, exports and editing.
              </p>
              <button
                onClick={() => onRetry(issue.key)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0055CC]"
              >
                <Icon name="refresh" className="h-4 w-4" />
                Regenerate assignment
              </button>
            </div>
          )}

          {content && (
            <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] px-3.5 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={issue.record.options?.includeVivaTitle === true}
                  disabled={optBusy}
                  onChange={(e) => saveOptions({ includeVivaTitle: e.target.checked })}
                />
                Viva Questions heading
                <span className="text-[12px] text-[#8590A2]">(handwritten by faculty)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={issue.record.options?.typedConclusion !== false}
                  disabled={optBusy}
                  onChange={(e) => saveOptions({ typedConclusion: e.target.checked })}
                />
                Typed conclusion
                <span className="text-[12px] text-[#8590A2]">(uncheck for handwriting space)</span>
              </label>
              {optError && <p className="break-words text-[12px] text-red-700">{optError}</p>}
            </div>
          )}

          {recordGone && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13px] font-semibold text-amber-900">This preview expired</p>
              <p className="mt-1 text-[12px] text-amber-800">The API restarted and no longer holds this record. Retry generation to create a fresh one.</p>
              <button onClick={() => onRetry(issue.key)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-[#0C66E4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0055CC]">
                <Icon name="refresh" className="h-4 w-4" />
                Retry generation
              </button>
            </div>
          )}

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
                <SectionHeading icon="list">Steps · {content.steps.length}</SectionHeading>
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

              {(issue.record?.sources?.length > 0) && (
                <section>
                  <SectionHeading icon="external">Sources used · {issue.record.sources.length}</SectionHeading>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {issue.record.sources.map((s, i) => (
                      <li key={i} className="rounded-md border border-[#EBECF0] px-3 py-2 text-[13px]">
                        <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-[#0C66E4] hover:underline">
                          {s.title || s.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!stale && (
                <section>
                  <SectionHeading icon="download">Exports</SectionHeading>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => exportFile('docx')} disabled={exportBusy !== ''} className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA] disabled:opacity-50">
                      <Icon name="download" className="h-4 w-4" />
                      {exportBusy === 'docx' ? 'Preparing…' : 'Export DOCX'}
                    </button>
                    <button onClick={() => exportFile('pdf')} disabled={exportBusy !== ''} className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA] disabled:opacity-50">
                      <Icon name="download" className="h-4 w-4" />
                      {exportBusy === 'pdf' ? 'Compiling…' : 'Export PDF'}
                    </button>
                  </div>
                  {exportError && <p className="mt-2 break-words text-[12px] text-red-700">{exportError}</p>}
                </section>
              )}

              {!stale && (
                <section>
                  <div className="flex items-center justify-between">
                    <SectionHeading icon="check">Edit sections</SectionHeading>
                    <button onClick={() => { setEditing((v) => !v); setEditError('') }} className="text-[12px] font-medium text-[#0C66E4] hover:underline">
                      {editing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                {editing && (
                  <div className="mt-2 flex flex-col gap-3">
                    {EDITABLE_SECTIONS.map((s) => (
                      <div key={s}>
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-[12px] font-semibold capitalize text-[#44546F]">{s}</p>
                          <button onClick={() => regenSection(s)} disabled={regenBusy !== ''} className="text-[12px] font-medium text-[#0C66E4] hover:underline disabled:opacity-50">
                            {regenBusy === s ? 'Regenerating…' : 'Regenerate'}
                          </button>
                        </div>
                        <textarea
                          value={drafts[s] ?? sectionToText(s, content[s])}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))}
                          rows={['title', 'aim'].includes(s) ? 2 : 6}
                          spellCheck={false}
                          className="w-full rounded-md border border-[#DFE1E6] px-2.5 py-2 font-mono text-[12px] leading-relaxed focus:border-[#0C66E4] focus:outline-none"
                        />
                      </div>
                    ))}
                    <div>
                      <button onClick={saveAllSections} disabled={saveBusy} className="rounded-md bg-[#0C66E4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-70">
                        {saveBusy ? 'Saving…' : 'Save all sections'}
                      </button>
                    </div>
                    {editError && <p className="break-words text-[12px] text-red-700">{editError}</p>}
                  </div>
                )}
                </section>
              )}

              {!stale && (
                <section>
                  <div className="flex items-center justify-between">
                    <SectionHeading icon="file">LaTeX source</SectionHeading>
                    <button onClick={loadLatex} disabled={latexBusy} className="text-[12px] font-medium text-[#0C66E4] hover:underline disabled:opacity-50">
                      {latex === null ? (latexBusy ? 'Loading…' : 'Load') : 'Reload'}
                    </button>
                  </div>
                {latex !== null && (
                  <div className="mt-2 overflow-hidden rounded-md border border-[#DFE1E6] bg-[#FAFBFC]">
                    <div className="max-h-[50vh] overflow-auto">
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#EBECF0] bg-[#FAFBFC]/95 px-2.5 py-1.5 backdrop-blur">
                        <span className="font-mono text-[11px] text-[#8590A2]">latex</span>
                        <button onClick={copyLatex} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#44546F] hover:bg-[#EBECF0]">
                          <Icon name={copiedLatex ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                          {copiedLatex ? 'Copied!' : 'Copy code'}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[11px] leading-relaxed">{latex}</pre>
                    </div>
                    <p className="border-t border-[#EBECF0] px-2.5 py-1.5 text-[12px] text-[#626F86]">PDF export compiles this source in an isolated container.</p>
                  </div>
                )}
                {latexError && <p className="mt-2 break-words text-[12px] text-red-700">{latexError}</p>}
                </section>
              )}

              {!stale && (
                <section>
                  <SectionHeading icon="file">Document preview</SectionHeading>
                  <p className="mt-1 text-[12px] text-[#626F86]">Department header and watermark applied on every page.</p>
                  <div className="mt-2 overflow-hidden rounded-lg border border-[#DFE1E6]">
                    <iframe title={`Document preview for ${issue.key}`} key={previewKey} src={`${apiBase}/api/v1/assignments/${issue.record.id}/html`} className="h-[420px] w-full bg-white" />
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
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

/* ------------------------------- modal shell ------------------------------ */

function ModalShell({ title, onClose, wide, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#091E42]/55" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} flex-col overflow-hidden rounded-xl bg-white shadow-[0_16px_48px_rgba(9,30,66,0.32)]`}>
        <div className="flex items-center gap-2 border-b border-[#DFE1E6] px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="ml-auto rounded p-1.5 text-[#626F86] hover:bg-[#F1F2F4]" title="Close">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

const modalInputCls =
  'w-full rounded-md border border-[#DFE1E6] bg-white px-2.5 py-2 text-[13px] placeholder:text-[#8590A2] hover:border-[#8590A2] focus:border-[#0C66E4] focus:outline-none focus:ring-1 focus:ring-[#0C66E4]'
const modalLabelCls = 'mb-1 block text-[12px] font-semibold text-[#44546F]'

/* ------------------------------- login modal ------------------------------ */

function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name } : { email, password }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Auth failed (${res.status})`)
      onLogin({ token: data.token, email })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={mode === 'login' ? 'Log in' : 'Register'} onClose={onClose}>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <div className="mb-3">
            <label className={modalLabelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={modalInputCls} />
          </div>
        )}
        <div className="mb-3">
          <label className={modalLabelCls}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={modalInputCls} />
        </div>
        <div className="mb-3">
          <label className={modalLabelCls}>Password (min 8 chars)</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={modalInputCls} />
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-[#0C66E4] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-70">
          {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Register'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="ml-3 text-[13px] text-[#0C66E4] hover:underline">
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
        </button>
      </form>
      <p className="mt-3 text-[12px] text-[#8590A2]">Tokens attach to every request once logged in. The API enforces login only when AUTH_REQUIRED=1.</p>
    </ModalShell>
  )
}

/* ------------------------------ templates modal ---------------------------- */

function TemplatesModal({ templates, onRefresh, notify, onClose }) {
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(e) {
    e.preventDefault()
    if (name.trim().length < 3) { setMsg('Name needs at least 3 characters.'); return }
    setBusy(true)
    setMsg('')
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/templates`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ name: name.trim() }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Create failed (${res.status})`)
      setName('')
      onRefresh()
      notify('success', 'Template created', `${data.template.name} v${data.template.version} (draft).`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function importPdf(e) {
    e.preventDefault()
    if (!file) { setMsg('Choose a sample PDF first.'); return }
    setBusy(true)
    setMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (name.trim()) form.append('name', name.trim())
      const res = await apiFetch(`${API_BASE}/api/v1/templates/from-pdf`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: AbortSignal.timeout(120000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Import failed (${res.status})`)
      setFile(null)
      onRefresh()
      notify('success', 'Template draft saved', `${data.template.name} — detected: ${(data.analysis?.detectedHeadings ?? []).join(', ') || 'no headings'}.`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Templates" wide onClose={onClose}>
      <div className="flex flex-col gap-2">
        {templates.map((t) => (
          <div key={`${t.id}@${t.version}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#DFE1E6] px-3 py-2">
            <div>
              <p className="text-[13px] font-semibold">{t.name}</p>
              <p className="font-mono text-[11px] text-[#8590A2]">{t.id} · tenant {t.tenantId ?? '—'}</p>
            </div>
            <span className="rounded-full bg-[#E9F2FF] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0055CC]">
              v{t.version} · {t.status}
            </span>
          </div>
        ))}
        {templates.length === 0 && <p className="text-[13px] text-[#626F86]">No templates found.</p>}
      </div>
      <div className="mt-4 border-t border-[#EBECF0] pt-4">
        <p className="text-[13px] font-semibold">New blank template</p>
        <form onSubmit={create} className="mt-2 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className={modalInputCls} />
          <button type="submit" disabled={busy} className="shrink-0 rounded-md bg-[#0C66E4] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-70">
            Create
          </button>
        </form>
      </div>
      <div className="mt-4 border-t border-[#EBECF0] pt-4">
        <p className="text-[13px] font-semibold">Import from sample PDF</p>
        <p className="mt-0.5 text-[12px] text-[#626F86]">Structure is extracted into a v1 draft for review. Uses the name above when set.</p>
        <form onSubmit={importPdf} className="mt-2 flex flex-col gap-2">
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px]" />
          <button type="submit" disabled={busy} className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#0C66E4] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-70">
            <Icon name="upload" className="h-4 w-4" />
            {busy ? 'Analyzing…' : 'Analyze & save draft'}
          </button>
        </form>
      </div>
      {msg && <p className="mt-3 break-words text-[13px] text-red-700">{msg}</p>}
    </ModalShell>
  )
}

/* ------------------------------ history modal ------------------------------ */

function HistoryModal({ onImport, onClose }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch(`${API_BASE}/api/v1/assignments`, { headers: authHeaders(), signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((d) => setItems(d.assignments ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <ModalShell title="Server history" wide onClose={onClose}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>}
      {items === null && !error && <p className="text-[13px] text-[#626F86]">Loading…</p>}
      {items !== null && items.length === 0 && <p className="text-[13px] text-[#626F86]">Nothing on the server yet.</p>}
      <div className="flex flex-col gap-2">
        {(items ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#DFE1E6] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{a.title || a.aim}</p>
              <p className="truncate font-mono text-[11px] text-[#8590A2]">
                {a.id} · {a.template?.id} v{a.template?.version} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <button onClick={() => onImport(a.id)} className="shrink-0 rounded-md border border-[#DFE1E6] px-2.5 py-1.5 text-[13px] font-medium text-[#44546F] hover:bg-[#F7F8FA]">
              Open in board
            </button>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

/* ------------------------------- create modal ------------------------------ */

function CreateModal({ initial, templates = [], onClose, onSubmit }) {
  const [form, setForm] = useState({
    aim: initial?.aim ?? '',
    description: initial?.description ?? '',
    subject: initial?.subject ?? 'DBMS',
    experimentNumber: initial?.experimentNumber ?? '',
    technology: initial?.technology ?? '',
    difficulty: initial?.difficulty ?? 'Intermediate',
    templateId: initial?.templateId ?? '',
    includeVivaTitle: initial?.includeVivaTitle ?? false,
    typedConclusion: initial?.typedConclusion ?? true,
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

          <div className="mt-3">
            <label className={labelCls} htmlFor="f-template">
              Template
            </label>
            <select id="f-template" value={form.templateId} onChange={(e) => set('templateId', e.target.value)} className={inputCls}>
              <option value="">Default (active template)</option>
              {templates.map((t) => (
                <option key={`${t.id}@${t.version}`} value={t.id}>
                  {t.name} v{t.version}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-md border border-[#DFE1E6] bg-[#FAFBFC] px-3 py-2.5">
            <label className="flex cursor-pointer items-start gap-2 text-[13px]">
              <input type="checkbox" checked={form.includeVivaTitle} onChange={(e) => set('includeVivaTitle', e.target.checked)} className="mt-0.5" />
              <span>
                Include Viva Questions heading
                <span className="block text-[12px] text-[#626F86]">Heading only — questions are handwritten by faculty, never generated. Off for most experiments.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-[13px]">
              <input type="checkbox" checked={form.typedConclusion} onChange={(e) => set('typedConclusion', e.target.checked)} className="mt-0.5" />
              <span>
                Type the conclusion
                <span className="block text-[12px] text-[#626F86]">Uncheck to leave handwriting space (conclusion itself is compulsory).</span>
              </span>
            </label>
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


