export default function ConfirmModal({ message, onConfirm, onCancel, loading = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-hh-xl shadow-hh-lg p-6 w-full max-w-sm mx-4">
        <p className="text-hh-text text-sm mb-6 text-center leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-hh-text font-medium rounded-hh py-2.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-hh-error hover:bg-red-600 text-white font-medium rounded-hh py-2.5 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
