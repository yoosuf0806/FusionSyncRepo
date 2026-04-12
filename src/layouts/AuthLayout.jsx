import logo from '../assets/logo.png'
// Shared left-right split layout used on Pages 1–5 (login/selection pages)
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-hh-mint flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center gap-8 md:gap-0">

        {/* ── LEFT PANEL — Branding ──────────────────── */}
        <div className="flex flex-col items-center justify-center md:w-2/5 gap-4">
          {/* Logo */}
          <img src={logo} alt="FusionSync Logo" className="w-36 h-36 rounded-full object-cover shadow-hh-lg" />

          {/* Brand name */}
          <p className="text-hh-text font-medium text-lg text-center">
            FusionSync Business
          </p>
        </div>

        {/* ── RIGHT PANEL — Card ─────────────────────── */}
        <div className="md:w-3/5 w-full">
          <div className="bg-hh-green-med rounded-hh-2xl shadow-hh-lg p-8 md:p-12 flex flex-col items-center gap-6">
            {children}
          </div>
        </div>

      </div>
    </div>
  )
}
