import logo from '../assets/logo.png'
import { Card } from '@/components/ui/card'

// Centered auth shell used on login / forgot / reset / selection pages
export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center p-4">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="FusionSync" className="h-20 w-20 rounded-2xl object-cover shadow-hh-lg ring-1 ring-border" />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">FusionSync</h1>
            <p className="text-sm text-muted-foreground">Field-services operations</p>
          </div>
        </div>

        <Card className="w-full p-6 sm:p-8 shadow-hh-lg">
          {children}
        </Card>
      </div>
    </div>
  )
}
