export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000'

export const SUBJECTS = ['DBMS', 'DSA', 'UHV', 'DLDCA', 'Professional Skills / AWS']

// Auth token lives in memory only (no browser storage): reloading logs out.
let memoryToken = '';

export function getToken() {
  return memoryToken;
}

export function setToken(token) {
  memoryToken = token ?? '';
}

function authHeaders(extra = {}) {
  const token = getToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

async function handle(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? data?.detail ?? `Request failed (${res.status})`)
  return data
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
  return handle(res)
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
  return handle(res)
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  return handle(res)
}

// Downloads a binary export (docx/pdf) via blob URL.
export async function apiDownload(path, filename) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: path.endsWith('/pdf') ? 'POST' : 'GET',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: path.endsWith('/pdf') ? '{}' : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error ?? `Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function apiUploadPdf(path, file, extra = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  return handle(res)
}

