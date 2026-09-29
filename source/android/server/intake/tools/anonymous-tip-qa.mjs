// Isolated, loopback-only QA fixture. Never deploy this in place of Directus.
// It exercises the real intake route with a durable SQLite storage test double.
import Fastify from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { registerAnonymousTipRoutes } from '../src/anonymous-tip-routes.js';
const database = new DatabaseSync(process.env.CW_TIP_QA_DB || '/tmp/cw317-anonymous-tip-qa.sqlite');
database.exec('CREATE TABLE IF NOT EXISTS tips (id INTEGER PRIMARY KEY, submission_id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL)');
const app = Fastify({ logger: false });
let failNextResponse = false;
app.post("/__qa/fail-next", async (_, reply) => { failNextResponse = true; return reply.code(204).send(); });
registerAnonymousTipRoutes(app, {
  directusUrl: 'http://qa-store.invalid', directusToken: 'local-fixture-only', anonymousTipTestsEnabled: true,
  fetchImplementation: async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.origin !== 'http://qa-store.invalid' || parsed.pathname !== '/items/anonymous_tip_tests') throw new Error('unexpected route');
    if (options.method === 'POST') {
      const row = JSON.parse(options.body);
      try {
        const result = database.prepare('INSERT INTO tips (submission_id,payload) VALUES (?,?)').run(row.submission_id, options.body);
        if (failNextResponse) { failNextResponse = false; throw new Error("simulated_lost_response"); }
        return Response.json({ data: { ...row, id: Number(result.lastInsertRowid) } });
      } catch (error) {
        if (error.message === "simulated_lost_response") throw error;
        return Response.json({ errors: [{ extensions: { code: 'RECORD_NOT_UNIQUE' } }] }, { status: 409 });
      }
    }
    const record = database.prepare('SELECT id,payload FROM tips WHERE submission_id=?').get(parsed.searchParams.get('filter[submission_id][_eq]'));
    return Response.json({ data: record ? [{ ...JSON.parse(record.payload), id: record.id }] : [] });
  }
});
await app.listen({ host: '127.0.0.1', port: 31717 });
console.log('Local anonymous-tip QA fixture listening on 127.0.0.1:31717; no official recipient or public binding.');
