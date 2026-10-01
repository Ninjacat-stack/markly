import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost, setToken } from '../lib/api.js'
import { Button, Card, ErrorText, Field, inputCls } from '../components/ui.jsx'

export default function Login() {
  const navigate = useNavigate()
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
      const out = await apiPost(`/api/v1/auth/${mode}`, mode === 'register' ? { email, password, name } : { email, password })
      setToken(out.token)
      navigate('/create')
    } catch (err) {
      setError(String(err.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h2 className="text-2xl font-bold">{mode === 'login' ? 'Log in' : 'Register'}</h2>
      <Card className="mt-4">
        <form onSubmit={submit}>
          {mode === 'register' && (
            <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          )}
          <Field label="Email"><input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password (min 8 chars)">
            <input className={inputCls} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Register'}</Button>
          <ErrorText error={error} />
        </form>
        <button className="mt-3 text-sm text-jira-600 underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
        </button>
      </Card>
    </div>
  )
}
