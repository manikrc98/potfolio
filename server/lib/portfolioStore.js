import { supabase } from './supabase.js'

export async function getPortfolio(name) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('owner, repo_name, pages_url')
    .eq('portfolio_name', name)
    .single()

  if (error || !data) return null
  return { owner: data.owner, repoName: data.repo_name, pagesUrl: data.pages_url }
}

export async function setPortfolio(name, { owner, repoName, pagesUrl }) {
  const { error } = await supabase
    .from('portfolios')
    .upsert(
      {
        portfolio_name: name,
        owner,
        repo_name: repoName,
        pages_url: pagesUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'portfolio_name' }
    )

  if (error) throw new Error(`Supabase upsert error: ${error.message}`)
}

export async function hasPortfolio(name) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('portfolio_name')
    .eq('portfolio_name', name)
    .single()

  return !error && !!data
}

export async function deletePortfolio(name, owner) {
  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('portfolio_name', name)
    .eq('owner', owner)

  if (error) throw new Error(`Supabase delete error: ${error.message}`)
}

export async function getPortfolioByRepo(repoName, owner) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('portfolio_name, owner, repo_name, pages_url')
    .eq('repo_name', repoName)
    .eq('owner', owner)
    .single()

  if (error || !data) return null
  return {
    portfolioName: data.portfolio_name,
    owner: data.owner,
    repoName: data.repo_name,
    pagesUrl: data.pages_url,
  }
}
