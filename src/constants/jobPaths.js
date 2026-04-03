/**
 * Role-scoped job URLs so helpee/helper see their role in the path, not /admin/jobs/...
 */

export function jobDetailPath(role, jobId) {
  if (!jobId) return jobsHubPath(role)
  if (role === 'helpee') return `/helpee/jobs/${jobId}`
  if (role === 'helper') return `/helper/jobs/${jobId}`
  return `/admin/jobs/${jobId}`
}

export function jobNewPath(role) {
  if (role === 'helpee') return '/helpee/jobs/new'
  return '/admin/jobs/new'
}

/** List / hub after leaving a job (matches sidebar "home" for helpee) */
export function jobsHubPath(role) {
  if (role === 'helpee') return '/helpee/home'
  return '/admin/manage-jobs'
}
