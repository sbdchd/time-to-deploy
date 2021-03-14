import jwt from "jsonwebtoken"
import * as t from "io-ts"
import * as et from "io-ts/Type"
import { Either, isLeft } from "fp-ts/lib/Either"
import { log } from "./logging"
import { AxiosError } from "axios"
import uniqBy from "lodash/uniqBy"
import sortBy from "lodash/sortBy"

import { http } from "./http"
import { notNullish } from "./message"

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
  const now = Math.round(Date.now() / 1000)
  const payload = {
    // issued at time
    iat: now,
    // JWT expiration time (10 minute maximum)
    exp: now + 2 * 60,
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
}): Promise<Either<AxiosError<unknown>, t.TypeOf<typeof GitHubAccessToken>>> {
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

const Commit = t.type({
  author: et.nullable(
    t.type({
      login: t.string,
      avatar_url: t.string,
    }),
  ),
})

const CommitComparison = t.type({
  total_commits: t.number,
  commits: t.array(Commit),
  files: t.array(
    t.type({
      additions: t.number,
      deletions: t.number,
    }),
  ),
})

function base64Decode(x: string) {
  return Buffer.from(x, "base64").toString("ascii")
}

export type Comparison = {
  readonly totalCommits: number
  readonly additions: number
  readonly deletions: number
  readonly authors: { readonly login: string; readonly avatarUrl: string }[]
} | null

export function createGitHubClient({
  appId,
  privateKeyBase64,
  installId,
}: {
  readonly appId: string
  readonly installId: string
  readonly privateKeyBase64: string
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
  }): Promise<Comparison> {
    const jwt = generateJWT({
      appId,
      privateKey: base64Decode(privateKeyBase64),
    })
    const tokenRes = await createAccessTokenForInstall({
      installId,
      token: jwt,
    })
    if (isLeft(tokenRes)) {
      log.warn("failed to create access token", tokenRes)
      return null
    }
    const token: string = tokenRes.right.token
    const res = await http({
      url: `https://api.github.com/repos/${org}/${repo}/compare/${head}...${base}`,
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

    const authors = sortBy(
      uniqBy(
        res.right.commits
          .map(x => {
            if (x.author == null) {
              return null
            }
            return {
              login: x.author.login,
              avatarUrl: x.author.avatar_url,
            }
          })
          .filter(notNullish),
        u => u.login,
      ),
      u => u.login,
    )

    const { additions, deletions } = res.right.files.reduce(
      (acc, val) => {
        acc.additions += val.additions
        acc.deletions += val.deletions
        return acc
      },
      { additions: 0, deletions: 0 },
    )
    return {
      totalCommits: res.right.total_commits,
      authors,
      additions,
      deletions,
    }
  }
  return { compare }
}
