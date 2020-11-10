import { formatDistance, format } from "date-fns"
import { utcToZonedTime } from "date-fns-tz"
import { GetLastDeployResponse } from "./heroku"
import { KnownBlock } from "@slack/web-api"
import * as t from "io-ts"
import * as et from "io-ts/Type"
import { Either, isLeft, isRight } from "fp-ts/lib/Either"
import { flatten } from "fp-ts/lib/Array"
import { AxiosError } from "axios"
import { getEnvVar } from "./env"
import { log } from "./logging"

export function humanize({
  date,
  timezone,
  getCurrentDate,
}: {
  readonly date: string
  readonly timezone: string | null
  readonly getCurrentDate: () => Date
}): string {
  const d = timezone == null ? new Date(date) : utcToZonedTime(date, timezone)
  return (
    formatDistance(new Date(date), getCurrentDate(), { addSuffix: true }) +
    " at " +
    format(d, "h:mm aaaa (MMM d, yyyy)") +
    (timezone == null ? " UTC" : "")
  )
}

function getEnvsInfo(config: {
  stagingEnvURL: string | null
  productionEnvURL: string | null
}): string {
  if (config.stagingEnvURL != null && config.productionEnvURL != null) {
    return `• envs
    ◦ <${config.stagingEnvURL}| staging>
    ◦ <${config.productionEnvURL}| production>`
  }
  if (config.stagingEnvURL != null) {
    return `• envs
    ◦ <${config.stagingEnvURL}| staging>`
  }
  if (config.productionEnvURL != null) {
    return `• envs
    ◦ <${config.productionEnvURL}| production>`
  }
  return ""
}

function getDiffText({
  diffUrl,
  hasChanges,
}: {
  readonly hasChanges: boolean
  readonly diffUrl: string | null
}): string {
  if (diffUrl && hasChanges) {
    return ` — <${diffUrl}|diff (_staging..production_)>`
  }
  if (hasChanges) {
    return ""
  }
  return " — no changes"
}

function getBodyText({
  config,
  lastDeploySha,
  stagingSha,
}: {
  readonly config: {
    readonly projectName: string
    readonly repoURL: string
    readonly stagingEnvURL: string | null
    readonly productionEnvURL: string | null
  }
  readonly lastDeploySha: string | null
  readonly stagingSha: string | null
}): string {
  const diffUrl =
    lastDeploySha && stagingSha
      ? `${config.repoURL}/compare/${lastDeploySha}...${stagingSha}`
      : null

  const hasChanges = lastDeploySha !== stagingSha
  return `\
*${config.projectName}*${getDiffText({
    diffUrl,
    hasChanges,
  })}
${getEnvsInfo(config)}`
}

export function getResponse(config: {
  readonly lastDeploy: {
    readonly sha: string
    readonly createdAt: string
    readonly isRollback: boolean
    readonly deployerEmail: string
  }
  readonly repoURL: string
  readonly stagingSha: string
  readonly promotionDashboardURL: string
  readonly timezone: string
  readonly projectName: string
  readonly stagingEnvURL: string | null
  readonly productionEnvURL: string | null
  readonly getCurrentDate: () => Date
}): Array<KnownBlock> {
  const lastDeployUrl = `${config.repoURL}/commit/${config.lastDeploy.sha}/`

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: getBodyText({
          config,
          lastDeploySha: config.lastDeploy.sha,
          stagingSha: config.stagingSha,
        }),
      },
      accessory:
        config.lastDeploy.sha != config.stagingSha
          ? {
              type: "button",
              text: {
                type: "plain_text",
                text: "Promote Staging 🚢",
                emoji: true,
              },
              url: config.promotionDashboardURL,
            }
          : undefined,
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Last deployed: <${lastDeployUrl}|${config.lastDeploy.sha.slice(
            0,
            7,
          )}> ${humanize({
            date: config.lastDeploy.createdAt,
            timezone: config.timezone,
            getCurrentDate: config.getCurrentDate,
          })}
