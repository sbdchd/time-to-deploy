import axios, { AxiosError } from "axios"
import { Either, left } from "fp-ts/lib/Either"
import { isRight } from "fp-ts/lib/These"
import * as t from "io-ts"
const baseHttp = axios.create({ timeout: 3000 })
import { log } from "./logging"

type Method = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "PATCH"

type Params = Record<string, string | number>

export async function http<T, A, O>({
  url,
  method,
  params,
  shape,
  data,
  headers = {},
}: {
  readonly url: string
  readonly method: Method
  readonly data?: T
  readonly shape: t.Type<A, O>
  readonly headers?: Record<string, string>
  readonly params?: Params
}): Promise<Either<AxiosError<unknown>, A>> {
  try {
    const r = await baseHttp.request<unknown>({
      url,
      method,
      params,
      headers: { "User-Agent": "sbdchd/time-to-deploy", ...headers },
      data,
    })
    let parsed = shape.decode(r.data)
    if (isRight(parsed)) {
      return parsed
    }
    log.warn({ violations: parsed.left }, "failed to parse schema")
    throw new Error("Failed to parse schema")
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e != null &&
      e.hasOwnProperty("isAxiosError")
    ) {
      log.warn({ err: e }, "problem making http request")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return left(e as AxiosError)
    }
    throw e
  }
}
