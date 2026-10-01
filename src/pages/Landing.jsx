import { Link } from 'react-router-dom'
import { Button, Card } from '../components/ui.jsx'

export default function Landing() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">AssignmentAI</h1>
      <p className="mt-4 text-lg text-ink-500">
        An assignment compiler: aim in, structured academic document out — preview, DOCX, LaTeX, PDF.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/create"><Button>Create assignment</Button></Link>
        <Link to="/history"><Button variant="secondary">History</Button></Link>
        <Link to="/templates"><Button variant="secondary">Templates</Button></Link>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          ['1. Describe', 'Aim plus optional subject, experiment number, technology.'],
          ['2. Generate', 'Validated sections — never viva questions, never invented results.'],
          ['3. Export', 'College header + 50% watermark on every page, DOCX / LaTeX / PDF.'],
        ].map(([h, p]) => (
          <Card key={h}><h3 className="font-semibold">{h}</h3><p className="mt-1 text-sm text-ink-500">{p}</p></Card>
        ))}
      </div>
    </div>
  )
}
