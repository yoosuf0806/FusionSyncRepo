import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { getBusinessSetup, saveBusinessSetup } from '../../services/businessService'
import FormRow from '../../components/FormRow'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'

export default function ManageSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    business_name: '', business_address: '', business_reg_id: '', currency: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBusinessSetup().then(data => {
      if (data) {
        setForm({
          business_name: data.business_name || '',
          business_address: data.business_address || '',
          business_reg_id: data.business_reg_id || '',
          currency: data.currency || '',
        })
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
    setSaved(false)
  }

  const validate = () => {
    const e = {}
    if (!form.business_name.trim()) e.business_name = 'Business Name is required'
    if (!form.business_address.trim()) e.business_address = 'Business Address is required'
    if (!form.business_reg_id.trim()) e.business_reg_id = 'Business Reg ID is required'
    if (form.currency && (form.currency.length < 2 || form.currency.length > 5)) {
      e.currency = 'Currency must be 2–5 characters'
    }
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    setError('')
    try {
      await saveBusinessSetup(form)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) =>
    `form-cell flex-1 w-full outline-none text-sm ${errors[field] ? 'border border-hh-error' : ''}`

  if (loading) return <MainLayout title="Manage Setup"><LoadingSpinner /></MainLayout>

  return (
    <MainLayout title="Manage Setup">
      <div className="max-w-2xl mx-auto space-y-3">
        {error && <ErrorBanner message={error} onClose={() => setError('')} />}
        {saved && (
          <div className="bg-hh-green text-white rounded-hh px-4 py-3 text-sm font-medium">
            Settings saved successfully!
          </div>
        )}

        <FormRow label="Business Name" labelWidth="w-52">
          <input className={inputClass('business_name')} value={form.business_name}
            onChange={e => set('business_name', e.target.value)} placeholder="Business Name" />
        </FormRow>
        {errors.business_name && <p className="text-hh-error text-xs">{errors.business_name}</p>}

        <FormRow label="Business Address" labelWidth="w-52">
          <input className={inputClass('business_address')} value={form.business_address}
            onChange={e => set('business_address', e.target.value)} placeholder="Business Address" />
        </FormRow>
        {errors.business_address && <p className="text-hh-error text-xs">{errors.business_address}</p>}

        <FormRow label="Business Reg ID" labelWidth="w-52">
          <input className={inputClass('business_reg_id')} value={form.business_reg_id}
            onChange={e => set('business_reg_id', e.target.value)} placeholder="Registration ID" />
        </FormRow>
        {errors.business_reg_id && <p className="text-hh-error text-xs">{errors.business_reg_id}</p>}

        <FormRow label="Currency" labelWidth="w-52">
          <input className={inputClass('currency')} value={form.currency}
            onChange={e => set('currency', e.target.value)} placeholder="e.g. AUD, USD" />
        </FormRow>
        {errors.currency && <p className="text-hh-error text-xs">{errors.currency}</p>}

        <FormRow label="View Departments" labelWidth="w-52">
          <button onClick={() => navigate('/admin/departments')} className="btn-select w-full">
            Configure Departments
          </button>
        </FormRow>

        <div className="flex pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-action px-10">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
