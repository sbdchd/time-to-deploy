import {
  humanize,
  getResponse,
  getFallbackMessage,
  IConfig,
  IHeroku,
} from "./message"

// via https://kimpers.com/mocking-date-and-time-in-tests-with-typescript-and-jest/
function mockDate(expected: Date) {
  const _Date = Date

  // If any Date or number is passed to the constructor
  // use that instead of our mocked date
  function MockDate(mockOverride?: Date | number) {
    return new _Date(mockOverride || expected)
  }

  MockDate.UTC = _Date.UTC
  MockDate.parse = _Date.parse
  MockDate.now = () => expected.getTime()
  // Give our mock Date has the same prototype as Date
  // Some libraries rely on this to identify Date objects
  MockDate.prototype = _Date.prototype

  // Our mock is not a full implementation of Date
  // Types will not match but it's good enough for our tests
  global.Date = MockDate as any

  // Callback function to remove the Date mock
  return () => {
    global.Date = _Date
  }
}

interface ICreateTestHeroku {
  readonly isRollback: boolean
}
function createTestHeroku({ isRollback }: ICreateTestHeroku): IHeroku {
  return {
    async getLastDeploy() {
      return {
        sha: "a8f68d19a290ad8a7eb19019de6ca58cecb444ce",
        createdAt: "2019-11-27T21:11:14Z",
        isRollback,
      }
    },
    async getStagingSha() {
      return "9c45ead4395ae80bc9a047f0a8474acc3ef93992"
    },
  }
}

describe("message", () => {
  test("humanize", () => {
    const getCurrentDate = () => new Date("2019-10-29T00:00:00Z")

    expect(
      humanize({
        date: "2019-10-27T21:03:14Z",
        timezone: null,
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(`"1 day ago at 9:03 p.m. (Oct 27, 2019) UTC"`)

    expect(
      humanize({
        date: "2019-10-27T21:03:14Z",
        timezone: "America/New_York",
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(`"1 day ago at 5:03 p.m. (Oct 27, 2019)"`)
  })
  const config: IConfig = {
    projectName: "Time To Deploy Project",
    stagingEnvURL: "https://staging.example.com",
    productionEnvURL: "https://prod.example.com",
    promotionDashboardURL: "https://dashboard.heroku.com",
    timezone: null,
  }

  test("getResponse", async () => {
    const mock = mockDate(new Date("2019-11-28T02:00:00Z"))
    const res = await getResponse(
      config,
      createTestHeroku({ isRollback: false }),
    )
    expect(res).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com",
          },
          "text": Object {
            "text": "*Time To Deploy Project*
      • <https://github.com/AdmitHub/marshall/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      • envs
          ◦ <https://staging.example.com| staging>
          ◦ <https://prod.example.com| production>",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "text": "Last deployed: <https://github.com/AdmitHub/marshall/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 9:11 p.m. (Nov 27, 2019) UTC
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)

    const rollbackRes = await getResponse(
      config,
      createTestHeroku({ isRollback: true }),
    )
    expect(rollbackRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com",
          },
          "text": Object {
            "text": "*Time To Deploy Project*
      • <https://github.com/AdmitHub/marshall/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      • envs
          ◦ <https://staging.example.com| staging>
          ◦ <https://prod.example.com| production>",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "text": "Last deployed: <https://github.com/AdmitHub/marshall/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 9:11 p.m. (Nov 27, 2019) UTC
      *Attention*: Last deploy was a *rollback*",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)

    mock()
  })

  test("getFallbackMessage", () => {
    const msg = getFallbackMessage(config)

    expect(msg).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com",
          },
          "text": Object {
            "text": "*Time To Deploy Project*

      • envs
          ◦ <https://staging.example.com| staging>
          ◦ <https://prod.example.com| production>",
            "type": "mrkdwn",
          },
          "type": "section",
        },
      ]
    `)
  })
})
