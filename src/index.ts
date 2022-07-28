import { FastifyModular } from "fastify-modular"
import type { PoolConfig as _PoolConfig } from "pg"
import pg from "pg"

export type PoolConfig = Pick<_PoolConfig, keyof _PoolConfig>
export type PgPool = Pick<pg.Pool, keyof pg.Pool>
export type PgPoolClient = Pick<pg.PoolClient, keyof pg.PoolClient>
export type PostgresModuleOption = PoolConfig

export const PostgresModule = FastifyModular('postgres')
    .option<PostgresModuleOption>()
    // ====================================================================================
    // pg is instance of pg.Pool
    .static('pg', 'auto', async ({ }, option) => {
        return new pg.Pool(option) as PgPool
    })
    // ====================================================================================
    // transaction is instance of pg.PoolClient
    // pool connection automatically get and release connection per request(HTTP, WS)
    .dynamic("txPg:raw", 5000,
        async ({ pg }) => {
            const tx = await pg.connect() as PgPoolClient
            await tx.query("begin");
            return tx
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
    .dynamic("txPg", 5000,
        async ({ "txPg:raw":txPgRaw }) => {
            const tx = await txPgRaw as PgPoolClient
            await tx.query("begin");
            return tx
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
    .dynamic("txPgRollback", 5000, async ({ txPg }) => {
        if (!txPg.isLoad) { return }
        await (await txPg).query("rollback");
        await txPg.drop()
    })
    .dynamic("txPgCommit", 5000, async ({ txPg }) => {
        if (!txPg.isLoad) { return }
        await (await txPg).query("commit");
        await txPg.drop()
    })
    .build()

export default PostgresModule;