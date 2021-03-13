import dotenv from "dotenv"
import { createHerokuClient } from "./heroku"
import { log } from "./logging"
import { createSlackClient } from "./slack"
import { createDbClient } from "./db"
import { createGitHubClient } from "./github"
import { main } from "./handler"
import * as t from "io-ts"
import { isLeft } from "fp-ts/lib/Either"

dotenv.config()

function getCurrentDate() {
  return new Date()
}

const EnvShape = t.type({
  TTD_SLACK_CHANNEL_ID: t.string,
  TTD_HTTP_AUTH_TOKEN: t.string,
  TTD_SLACK_API_TOKEN: t.string,
  TTD_DYNAMO_TABLE_NAME: t.string,
  TTD_HEROKU_API_TOKEN: t.string,
  TTD_TIMEZONE: t.string,
  TTD_PROJECT_SETTINGS: t.string,
  TTD_GITHUB_APP_ID: t.string,
  TTD_GITHUB_INSTALL_ID: t.string,
  TTD_GITHUB_APP_PRIVATE_KEY: t.string,
})

export async function handler(event: unknown) {
  log.info("Starting...")

  const env = EnvShape.decode(process.env)

  if (isLeft(env)) {
    log.error("problem parsing env", env)
    return
  }

  await main({
    heroku: createHerokuClient(env.right.TTD_HEROKU_API_TOKEN),
    slack: createSlackClient(env.right.TTD_SLACK_API_TOKEN),
    github: createGitHubClient({
      appId: env.right.TTD_GITHUB_APP_ID,
      installId: env.right.TTD_GITHUB_INSTALL_ID,
      privateKey: env.right.TTD_GITHUB_APP_PRIVATE_KEY,
    }),
    db: createDbClient(env.right.TTD_DYNAMO_TABLE_NAME),
    env: env.right,
    event,
    getCurrentDate,
  })
}
