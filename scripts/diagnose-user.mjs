import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// Diagnose (and optionally repair) a single login account against Supabase.
//
// Why this exists:
//   Login in this app is by *username*, which is normalized to an auth email
//   (see src/services/authService.js → normalizeLoginEmail). Creating a user
//   writes TWO rows that must line up: one in auth.users and one in
//   public.users (linked by auth_user_id). When login "doesn't work" after
//   creating an account, it's almost always one of:
//     1. The login identifier typed doesn't normalize to the stored auth email
//        (e.g. account made with username "admintest123@gmail.com" but you try
//         to log in as "admintest123" → becomes admintest123@helpinghands.local).
//     2. An orphaned auth user: auth.users row exists but public.users profile
//        is missing/unlinked, so the app authenticates then can't load a role.
//     3. The auth email is unconfirmed, or the profile is is_active = false.
//
// This script reports exactly which of those is the case, and with --repair
// will create/link the missing profile, confirm the email, and reactivate.
//
// Usage:
//   node scripts/diagnose-user.mjs <identifier> [--repair] [--password=NEW]
//   node scripts/diagnose-user.mjs admintest123@gmail.com
//   node scripts/diagnose-user.mjs admintest123@gmail.com --repair --password='New@12345'
//
// Requires .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
// (same keys bootstrap-admin.mjs uses).
// ─────────────────────────────────────────────────────────────────────────

