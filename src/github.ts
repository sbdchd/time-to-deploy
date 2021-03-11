async function generateJWT(): Promise<string | null> {
  return Promise.resolve(null)
}

async function createAccessTokenForInstall() {}

async function compare({
  org,
  repo,
  base,
  head,
}: {
  readonly org: string
  readonly repo: string
  readonly base: string
  readonly head: string
}): Promise<number | null> {
  const githubCompareUrl = `https://api.github.com/repos/${org}/${repo}/compare/${base}...${head}`
  return Promise.resolve(null)
}
