import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

// ── Auth / Public pages ───────────────────────────────────────────────────
import UserSelection from './pages/UserSelection'
import LoginPage     from './pages/LoginPage'

// ── Admin / Shared pages ─────────────────────────────────────────────────
import AdminHome           from './pages/admin/AdminHome'
import ManageUsers         from './pages/admin/ManageUsers'
import UserForm            from './pages/admin/UserForm'
import ManageJobs          from './pages/admin/ManageJobs'
import JobForm             from './pages/admin/JobForm'
import ManageJobSpecs      from './pages/admin/ManageJobSpecs'
import JobSpecForm         from './pages/admin/JobSpecForm'
import ManageSetup         from './pages/admin/ManageSetup'
import ManageDepartments   from './pages/admin/ManageDepartments'
import DepartmentForm      from './pages/admin/DepartmentForm'
import SearchUsers         from './pages/admin/SearchUsers'

// ── Shared pages ────────────────────────────────────────────────────────
import ProfilePage     from './pages/shared/ProfilePage'
import Notifications   from './pages/shared/Notifications'
import JobRemark       from './pages/shared/JobRemark'
import ChangePassword  from './pages/shared/ChangePassword'

// ── Helpee ──────────────────────────────────────────────────────────────
import HelpeeHome from './pages/helpee/HelpeeHome'

const ALL_ROLES = ['admin', 'supervisor', 'helper', 'helpee']
const MANAGE_ROLES = ['admin', 'supervisor']
const ADMIN_ONLY = ['admin']
const JOB_ROLES = ['admin', 'supervisor', 'helper', 'helpee']

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── PUBLIC ─────────────────────────────────────────────────── */}
          <Route path="/"                 element={<UserSelection />} />
          <Route path="/login/admin"      element={<LoginPage role="admin" />} />
          <Route path="/login/supervisor" element={<LoginPage role="supervisor" />} />
          <Route path="/login/helper"     element={<LoginPage role="helper" />} />
          <Route path="/login/helpee"     element={<LoginPage role="helpee" />} />

          {/* ── ROLE HOMES ──────────────────────────────────────────────── */}
          <Route path="/admin/home"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><AdminHome /></RoleRoute>} />
          <Route path="/supervisor/home"
            element={<RoleRoute allowedRoles={['supervisor']}><AdminHome /></RoleRoute>} />
          <Route path="/helper/home"
            element={<RoleRoute allowedRoles={['helper']}><AdminHome /></RoleRoute>} />
          <Route path="/helpee/home"
            element={<RoleRoute allowedRoles={['helpee']}><HelpeeHome /></RoleRoute>} />

          {/* ── MANAGE USERS ─────────────────────────────────────────────── */}
          <Route path="/admin/manage-users"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><ManageUsers /></RoleRoute>} />
          <Route path="/admin/users/new"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><UserForm /></RoleRoute>} />
          <Route path="/admin/users/:id/edit"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><UserForm /></RoleRoute>} />
          <Route path="/admin/users/:id"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><ProfilePage /></RoleRoute>} />

          {/* ── MANAGE JOBS ──────────────────────────────────────────────── */}
          <Route path="/admin/manage-jobs"
            element={<RoleRoute allowedRoles={JOB_ROLES}><ManageJobs /></RoleRoute>} />
          <Route path="/admin/jobs/new"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><JobForm /></RoleRoute>} />
          <Route path="/admin/jobs/new/frequent"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><JobForm /></RoleRoute>} />
          <Route path="/admin/jobs/:id"
            element={<RoleRoute allowedRoles={JOB_ROLES}><JobForm /></RoleRoute>} />

          {/* ── MANAGE JOB SPECS ─────────────────────────────────────────── */}
          <Route path="/admin/job-specs"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><ManageJobSpecs /></RoleRoute>} />
          <Route path="/admin/job-specs/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobSpecForm /></RoleRoute>} />
          <Route path="/admin/job-specs/:id/edit"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><JobSpecForm /></RoleRoute>} />

          {/* ── MANAGE SETUP ─────────────────────────────────────────────── */}
          <Route path="/admin/setup"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageSetup /></RoleRoute>} />

          {/* ── DEPARTMENTS ──────────────────────────────────────────────── */}
          <Route path="/admin/departments"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><ManageDepartments /></RoleRoute>} />
          <Route path="/admin/departments/new"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><DepartmentForm /></RoleRoute>} />
          <Route path="/admin/departments/:id/edit"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><DepartmentForm /></RoleRoute>} />

          {/* ── SEARCH USERS ─────────────────────────────────────────────── */}
          <Route path="/admin/search-users"
            element={<RoleRoute allowedRoles={MANAGE_ROLES}><SearchUsers /></RoleRoute>} />
          <Route path="/admin/search-users/dept"
            element={<RoleRoute allowedRoles={ADMIN_ONLY}><SearchUsers /></RoleRoute>} />

          {/* ── SHARED ───────────────────────────────────────────────────── */}
          <Route path="/notifications"
            element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/profile"
            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/change-password"
            element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/helpee/jobs/:id/remark"
            element={<ProtectedRoute><JobRemark /></ProtectedRoute>} />

          {/* ── LEGACY SUPERVISOR PATHS → redirect to admin equivalents ─── */}
          <Route path="/supervisor/manage-users"  element={<Navigate to="/admin/manage-users" replace />} />
          <Route path="/supervisor/manage-jobs"   element={<Navigate to="/admin/manage-jobs" replace />} />
          <Route path="/supervisor/job-specs"     element={<Navigate to="/admin/job-specs" replace />} />
          <Route path="/helper/manage-jobs"       element={<Navigate to="/admin/manage-jobs" replace />} />

          {/* ── 404 ──────────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
