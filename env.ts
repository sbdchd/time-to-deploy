import { log } from "./logging"

export function getEnvVar(name: string, env: NodeJS.ProcessEnv): string {
  const v = env[name]
  if (v == null || !v) {
    log.error(`Env var: not set ${name}`)
    process.exit(1)
  }
  return v
}
