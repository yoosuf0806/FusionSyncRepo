export default function LoadingSpinner({ fullPage = false }) {
  if (fullPage) {
    return (
      <div className="min-h-screen bg-hh-mint flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-hh-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-hh-green border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
