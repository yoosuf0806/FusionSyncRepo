import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Building2, ChevronRight } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { getBusinessSetup, saveBusinessSetup } from '../../services/businessService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ManageSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ business_name: '', business_address: '', business_reg_id: '', currency: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBusinessSetup().then(data => {
      if (data) setForm({
        business_name: data.business_name || '', business_address: data.business_address || '',
        business_reg_id: data.business_reg_id || '', currency: data.currency || '',
      })
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
    setSaved(false)
  }

  const validate = () => {
    const e = {}
    if (!form.business_name.trim()) e.business_name = 'Business name is required'
    if (!form.business_address.trim()) e.business_address = 'Business address is required'
    if (!form.business_reg_id.trim()) e.business_reg_id = 'Business Reg ID is required'
    if (form.currency && (form.currency.length < 2 || form.currency.length > 5)) e.currency = 'Currency must be 2–5 characters'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true); setError('')
    try { await saveBusinessSetup(form); setSaved(true) }
    catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const errClass = (field) => errors[field] ? 'border-destructive focus-visible:ring-destructive/30' : ''

  if (loading) return <MainLayout title="Manage Setup"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="Manage Setup">
      <div className="mx-auto max-w-2xl space-y-4">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}
        {saved && (
          <Alert variant="success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>Settings saved successfully.</AlertDescription></Alert>
        )}

        <Card>
          <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bname">Business name</Label>
              <Input id="bname" value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Business name" className={errClass('business_name')} />
              {errors.business_name && <p className="text-xs text-destructive">{errors.business_name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="baddr">Business address</Label>
              <Input id="baddr" value={form.business_address} onChange={e => set('business_address', e.target.value)} placeholder="Business address" className={errClass('business_address')} />
              {errors.business_address && <p className="text-xs text-destructive">{errors.business_address}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="breg">Business Reg ID</Label>
                <Input id="breg" value={form.business_reg_id} onChange={e => set('business_reg_id', e.target.value)} placeholder="Registration ID" className={errClass('business_reg_id')} />
                {errors.business_reg_id && <p className="text-xs text-destructive">{errors.business_reg_id}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bcur">Currency</Label>
                <Input id="bcur" value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="e.g. LKR" className={errClass('currency')} />
                {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <button onClick={() => navigate('/admin/departments')}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">Configure Departments</span>
            <span className="block text-xs text-muted-foreground">Manage departments and their members</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex pt-1">
          <Button onClick={handleSave} disabled={saving} className="px-10">{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </MainLayout>
  )
}