${
  config.lastDeploy.isRollback
    ? `*Attention*: Last deploy was a *rollback* by ${config.lastDeploy.deployerEmail}`
    : ""
}`,
        },
      ],
    },
  ]
}

export function getFallbackMessage(config: {
  readonly promotionDashboardURL: string
  readonly projectName: string
  readonly repoURL: string
  readonly stagingEnvURL: string | null
  readonly productionEnvURL: string | null
}): Array<KnownBlock> {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: getBodyText({
          config,
          lastDeploySha: null,
          stagingSha: null,
        }),
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Promote Staging 🚢",
          emoji: true,
        },
        url: config.promotionDashboardURL,
      },
    },
  ]
}

export const ProjectsSchema = t.array(
  t.type({
    name: t.string,
    repoURL: t.string,
    stagingEnvURL: et.nullable(t.string),
    productionEnvURL: et.nullable(t.string),
    stagingEnvName: t.string,
    productionEnvName: t.string,
  }),
)

function getMessageOrDefault(config: {
  readonly projectName: string
  readonly repoURL: string
  readonly stagingEnvURL: string | null
  readonly productionEnvURL: string | null
  readonly promotionDashboardURL: string
  readonly timezone: string
  readonly stagingSha: string | null
  readonly lastDeploy: {
    readonly sha: string
    readonly createdAt: string
    readonly isRollback: boolean
    readonly deployerEmail: string
  } | null
  getCurrentDate: () => Date
}): Array<KnownBlock> {
  if (config.stagingSha == null || config.lastDeploy == null) {
    return getFallbackMessage(config)
  }
  return getResponse({
    ...config,
    lastDeploy: config.lastDeploy,
    stagingSha: config.stagingSha,
  })
}

function getProjectSettings(env: NodeJS.ProcessEnv) {
  const parsedResult = ProjectsSchema.decode(
    JSON.parse(getEnvVar("TTD_PROJECT_SETTINGS", env)),
  )
  if (isRight(parsedResult)) {
    return parsedResult.right
  }
  log.error(
    `Problem parsing project settings: ${JSON.stringify(
      { res: parsedResult.left },
      null,
      2,
    )}`,
  )
  throw Error("problem parisng project settings")
}

type Heroku = {
  getMostRecentDeployInfo: (param: {
    readonly envName: string
    readonly token: string
  }) => Promise<
    Either<t.Errors | AxiosError<unknown> | Error, GetLastDeployResponse>
  >
}

async function getLastDeploy({
  heroku,
  envName,
  token,
}: {
  readonly heroku: Heroku
  readonly envName: string
  readonly token: string
}): Promise<GetLastDeployResponse | null> {
  const res = await heroku.getMostRecentDeployInfo({
    envName,
    token,
  })
  if (isLeft(res)) {
    log.warn("failed to get recent deploy info", envName)
    return null
  }
  return res.right
}

async function getStagingSha({
  heroku,
  envName,
  token,
}: {
  readonly heroku: Heroku
  readonly envName: string
  readonly token: string
}): Promise<string | null> {
  const res = await heroku.getMostRecentDeployInfo({
    envName,
    token,
  })
  if (isLeft(res)) {
    log.warn("failed to get staging sha", envName)
    return null
  }
  return res.right.sha
}

export async function getMessage(
  env: NodeJS.ProcessEnv,
  heroku: Heroku,
  getCurrentDate: () => Date,
): Promise<KnownBlock[]> {
  const HEROKU_API_TOKEN = getEnvVar("TTD_HEROKU_API_TOKEN", env)

  const TIMEZONE = getEnvVar("TTD_TIMEZONE", env)

  const projectSettings = getProjectSettings(env)

  log.info("fetching env info from heroku")

  const envConfigs = await Promise.all(
    projectSettings.map(async settings => {
      const [stagingSha, lastDeploy] = await Promise.all([
        getStagingSha({
          heroku,
          envName: settings.stagingEnvName,
          token: HEROKU_API_TOKEN,
        }),
        getLastDeploy({
          heroku,
          envName: settings.productionEnvName,
          token: HEROKU_API_TOKEN,
        }),
      ])
      return {
        projectName: settings.name,
        repoURL: settings.repoURL,
        stagingEnvURL: settings.stagingEnvURL,
        productionEnvURL: settings.productionEnvURL,
        promotionDashboardURL: `https://dashboard.heroku.com/pipelines/${encodeURIComponent(
          settings.name.toLowerCase(),
        )}`,
        timezone: TIMEZONE,
        stagingSha,
        lastDeploy,
        getCurrentDate,
      }
    }),
  )

  log.info("creating messages")

  return flatten(envConfigs.map(getMessageOrDefault))
}
