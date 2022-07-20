import { Requester } from "@fastify-modular/request"
import { HTTPBody, HTTPNoBody } from "@fastify-modular/route"
import Fastify from "fastify"
import { FastifyModular } from "fastify-modular"
import { pito } from "pito"
import tap from "tap"
import PostgresModule from "../esm/index.js"





tap.test("build", async t => {
    const PORT = 20000
    const init = HTTPBody('POST', '/init').build()
    const insert = HTTPBody('POST', '/insert').body(pito.Obj({ value: pito.Str() })).build()
    const insertFail = HTTPBody('POST', '/insertFail').body(pito.Obj({ value: pito.Str() })).build()
    const select = HTTPNoBody('GET', '/select').response(pito.Arr(pito.Str())).build()
    // 
    // 
    const mod = FastifyModular('00_import')
        .import(PostgresModule).from()
        .dynamic('newAccount', async ({ transaction }) => {
            //a
            //b/
            //c
            return async () => { }
        })
        .route(init).implements(async ({ body }, { transaction, newAccount }) => {
            const tmpv = newAccount()
            await (await transaction).query(`drop table if exists fastify_modular_pg_00`);
            await (await transaction).query(`create table fastify_modular_pg_00(value varchar(100))`);
        })
        .route(insert).implements(async ({ body }, { transaction }) => {
            await (await transaction).query(`insert into fastify_modular_pg_00(value) values ($1)`, [body.value])
        })
        .route(insertFail).implements(async ({ body, fail }, { transaction }) => {
            await (await transaction).query(`insert into fastify_modular_pg_00(value) values ($1)`, [body.value])
            throw fail({ 'failed': 'failed' })
        })
        .route(select).implements(async ({ }, { transaction }) => {
            const temp = await (await transaction).query(`select value from fastify_modular_pg_00`)
            return temp.rows.map(v => v.value as string)
        })
        .do(async ({ pool }, _, { fastify }) => { fastify.addHook('onClose', async () => { await pool.end() }) })
        .build()
    //
    // 
    const fastify = Fastify()
    await fastify.register(mod.plugin(), {
        postgres: {
            host: "localhost",
            port: 5432,
            user: 'postgres'
        }
    })
    await fastify.listen({ port: PORT })
    // 
    const req = Requester.create(`http://localhost:${PORT}`)

    await req.request(init, {})
    await req.request(insert, { body: { value: 'hello' } })
    const sel0 = await req.request(select, {}).ok()
    await req.request(insertFail, { body: { value: 'world' } })
    const sel1 = await req.request(select, {}).ok()
    t.same(sel0, ['hello'])
    t.same(sel1, ['hello'])
    console.log("sel0")
    await fastify.close()
    console.log("close")
})
