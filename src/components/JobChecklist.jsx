import { useState, useEffect } from 'react'
import { Plus, X, Check, ListChecks } from 'lucide-react'
import { getTasksForJob, addTask, deleteTask, toggleTask } from '../services/jobTaskService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Per-job task checklist. Self-loads. `canManage` shows add/delete controls;
 * everyone with access can tick items. `compact` tightens spacing for cards.
 */
export default function JobChecklist({ jobId, canManage = false, userId, compact = false }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    getTasksForJob(jobId).then(t => { if (alive) { setTasks(t); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [jobId])

  const onToggle = async (task) => {
    const next = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: next } : t))
    try { await toggleTask(task.id, next, userId) }
    catch { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: !next } : t)) }
  }

  const onAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setBusy(true); setErr('')
    try {
      const created = await addTask(jobId, title, tasks.length)
      setTasks(prev => [...prev, created])
      setNewTitle('')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const onDelete = async (task) => {
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try { await deleteTask(task.id) } catch { /* best-effort */ }
  }

  const doneCount = tasks.filter(t => t.is_done).length

  if (loading) return <p className="text-sm text-muted-foreground">Loading checklist…</p>

  if (tasks.length === 0 && !canManage) {
    return <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ListChecks className="h-4 w-4" /> No tasks for this job.</p>
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {tasks.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{doneCount} of {tasks.length} done</span>
          <div className="ml-3 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {tasks.map(task => (
          <li key={task.id} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onToggle(task)}
              className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                task.is_done ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:border-primary')}
              aria-pressed={task.is_done}
            >
              {task.is_done && <Check className="h-3.5 w-3.5" />}
            </button>
            <span className={cn('flex-1 text-sm', task.is_done ? 'text-muted-foreground line-through' : 'text-foreground')}>{task.title}</span>
            {canManage && (
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="flex items-center gap-2 pt-1">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} placeholder="Add a task…" className="h-9" />
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onAdd} disabled={busy || !newTitle.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
