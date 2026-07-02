import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <Alert variant="destructive" className="flex items-start gap-2 pr-10">
      <AlertCircle className="h-4 w-4 mt-0.5" />
      <AlertDescription className="flex-1">{message}</AlertDescription>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-destructive/70 hover:text-destructive transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  )
}
