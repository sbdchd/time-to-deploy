import { AxiosError } from "axios"
import { Either, right } from "fp-ts/lib/Either"
import { main } from "./handler"
import { GetLastDeployResponse } from "./heroku"
import * as t from "io-ts"
import { KnownBlock, WebAPICallResult } from "@slack/web-api"

function createFakeSlackClient() {
  const postMessageCalls: Array<{ args: PostMessageArgs }> = []
  type PostMessageArgs = {
    channel: string
    text: string
    blocks: KnownBlock[]
  }
  function postMessage(
    args: PostMessageArgs,
  ): Promise<Either<void, { ts: string }>> {
    postMessageCalls.push({ args })
    return Promise.resolve(right({ ts: "fake-ts-value" }))
  }

  const updateMessageCalls: Array<{ args: UpdateMessageArgs }> = []
  type UpdateMessageArgs = {
    ts: string
    channel: string
    text: string
    blocks: KnownBlock[]
  }
  function updateMessage(args: UpdateMessageArgs): Promise<WebAPICallResult> {
    updateMessageCalls.push({ args })
    return Promise.resolve({ ok: true })
  }

  return {
    postMessage: Object.assign(postMessage, { calls: postMessageCalls }),
    updateMessage: Object.assign(updateMessage, { calls: updateMessageCalls }),
  }
}

function createFakeDbClient() {
  const setKeyCalls: Array<{ args: SetKeyArgs }> = []
  type SetKeyArgs = {
    key: string
    value: string
  }
  function setKey(args: SetKeyArgs): Promise<Either<Error, void>> {
    setKeyCalls.push({ args })
    return Promise.resolve(right(undefined))
  }

  const getKeyCalls: Array<{ args: [string] }> = []
  function getKey(key: string): Promise<Either<Error, { ts: string }>> {
    getKeyCalls.push({ args: [key] })
    return Promise.resolve(right({ ts: "" }))
  }

  return {
    setKey: Object.assign(setKey, { calls: setKeyCalls }),
    getKey: Object.assign(getKey, { calls: getKeyCalls }),
  }
}

function createFakeHeroku() {
  const getMostRecentDeployInfoCalls: Array<{ args: unknown }> = []
  function getMostRecentDeployInfo(args: {
    envName: string
  }): Promise<
    Either<Error | t.Errors | AxiosError<unknown>, GetLastDeployResponse>
  > {
    getMostRecentDeployInfoCalls.push({ args })
    return Promise.resolve(
      right({
        sha: "foo",
        createdAt: "2020-12-05T17:42:41.840Z",
        isRollback: false,
        deployerEmail: "j.person@example.org",
      }),
    )
  }
  return {
    getMostRecentDeployInfo: Object.assign(getMostRecentDeployInfo, {
      calls: getMostRecentDeployInfoCalls,
    }),
  }
}

const github = {
  compare: (_: {
    readonly org: string
    readonly repo: string
    readonly base: string
    readonly head: string
  }) => Promise.resolve(5),
}

function getCurrentDate() {
  return new Date("2020-12-01T17:07:02.887Z")
}

describe("handler:main", () => {
  const SHARED_AUTH_TOKEN = "shared-auth-token"
  const env = {
    TTD_SLACK_CHANNEL_ID: "fake-slack-channel-id",
    TTD_HEROKU_API_TOKEN: "fake-heroku-api-token",
    TTD_TIMEZONE: "America/New_York",
    TTD_HTTP_AUTH_TOKEN: SHARED_AUTH_TOKEN,
    TTD_PROJECT_SETTINGS: JSON.stringify([
      {
        name: "Time To Deploy Project",
        repoURL: "https://github.com/ghost/example",
        stagingEnvURL: "https://staging.example.com",
        productionEnvURL: "https://prod.example.com",
        stagingEnvName: "staging name",
        productionEnvName: "production name",
      },
    ]),
  }
  test("cron", async () => {
    const slack = createFakeSlackClient()
    const db = createFakeDbClient()
    const heroku = createFakeHeroku()

    const fakeCronEvent = {
      ["detail-type"]: "",
      source: "",
      time: "",
    }
    await main({
      event: fakeCronEvent,
      slack,
      db,
      heroku,
      github,
      env,
      getCurrentDate,
    })

    expect(slack.postMessage.calls).toHaveLength(1)
    expect(slack.updateMessage.calls).toHaveLength(0)
    expect(db.setKey.calls).toMatchInlineSnapshot(`
      Array [
        Object {
          "args": Object {
            "key": "2020-12-01T00:00:00.000Zfake-slack-channel-id",
            "ttl": 1608052022,
            "value": "fake-ts-value",
          },
        },
      ]
    `)
    expect(db.getKey.calls).toEqual([])
    expect(heroku.getMostRecentDeployInfo.calls).toHaveLength(2)
  })
  test("api_call without auth_token", async () => {
    const slack = createFakeSlackClient()
    const db = createFakeDbClient()
    const heroku = createFakeHeroku()

    const fakeApiCallEvent = {
      routeKey: "",
      queryStringParameters: undefined,
    }
    await main({
      event: fakeApiCallEvent,
      slack,
      db,
      heroku,
      github,
      env,
      getCurrentDate,
    })

    expect(slack.postMessage.calls).toHaveLength(0)
    expect(slack.updateMessage.calls).toHaveLength(0)
    expect(db.setKey.calls).toHaveLength(0)
    expect(db.getKey.calls).toHaveLength(0)
    expect(heroku.getMostRecentDeployInfo.calls).toHaveLength(2)
  })

  test("api_call with auth_token", async () => {
    const slack = createFakeSlackClient()
    const db = createFakeDbClient()
    const heroku = createFakeHeroku()

    const fakeApiCallEvent = {
      routeKey: "",
      queryStringParameters: { auth_token: SHARED_AUTH_TOKEN },
    }
    await main({
      event: fakeApiCallEvent,
      slack,
      db,
      heroku,
      github,
      env,
      getCurrentDate,
    })

    expect(slack.postMessage.calls).toHaveLength(0)
    expect(slack.updateMessage.calls).toHaveLength(1)
    expect(db.setKey.calls).toHaveLength(0)
    expect(db.getKey.calls).toHaveLength(1)
    expect(heroku.getMostRecentDeployInfo.calls).toHaveLength(2)
  })
})
