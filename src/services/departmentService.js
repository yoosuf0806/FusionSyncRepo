import { supabase } from '../supabase/client'

export async function getDepartments({ search = '' } = {}) {
  let query = supabase
    .from('departments')
    .select('id, department_id, department_name, department_location, department_address, currency, customer_basis, pricing_structure')
    .order('department_name')

  if (search) {
    query = query.or(
      `department_id.ilike.%${search}%,department_name.ilike.%${search}%,department_location.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getDepartmentById(id) {
  const { data: dept, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: deptUsers, error: duErr } = await supabase
    .from('department_users')
    .select('id, user_id, users(id, user_id, user_name, user_type)')
    .eq('department_id', id)
  if (duErr) throw duErr

  return { ...dept, department_users: deptUsers || [] }
}

export async function createDepartment(deptData) {
  const { data, error } = await supabase
    .from('departments')
    .insert({
      department_name: deptData.department_name,
      department_location: deptData.department_location || null,
      department_address: deptData.department_address || null,
      currency: deptData.currency || null,
      customer_basis: deptData.customer_basis || null,
      pricing_structure: deptData.pricing_structure || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDepartment(id, deptData) {
  const { data, error } = await supabase
    .from('departments')
    .update({
      department_name: deptData.department_name,
      department_location: deptData.department_location || null,
      department_address: deptData.department_address || null,
      currency: deptData.currency || null,
      customer_basis: deptData.customer_basis || null,
      pricing_structure: deptData.pricing_structure || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDepartment(id) {
  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) throw error
}

export async function addUserToDepartment(departmentId, userId) {
  const { data: existing } = await supabase
    .from('department_users')
    .select('id')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) throw new Error('User is already in this department')

  const { data, error } = await supabase
    .from('department_users')
    .insert({ department_id: departmentId, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeUserFromDepartment(departmentUserId) {
  const { error } = await supabase
    .from('department_users')
    .delete()
    .eq('id', departmentUserId)
  if (error) throw error
}
