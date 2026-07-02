import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeeklyJobVideoPrompt,
  createWeeklyJob,
  formatWeekRange,
  getWeeklyJobChecklist,
  groupWeeklyJobsByWeek,
  isWeeklyJobReady,
  mergeWeeklyJobLists,
  startOfISOWeek,
  storageKeyForWeeklyJobs,
} from '../src/utils/weeklyJobs.js'

const packages = [
  {
    id: 'av_1',
    type: 'avatar',
    name: 'Maya',
    identityLock: 'Maya keeps the same face and hair.',
    items: [{ id: 'face', url: 'https://cdn.example.com/maya.png' }],
  },
  {
    id: 'prd_1',
    type: 'product',
    name: 'Glow Serum',
    identityLock: 'Amber glass bottle with white label.',
    items: [{ id: 'packshot', url: 'https://cdn.example.com/serum.png' }],
  },
]

test('normalizes jobs to ISO weeks and account-scoped storage keys', () => {
  assert.equal(startOfISOWeek('2026-07-02'), '2026-06-29')
  assert.equal(formatWeekRange('2026-06-29'), '2026-06-29 to 2026-07-05')
  assert.equal(storageKeyForWeeklyJobs({ id: 'demo-abderrahim' }), 'ugc_weekly_jobs_v1:demo-abderrahim')
})

test('creates weekly jobs with product, avatar, location, and video format defaults', () => {
  const job = createWeeklyJob({
    id: 'week_1',
    now: new Date('2026-07-02T10:00:00').getTime(),
    title: 'Serum launch',
    avatarPackageId: 'av_1',
    productPackageId: 'prd_1',
    videoBrief: 'Make a morning routine ad.',
  })

  assert.equal(job.weekStart, '2026-06-29')
  assert.equal(job.locationId, 'studio')
  assert.equal(job.videoFormat, 'ugc-ad')
  assert.equal(job.title, 'Serum launch')
})

test('reports missing references before a video job is ready', () => {
  const missing = createWeeklyJob({ id: 'week_missing', title: 'Missing refs', weekStart: '2026-07-06' })
  const checklist = getWeeklyJobChecklist(missing, packages)

  assert.equal(isWeeklyJobReady(missing, packages), false)
  assert.deepEqual(checklist.filter(item => !item.done).map(item => item.id), [
    'avatar-package',
    'avatar-images',
    'product-package',
    'product-images',
    'video-brief',
  ])
})

test('builds video prompt from avatar, product, location, and brief', () => {
  const job = createWeeklyJob({
    id: 'week_ready',
    title: 'Glow Serum week',
    weekStart: '2026-07-02',
    avatarPackageId: 'av_1',
    productPackageId: 'prd_1',
    locationId: 'bathroom',
    videoBrief: 'Create a mirror routine ad showing the serum texture.',
  })
  const prompt = buildWeeklyJobVideoPrompt(job, packages)

  assert.equal(isWeeklyJobReady(job, packages), true)
  assert.match(prompt, /Avatar reference: Maya/)
  assert.match(prompt, /Product reference: Glow Serum/)
  assert.match(prompt, /Location: Mirror Selfie/)
  assert.match(prompt, /Create a mirror routine ad/)
})

test('groups jobs by week with newest weeks first', () => {
  const groups = groupWeeklyJobsByWeek([
    { id: 'a', weekStart: '2026-06-29', updatedAt: 1 },
    { id: 'b', weekStart: '2026-07-06', updatedAt: 2 },
    { id: 'c', weekStart: '2026-06-29', updatedAt: 3 },
  ])

  assert.deepEqual(groups.map(group => group.weekStart), ['2026-07-06', '2026-06-29'])
  assert.deepEqual(groups[1].jobs.map(job => job.id), ['c', 'a'])
})

test('merges server and local weekly jobs without losing newer edits', () => {
  const merged = mergeWeeklyJobLists(
    [
      { id: 'server-only', title: 'Server', weekStart: '2026-07-06', updatedAt: 3 },
      { id: 'same', title: 'Server newer', weekStart: '2026-07-06', updatedAt: 5 },
    ],
    [
      { id: 'local-only', title: 'Local', weekStart: '2026-06-29', updatedAt: 4 },
      { id: 'same', title: 'Local older', weekStart: '2026-07-06', updatedAt: 2 },
    ],
  )

  assert.equal(merged.find(job => job.id === 'same').title, 'Server newer')
  assert.deepEqual(merged.map(job => job.id), ['same', 'server-only', 'local-only'])
})
