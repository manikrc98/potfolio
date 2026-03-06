const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'

function headers() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Find an existing DNS record for a subdomain (any type: CNAME, A, AAAA).
 */
async function findExistingRecord(zoneId, subdomain) {
  const fullName = `${subdomain}.potfolio.me`
  const searchRes = await fetch(
    `${CLOUDFLARE_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(fullName)}`,
    { headers: headers() }
  )
  const searchData = await searchRes.json()
  if (searchData.success && searchData.result?.length) {
    return searchData.result[0]
  }
  return null
}

/**
 * Create a CNAME record for a portfolio subdomain.
 * If a record already exists, update it instead.
 * e.g. portfolioName.potfolio.me → owner.github.io
 */
export async function createDnsRecord(subdomain, githubPagesHost) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!zoneId || !process.env.CLOUDFLARE_API_TOKEN) {
    console.warn('Cloudflare credentials not configured — skipping DNS record creation')
    return null
  }

  const recordBody = {
    type: 'CNAME',
    name: subdomain,       // e.g. "manik" → manik.potfolio.me
    content: githubPagesHost, // e.g. "username.github.io"
    ttl: 1,                // 1 = automatic
    proxied: true,         // Cloudflare handles SSL — instant HTTPS, no waiting for GitHub cert
  }

  // Try to create first
  const res = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(recordBody),
  })

  const data = await res.json()
  if (data.success) return data.result

  // If record already exists, find and update it
  const alreadyExists = data.errors?.some((e) => e.code === 81057 || /already.*exists/i.test(e.message))
  if (alreadyExists) {
    console.log(`[Cloudflare] Record for ${subdomain} already exists, updating…`)
    const existing = await findExistingRecord(zoneId, subdomain)
    if (existing) {
      const updateRes = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${existing.id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(recordBody),
      })
      const updateData = await updateRes.json()
      if (updateData.success) return updateData.result
      console.error('Cloudflare DNS update error:', updateData.errors)
      throw new Error(`Failed to update DNS record: ${updateData.errors?.[0]?.message || 'Unknown error'}`)
    }
  }

  console.error('Cloudflare DNS create error:', data.errors)
  throw new Error(`Failed to create DNS record: ${data.errors?.[0]?.message || 'Unknown error'}`)
}

/**
 * Delete the CNAME record for a portfolio subdomain.
 */
export async function deleteDnsRecord(subdomain) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!zoneId || !process.env.CLOUDFLARE_API_TOKEN) {
    console.warn('Cloudflare credentials not configured — skipping DNS record deletion')
    return
  }

  // Find the record by name (any type — CNAME, A, AAAA)
  const existing = await findExistingRecord(zoneId, subdomain)
  if (!existing) {
    console.warn(`No DNS record found for ${subdomain}.potfolio.me`)
    return
  }

  const delRes = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${existing.id}`, {
    method: 'DELETE',
    headers: headers(),
  })

  const delData = await delRes.json()
  if (!delData.success) {
    console.error('Cloudflare DNS delete error:', delData.errors)
  }
}
