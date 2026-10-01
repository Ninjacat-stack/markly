import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, SUBJECTS } from '../lib/api.js'
import { Button, Card, ErrorText, Field, StatusBadge, inputCls } from '../components/ui.jsx'

export default function Create() {
  const navigate = useNavigate()
  const [background, setBackground] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { aim: 'Explore subqueries in SQL', subject: 'DBMS', experimentNumber: '7', technology: 'SQL', description: '' },
  })

  const sync = useMutation({
    mutationFn: (values) => apiPost('/api/v1/assignments/generate', {
      aim: values.aim,
      description: values.description || undefined,
      subject: values.subject,
      experimentNumber: values.experimentNumber ? Number(values.experimentNumber) : undefined,
      technology: values.technology || undefined,
    }),
    onSuccess: (data) => navigate(`/assignments/${data.id}`),
  })

  const asyncJob = useMutation({
    mutationFn: (values) => apiPost('/api/v1/jobs', {
      type: 'generate',
      input: {
        aim: values.aim,
        description: values.description || undefined,
        subject: values.subject,
        experimentNumber: values.experimentNumber ? Number(values.experimentNumber) : undefined,
        technology: values.technology || undefined,
      },
    }),
  })

  const onSubmit = (values) => (background ? asyncJob.mutate(values) : sync.mutate(values))

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h2 className="text-2xl font-bold">Create assignment</h2>
      <Card className="mt-4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Field label="Aim *">
            <input className={inputCls} placeholder="e.g. Explore subqueries in SQL"
              {...register('aim', { required: 'Aim is required', minLength: { value: 4, message: 'Aim is too short' } })} />
            {errors.aim && <span className="text-xs text-red-600">{errors.aim.message}</span>}
          </Field>
          <Field label="Description (optional)">
            <textarea className={inputCls} rows={2} {...register('description')} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Subject">
              <select className={inputCls} {...register('subject')}>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Experiment number">
              <input className={inputCls} inputMode="numeric" {...register('experimentNumber')} />
            </Field>
            <Field label="Technology">
              <input className={inputCls} {...register('technology')} />
            </Field>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} />
            Run as background job (pollable progress)
          </label>
          <Button type="submit" disabled={sync.isPending || asyncJob.isPending}>
            {(sync.isPending || asyncJob.isPending) ? 'Working…' : 'Generate'}
          </Button>
          <ErrorText error={sync.error ?? asyncJob.error} />
        </form>
      </Card>

      {asyncJob.data && <JobProgress jobId={asyncJob.data.job.id} />}
    </div>
  )
}

function JobProgress({ jobId }) {
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const { job: j } = await apiGet(`/api/v1/jobs/${jobId}`)
        if (!alive) return
        setJob(j)
        if (j.status === 'completed' && j.assignmentId) navigate(`/assignments/${j.assignmentId}`)
      } catch (e) {
        if (alive) setError(String(e.message ?? e))
      }
    }
    poll()
    const timer = setInterval(poll, 2500)
    return () => { alive = false; clearInterval(timer) }
  }, [jobId, navigate])
  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 text-sm">
        <span>Job <code>{jobId}</code></span>
        {job ? <StatusBadge status={job.status} /> : <span>starting…</span>}
      </div>
      {job?.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  )
}
