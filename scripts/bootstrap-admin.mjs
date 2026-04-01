import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  const raw = readFileSync(path, 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    env[key] = value
  }
  return env
}

async function main() {
  const envPath = resolve(process.cwd(), '.env.local')
  const env = loadEnvFile(envPath)

  const supabaseUrl = env.VITE_SUPABASE_URL
  const serviceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const ADMIN_USERNAME = 'Admin'
  const ADMIN_EMAIL = 'admin@helpinghands.local'
  const ADMIN_PASSWORD = 'Admin@123'

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Ensuring default department exists...')
  let departmentId = null
  {
    const { data, error } = await admin.from('departments').select('id').limit(1)
    if (error) throw error
    if (data?.length) {
      departmentId = data[0].id
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('departments')
        .insert({
          department_name: 'Head Office',
          department_location: 'Default',
          department_address: 'Head Office Address',
          currency: 'AUD',
          customer_basis: 'all',
          pricing_structure: 'quotation',
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      departmentId = inserted.id
      console.log('Created default department: Head Office')
    }
  }

  console.log('Ensuring default Admin auth account exists...')
  let authUserId = null
  {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) throw listError
    const existing = listData.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL)
    if (existing) {
      authUserId = existing.id
      // Keep password aligned with bootstrap credentials for first login.
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME, role: 'admin' },
      })
      if (updateError) throw updateError
      console.log('Updated existing Admin auth account credentials.')
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME, role: 'admin' },
      })
      if (createError) throw createError
      authUserId = created.user.id
      console.log('Created Admin auth account.')
    }
  }

  console.log('Ensuring Admin profile exists in public.users...')
  {
    const { data: existingUser, error: findError } = await admin
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    if (findError) throw findError

    if (existingUser?.id) {
      const { error: updateError } = await admin
        .from('users')
        .update({
          user_type: 'admin',
          user_name: ADMIN_USERNAME,
          user_email: ADMIN_EMAIL,
          department_id: departmentId,
          is_active: true,
        })
        .eq('id', existingUser.id)
      if (updateError) throw updateError
      console.log('Updated existing Admin profile row.')
    } else {
      const { error: insertError } = await admin.from('users').insert({
        user_type: 'admin',
        user_name: ADMIN_USERNAME,
        user_email: ADMIN_EMAIL,
        department_id: departmentId,
        auth_user_id: authUserId,
        is_active: true,
      })
      if (insertError) throw insertError
      console.log('Created Admin profile row.')
    }
  }

  console.log('\nBootstrap complete.')
  console.log('Login identifier: Admin')
  console.log('Email mapping   : admin@helpinghands.local')
  console.log('Password        : Admin@123')
  console.log('Password can be changed after login using Supabase updateUser flow.')
}

main().catch((err) => {
  console.error('Bootstrap failed:', err.message)
  process.exit(1)
})
