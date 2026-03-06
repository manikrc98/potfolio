/**
 * One-time cleanup script to remove stale CNAME records and Supabase portfolio entries.
 *
 * Usage: node --env-file=.env scripts/cleanup-stale-records.js
 * Run from the server/ directory.
 */

import { deleteDnsRecord } from '../lib/cloudflare.js'
import { supabase } from '../lib/supabase.js'

// Stale subdomains identified from Cloudflare dashboard (March 2026)
const STALE_SUBDOMAINS = [
  'aaaa',
  'ada',
  'asdfsgdg',
  'manik',
  'tata',
  'test309',
  'testssesa',
  'yojo',
]

async function cleanup() {
  console.log(`Cleaning up ${STALE_SUBDOMAINS.length} stale records...\n`)

  for (const subdomain of STALE_SUBDOMAINS) {
    // 1. Delete Cloudflare DNS record
    try {
      await deleteDnsRecord(subdomain)
      console.log(`[DNS] Deleted ${subdomain}.potfolio.me`)
    } catch (err) {
      console.error(`[DNS] Failed to delete ${subdomain}: ${err.message}`)
    }

    // 2. Delete Supabase portfolio entry
    try {
      const { data, error } = await supabase
        .from('portfolios')
        .delete()
        .eq('portfolio_name', subdomain)
        .select()

      if (data?.length) {
        console.log(`[DB]  Deleted portfolio "${subdomain}" (owner: ${data[0].owner})`)
      } else {
        console.log(`[DB]  No portfolio entry for "${subdomain}" (already gone)`)
      }
      if (error) console.error(`[DB]  Error: ${error.message}`)
    } catch (err) {
      console.error(`[DB]  Failed to delete ${subdomain}: ${err.message}`)
    }
  }

  console.log('\nCleanup complete.')
}

cleanup()
