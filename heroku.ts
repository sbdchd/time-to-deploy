import { http } from "./http"

import * as t from "io-ts"
import * as et from "io-ts/Type"
import { Either, isLeft, right } from "fp-ts/lib/Either"
import { AxiosError } from "axios"
import { log } from "./logging"

const HerokuReleaseResponseShape = t.array(
  t.type({
    addon_plan_names: t.array(t.string),
    app: t.type({
      id: t.string,
      name: t.string,
    }),
    created_at: t.string,
    description: t.string,
    status: t.string,
    id: t.string,
    slug: t.type({
      id: t.string,
    }),
    updated_at: t.string,
    user: t.type({
      email: t.string,
      id: t.string,
    }),
    version: t.number,
    current: t.boolean,
    output_stream_url: et.nullable(t.string),
  }),
)

export type GetLastDeployResponse = {
  readonly sha: string
  readonly createdAt: string
  readonly isRollback: boolean
  /** Email of the user who deployed. */
  readonly deployerEmail: string
}

export async function herokuGetMostRecentDeployInfo({
  envName,
  token,
}: {
  readonly envName: string
  readonly token: string
}): Promise<
  Either<t.Errors | AxiosError<unknown> | Error, GetLastDeployResponse>
> {
  const releasesRes = await http({
    url: `https://api.heroku.com/apps/${envName}/releases/`,
    method: "GET",
    shape: HerokuReleaseResponseShape,
    headers: {
      Range: "id; order=desc,max=1",
      Accept: "application/vnd.heroku+json; version=3",
      Authorization: `Bearer ${token}`,
    },
  })
  if (isLeft(releasesRes)) {
    log.warn("problem parsing release info", envName)
    return releasesRes
  }

  const releaseJson = releasesRes.right
  const mostRecentSlugId = releaseJson[0].slug.id
  const createdAt = releaseJson[0].created_at
  const deployerEmail = releaseJson[0].user.email
  const isRollback = releaseJson[0].description
    .toLowerCase()
    .includes("rollback")

  const slugRes = await http({
    url: `https://api.heroku.com/apps/${envName}/slugs/${mostRecentSlugId}/`,
    method: "GET",
    shape: t.type({
      commit: t.string,
    }),
    headers: {
      Accept: "application/vnd.heroku+json; version=3",
      Authorization: `Bearer ${token}`,
    },
  })
  if (isLeft(slugRes)) {
    log.warn("problem parsing slug res", envName)
    return slugRes
  }

  const mostRecentDeploySha = slugRes.right.commit
  return right({
    sha: mostRecentDeploySha,
    createdAt,
    isRollback,
    deployerEmail,
  })
}
