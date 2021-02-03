import axios, { AxiosError } from "axios"
import { Either, left } from "fp-ts/lib/Either"
import * as t from "io-ts"
const baseHttp = axios.create({ timeout: 3000 })

type Method = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "PATCH"

type Params = Record<string, string | number>

export async function http<T, A, O>({
  url,
  method,
  params,
  shape,
  data,
  headers,
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
      headers,
      data,
    })
    return shape.decode(r.data)
  } catch (e) {
    return left(e)
  }
}
