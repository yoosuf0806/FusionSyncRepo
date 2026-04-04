// Page 6 — Admin / Supervisor / Helper Home Dashboard
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  jobsHubPath, usersHubPath, jobSpecsHubPath,
} from '../../constants/jobPaths'

const NAV_CARDS = [
  {
    label: ['Manage', 'Users'],
    pathForRole: (r) => usersHubPath(r),
    roles: ['admin', 'supervisor'],
  },
  {
    label: ['Manage', 'Jobs'],
    pathForRole: (r) => jobsHubPath(r),
    roles: ['admin', 'supervisor', 'helper'],
  },
  {
    label: ['Manage', 'Job', 'Specifications'],
    pathForRole: (r) => jobSpecsHubPath(r),
    roles: ['admin', 'supervisor'],
  },
  {
    label: ['Manage', 'Setup'],
    pathForRole: () => '/admin/setup',
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
              onClick={() => navigate(card.pathForRole(role))}
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
