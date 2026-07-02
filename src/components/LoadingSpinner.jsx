import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ fullPage = false }) {
  const spinner = <Loader2 className="h-8 w-8 animate-spin text-primary" />
  if (fullPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {spinner}
      </div>
    )
  }
  return <div className="flex items-center justify-center py-16">{spinner}</div>
}
