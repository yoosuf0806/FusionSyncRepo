import { supabase } from '../supabase/client'

export async function getBusinessSetup() {
  const { data, error } = await supabase
    .from('business_setup')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveBusinessSetup(setupData) {
  const existing = await getBusinessSetup()
  const payload = {
    business_name: setupData.business_name,
    business_address: setupData.business_address || null,
    business_reg_id: setupData.business_reg_id || null,
    currency: setupData.currency || null,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('business_setup')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('business_setup')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }
}
