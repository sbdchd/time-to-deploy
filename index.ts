import dotenv from "dotenv"
import { herokuGetMostRecentDeployInfo } from "./heroku"
import { WebClient, retryPolicies } from "@slack/web-api"
import { log } from "./logging"
import { getEnvVar } from "./env"
import { getMessage } from "./message"

dotenv.config()

function getCurrentDate() {
  return new Date()
}

export async function handler() {
  log.info("Starting...")

  const SLACK_CHANNEL_ID = getEnvVar("TTD_SLACK_CHANNEL_ID", process.env)
  const SLACK_API_TOKEN = getEnvVar("TTD_SLACK_API_TOKEN", process.env)

  const heroku = {
    getMostRecentDeployInfo: herokuGetMostRecentDeployInfo,
  }

  const message = await getMessage(process.env, heroku, getCurrentDate)

  log.info("Created message")

  const web = new WebClient(SLACK_API_TOKEN, {
    retryConfig: retryPolicies.fiveRetriesInFiveMinutes,
  })

  try {
    log.info("Sending message")
    const result = await web.chat.postMessage({
      // Text forms the notification message.
      // see: https://api.slack.com/reference/messaging/payload
      text: "Time to deploy",
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
