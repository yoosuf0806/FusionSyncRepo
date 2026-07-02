import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SearchInput({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-4 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
      />
    </div>
  )
}
