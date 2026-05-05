import { supabase } from './supabase';

const SUPABASE_CONFIGURED = !!(
  process.env.REACT_APP_SUPABASE_URL &&
  process.env.REACT_APP_SUPABASE_URL !== 'https://placeholder.supabase.co'
);

export async function createCase({ propertyPayload, intakeMode = 'borrower', orgId = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('cases')
    .insert({
      created_by: user.id,
      owner_user_id: user.id,
      org_id: orgId,
      intake_mode: intakeMode,
      status: 'draft',
      property_payload: propertyPayload,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitCase(caseId, { resultPayload, summaryPayload } = {}) {
  const { error } = await supabase
    .from('cases')
    .update({ status: 'submitted', result_payload: resultPayload, summary_payload: summaryPayload })
    .eq('id', caseId);
  if (error) throw error;
}

export async function getBorrowerCases() {
  if (!SUPABASE_CONFIGURED) return [];
  const { data, error } = await supabase
    .from('cases')
    .select(`*, case_decisions(recommendation, confidence_score, resale_potential_index, market_value_min, market_value_max, borrower_summary)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLenderCases() {
  if (!SUPABASE_CONFIGURED) return [];
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();

  let query = supabase
    .from('cases')
    .select(`*, profiles!cases_owner_user_id_fkey(full_name, email), case_decisions(recommendation, confidence_score, resale_potential_index, market_value_min, market_value_max, ttl_days_min, ttl_days_max)`)
    .order('created_at', { ascending: false });

  if (profile?.role !== 'admin' && profile?.org_id) {
    query = query.eq('org_id', profile.org_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCaseById(caseId) {
  if (!SUPABASE_CONFIGURED) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('cases')
    .select(`*, profiles!cases_owner_user_id_fkey(full_name, email), case_decisions(*), case_documents(*), case_activity(*, profiles!case_activity_actor_id_fkey(full_name, role))`)
    .eq('id', caseId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCaseStatus(caseId, status) {
  const { error } = await supabase
    .from('cases')
    .update({ status })
    .eq('id', caseId);
  if (error) throw error;
}

export async function upsertDecision(caseId, decisionData) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('case_decisions')
    .upsert({ case_id: caseId, ...decisionData, updated_by: user?.id }, { onConflict: 'case_id' });
  if (error) throw error;
}

export async function logCaseActivity(caseId, { eventType, eventLabel, details = {}, actorRole = 'borrower' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('case_activity')
    .insert({ case_id: caseId, actor_id: user.id, actor_role: actorRole, event_type: eventType, event_label: eventLabel, details });
  if (error) console.error('Activity log failed:', error.message);
}
