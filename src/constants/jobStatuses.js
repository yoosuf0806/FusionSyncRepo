export const JOB_STATUSES = {
  REQUEST_RAISED:      'request_raised',
  MANAGER_ASSIGNED:    'manager_assigned',
  HELPER_ASSIGNED:     'helper_assigned',
  JOB_STARTED:         'job_started',
  JOB_FINISHED:        'job_finished',
  PAYMENT_CONFIRMED:   'payment_confirmed',
  JOB_CLOSED:          'job_closed',
}

export const JOB_STATUS_LABELS = {
  request_raised:     'Request Raised',
  manager_assigned:   'Supervisor Assigned',
  helper_assigned:    'Helper Assigned',
  job_started:        'Job Started',
  job_finished:       'Job Finished',
  payment_confirmed:  'Payment Confirmed',
  job_closed:         'Job Closed',
}

export const JOB_STATUS_FILTERS = {
  PENDING:   ['request_raised', 'manager_assigned', 'helper_assigned'],
  ONGOING:   ['job_started', 'job_finished'],
  COMPLETED: ['payment_confirmed', 'job_closed'],
}

export const WORKFLOW_STAGES = [
  { key: 'request_raised',    label: ['Request', 'Raised'] },
  { key: 'manager_assigned',  label: ['Supervisor', 'Assigned'] },
  { key: 'helper_assigned',   label: ['Helper', 'Assigned'] },
  { key: 'job_started',       label: ['Job', 'Started'] },
  { key: 'job_finished',      label: ['Job', 'Finished'] },
  { key: 'payment_confirmed', label: ['Payment', 'Confirmed'] },
]

const STATUS_ORDER = [
  'request_raised',
  'manager_assigned',
  'helper_assigned',
  'job_started',
  'job_finished',
  'payment_confirmed',
  'job_closed',
]

// Legacy helper — used where only status is available
export function isStageComplete(currentStatus, stageKey) {
  return STATUS_ORDER.indexOf(currentStatus) >= STATUS_ORDER.indexOf(stageKey)
}

// CO4: Accurate stage completion based on associated users AND job status
export function getCompletedStages(status, associatedUsers = []) {
  const hasHelper     = associatedUsers.some(u => u.role === 'helper')
  const hasSupervisor = associatedUsers.some(u => u.role === 'supervisor')
  const idx           = STATUS_ORDER.indexOf(status)

  return {
    request_raised:    true,
    manager_assigned:  hasSupervisor,
    helper_assigned:   hasHelper,
    job_started:       idx >= STATUS_ORDER.indexOf('job_started'),
    job_finished:      idx >= STATUS_ORDER.indexOf('job_finished'),
    payment_confirmed: idx >= STATUS_ORDER.indexOf('payment_confirmed'),
  }
}
