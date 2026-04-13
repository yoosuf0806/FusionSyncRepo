/**
 * Two-step job creation picker:
 *   Step 1 — choose category: One-Time or Frequent
 *   Step 2 — choose job specification (job type) from the list
 *
 * On completion, calls onSelect({ category, job_type_id, job_type_name })
 * so the caller can navigate to JobForm with the full state pre-filled.
 */
import { useState, useEffect } from 'react'
import { getJobSpecs } from '../services/jobSpecService'
import LoadingSpinner from './LoadingSpinner'

export default function JobTypePickerModal({ onSelect, onClose }) {
  const [step, setStep] = useState(1)           // 1 = category, 2 = spec
  const [category, setCategory] = useState(null) // 'one-time' | 'frequent'
  const [specs, setSpecs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (step === 2) {
      setLoading(true)
      getJobSpecs({ activeOnly: true })
        .then(data => { setSpecs(data); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
    }
  }, [step])

  const handleCategorySelect = (cat) => {
    setCategory(cat)
    setStep(2)
  }

  const handleSpecSelect = (spec) => {
    onSelect({ category, job_type_id: spec.id, job_type_name: spec.job_type_name })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-hh-mint rounded-hh-xl shadow-hh-lg w-full max-w-sm p-8 space-y-6">

        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-center text-hh-text">Select Job Category</h2>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => handleCategorySelect('one-time')}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                One-Time Job
              </button>
              <button
                type="button"
                onClick={() => handleCategorySelect('frequent')}
                className="flex-1 py-4 bg-white text-hh-text font-medium rounded-hh border-2 border-hh-green hover:bg-hh-green hover:text-white transition-colors"
              >
                Frequent Job
              </button>
            </div>
            <button type="button" onClick={onClose} className="w-full btn-filter text-sm">
              Cancel
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-hh-green text-sm hover:opacity-70 transition-opacity"
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold text-hh-text flex-1 text-center pr-8">
                Select Job Type
              </h2>
            </div>

            <p className="text-xs text-hh-placeholder text-center -mt-2 capitalize">
              Category: <span className="font-medium text-hh-text">{category}</span>
            </p>

            {error && (
              <p className="text-hh-error text-xs text-center">{error}</p>
            )}

            {loading ? (
              <div className="flex justify-center py-4"><LoadingSpinner /></div>
            ) : specs.length === 0 ? (
              <p className="text-sm text-hh-placeholder text-center py-2">
                No job types available. Ask an admin to create job specifications.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {specs.map(spec => (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => handleSpecSelect(spec)}
                    className="w-full py-3 px-4 bg-white text-hh-text text-sm font-medium rounded-hh border-2 border-transparent hover:border-hh-green hover:bg-hh-green/10 transition-colors text-left"
                  >
                    {spec.job_type_name}
                  </button>
                ))}
              </div>
            )}

            <button type="button" onClick={onClose} className="w-full btn-filter text-sm">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
