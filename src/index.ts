import { FastifyModular } from "fastify-modular"
import fs from "fs/promises"
import type { PoolConfig } from "pg"
import pg from "pg"
import { Readable } from "stream"
import { json } from "stream/consumers"

export type PgPool = pg.Pool
export type PgPoolClient = pg.PoolClient
export type PostgresModuleOption =
    | { file: string, format?: 'json' }
    | PoolConfig

export const PostgresModule = FastifyModular('postgres')
    .option<PostgresModuleOption>()
    // ====================================================================================
    // pool is instance of pg.Pool
    .static('pool', 'auto', async ({ }, option) => {
        if ('file' in option) {
            let config: PoolConfig
            switch (option.format) {
                case 'json':
                case undefined:
                    config = await json(Readable.from(await fs.readFile(option.file))) as any
                    break
                default:
                    throw new Error(`[PostgresModule] unknown format '${option.format}'`)
                    break
            }
            return new pg.Pool(config) as PgPool
        }
        return new pg.Pool(option) as PgPool
    })
    // ====================================================================================
    // transaction is instance of pg.PoolClient
    // pool connection automatically get and release connection per request(HTTP, WS)
    .dynamic("transaction", 5000,
        async ({ pool }) => {
            const tx = await pool.connect()
            await tx.query("begin");
            return tx as PgPoolClient
        },
        async ({ value, catched }) => {
            if (catched === undefined) {
                await value.query("commit");
                value.release()
            } else {
                await value.query("rollback");
                value.release()
            }
        }
    )
    // ====================================================================================
    // when sse, ws api, it support rollback, commit and release socket
    .when({ includes: ['sse', 'ws'] })
    .define("rollback", async ({ transaction }) => {
        if (!transaction.isLoad) { return }
        await (await transaction).query("rollback");
        await transaction.drop()
    })
    .define("commit", async ({ transaction }) => {
        if (!transaction.isLoad) { return }
        await (await transaction).query("commit");
        await transaction.drop()
    })
    .end()
    .build()

export default PostgresModule;