import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, CalendarClock, ListFilter, Wallet, TrendingUp } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getJobsForHelpee } from '../../services/jobService'
import { getHelpeeDashboard } from '../../services/dashboardService'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import { JOB_STATUS_LABELS, JOB_STATUS_FILTERS } from '../../constants/jobStatuses'
import { jobDetailPath, jobNewPath, jobsHubPath } from '../../constants/jobPaths'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function statusVariant(status) {
  if (JOB_STATUS_FILTERS.COMPLETED.includes(status)) return 'success'
  if (JOB_STATUS_FILTERS.ONGOING.includes(status)) return 'warning'
  return 'muted'
}

function StatCard({ label, value, icon: Icon, accent, money, loading, onClick }) {
  return (
    <Card
      onClick={onClick}
      className={cn('flex flex-col gap-2 p-5', onClick && 'cursor-pointer transition-all hover:border-primary/40 hover:shadow-hh-lg')}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <span className={cn('text-3xl font-bold leading-none tracking-tight', accent ? 'text-primary' : 'text-foreground')}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          : money ? (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : (value ?? 0)}
      </span>
    </Card>
  )
}

export default function HelpeeHome() {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!authUser?.id) return
    getJobsForHelpee(authUser.id).then(data => { setJobs(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    getHelpeeDashboard(authUser.id).then(setStats).catch(() => setStats({}))
  }, [authUser])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'
  const statsLoading = stats === null

  return (
    <MainLayout title="My Jobs">
      <div className="space-y-8">

        {/* Account balance */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account Balance</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Amount Spent" value={stats?.amount_spent} icon={Wallet} money loading={statsLoading} />
            <StatCard label="Pending Payable" value={stats?.amount_payable} icon={TrendingUp} accent money loading={statsLoading}
              onClick={() => navigate(jobsHubPath(role))} />
          </div>
        </section>

        {/* My jobs */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">My Jobs</h2>
            <Button onClick={() => setShowTypeModal(true)}><Plus className="h-4 w-4" /> New Request</Button>
          </div>

          {error && <ErrorBanner message={error} onClose={() => setError('')} />}

          <Card className="overflow-hidden">
            {loading ? (
              <LoadingSpinner />
            ) : jobs.length === 0 ? (
              <EmptyState message="No jobs assigned to you yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[110px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id} className="cursor-pointer" onClick={() => navigate(jobDetailPath(role, job.id))}>
                      <TableCell className="font-medium text-primary">{job.job_id}</TableCell>
                      <TableCell className="font-medium text-foreground">{job.job_name}</TableCell>
                      <TableCell className="text-muted-foreground">{job.job_specifications?.job_type_name || '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(job.job_from_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>

        {/* Overview */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Ongoing Jobs" value={stats?.ongoing} loading={statsLoading} />
            <StatCard label="Completed Jobs" value={stats?.completed} accent loading={statsLoading} />
            <StatCard label="Payment Confirmed" value={stats?.payment_confirmed} loading={statsLoading} />
          </div>
        </section>
      </div>

      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a new job</DialogTitle>
            <DialogDescription>Choose the type of service you need.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'one-time' } }) }}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <CalendarClock className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">One-Time Job</span>
            </button>
            <button
              onClick={() => { setShowTypeModal(false); navigate(jobNewPath(role), { state: { category: 'frequent' } }) }}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <ListFilter className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">Recurring Job</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}
