import test from 'node:test'
import assert from 'node:assert/strict'
import {
  weeklyJobFromRow,
  weeklyJobRowFromJob,
} from '../src/utils/serverWeeklyJobs.js'

test('serializes weekly jobs for Supabase storage', () => {
  const row = weeklyJobRowFromJob({ id: 'user-1' }, {
    id: 'week_1',
    title: 'Launch week',
    weekStart: '2026-06-29',
    status: 'references-ready',
    avatarPackageId: 'av_1',
    productPackageId: 'prd_1',
    locationId: 'bathroom',
    videoFormat: 'testimonial',
    videoBrief: 'Show the product in a mirror routine.',
    notes: 'Use soft morning light.',
    createdAt: 1782710000000,
    updatedAt: 1782715000000,
  })

  assert.equal(row.owner_id, 'user-1')
  assert.equal(row.week_start, '2026-06-29')
  assert.equal(row.avatar_package_id, 'av_1')
  assert.equal(row.product_package_id, 'prd_1')
  assert.equal(row.location_id, 'bathroom')
  assert.equal(row.video_format, 'testimonial')
})

test('composes weekly jobs from Supabase rows', () => {
  const job = weeklyJobFromRow({
    id: 'week_1',
    owner_id: 'user-1',
    title: 'Launch week',
    week_start: '2026-06-29',
    status: 'video-ready',
    avatar_package_id: 'av_1',
    product_package_id: 'prd_1',
    location_id: 'gym',
    video_format: 'product-demo',
    video_brief: 'Show product use.',
    notes: '',
    metadata: { customField: 'kept' },
    created_at: '2026-06-29T08:00:00.000Z',
    updated_at: '2026-06-29T09:00:00.000Z',
  })

  assert.equal(job.ownerId, 'user-1')
  assert.equal(job.weekStart, '2026-06-29')
  assert.equal(job.avatarPackageId, 'av_1')
  assert.equal(job.productPackageId, 'prd_1')
  assert.equal(job.locationId, 'gym')
  assert.equal(job.videoFormat, 'product-demo')
  assert.equal(job.customField, 'kept')
})
