import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js'

function toTime(value, fallback = Date.now()) {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isFinite(time) ? time : fallback
}

export function weeklyJobRowFromJob(profile, job) {
  const {
    id,
    title,
    weekStart,
    status,
    avatarPackageId,
    productPackageId,
    locationId,
    videoFormat,
    videoBrief,
    notes,
    createdAt,
    updatedAt,
    ...metadata
  } = job

  return {
    id,
    owner_id: profile.id,
    title,
    week_start: weekStart,
    status: status || 'draft',
    avatar_package_id: avatarPackageId || null,
    product_package_id: productPackageId || null,
    location_id: locationId || 'studio',
    video_format: videoFormat || 'ugc-ad',
    video_brief: videoBrief || '',
    notes: notes || '',
    metadata,
    created_at: new Date(createdAt || Date.now()).toISOString(),
    updated_at: new Date(updatedAt || Date.now()).toISOString(),
  }
}

export function weeklyJobFromRow(row) {
  const metadata = row.metadata || {}
  return {
    ...metadata,
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    weekStart: row.week_start,
    status: row.status || 'draft',
    avatarPackageId: row.avatar_package_id || '',
    productPackageId: row.product_package_id || '',
    locationId: row.location_id || 'studio',
    videoFormat: row.video_format || 'ugc-ad',
    videoBrief: row.video_brief || '',
    notes: row.notes || '',
    createdAt: metadata.createdAt || toTime(row.created_at),
    updatedAt: metadata.updatedAt || toTime(row.updated_at),
  }
}

export async function loadServerWeeklyJobs(profile) {
  if (!hasSupabaseConfig || !profile?.id) return { skipped: true, jobs: [] }
  const { data, error } = await supabase
    .from('weekly_jobs')
    .select('*')
    .eq('owner_id', profile.id)
    .order('week_start', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) return { error, jobs: [] }
  return { jobs: (data || []).map(weeklyJobFromRow), error: null }
}

export async function saveServerWeeklyJob(profile, job) {
  if (!hasSupabaseConfig || !profile?.id || !job?.id) return { skipped: true }
  return supabase.from('weekly_jobs').upsert(weeklyJobRowFromJob(profile, job))
}

export async function deleteServerWeeklyJob(id) {
  if (!hasSupabaseConfig || !id) return { skipped: true }
  return supabase.from('weekly_jobs').delete().eq('id', id)
}
