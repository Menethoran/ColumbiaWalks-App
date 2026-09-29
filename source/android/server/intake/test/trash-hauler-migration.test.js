import assert from "node:assert/strict";
import test from "node:test";
import migration from "../../directus-3.17-trash-haulers-upgrade.cjs";

function fixture() {
  const collections = ["trash_can_comments", "trash_can_complaints"];
  const fields = Object.fromEntries(collections.map((name) => [name, []]));
  const permissions = collections.map((collection, id) => ({ id, collection, action: "create", policy: "private", fields: ["submission_id"] }));
  const changes = [];
  let backedUp = false;
  return {
    fields, permissions, changes,
    options: {
      policyId: "private",
      backup: async () => { backedUp = true; },
      request: async (method, path, body) => {
        if (method === "GET" && path.startsWith("/permissions?")) return { data: permissions };
        if (method === "GET" && path.startsWith("/fields/")) return { data: fields[path.split("/")[2]] };
        assert.equal(backedUp, true, "Migration must verify backup before mutation");
        changes.push({ method, path, body });
        if (method === "POST") fields[path.split("/")[2]].push(body);
        if (method === "PATCH") permissions[Number(path.split("/")[2])].fields = body.fields;
        return {};
      },
    },
  };
}
test("hauler migration is additive, backup-first and idempotent", async () => {
  const state = fixture();
  await migration.migrate(state.options);
  assert.equal(state.changes.length, 6);
  for (const permission of state.permissions) assert.deepEqual(permission.fields, ["submission_id", "hauler", "property_type"]);
  const choices = state.fields.trash_can_comments[0].meta.options.choices.map(({ text }) => text);
  assert.deepEqual(choices, ["B&L Carson", "Cauler", "Good's", "Penn Waste", "Waste Connections", "Shell's", "WM.COM"]);
  await migration.migrate(state.options);
  assert.equal(state.changes.length, 6);
});
test("hauler migration refuses unexpected public permissions before changes", async () => {
  const state = fixture();
  state.permissions.push({ collection: "trash_can_comments", action: "read", policy: null, fields: ["*"] });
  await assert.rejects(migration.migrate(state.options), /Unexpected permission/);
  assert.equal(state.changes.length, 0);
});
test("failed backup stops all hauler changes", async () => {
  const state = fixture();
  state.options.backup = async () => { throw new Error("backup failed"); };
  await assert.rejects(migration.migrate(state.options), /backup failed/);
  assert.equal(state.changes.length, 0);
});
