import { IGetLastDeployResponse } from "./message"
import { http } from "./http"

interface IHerokuReleaseResponse {
  readonly addon_plan_names: ReadonlyArray<string>
  readonly app: {
    readonly id: string
    readonly name: string
  }
  readonly created_at: string
  readonly description: string
  readonly status: string
  readonly id: string
  readonly slug: {
    readonly id: string
  }
  readonly updated_at: string
  readonly user: {
    readonly email: string
    readonly id: string
  }
  readonly version: number
  readonly current: boolean
  readonly output_stream_url: string
}

interface IHerokuGetMostRecentDeployInfo {
  readonly envName: string
  readonly token: string
}
export async function herokuGetMostRecentDeployInfo({
  envName,
  token,
}: IHerokuGetMostRecentDeployInfo): Promise<IGetLastDeployResponse> {
  const releasesRes = await http.get<ReadonlyArray<IHerokuReleaseResponse>>(
    `https://api.heroku.com/apps/${envName}/releases/`,
    {
      headers: {
        Range: "id; order=desc,max=1",
        Accept: "application/vnd.heroku+json; version=3",
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const releaseJson = releasesRes.data
  const mostRecentSlugId = releaseJson[0].slug.id
  const createdAt = releaseJson[0].created_at
  const deployerEmail = releaseJson[0].user.email
  const isRollback = releaseJson[0].description
    .toLowerCase()
    .includes("rollback")

  const slugRes = await http.get(
    `https://api.heroku.com/apps/${envName}/slugs/${mostRecentSlugId}/`,
    {
      headers: {
        Accept: "application/vnd.heroku+json; version=3",
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const slugJson = slugRes.data
  const mostRecentDeploySha = slugJson.commit
  return {
    sha: mostRecentDeploySha,
    createdAt,
    isRollback,
    deployerEmail,
  }
}
