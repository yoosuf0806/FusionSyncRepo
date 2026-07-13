import { useState, useEffect } from 'react'
import { Briefcase, Wallet, Clock, Users } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { getReports } from '../../services/reportService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorBanner from '../../components/ErrorBanner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}><Icon className="h-4 w-4" /></span>
      </div>
      <div className={cn('mt-2 text-3xl font-bold tracking-tight', accent && 'text-primary')}>{value}</div>
    </Card>
  )
}

function BarList({ title, items, tone = 'primary' }) {
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : items.map(it => (
          <div key={it.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{it.label}</span>
              <span className="font-semibold tabular-nums text-muted-foreground">{it.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-warning')} style={{ width: `${(it.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { getReports().then(setData).catch(e => setError(e.message)) }, [])

  return (
    <MainLayout title="Reports">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational and financial overview across the business.</p>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError('')} />}

        {!data && !error ? <LoadingSpinner /> : data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat icon={Briefcase} label="Total Jobs" value={data.jobsTotal} />
              <Stat icon={Wallet} label="Collected" value={money(data.revenue.collected)} accent />
              <Stat icon={Wallet} label="Outstanding" value={money(data.revenue.outstanding)} />
              <Stat icon={Clock} label="Approved Hours" value={data.approvedHours} />
            </div>

            {/* Revenue */}
            <Card>
              <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Invoiced</span><span className="font-semibold tabular-nums">{money(data.revenue.invoiced)}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${data.revenue.collectionRate}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary">Collected {money(data.revenue.collected)} ({data.revenue.collectionRate}%)</span>
                  <span className="text-muted-foreground">Outstanding {money(data.revenue.outstanding)}</span>
                </div>
                {data.revenue.collectionRate === 0 && data.revenue.invoiced > 0 && (
                  <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">No jobs have reached Payment Confirmed or Job Closed yet, so nothing is counted as collected. Move jobs through to payment to close the loop.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <BarList title="Jobs by status" items={data.jobsByStatus} />
              <BarList title="Jobs by department" items={data.jobsByDept} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <BarList title="Jobs by type" items={Object.entries(data.byCategory).map(([label, value]) => ({ label, value }))} tone="warning" />
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Active workforce</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {Object.entries(data.roleCounts).map(([role, n]) => (
                    <div key={role} className="rounded-lg border border-border p-3">
                      <div className="text-2xl font-bold">{n}</div>
                      <div className="text-xs capitalize text-muted-foreground">{role}{n === 1 ? '' : 's'}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
