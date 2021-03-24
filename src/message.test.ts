import { right } from "fp-ts/lib/Either"
import {
  humanize,
  getFallbackMessage,
  getMessage,
  ProjectsSchema,
} from "./message"
import * as t from "io-ts"
import { addHours, addMinutes, subDays, subHours } from "date-fns"
import { Comparison } from "./github"

function createTestHeroku(
  {
    isRollback = false,
    noChangesToDeploy = false,
  }: {
    readonly isRollback?: boolean
    readonly noChangesToDeploy?: boolean
  } = { isRollback: false, noChangesToDeploy: false },
) {
  const firstSha = "a8f68d19a290ad8a7eb19019de6ca58cecb444ce"
  const secondSha = "9c45ead4395ae80bc9a047f0a8474acc3ef93992"

  return async ({ envName }: { envName: string }) => {
    if (envName.includes("staging")) {
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

const fakeGithubResponse: Comparison = {
  totalCommits: 5,
  authors: [
    {
      login: "chdsbd",
      avatarUrl: "https://avatars.githubusercontent.com/u/1929960",
    },
    {
      login: "sbdchd",
      avatarUrl: "https://avatars.githubusercontent.com/u/7340772",
    },
  ],
  additions: 142,
  deletions: 23,
}

function fakeGitHub(comparision: Comparison = fakeGithubResponse) {
  return {
    compare: async (_: {
      readonly org: string
      readonly repo: string
      readonly base: string
      readonly head: string
    }): Promise<Comparison> => comparision,
  }
}

type ProjectSchemaType = t.TypeOf<typeof ProjectsSchema>

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

describe("message", () => {
  test("humanize", () => {
    const CURRENT_DATE = new Date("2019-10-28T00:00:00Z")
    const getCurrentDate = () => CURRENT_DATE

    const date = "2019-10-27T21:03:14Z"

    expect(
      humanize({
        date,
        timezone: "America/New_York",
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(`"Today at 5:03 p.m. (Oct 27, 2019)"`)

    const pastDate = subDays(CURRENT_DATE, 5).toISOString()
    expect(
      humanize({
        date: pastDate,
        timezone: "America/New_York",
        getCurrentDate,
      }),
    ).toMatchInlineSnapshot(`"5 days ago at 8:00 p.m. (Oct 22, 2019)"`)
  })

  test("humanize with timezones", () => {
    const PAST_DATE = new Date("2020-12-08T23:00:00.000Z")
    const CURRENT_DATE = addHours(PAST_DATE, 6)
    const TZ = "America/New_York"

    expect(
      humanize({
        date: PAST_DATE.toISOString(),
        timezone: TZ,
        getCurrentDate: () => CURRENT_DATE,
      }),
    ).toMatchInlineSnapshot(`"about 6 hours ago at 6:00 p.m. (Dec 8, 2020)"`)

    expect(
      humanize({
        date: PAST_DATE.toISOString(),
        timezone: TZ,
        getCurrentDate: () => addMinutes(PAST_DATE, 10),
      }),
    ).toMatchInlineSnapshot(`"Today at 6:00 p.m. (Dec 8, 2020)"`)

    expect(
      humanize({
        date: subHours(PAST_DATE, 15).toISOString(),
        timezone: TZ,
        getCurrentDate: () => PAST_DATE,
      }),
    ).toMatchInlineSnapshot(`"Today at 3:00 a.m. (Dec 8, 2020)"`)

    expect(
      humanize({
        date: subHours(PAST_DATE, 19).toISOString(),
        timezone: TZ,
        getCurrentDate: () => PAST_DATE,
      }),
    ).toMatchInlineSnapshot(`"about 19 hours ago at 11:00 p.m. (Dec 7, 2020)"`)
  })

  test("getMessage", async () => {
    const res = await getMessage(
      env,
      {
        getMostRecentDeployInfo: createTestHeroku(),
      },
      fakeGitHub(null),
      getCurrentDate,
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
            "url": "https://dashboard.heroku.com/pipelines/time%20to%20deploy%20project",
          },
          "text": Object {
            "text": "*Time To Deploy Project* — <https://github.com/ghost/time-to-deploy/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
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
      fakeGitHub(),
      getCurrentDate,
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
            "url": "https://dashboard.heroku.com/pipelines/time%20to%20deploy%20project",
          },
          "text": Object {
            "text": "*Time To Deploy Project* — <https://github.com/ghost/time-to-deploy/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      5 commits with 142 additions and 23 deletions",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "chdsbd",
              "image_url": "https://avatars.githubusercontent.com/u/1929960",
              "type": "image",
            },
            Object {
              "alt_text": "sbdchd",
              "image_url": "https://avatars.githubusercontent.com/u/7340772",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "2 authors",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
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
          noChangesToDeploy: true,
        }),
      },
      fakeGitHub(),
      getCurrentDate,
    )
    expect(noChangesRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": undefined,
          "text": Object {
            "text": "*Time To Deploy Project* — no changes",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "chdsbd",
              "image_url": "https://avatars.githubusercontent.com/u/1929960",
              "type": "image",
            },
            Object {
              "alt_text": "sbdchd",
              "image_url": "https://avatars.githubusercontent.com/u/7340772",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "2 authors",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
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
      fakeGitHub(),
      getCurrentDate,
    )

    expect(multipleEnvs).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com/pipelines/acacia",
          },
          "text": Object {
            "text": "*Acacia* — <https://github.com/ghost/Acacia/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      5 commits with 142 additions and 23 deletions",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "chdsbd",
              "image_url": "https://avatars.githubusercontent.com/u/1929960",
              "type": "image",
            },
            Object {
              "alt_text": "sbdchd",
              "image_url": "https://avatars.githubusercontent.com/u/7340772",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "2 authors",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/Acacia/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com/pipelines/altair",
          },
          "text": Object {
            "text": "*Altair* — <https://github.com/ghost/altair/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      5 commits with 142 additions and 23 deletions",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "chdsbd",
              "image_url": "https://avatars.githubusercontent.com/u/1929960",
              "type": "image",
            },
            Object {
              "alt_text": "sbdchd",
              "image_url": "https://avatars.githubusercontent.com/u/7340772",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "2 authors",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "last deployed: <https://github.com/ghost/altair/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)
  })

  test("plural vs singular message", async () => {
    const noChangesRes = await getMessage(
      env,
      {
        getMostRecentDeployInfo: createTestHeroku(),
      },
      fakeGitHub({
        ...fakeGithubResponse,
        totalCommits: 1,
        authors: [
          {
            login: "ghost",
            avatarUrl: "https://example.org/u/ghost",
          },
        ],
      }),
      getCurrentDate,
    )
    expect(noChangesRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com/pipelines/time%20to%20deploy%20project",
          },
          "text": Object {
            "text": "*Time To Deploy Project* — <https://github.com/ghost/time-to-deploy/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      1 commit with 142 additions and 23 deletions",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "ghost",
              "image_url": "https://example.org/u/ghost",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "1 author",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
      ",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `)
  })

  test("singular addition & deletion", async () => {
    const noChangesRes = await getMessage(
      env,
      {
        getMostRecentDeployInfo: createTestHeroku(),
      },
      fakeGitHub({
        ...fakeGithubResponse,
        additions: 1,
        deletions: 1,
      }),
      getCurrentDate,
    )

    expect(noChangesRes).toMatchInlineSnapshot(`
      Array [
        Object {
          "accessory": Object {
            "text": Object {
              "emoji": true,
              "text": "Promote Staging 🚢",
              "type": "plain_text",
            },
            "type": "button",
            "url": "https://dashboard.heroku.com/pipelines/time%20to%20deploy%20project",
          },
          "text": Object {
            "text": "*Time To Deploy Project* — <https://github.com/ghost/time-to-deploy/compare/a8f68d19a290ad8a7eb19019de6ca58cecb444ce...9c45ead4395ae80bc9a047f0a8474acc3ef93992|diff (_staging..production_)>
      5 commits with 1 addition and 1 deletion",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        Object {
          "elements": Array [
            Object {
              "alt_text": "chdsbd",
              "image_url": "https://avatars.githubusercontent.com/u/1929960",
              "type": "image",
            },
            Object {
              "alt_text": "sbdchd",
              "image_url": "https://avatars.githubusercontent.com/u/7340772",
              "type": "image",
            },
            Object {
              "emoji": true,
              "text": "2 authors",
              "type": "plain_text",
            },
          ],
          "type": "context",
        },
        Object {
          "elements": Array [
            Object {
              "text": "environments: <https://staging.example.com| staging>, <https://prod.example.com| production>
      last deployed: <https://github.com/ghost/time-to-deploy/commit/a8f68d19a290ad8a7eb19019de6ca58cecb444ce/|a8f68d1> Today at 4:11 p.m. (Nov 27, 2019)
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
            "text": "*Time To Deploy Project* — no changes",
            "type": "mrkdwn",
          },
          "type": "section",
        },
      ]
    `)
  })
})
