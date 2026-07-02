import { Inbox } from 'lucide-react'

export default function EmptyState({ message = 'No records found' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Inbox className="h-6 w-6 opacity-70" />
      </div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}
