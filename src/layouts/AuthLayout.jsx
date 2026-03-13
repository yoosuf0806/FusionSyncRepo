// Shared left-right split layout used on Pages 1–5 (login/selection pages)
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-hh-mint flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center gap-8 md:gap-0">

        {/* ── LEFT PANEL — Branding ──────────────────── */}
        <div className="flex flex-col items-center justify-center md:w-2/5 gap-4">
          {/* Logo circle */}
          <div className="w-36 h-36 rounded-full bg-hh-green flex items-center justify-center shadow-hh-lg">
            <svg viewBox="0 0 80 80" className="w-24 h-24" fill="none">
              {/* Two hands icon */}
              <path
                d="M20 55 C18 45 22 30 30 28 C34 27 36 30 36 34 L36 38 C36 36 38 33 42 33 C46 33 47 36 47 38 L47 36 C47 34 49 31 53 31 C57 31 58 34 58 37 L58 40 C58 38 60 36 63 36 C67 36 68 40 68 44 L68 52 C68 62 60 68 52 68 L35 68 C28 68 22 63 20 55Z"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />
              <path
                d="M36 34 L36 28 C36 24 33 21 30 21 C27 21 25 24 25 27 L25 42"
                stroke="white" strokeWidth="2.5" strokeLinecap="round"
              />
              <path d="M47 38 L47 30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M58 40 L58 33" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

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
