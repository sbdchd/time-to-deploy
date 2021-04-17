export function assertNever(arg: never): never {
    throw Error(`expected never, got: ${arg}`)
}
