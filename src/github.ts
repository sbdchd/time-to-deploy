import jwt from "jsonwebtoken"
import * as t from "io-ts"
import { Either, isLeft } from "fp-ts/lib/Either"
import { log } from "./logging"
import { AxiosError } from "axios"

import { http } from "./http"

/// Create an authentication token to make application requests.
/// https://developer.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app
/// This is different from authenticating as an installation
function generateJWT({
  appId,
  privateKey,
}: {
  readonly appId: string
  readonly privateKey: string
}): string {
  const now = Date.now()
  const payload = {
    // issued at time
    iat: now,
    // JWT expiration time (10 minute maximum)
    exp: now + 10 * 60,
    // GitHub App's identifier
    iss: appId,
  }
  return jwt.sign(payload, privateKey, { algorithm: "RS256" })
}

const GitHubAccessToken = t.type({
  token: t.string,
})

/// https://developer.github.com/v3/apps/#create-an-installation-access-token-for-an-app
async function createAccessTokenForInstall({
  installId,
  token,
}: {
  readonly installId: string
  readonly token: string
}): Promise<
  Either<
    t.Errors | AxiosError<unknown> | Error,
    t.TypeOf<typeof GitHubAccessToken>
  >
> {
  const res = await http({
    url: `https://api.github.com/app/installations/${installId}/access_tokens`,
    method: "POST",
    shape: GitHubAccessToken,
    headers: {
      Accept: "application/vnd.github.machine-man-preview+json",
      Authorization: `Bearer ${token}`,
    },
  })
  if (isLeft(res)) {
    log.warn("problem generating access token", installId)
    return res
  }
  return res
}

const CommitComparison = t.type({
  commits: t.array(t.unknown),
})

export function createGitHubClient({
  appId,
  privateKey,
  installId,
}: {
  readonly appId: string
  readonly installId: string
  readonly privateKey: string
}) {
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
    const jwt = generateJWT({ appId, privateKey })
    const token = await createAccessTokenForInstall({ installId, token: jwt })
    const res = await http({
      url: `https://api.github.com/repos/${org}/${repo}/compare/${base}...${head}`,
      method: "GET",
      shape: CommitComparison,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (isLeft(res)) {
      log.warn("failed to compare commit shas", res)
      return null
    }

    return res.right.commits.length
  }
  return { compare }
}
