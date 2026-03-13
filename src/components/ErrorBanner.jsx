export default function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-hh-error text-hh-error text-sm rounded-hh px-4 py-2.5">
      {message}
    </div>
  )
}
