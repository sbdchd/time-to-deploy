import {
  WebClient,
  retryPolicies,
  KnownBlock,
  WebAPICallResult,
} from "@slack/web-api"
import { Either, isRight, left, right } from "fp-ts/lib/Either"
import * as t from "io-ts"

export type Slack = {
  postMessage: (_: {
    channel: string
    text: string
    blocks: KnownBlock[]
  }) => Promise<Either<void, { ts: string }>>
  updateMessage: (_: {
    ts: string
    channel: string
    text: string
    blocks: KnownBlock[]
  }) => Promise<WebAPICallResult>
}

const PostMessageResponseShape = t.type({
  ts: t.string,
})

export function createSlackClient(api_token: string): Slack {
  const web = new WebClient(api_token, {
    retryConfig: retryPolicies.fiveRetriesInFiveMinutes,
  })
  return {
    postMessage: async ({
      text,
      blocks,
      channel,
    }: {
      text: string
      blocks: KnownBlock[]
      channel: string
    }): Promise<Either<void, { ts: string }>> => {
      const res = await web.chat.postMessage({ text, blocks, channel })
      const result = PostMessageResponseShape.decode(res)
      if (isRight(result)) {
        return right({ ts: result.right.ts })
      }
      return left(undefined)
    },
    updateMessage: ({
      text,
      blocks,
      channel,
      ts,
    }: {
      text: string
      blocks: KnownBlock[]
      channel: string
      ts: string
    }): Promise<WebAPICallResult> => {
      return web.chat.update({ text, blocks, channel, ts })
    },
  }
}
