import { supabase } from '../supabase/client'

export async function getJobSpecs({ search = '', activeOnly = true } = {}) {
  let query = supabase
    .from('job_specifications')
    .select('id, job_type_id, job_type_name, is_active')
    .order('job_type_name')

  if (activeOnly) query = query.eq('is_active', true)
  if (search) {
    query = query.or(`job_type_id.ilike.%${search}%,job_type_name.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getJobSpecById(id) {
  const { data: spec, error } = await supabase
    .from('job_specifications')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: questions, error: qErr } = await supabase
    .from('job_spec_questions')
    .select('*')
    .eq('job_type_id', id)
    .order('question_order')
  if (qErr) throw qErr

  return { ...spec, questions: questions || [] }
}

export async function getQuestionsForSpec(specId) {
  const { data, error } = await supabase
    .from('job_spec_questions')
    .select('*')
    .eq('job_type_id', specId)
    .order('question_order')
  if (error) throw error
  return data || []
}

export async function createJobSpec(specData, questions = []) {
  const { data: spec, error } = await supabase
    .from('job_specifications')
    .insert({ job_type_name: specData.job_type_name, is_active: true })
    .select()
    .single()
  if (error) throw error

  const validQuestions = questions.filter(q => q.trim())
  if (validQuestions.length > 0) {
    const rows = validQuestions.map((q, i) => ({
      job_type_id: spec.id,
      question_text: q,
      question_order: i + 1,
      is_required: false,
    }))
    const { error: qErr } = await supabase.from('job_spec_questions').insert(rows)
    if (qErr) throw qErr
  }
  return spec
}

export async function updateJobSpec(id, specData, questions = []) {
  const { error } = await supabase
    .from('job_specifications')
    .update({ job_type_name: specData.job_type_name })
    .eq('id', id)
  if (error) throw error

  await supabase.from('job_spec_questions').delete().eq('job_type_id', id)

  const validQuestions = questions.filter(q => q.trim())
  if (validQuestions.length > 0) {
    const rows = validQuestions.map((q, i) => ({
      job_type_id: id,
      question_text: q,
      question_order: i + 1,
      is_required: false,
    }))
    const { error: qErr } = await supabase.from('job_spec_questions').insert(rows)
    if (qErr) throw qErr
  }
}

export async function deleteJobSpec(id) {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('job_type_id', id)
    .limit(1)

  if (jobs && jobs.length > 0) {
    const { error } = await supabase
      .from('job_specifications')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('job_specifications').delete().eq('id', id)
    if (error) throw error
  }
}
