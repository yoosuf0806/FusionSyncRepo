import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth pages
import UserSelection from './pages/UserSelection'
import LoginPage     from './pages/LoginPage'

// Admin pages
import AdminHome     from './pages/admin/AdminHome'

// Placeholder — more pages will be added per phase
function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-hh-mint flex items-center justify-center">
      <div className="bg-white rounded-hh-xl shadow-hh p-10 text-center">
        <p className="text-hh-placeholder text-sm mb-2">Coming soon</p>
        <h1 className="text-hh-text text-xl font-semibold">{title}</h1>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── PUBLIC ─────────────────────────────── */}
          <Route path="/"                  element={<UserSelection />} />
          <Route path="/login/admin"       element={<LoginPage role="admin" />} />
          <Route path="/login/supervisor"  element={<LoginPage role="supervisor" />} />
          <Route path="/login/helper"      element={<LoginPage role="helper" />} />
          <Route path="/login/helpee"      element={<LoginPage role="helpee" />} />

          {/* ── ADMIN ──────────────────────────────── */}
          <Route path="/admin/home"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminHome /></ProtectedRoute>} />
          <Route path="/admin/manage-users"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="Manage Users" /></ProtectedRoute>} />
          <Route path="/admin/users/new"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="New User" /></ProtectedRoute>} />
          <Route path="/admin/users/:id"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="User Profile" /></ProtectedRoute>} />
          <Route path="/admin/users/:id/edit"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="Edit User" /></ProtectedRoute>} />
          <Route path="/admin/manage-jobs"
            element={<ProtectedRoute allowedRoles={['admin','supervisor','helper','helpee']}><ComingSoon title="Manage Jobs" /></ProtectedRoute>} />
          <Route path="/admin/jobs/new"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="New One-Time Job" /></ProtectedRoute>} />
          <Route path="/admin/jobs/new/frequent"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="New Frequent Job" /></ProtectedRoute>} />
          <Route path="/admin/jobs/:id"
            element={<ProtectedRoute allowedRoles={['admin','supervisor','helper','helpee']}><ComingSoon title="Job Detail" /></ProtectedRoute>} />
          <Route path="/admin/job-specs"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="Manage Job Specifications" /></ProtectedRoute>} />
          <Route path="/admin/job-specs/new"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="New Job Specification" /></ProtectedRoute>} />
          <Route path="/admin/job-specs/:id/edit"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="Edit Job Specification" /></ProtectedRoute>} />
          <Route path="/admin/setup"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="Manage Setup" /></ProtectedRoute>} />
          <Route path="/admin/departments"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="Manage Departments" /></ProtectedRoute>} />
          <Route path="/admin/departments/new"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="New Department" /></ProtectedRoute>} />
          <Route path="/admin/departments/:id/edit"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="Edit Department" /></ProtectedRoute>} />
          <Route path="/admin/search-users"
            element={<ProtectedRoute allowedRoles={['admin','supervisor']}><ComingSoon title="Search Users" /></ProtectedRoute>} />
          <Route path="/admin/search-users/dept"
            element={<ProtectedRoute allowedRoles={['admin']}><ComingSoon title="Search Users (Department)" /></ProtectedRoute>} />

          {/* ── SUPERVISOR ─────────────────────────── */}
          <Route path="/supervisor/home"
            element={<ProtectedRoute allowedRoles={['supervisor']}><AdminHome /></ProtectedRoute>} />
          <Route path="/supervisor/manage-users"
            element={<ProtectedRoute allowedRoles={['supervisor']}><ComingSoon title="Manage Users" /></ProtectedRoute>} />
          <Route path="/supervisor/manage-jobs"
            element={<ProtectedRoute allowedRoles={['supervisor']}><ComingSoon title="Manage Jobs" /></ProtectedRoute>} />
          <Route path="/supervisor/job-specs"
            element={<ProtectedRoute allowedRoles={['supervisor']}><ComingSoon title="Job Specifications" /></ProtectedRoute>} />

          {/* ── HELPER ─────────────────────────────── */}
          <Route path="/helper/home"
            element={<ProtectedRoute allowedRoles={['helper']}><AdminHome /></ProtectedRoute>} />
          <Route path="/helper/manage-jobs"
            element={<ProtectedRoute allowedRoles={['helper']}><ComingSoon title="My Jobs" /></ProtectedRoute>} />

          {/* ── HELPEE ─────────────────────────────── */}
          <Route path="/helpee/home"
            element={<ProtectedRoute allowedRoles={['helpee']}><AdminHome /></ProtectedRoute>} />
          <Route path="/helpee/jobs/:id/remark"
            element={<ProtectedRoute allowedRoles={['helpee']}><ComingSoon title="Job Rating" /></ProtectedRoute>} />

          {/* ── SHARED ─────────────────────────────── */}
          <Route path="/notifications"
            element={<ProtectedRoute><ComingSoon title="Notifications" /></ProtectedRoute>} />
          <Route path="/profile"
            element={<ProtectedRoute><ComingSoon title="My Profile" /></ProtectedRoute>} />

          {/* ── 404 ────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
