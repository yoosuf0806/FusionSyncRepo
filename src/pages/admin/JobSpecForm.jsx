import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { jobSpecsHubPath } from '../../constants/jobPaths'
import { getJobSpecById, createJobSpec, updateJobSpec } from '../../services/jobSpecService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

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
    }).catch(e => {
      setError(e.message)
      setLoading(false)
    })
  }, [id, isEdit])

  const setQuestion = (i, val) => {
    setQuestions(prev => { const next = [...prev]; next[i] = val; return next })
  }
  const addQuestion = () => setQuestions(prev => [...prev, ''])
  const removeQuestion = (i) => setQuestions(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!specName.trim()) { setNameError('Job Type Name is required'); return }
    setNameError('')
    setSaving(true)
    setError('')
    try {
      const specData = {
        job_type_name: specName,
        daily_rate: parseFloat(dailyRate) || 0,
        hourly_rate: parseFloat(hourlyRate) || 0,
      }
      if (isEdit) {
        await updateJobSpec(id, specData, questions)
      } else {
        await createJobSpec(specData, questions)
      }
      navigate(jobSpecsHubPath(role))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const rateInput = 'form-cell flex-1 w-full outline-none text-sm'

  if (loading) return <MainLayout title="Job Specifications"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="Job Specifications">
      <div className="max-w-3xl mx-auto space-y-6">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {/* Job Type Details */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Job Type Details</h2>
          <div className="space-y-2">
            <FormRow label="Job Type ID" labelWidth="w-44">
              <div className="form-cell flex-1 text-sm text-hh-placeholder">{specId}</div>
            </FormRow>

            <FormRow label="Job Type Name" labelWidth="w-44">
              <input
                className={`form-cell flex-1 w-full outline-none text-sm ${nameError ? 'border border-hh-error' : ''}`}
                value={specName}
                onChange={e => { setSpecName(e.target.value); setNameError('') }}
                placeholder="Enter job type name"
              />
            </FormRow>
            {nameError && <p className="text-hh-error text-xs ml-48">{nameError}</p>}

            {/* Daily Rate — Admin only */}
            {isAdmin && (
              <FormRow label="Daily Rate" labelWidth="w-44">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={rateInput}
                  value={dailyRate}
                  onChange={e => setDailyRate(e.target.value)}
                  placeholder="0.00"
                />
              </FormRow>
            )}
            {isSupervisor && !isAdmin && (
              <FormRow label="Daily Rate" labelWidth="w-44">
                <div className="form-cell flex-1 text-sm text-hh-placeholder">
                  {dailyRate || '0.00'} <span className="text-xs">(read-only)</span>
                </div>
              </FormRow>
            )}

            {/* Hourly Rate — Admin only */}
            {isAdmin && (
              <FormRow label="Hourly Rate" labelWidth="w-44">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={rateInput}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                />
              </FormRow>
            )}
            {isSupervisor && !isAdmin && (
              <FormRow label="Hourly Rate" labelWidth="w-44">
                <div className="form-cell flex-1 text-sm text-hh-placeholder">
                  {hourlyRate || '0.00'} <span className="text-xs">(read-only)</span>
                </div>
              </FormRow>
            )}
          </div>
        </div>

        {/* Questions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Job Specific Questions</h2>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="form-cell flex-1 outline-none text-sm"
                  value={q}
                  onChange={e => setQuestion(i, e.target.value)}
                  placeholder="Question"
                />
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(i)}
                    className="btn-icon w-8 h-8 text-hh-error flex-shrink-0" title="Remove">✕</button>
                )}
              </div>
            ))}
            <button onClick={addQuestion} className="btn-add mt-2" title="Add question">⊕</button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-action px-8">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => navigate(jobSpecsHubPath(role))} className="btn-filter">Cancel</button>
        </div>
      </div>
    </MainLayout>
  )
}
