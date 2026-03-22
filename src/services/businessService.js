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

  if (existing) {
    const { data, error } = await supabase
      .from('business_setup')
      .update({
        business_name: setupData.business_name,
        business_address: setupData.business_address || null,
        business_reg_id: setupData.business_reg_id || null,
        currency: setupData.currency || null,
        customer_basis: setupData.customer_basis || null,
        pricing_structure: setupData.pricing_structure || null,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('business_setup')
      .insert({
        business_name: setupData.business_name,
        business_address: setupData.business_address || null,
        business_reg_id: setupData.business_reg_id || null,
        currency: setupData.currency || null,
        customer_basis: setupData.customer_basis || null,
        pricing_structure: setupData.pricing_structure || null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}
