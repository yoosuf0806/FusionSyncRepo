import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobById, saveRemark } from '../../services/jobService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

function StarRating({ rating, onChange, readOnly }) {
  return (
    <div className="flex gap-2 items-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange && onChange(star)}
          className={`text-2xl transition-colors ${
            star <= rating ? 'text-hh-star' : 'text-hh-node-off'
          } ${readOnly ? 'cursor-default' : 'hover:text-hh-star cursor-pointer'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function JobRemark() {
  const { id } = useParams()
  const { user: authUser, isHelpee, isAdmin } = useAuth()
  const [dbUser, setDbUser] = useState(null)
  const [rating, setRating] = useState(0)
  const [remarkText, setRemarkText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // authUser from context IS the DB user record
  useEffect(() => {
    if (authUser) setDbUser(authUser)
    const load = async () => {
      try {
        const job = await getJobById(id)
        if (job.remark) {
          setRating(job.remark.rating || 0)
          setRemarkText(job.remark.remark_text || '')
        }
      } catch (e) {
        setError('Unable to load job remark')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, authUser])

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a star rating'); return }
    if (!dbUser) return
    setSaving(true)
    setError('')
    try {
      await saveRemark(id, dbUser.id, rating, remarkText)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canEdit = isHelpee || isAdmin

  if (loading) return <MainLayout title="View Job Rating"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="View Job Rating">
      <div className="max-w-2xl mx-auto space-y-4">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}
        {saved && (
          <div className="bg-hh-green text-white rounded-hh px-4 py-3 text-sm font-medium">
            Rating saved successfully!
          </div>
        )}

        <h2 className="text-lg font-semibold text-hh-text">Job Rating</h2>

        <FormRow label="Rate">
          <div className="form-cell flex-1">
            <StarRating
              rating={rating}
              onChange={canEdit ? setRating : undefined}
              readOnly={!canEdit}
            />
          </div>
        </FormRow>

        <div className="flex gap-2">
          <div className="form-label flex-shrink-0 w-48">Remarks</div>
          <textarea
            className="form-cell flex-1 h-24 resize-none py-2 outline-none text-sm"
            placeholder={canEdit ? 'Add Remark' : 'No remarks yet'}
            value={remarkText}
            onChange={e => setRemarkText(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

        {canEdit && !saved && (
          <div className="flex">
            <button onClick={handleSubmit} disabled={saving} className="btn-action px-8">
              {saving ? 'Saving...' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
