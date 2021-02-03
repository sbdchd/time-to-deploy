import { getMessage, Heroku } from "./message"
import * as t from "io-ts"
import { isLeft, isRight } from "fp-ts/lib/Either"
import startOfDay from "date-fns/startOfDay"
import { Slack } from "./slack"
import { DB } from "./db"
import { log } from "./logging"
import { addWeeks, getUnixTime } from "date-fns"

export async function main({
  slack,
  db,
  heroku,
  env,
  event,
  getCurrentDate,
}: {
  event: unknown
  slack: Slack
  db: DB
  heroku: Heroku
  env: {
    readonly TTD_SLACK_CHANNEL_ID: string
    readonly TTD_HTTP_AUTH_TOKEN: string
    readonly TTD_TIMEZONE: string
    readonly TTD_PROJECT_SETTINGS: string
  }
  getCurrentDate: () => Date
}) {
  const eventInfo = getEventInfo(event)

  const SLACK_CHANNEL_ID = env.TTD_SLACK_CHANNEL_ID
  const HTTP_AUTH_TOKEN = env.TTD_HTTP_AUTH_TOKEN

  const message = await getMessage(env, heroku, getCurrentDate)

  log.info("Created message")

  try {
    log.info("Sending message")

    // Want the message history to be unique per channel
    const pk = startOfDay(getCurrentDate()).toISOString() + SLACK_CHANNEL_ID

    if (eventInfo.kind === "cron") {
      log.info("handling cron event")
      const result = await slack.postMessage({
        // Text forms the notification message.
        // see: https://api.slack.com/reference/messaging/payload
        text: "Time to deploy",
        // Blocks form the actual message body that is rendered in Slack.
        blocks: message,
        channel: SLACK_CHANNEL_ID,
      })
      if (isRight(result)) {
        const messageId = result.right.ts
        const ttl = getUnixTime(addWeeks(getCurrentDate(), 2))
        const res = await db.setKey({
          key: pk,
          value: messageId,
          ttl,
        })
        if (isRight(res)) {
          log.info("saved message id")
        } else {
          log.info("problem saving message", res.left)
        }
      } else {
        log.info("problem parsing slack response info")
      }

      log.info("Sent message to slack", result)
    } else if (eventInfo.kind === "api_call") {
      log.info("handling api_call event")
      if (eventInfo.authToken !== HTTP_AUTH_TOKEN) {
        log.info("missing auth token")
        return
      }
      const dbItem = await db.getKey(pk)
      if (isLeft(dbItem)) {
        log.info("couldn't find an existing message to update")
        return
      }
      const result = await slack.updateMessage({
        ts: dbItem.right.ts,
        text: "Time to deploy",
        blocks: message,
        channel: SLACK_CHANNEL_ID,
      })

      log.info("updated slack message", result)
    }
  } catch (e) {
    log.warn("Problem sending message to slack", e)
  }
}

const EventShape = t.union([
  t.type({
    routeKey: t.string,
    queryStringParameters: t.union([t.record(t.string, t.string), t.undefined]),
  }),
  t.type({
    ["detail-type"]: t.string,
    source: t.string,
    time: t.string,
  }),
])

type EventType =
  | { readonly kind: "api_call"; readonly authToken: string | null }
  | { readonly kind: "cron" }

function getEventInfo(event: unknown): EventType {
  const res = EventShape.decode(event)
  if (isRight(res) && "routeKey" in res.right) {
    return {
      kind: "api_call",
      authToken: res.right.queryStringParameters?.["auth_token"] ?? null,
    }
  }
  return {
    kind: "cron",
  }
}
