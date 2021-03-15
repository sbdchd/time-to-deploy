import axios, { AxiosError } from "axios"
import { Either, isRight, left } from "fp-ts/lib/Either"
import * as t from "io-ts"
import * as Sentry from "@sentry/node"
import { PathReporter } from "io-ts/lib/PathReporter"
const baseHttp = axios.create({ timeout: 3000 })

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
}): Promise<Either<t.Errors | AxiosError<unknown> | Error, A>> {
  try {
    const r = await baseHttp.request<unknown>({
      url,
      method,
      params,
      headers: { "User-Agent": "sbdchd/time-to-deploy", ...headers },
      data,
    })
    let decodedResponse = shape.decode(r.data)
    if (isRight(decodedResponse)) {
      return decodedResponse
    }
    Sentry.captureMessage("schema violation", scope =>
      scope.setContext("http", { response: r.data }).setContext(
        "schema-violations",
        PathReporter.report(decodedResponse).reduce<{ [_: string]: unknown }>(
          (acc, val, index) => {
            acc[index] = val
            return acc
          },
          {},
        ),
      ),
    )
    return decodedResponse
  } catch (e) {
    Sentry.captureException(e)
    return left(e)
  }
}
