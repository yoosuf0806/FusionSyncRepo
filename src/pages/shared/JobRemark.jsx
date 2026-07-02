import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Star, CheckCircle2, Lock } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobById, saveRemark } from '../../services/jobService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

function StarRating({ rating, onChange, readOnly }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange && onChange(star)}
          className={cn('transition-transform', !readOnly && 'hover:scale-110 cursor-pointer', readOnly && 'cursor-default')}
        >
          <Star className={cn('h-8 w-8', star <= rating ? 'fill-warning text-warning' : 'fill-muted text-muted-foreground/40')} />
        </button>
      ))}
    </div>
  )
}

export default function JobRemark() {
  const { id } = useParams()
  const { user: authUser, isHelpee } = useAuth()
  const [dbUser, setDbUser] = useState(null)
  const [rating, setRating] = useState(0)
  const [remarkText, setRemarkText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [existsInDb, setExistsInDb] = useState(false)

  useEffect(() => {
    if (authUser) setDbUser(authUser)
    const load = async () => {
      try {
        const job = await getJobById(id)
        if (job.remark) {
          setRating(job.remark.rating || 0)
          setRemarkText(job.remark.remark_text || '')
          setExistsInDb(true)
        }
      } catch (e) { setError('Unable to load job remark') } finally { setLoading(false) }
    }
    load()
  }, [id, authUser])

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a star rating'); return }
    if (!dbUser) return
    setSaving(true); setError('')
    try {
      await saveRemark(id, dbUser.id, rating, remarkText)
      setSaved(true); setExistsInDb(true)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const remarkAlreadySubmitted = existsInDb
  const canEdit = !remarkAlreadySubmitted && isHelpee

  if (loading) return <MainLayout title="Job Rating"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="Job Rating">
      <div className="mx-auto max-w-2xl space-y-4">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}
        {saved && (
          <Alert variant="success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>Rating saved. This remark is now locked.</AlertDescription></Alert>
        )}
        {!saved && remarkAlreadySubmitted && (
          <Alert><Lock className="h-4 w-4" /><AlertDescription>This remark has already been submitted and cannot be edited.</AlertDescription></Alert>
        )}

        <Card>
          <CardHeader><CardTitle>Rate this job</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label>Your rating</Label>
              <StarRating rating={rating} onChange={canEdit ? setRating : undefined} readOnly={!canEdit} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="remark">Remarks</Label>
              <Textarea id="remark" className="min-h-[120px]" placeholder={canEdit ? 'Add a remark…' : 'No remarks'}
                value={remarkText} onChange={e => setRemarkText(e.target.value)} readOnly={!canEdit} />
            </div>
            {canEdit && !saved && (
              <Button onClick={handleSubmit} disabled={saving} className="px-8">{saving ? 'Saving…' : 'Submit rating'}</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
