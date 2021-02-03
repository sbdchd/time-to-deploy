import * as t from "io-ts"
import aws from "aws-sdk"
import { isRight, right, left, Either } from "fp-ts/lib/Either"

const DocumentShape = t.type({
  pk: t.string,
  value: t.string,
  ttl: t.number,
})

export function createDbClient(tableName: string) {
  const db = new aws.DynamoDB.DocumentClient()
  return {
    setKey: async ({
      key,
      value,
      ttl,
    }: {
      key: string
      value: string
      ttl: number
    }): Promise<Either<Error, void>> => {
      const res = await db
        .put({
          TableName: tableName,
          Item: DocumentShape.encode({ pk: key, value, ttl }),
        })
        .promise()
      if (res.$response.error instanceof Error) {
        return left(res.$response.error)
      }
      return right(undefined)
    },
    getKey: async (key: string): Promise<Either<Error, { ts: string }>> => {
      const res = await db
        .get({ TableName: tableName, Key: { pk: key } })
        .promise()
      if (res.$response.error instanceof Error) {
        return left(res.$response.error)
      }
      const parsedRes = DocumentShape.decode(res.Item)
      if (isRight(parsedRes)) {
        return right({ ts: parsedRes.right.value })
      }
      return left(new Error("problem parsing response"))
    },
  }
}

export type DB = ReturnType<typeof createDbClient>
