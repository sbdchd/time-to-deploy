import { formatDistance, format } from "date-fns"
import { utcToZonedTime } from "date-fns-tz"
import { KnownBlock } from "@slack/types"

export interface IGetLastDeployResponse {
  readonly sha: string
  readonly createdAt: string
  readonly isRollback: boolean
}

export interface IHeroku {
  readonly getLastDeploy: () => Promise<IGetLastDeployResponse>
  readonly getStagingSha: () => Promise<string>
}

export interface IConfig {
  readonly projectName: string
  readonly stagingEnvURL: string
  readonly productionEnvURL: string
  readonly promotionDashboardURL: string
  readonly timezone: string | null
}

interface IHumanize {
  readonly date: string
  readonly timezone: string | null
  readonly getCurrentDate?: () => Date
}

export function humanize({
  date,
  timezone,
  getCurrentDate = () => new Date(),
}: IHumanize): string {
  const d = timezone == null ? new Date(date) : utcToZonedTime(date, timezone)
  return (
    formatDistance(d, getCurrentDate(), { addSuffix: true }) +
    " at " +
    format(d, "h:mm aaaa (MMM d, yyyy)") +
    (timezone == null ? " UTC" : "")
  )
}

interface IGetBodyText {
  readonly config: IConfig
  readonly lastDeploySha?: string
  readonly stagingSha?: string
}
function getBodyText({ config, lastDeploySha, stagingSha }: IGetBodyText) {
  const diffUrl =
    lastDeploySha && stagingSha
      ? `https://github.com/AdmitHub/marshall/compare/${lastDeploySha}...${stagingSha}`
      : null
  return `\
*${config.projectName}*
${diffUrl ? `• <${diffUrl}|diff (_staging..production_)>` : ""}
• envs
    ◦ <${config.stagingEnvURL}| staging>
    ◦ <${config.productionEnvURL}| production>`
}

export async function getResponse(
  config: IConfig,
  heroku: IHeroku,
): Promise<Array<KnownBlock>> {
  const stagingSha = await heroku.getStagingSha()
  const lastDeploy = await heroku.getLastDeploy()

  const lastDeployUrl = `https://github.com/AdmitHub/marshall/commit/${lastDeploy.sha}/`

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: getBodyText({
          config,
          lastDeploySha: lastDeploy.sha,
          stagingSha,
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
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Last deployed: <${lastDeployUrl}|${lastDeploy.sha.slice(
            0,
            7,
          )}> ${humanize({
            date: lastDeploy.createdAt,
            timezone: config.timezone,
          })}
${lastDeploy.isRollback ? "*Attention*: Last deploy was a *rollback*" : ""}`,
        },
      ],
    },
  ]
}

export function getFallbackMessage(config: IConfig): Array<KnownBlock> {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: getBodyText({ config }),
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
