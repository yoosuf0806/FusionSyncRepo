import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

// ── Auth / Public pages ───────────────────────────────────────────────────
import LoginPage     from './pages/LoginPage'

// ── Shared layout pages ───────────────────────────────────────────────────
import AdminHome         from './pages/admin/AdminHome'
import ManageUsers       from './pages/admin/ManageUsers'
import UserForm          from './pages/admin/UserForm'
import ManageJobs        from './pages/admin/ManageJobs'
import JobForm           from './pages/admin/JobForm'
import ManageJobSpecs    from './pages/admin/ManageJobSpecs'
import JobSpecForm       from './pages/admin/JobSpecForm'
import ManageSetup       from './pages/admin/ManageSetup'
import ManageDepartments from './pages/admin/ManageDepartments'
import DepartmentForm    from './pages/admin/DepartmentForm'
import SearchUsers       from './pages/admin/SearchUsers'

// ── Shared pages ──────────────────────────────────────────────────────────
import ProfilePage   from './pages/shared/ProfilePage'
import Notifications from './pages/shared/Notifications'
import JobRemark     from './pages/shared/JobRemark'
import ChangePassword from './pages/shared/ChangePassword'
import ForgotPassword from './pages/shared/ForgotPassword'
import ResetPassword  from './pages/shared/ResetPassword'

// ── Helpee home ───────────────────────────────────────────────────────────
import HelpeeHome from './pages/helpee/HelpeeHome'

// ── Role arrays ───────────────────────────────────────────────────────────
const ADMIN_ONLY      = ['admin']
const SUPERVISOR_ONLY = ['supervisor']
const HELPER_ONLY     = ['helper']
const HELPEE_ONLY     = ['helpee']

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── PUBLIC ────────────────────────────────────────────────── */}
          <Route path="/"                 element={<Navigate to="/login" replace />} />
          <Route path="/login"            element={<LoginPage />} />
          {/* Legacy role-specific login URLs — redirect to unified login */}
          <Route path="/login/admin"      element={<Navigate to="/login" replace />} />
          <Route path="/login/supervisor" element={<Navigate to="/login" replace />} />
          <Route path="/login/helper"     element={<Navigate to="/login" replace />} />
          <Route path="/login/helpee"     element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />

          {/* ── SHARED (all authenticated roles) ──────────────────────── */}
          <Route path="/notifications"
            element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/profile"
            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/change-password"
            element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          {/* Remark page: accessible to all authenticated users on the job */}
          <Route path="/jobs/:id/remark"
            element={<ProtectedRoute><JobRemark /></ProtectedRoute>} />
          {/* Legacy helpee remark URL — keep for existing deep-links */}
          <Route path="/helpee/jobs/:id/remark"
            element={<ProtectedRoute><JobRemark /></ProtectedRoute>} />

          {/* ────────────────────────────────────────────────────────────
              ADMIN prefix — admin only
          ──────────────────────────────────────────────────────────────*/}
          <Route path="/admin/home"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><AdminHome /></RoleRoute>} />

          <Route path="/admin/manage-users"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageUsers /></RoleRoute>} />
          <Route path="/admin/users/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><UserForm /></RoleRoute>} />
          <Route path="/admin/users/:id/edit"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><UserForm /></RoleRoute>} />
          <Route path="/admin/users/:id"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ProfilePage /></RoleRoute>} />

          <Route path="/admin/manage-jobs"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageJobs /></RoleRoute>} />
          <Route path="/admin/jobs/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobForm /></RoleRoute>} />
          <Route path="/admin/jobs/new/frequent"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobForm /></RoleRoute>} />
          <Route path="/admin/jobs/:id"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobForm /></RoleRoute>} />

          <Route path="/admin/job-specs"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageJobSpecs /></RoleRoute>} />
          <Route path="/admin/job-specs/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobSpecForm /></RoleRoute>} />
          <Route path="/admin/job-specs/:id/edit"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobSpecForm /></RoleRoute>} />

          <Route path="/admin/setup"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageSetup /></RoleRoute>} />

          <Route path="/admin/departments"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageDepartments /></RoleRoute>} />
          <Route path="/admin/departments/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><DepartmentForm /></RoleRoute>} />
          <Route path="/admin/departments/:id/edit"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><DepartmentForm /></RoleRoute>} />

          <Route path="/admin/search-users"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><SearchUsers /></RoleRoute>} />
          <Route path="/admin/search-users/dept"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><SearchUsers /></RoleRoute>} />

          {/* ────────────────────────────────────────────────────────────
              SUPERVISOR prefix — supervisor only
          ──────────────────────────────────────────────────────────────*/}
          <Route path="/supervisor/home"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><AdminHome /></RoleRoute>} />

          <Route path="/supervisor/manage-users"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><ManageUsers /></RoleRoute>} />
          <Route path="/supervisor/users/new"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><UserForm /></RoleRoute>} />
          <Route path="/supervisor/users/:id/edit"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><UserForm /></RoleRoute>} />
          <Route path="/supervisor/users/:id"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><ProfilePage /></RoleRoute>} />

          <Route path="/supervisor/manage-jobs"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><ManageJobs /></RoleRoute>} />
          <Route path="/supervisor/jobs/new"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><JobForm /></RoleRoute>} />
          <Route path="/supervisor/jobs/new/frequent"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><JobForm /></RoleRoute>} />
          <Route path="/supervisor/jobs/:id"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><JobForm /></RoleRoute>} />

          <Route path="/supervisor/job-specs"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><ManageJobSpecs /></RoleRoute>} />

          <Route path="/supervisor/search-users"
            element={<RoleRoute allowedRoles={SUPERVISOR_ONLY}><SearchUsers /></RoleRoute>} />

          {/* ────────────────────────────────────────────────────────────
              HELPER prefix — helper only
          ──────────────────────────────────────────────────────────────*/}
          <Route path="/helper/home"
            element={<RoleRoute allowedRoles={HELPER_ONLY}><AdminHome /></RoleRoute>} />
          <Route path="/helper/manage-jobs"
            element={<RoleRoute allowedRoles={HELPER_ONLY}><ManageJobs /></RoleRoute>} />
          <Route path="/helper/jobs/:id"
            element={<RoleRoute allowedRoles={HELPER_ONLY}><JobForm /></RoleRoute>} />

          {/* ────────────────────────────────────────────────────────────
              HELPEE prefix — helpee only
          ──────────────────────────────────────────────────────────────*/}
          <Route path="/helpee/home"
            element={<RoleRoute allowedRoles={HELPEE_ONLY}><HelpeeHome /></RoleRoute>} />
          <Route path="/helpee/jobs/new"
            element={<RoleRoute allowedRoles={HELPEE_ONLY}><JobForm /></RoleRoute>} />
          <Route path="/helpee/jobs/:id"
            element={<RoleRoute allowedRoles={HELPEE_ONLY}><JobForm /></RoleRoute>} />

          {/* ── 404 / catch-all → role home or landing ────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
