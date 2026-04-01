export default function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-hh-error text-hh-error text-sm rounded-hh px-4 py-2.5 flex items-center justify-between gap-3">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-hh-error hover:text-red-700 font-bold flex-shrink-0">✕</button>
      )}
    </div>
  )
}
