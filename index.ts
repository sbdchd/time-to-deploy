import dotenv from "dotenv"
import bunyan from "bunyan"
import {
  IGetLastDeployResponse,
  IConfig,
  IHeroku,
  getResponse,
  getFallbackMessage,
} from "./message"
import { herokuGetMostRecentDeployInfo } from "./heroku"
import { WebClient, KnownBlock, retryPolicies } from "@slack/web-api"

const log = bunyan.createLogger({ name: "main" })

dotenv.config()

function getEnvVar(name: string): string {
  const v = process.env[name]
  if (v == null || !v) {
    log.error(`Env var: not set ${name}`)
    process.exit(1)
    // make typescript happy, otherwise it can't tell that we are refining
    // string | undefined to string
    throw Error()
  }
  return v
}

const PROJECT_NAME = getEnvVar("TTD_PROJECT_NAME")
const STAGING_ENV_URL = getEnvVar("TTD_STAGING_ENV_URL")
const PRODUCTION_ENV_URL = getEnvVar("TTD_PRODUCTION_ENV_URL")
const PROMOTION_DASHBOARD_URL = getEnvVar("TTD_PROMOTION_DASHBOARD_URL")
const HEROKU_PROD_ENV_NAME = getEnvVar("TTD_HEROKU_PROD_ENV_NAME")
const HEROKU_STAGING_ENV_NAME = getEnvVar("TTD_HEROKU_STAGING_ENV_NAME")
const HEROKU_API_TOKEN = getEnvVar("TTD_HEROKU_API_TOKEN")
const SLACK_CHANNEL_ID = getEnvVar("TTD_SLACK_CHANNEL_ID")
const SLACK_API_TOKEN = getEnvVar("TTD_SLACK_API_TOKEN")
const TIMEZONE = getEnvVar("TTD_TIMEZONE")

const config: IConfig = {
  projectName: PROJECT_NAME,
  stagingEnvURL: STAGING_ENV_URL,
  productionEnvURL: PRODUCTION_ENV_URL,
  promotionDashboardURL: PROMOTION_DASHBOARD_URL,
  timezone: TIMEZONE,
}

const heroku: IHeroku = {
  async getLastDeploy(): Promise<IGetLastDeployResponse> {
    return herokuGetMostRecentDeployInfo({
      envName: HEROKU_PROD_ENV_NAME,
      token: HEROKU_API_TOKEN,
    })
  },
  async getStagingSha(): Promise<string> {
    const { sha } = await herokuGetMostRecentDeployInfo({
      envName: HEROKU_STAGING_ENV_NAME,
      token: HEROKU_API_TOKEN,
    })
    return sha
  },
}

async function getMessageOrDefault(
  config: IConfig,
  heroku: IHeroku,
): Promise<Array<KnownBlock>> {
  try {
    return await getResponse(config, heroku)
  } catch (e) {
    return getFallbackMessage(config)
  }
}

export async function handler() {
  log.info("Starting...")
  const message = await getMessageOrDefault(config, heroku)
  log.info("Created message")

  const web = new WebClient(SLACK_API_TOKEN, {
    retryConfig: retryPolicies.fiveRetriesInFiveMinutes,
  })

  try {
    log.info("Sending message")
    const result = await web.chat.postMessage({
      // Text forms the notification message.
      // see: https://api.slack.com/reference/messaging/payload
      text: `Time to deploy ${config.projectName}`,
      // Blocks form the actual message body that is rendered in Slack.
      blocks: message,
      channel: SLACK_CHANNEL_ID,
    })
    log.info("Sent message to slack", result)
  } catch (e) {
    log.warn("Problem sending message to slack", e)
  }
}

if (!module.parent) {
  handler()
}
