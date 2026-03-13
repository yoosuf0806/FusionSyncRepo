// Page 6 — Admin Home Dashboard
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'

const NAV_CARDS = [
  {
    label: ['Manage', 'Users'],
    path: (role) => `/${role}/manage-users`,
    roles: ['admin', 'supervisor'],
  },
  {
    label: ['Manage', 'Jobs'],
    path: (role) => `/${role}/manage-jobs`,
    roles: ['admin', 'supervisor', 'helper', 'helpee'],
  },
  {
    label: ['Manage', 'Job', 'Specifications'],
    path: (role) => `/${role}/job-specs`,
    roles: ['admin', 'supervisor'],
  },
  {
    label: ['Manage', 'Setup'],
    path: () => '/admin/setup',
    roles: ['admin'],
  },
]

export default function AdminHome() {
  const navigate = useNavigate()
  const { role } = useAuth()

  const visibleCards = NAV_CARDS.filter(c => c.roles.includes(role))

  return (
    <MainLayout title="Home">
      <div className="flex items-start justify-center pt-8">
        <div className="flex flex-wrap gap-6 justify-center">
          {visibleCards.map((card, i) => (
            <button
              key={i}
              onClick={() => navigate(card.path(role))}
              className="
                bg-hh-green-med text-white rounded-hh-xl shadow-hh
                w-36 h-32 flex flex-col items-center justify-center gap-1
                hover:bg-green-500 active:scale-95 transition-all duration-150 cursor-pointer
              "
            >
              {card.label.map((line, j) => (
                <span key={j} className="text-sm font-medium leading-tight">{line}</span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
