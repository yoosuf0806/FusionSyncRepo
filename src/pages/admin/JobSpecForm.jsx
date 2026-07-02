import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { jobSpecsHubPath } from '../../constants/jobPaths'
import { getJobSpecById, createJobSpec, updateJobSpec } from '../../services/jobSpecService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function JobSpecForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isAdmin, isSupervisor, role } = useAuth()
  const isEdit = Boolean(id)

  const [specId, setSpecId] = useState('Auto-generated')
  const [specName, setSpecName] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [questions, setQuestions] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    getJobSpecById(id).then(spec => {
      setSpecId(spec.job_type_id)
      setSpecName(spec.job_type_name)
      setDailyRate(spec.daily_rate != null ? String(spec.daily_rate) : '')
      setHourlyRate(spec.hourly_rate != null ? String(spec.hourly_rate) : '')
      const qs = spec.questions.map(q => q.question_text)
      while (qs.length < 4) qs.push('')
      setQuestions(qs)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [id, isEdit])

  const setQuestion = (i, val) => setQuestions(prev => { const next = [...prev]; next[i] = val; return next })
  const addQuestion = () => setQuestions(prev => [...prev, ''])
  const removeQuestion = (i) => setQuestions(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!specName.trim()) { setNameError('Job type name is required'); return }
    setNameError('')
    setSaving(true)
    setError('')
    try {
      const specData = { job_type_name: specName, daily_rate: parseFloat(dailyRate) || 0, hourly_rate: parseFloat(hourlyRate) || 0 }
      if (isEdit) await updateJobSpec(id, specData, questions)
      else await createJobSpec(specData, questions)
      navigate(jobSpecsHubPath(role))
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (loading) return <MainLayout title="Job Specifications"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title={isEdit ? 'Edit Job Type' : 'New Job Type'}>
      <div className="mx-auto max-w-2xl space-y-6">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        <Card>
          <CardHeader><CardTitle>Job type details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Job type ID</Label>
              <Input value={specId} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sname">Job type name</Label>
              <Input id="sname" value={specName} onChange={e => { setSpecName(e.target.value); setNameError('') }}
                placeholder="Enter job type name" className={nameError ? 'border-destructive focus-visible:ring-destructive/30' : ''} />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="drate">Daily rate</Label>
                {isAdmin
                  ? <Input id="drate" type="number" min="0" step="0.01" value={dailyRate} onChange={e => setDailyRate(e.target.value)} placeholder="0.00" />
                  : <Input value={`${dailyRate || '0.00'} (read-only)`} disabled />}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hrate">Hourly rate</Label>
                {isAdmin
                  ? <Input id="hrate" type="number" min="0" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="0.00" />
                  : <Input value={`${hourlyRate || '0.00'} (read-only)`} disabled />}
              </div>
            </div>
            {isSupervisor && !isAdmin && <p className="text-xs text-muted-foreground">Rates are managed by administrators.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Job-specific questions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={q} onChange={e => setQuestion(i, e.target.value)} placeholder={`Question ${i + 1}`} />
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" title="Remove" onClick={() => removeQuestion(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addQuestion}><Plus className="h-4 w-4" /> Add question</Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="px-8">{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={() => navigate(jobSpecsHubPath(role))}>Cancel</Button>
        </div>
      </div>
    </MainLayout>
  )
}
