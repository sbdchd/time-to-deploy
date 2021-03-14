import { Writable } from "stream"
import bunyan from "bunyan"
import * as Sentry from "@sentry/node"
import * as t from "io-ts"
import { isRight } from "fp-ts/lib/These"
import omit from "lodash/omit"
export const log = bunyan.createLogger({ name: "main" })

const BunyanChunk = t.type({
  name: t.string,
  level: t.number,
  msg: t.string,
})

const logRecord = t.record(t.string, t.unknown)

const ALLOWED_LEVELS = new Set([
  Sentry.Severity.Log,
  Sentry.Severity.Info,
  Sentry.Severity.Debug,
])

function getOrElse<T>(a: t.Validation<T>, def: T): T {
  if (isRight(a)) {
    return a.right
  }
  return def
}

log.addStream({
  level: "debug",
  stream: new Writable({
    write(c: string, _encoding, next) {
      const decoded = getOrElse(logRecord.decode(JSON.parse(c)), {})
      const extra = omit(decoded, [
        "name",
        "hostname",
        "pid",
        "level",
        "msg",
        "time",
        "v",
      ])
      const chunk = BunyanChunk.decode(JSON.parse(c))
      if (isRight(chunk)) {
        const level = Sentry.Severity.fromString(
          bunyan.nameFromLevel[chunk.right.level],
        )
        // Report any message that's not "log", "info" or "debug"
        if (!ALLOWED_LEVELS.has(level)) {
          Sentry.captureMessage(chunk.right.msg, scope =>
            scope.setExtras(extra),
          )
        } else {
          Sentry.addBreadcrumb({
            type: "debug",
            category: chunk.right.name,
            message: chunk.right.msg,
            level,
            data: extra,
          })
        }
      }
      next()
    },
  }),
})
