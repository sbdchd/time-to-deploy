import { Writable } from "stream"
import bunyan from "bunyan"
import * as Sentry from "@sentry/node"
import * as t from "io-ts"
import { isRight } from "fp-ts/lib/These"
import omit from "lodash/omit"
const baselogger = bunyan.createLogger({ name: "main" })

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

type LogContext = Record<string, unknown>

class CustomLogger {
  logger: bunyan
  constructor(logger: bunyan) {
    this.logger = logger
  }
  private log(
    type: "info" | "warn" | "error",
    contextOrMessage: LogContext | string,
    context?: LogContext,
  ): void {
    if (typeof contextOrMessage === "object") {
      baselogger[type](contextOrMessage)
      return
    }
    if (typeof context != null) {
      baselogger[type](context, contextOrMessage)
      return
    }
    baselogger[type](contextOrMessage)
  }
  info(context: LogContext): void
  info(message: string, context?: LogContext): void
  info(contextOrMessage: LogContext | string, context?: LogContext): void {
    this.log("info", contextOrMessage, context)
  }

  warn(context: LogContext): void
  warn(message: string, context?: LogContext): void
  warn(contextOrMessage: LogContext | string, context?: LogContext): void {
    this.log("warn", contextOrMessage, context)
  }

  error(context: LogContext): void
  error(message: string, context?: LogContext): void
  error(contextOrMessage: LogContext | string, context?: LogContext): void {
    this.log("error", contextOrMessage, context)
  }
  child(context: LogContext): CustomLogger {
    return new CustomLogger(this.logger.child(context))
  }
}

export const log = new CustomLogger(baselogger)

baselogger.addStream({
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
