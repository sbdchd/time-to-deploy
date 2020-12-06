import { right } from "fp-ts/lib/Either"
import {
  humanize,
  getFallbackMessage,
  getMessage,
  ProjectsSchema,
} from "./message"
import * as t from "io-ts"

function createTestHeroku({
  isRollback,
  noChangesToDeploy = false,
}: {
  readonly isRollback: boolean
  readonly noChangesToDeploy?: boolean
}) {
  const firstSha = "a8f68d19a290ad8a7eb19019de6ca58cecb444ce"
  const secondSha = "9c45ead4395ae80bc9a047f0a8474acc3ef93992"

  return async ({ envName }: { envName: string }) => {
    if (envName === "staging") {
      const sha = noChangesToDeploy ? firstSha : secondSha
      return right({
        sha,
        createdAt: "2019-11-27T21:11:14Z",
        isRollback,
        deployerEmail: "j.person@example.com",
      })
    }
    return right({
      sha: firstSha,
      createdAt: "2019-11-27T21:11:14Z",
      isRollback,
      deployerEmail: "j.person@example.com",
    })
  }
}

type ProjectSchemaType = t.TypeOf<typeof ProjectsSchema>

describe("message", () => {
  test("humanize", () => {
    const getCurrentDate = () => new Date("2019-10-28T00:00:00Z")

    const date = "2019-10-27T21:03:14Z"

    expect(
      humanize({
        date,
        timezone: null,
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(
      `"about 3 hours ago at 9:03 p.m. (Oct 27, 2019) UTC"`,
    )

    expect(
      humanize({
        date,
        timezone: "America/New_York",
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(`"about 3 hours ago at 5:03 p.m. (Oct 27, 2019)"`)
  })

  test("getMessage", async () => {
    const getCurrentDate = () => new Date("2019-11-28T02:00:00Z")

    const projectSettings: ProjectSchemaType = [
      {
        name: "Time To Deploy Project",
        repoURL: "https://github.com/ghost/time-to-deploy",
        stagingEnvURL: "https://staging.example.com",
        productionEnvURL: "https://prod.example.com",
        stagingEnvName: "staging name",
        productionEnvName: "production name",
      },
    ]

    const env = {
      TTD_PROJECT_SETTINGS: JSON.stringify(projectSettings),
      TTD_HEROKU_API_TOKEN: "fake-heroku-api-token",
      TTD_TIMEZONE: "America/New_York",
    }
    const res = await getMessage(
      env,
      {
        getMostRecentDeployInfo: createTestHeroku({ isRollback: false }),
      },
      getCurrentDate,
    )
    expect(res).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Time To Deploy Project* — no changes
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
              "text": "Last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)

    const rollbackRes = await getMessage(
      env,
      { getMostRecentDeployInfo: createTestHeroku({ isRollback: true }) },
      getCurrentDate,
    )
    expect(rollbackRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Time To Deploy Project* — no changes
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
              "text": "Last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 4:11 p.m. (Nov 27, 2019)
      *Attention*: Last deploy was a *rollback* by j.person@example.com",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)

    const noChangesRes = await getMessage(
      env,
      {
        getMostRecentDeployInfo: createTestHeroku({
          isRollback: false,
          noChangesToDeploy: true,
        }),
      },
      getCurrentDate,
    )
    expect(noChangesRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Time To Deploy Project* — no changes
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
              "text": "Last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)

    const projectSettings2: ProjectSchemaType = [
      {
        name: "Acacia",
        repoURL: "https://github.com/ghost/Acacia",
        stagingEnvURL: "https://staging.example.com",
        productionEnvURL: "https://prod.example.com",
        stagingEnvName: "staging name",
        productionEnvName: "production name",
      },
      {
        name: "Altair",
        repoURL: "https://github.com/ghost/altair",
        stagingEnvURL: null,
        productionEnvURL: null,
        stagingEnvName: "altair staging",
        productionEnvName: "altair production",
      },
    ]
    const multipleEnvs = await getMessage(
      {
        TTD_PROJECT_SETTINGS: JSON.stringify(projectSettings2),
        TTD_TIMEZONE: "America/New_York",
      },
      {
        getMostRecentDeployInfo: createTestHeroku({
          isRollback: false,
        }),
      },
      getCurrentDate,
    )

    expect(multipleEnvs).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Acacia* — no changes
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
              "text": "Last deployed: <https://github.com/ghost/Acacia/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Altair* — no changes
      ",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "text": "Last deployed: <https://github.com/ghost/altair/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> about 5 hours ago at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)
  })

  test("getFallbackMessage", () => {
    const config = {
      projectName: "Time To Deploy Project",
      repoURL: "https://github.com/ghost/time-to-deploy",
      stagingEnvURL: "https://staging.example.com",
      productionEnvURL: "https://prod.example.com",
      promotionDashboardURL: "https://dashboard.heroku.com",
      timezone: null,
    }
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
            "text": "*Time To Deploy Project* — no changes
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
