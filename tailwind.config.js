/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Helping Hands Design System ──────────────────────────────
        'hh-mint':        '#E8F5E9',   // Page background
        'hh-sidebar':     '#2E7D32',   // Left sidebar (dark green)
        'hh-accent':      '#2196F3',   // Sidebar accent line (blue)
        'hh-green':       '#4CAF50',   // Primary action buttons / active nodes
        'hh-green-med':   '#66BB6A',   // Selection card / expanded sidebar / select pills
        'hh-green-light': '#A5D6A7',   // Login buttons
        'hh-text':        '#212121',   // Primary text
        'hh-placeholder': '#9E9E9E',   // Placeholder text
        'hh-error':       '#F44336',   // Error states
        'hh-node-off':    '#BDBDBD',   // Inactive workflow nodes
        'hh-star':        '#FFC107',   // Star rating filled
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'hh': '8px',
        'hh-lg': '12px',
        'hh-xl': '16px',
        'hh-2xl': '20px',
        'pill': '9999px',
      },
      boxShadow: {
        'hh': '0 2px 8px rgba(0,0,0,0.10)',
        'hh-lg': '0 4px 16px rgba(0,0,0,0.12)',
      },
      minHeight: {
        'btn': '44px',
      },
    },
  },
  plugins: [],
}