function loadEnvFile(path) {
  const raw = readFileSync(path, 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

// Mirror of src/services/authService.js → normalizeLoginEmail.
// Keep in sync: this is how the app turns a typed login identifier into an
// auth email.
function normalizeLoginEmail(identifier) {
  const value = String(identifier).trim()
  if (value.includes('@')) return value.toLowerCase()
  return `${value.toLowerCase().replace(/\s+/g, '.')}@helpinghands.local`
}

function parseArgs(argv) {
  const args = { identifier: null, repair: false, password: null, role: 'admin' }
  for (const a of argv) {
    if (a === '--repair') args.repair = true
    else if (a.startsWith('--password=')) args.password = a.slice('--password='.length)
    else if (a.startsWith('--role=')) args.role = a.slice('--role='.length)
    else if (!a.startsWith('--') && !args.identifier) args.identifier = a
  }
  return args
}

async function findAuthUserByEmail(admin, email) {
  // listUsers is paginated; walk pages until we find the match or run out.
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) break // last page
  }
  return null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.identifier) {
    console.error('Usage: node scripts/diagnose-user.mjs <identifier> [--repair] [--password=NEW] [--role=admin]')
    process.exit(1)
  }

  const env = loadEnvFile(resolve(process.cwd(), '.env.local'))
  const supabaseUrl = env.VITE_SUPABASE_URL
  const serviceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const loginEmail = normalizeLoginEmail(args.identifier)
  console.log('──────────────────────────────────────────────')
  console.log('Diagnosing account')
  console.log('  You entered (identifier) :', args.identifier)
  console.log('  Normalized login email   :', loginEmail)
  if (!args.identifier.includes('@')) {
    console.log('  NOTE: no "@" in your input, so the app appended @helpinghands.local.')
    console.log('        If the account was created with a full email as the username,')
    console.log('        you must log in with that exact email.')
  }
  console.log('──────────────────────────────────────────────')

  // 1. Auth side
  const authUser = await findAuthUserByEmail(admin, loginEmail)
  if (!authUser) {
    console.log('AUTH   : ❌ No auth.users row for', loginEmail)
    console.log('         → The account was never created under this login email,')
    console.log('           OR it was created under a different normalized email.')
    console.log('         Tip: list recent auth emails to spot a mismatch:')
    console.log('           the username field is what becomes the login email.')
  } else {
    console.log('AUTH   : ✅ Found auth.users row')
    console.log('         id               :', authUser.id)
    console.log('         email            :', authUser.email)
    console.log('         email_confirmed  :', authUser.email_confirmed_at ? 'yes' : 'NO ⚠️  (cannot log in until confirmed)')
    console.log('         metadata.username:', authUser.user_metadata?.username ?? '(none)')
    console.log('         metadata.role    :', authUser.user_metadata?.role ?? '(none)')
  }

  // 2. Profile side
  let profile = null
  if (authUser) {
    const { data, error } = await admin
      .from('users')
      .select('id, user_id, user_name, user_email, user_type, is_active, auth_user_id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (error) throw error
    profile = data
  }

  if (!profile) {
    console.log('PROFILE: ❌ No public.users row linked to this auth user')
    console.log('         → This is an "orphaned auth user": login succeeds but the app')
    console.log('           cannot load a role/profile, so it behaves like login failing.')
  } else {
    console.log('PROFILE: ✅ Found public.users row')
    console.log('         user_id   :', profile.user_id)
    console.log('         user_name :', profile.user_name)
    console.log('         user_type :', profile.user_type)
    console.log('         is_active :', profile.is_active ? 'yes' : 'NO ⚠️  (filtered out of lists / blocked)')
    console.log('         contact   :', profile.user_email ?? '(none)')
  }

  // 3. Verdict
  console.log('──────────────────────────────────────────────')
  const problems = []
  if (!authUser) problems.push('No auth user under this login email (identifier mismatch or never created).')
  if (authUser && !authUser.email_confirmed_at) problems.push('Auth email is not confirmed.')
  if (authUser && !profile) problems.push('Missing/unlinked public.users profile (orphaned auth user).')
  if (profile && !profile.is_active) problems.push('Profile is inactive (is_active = false).')

  if (problems.length === 0) {
    console.log('VERDICT: ✅ Account looks healthy on both sides.')
    console.log('         Log in with identifier:', authUser.email)
    console.log('         If login still fails, it is a wrong password — re-set it with:')
    console.log(`           node scripts/diagnose-user.mjs ${args.identifier} --repair --password='New@12345'`)
  } else {
    console.log('VERDICT: ⚠️  Problems found:')
    problems.forEach((p, i) => console.log(`         ${i + 1}. ${p}`))
  }

  // 4. Repair
  if (!args.repair) {
    console.log('──────────────────────────────────────────────')
    console.log('Run again with --repair to fix the fixable problems above.')
    return
  }

  if (!authUser) {
    console.log('REPAIR : Cannot repair — no auth user exists under this login email.')
    console.log('         Re-create the account in the app, or run bootstrap for the default admin.')
    return
  }

  console.log('──────────────────────────────────────────────')
  console.log('REPAIR : applying fixes…')

  // 4a. Confirm email / reset password on the auth user
  const authUpdate = {}
  if (!authUser.email_confirmed_at) authUpdate.email_confirm = true
  if (args.password) authUpdate.password = args.password
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(authUser.id, authUpdate)
    if (error) throw error
    if (authUpdate.email_confirm) console.log('         ✔ Confirmed auth email')
    if (authUpdate.password) console.log('         ✔ Reset password')
  }

  // 4b. Create the profile if missing
  if (!profile) {
    const userName = authUser.user_metadata?.username || args.identifier
    const userType = authUser.user_metadata?.role || args.role
    const { error } = await admin.from('users').insert({
      auth_user_id: authUser.id,
      user_name: userName,
      user_type: userType,
      is_active: true,
    })
    if (error) throw error
    console.log(`         ✔ Created public.users profile (user_type=${userType})`)
  } else if (!profile.is_active) {
    // 4c. Reactivate if inactive
    const { error } = await admin.from('users').update({ is_active: true }).eq('id', profile.id)
    if (error) throw error
    console.log('         ✔ Reactivated profile (is_active = true)')
  }

  console.log('REPAIR : done. Log in with identifier:', authUser.email)
}

main().catch((err) => {
  console.error('diagnose-user failed:', err.message)
  process.exit(1)
})
