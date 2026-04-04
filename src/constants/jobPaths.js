/**
 * Role-scoped URL helpers.
 * Admin    → /admin/...
 * Supervisor → /supervisor/...
 * Helper   → /helper/...
 * Helpee   → /helpee/...
 */

// ── Job paths ─────────────────────────────────────────────────────────────

export function jobDetailPath(role, jobId) {
  if (!jobId) return jobsHubPath(role)
  if (role === 'helpee')     return `/helpee/jobs/${jobId}`
  if (role === 'helper')     return `/helper/jobs/${jobId}`
  if (role === 'supervisor') return `/supervisor/jobs/${jobId}`
  return `/admin/jobs/${jobId}`
}

export function jobNewPath(role) {
  if (role === 'helpee')     return '/helpee/jobs/new'
  if (role === 'supervisor') return '/supervisor/jobs/new'
  return '/admin/jobs/new'
}

export function jobsHubPath(role) {
  if (role === 'helpee')     return '/helpee/home'
  if (role === 'helper')     return '/helper/manage-jobs'
  if (role === 'supervisor') return '/supervisor/manage-jobs'
  return '/admin/manage-jobs'
}

// ── User / manage-users paths ─────────────────────────────────────────────

export function usersHubPath(role) {
  return role === 'supervisor' ? '/supervisor/manage-users' : '/admin/manage-users'
}

export function userNewPath(role) {
  return role === 'supervisor' ? '/supervisor/users/new' : '/admin/users/new'
}

export function userEditPath(role, userId) {
  return role === 'supervisor'
    ? `/supervisor/users/${userId}/edit`
    : `/admin/users/${userId}/edit`
}

// ── Job-spec paths ────────────────────────────────────────────────────────

export function jobSpecsHubPath(role) {
  return role === 'supervisor' ? '/supervisor/job-specs' : '/admin/job-specs'
}

export function jobSpecNewPath(role) {
  return role === 'supervisor' ? '/supervisor/job-specs/new' : '/admin/job-specs/new'
}

export function jobSpecEditPath(role, specId) {
  return role === 'supervisor'
    ? `/supervisor/job-specs/${specId}/edit`
    : `/admin/job-specs/${specId}/edit`
}
