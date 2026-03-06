const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'

function headers() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Create a CNAME record for a portfolio subdomain.
 * e.g. portfolioName.potfolio.me → owner.github.io
 */
export async function createDnsRecord(subdomain, githubPagesHost) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!zoneId || !process.env.CLOUDFLARE_API_TOKEN) {
    console.warn('Cloudflare credentials not configured — skipping DNS record creation')
    return null
  }

  const res = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'CNAME',
      name: subdomain,       // e.g. "manik" → manik.potfolio.me
      content: githubPagesHost, // e.g. "username.github.io"
      ttl: 1,                // 1 = automatic
      proxied: false,        // must be false for GitHub Pages to verify the domain
    }),
  })

  const data = await res.json()
  if (!data.success) {
    console.error('Cloudflare DNS create error:', data.errors)
    throw new Error(`Failed to create DNS record: ${data.errors?.[0]?.message || 'Unknown error'}`)
  }

  return data.result
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

  // Find the record by name
  const fullName = `${subdomain}.potfolio.me`
  const searchRes = await fetch(
    `${CLOUDFLARE_API}/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fullName)}`,
    { headers: headers() }
  )

  const searchData = await searchRes.json()
  if (!searchData.success || !searchData.result?.length) {
    console.warn(`No DNS record found for ${fullName}`)
    return
  }

  const recordId = searchData.result[0].id

  const delRes = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers: headers(),
  })

  const delData = await delRes.json()
  if (!delData.success) {
    console.error('Cloudflare DNS delete error:', delData.errors)
  }
}
