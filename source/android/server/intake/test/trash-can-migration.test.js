import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../../directus-3.16-trash-cans-upgrade.cjs",
  import.meta.url
);

test("trash-can migration is idempotent and asserts private service-only access", async () => {
  const source = await readFile(migrationPath, "utf8");
  for (const collection of [
    "public_trash_cans",
    "trash_can_comments",
    "trash_can_complaints"
  ]) {
    assert.match(source, new RegExp(`\\b${collection}\\b`));
  }
  assert.match(source, /ensureCollection/);
  assert.match(source, /ensureField/);
  assert.match(source, /ensurePermission/);
  assert.match(source, /assertPrivatePermissions/);
  assert.match(source, /permission outside the private intake policy/);
  assert.match(source, /public_permission_created:\s*false/);
  assert.match(source, /directus_public_read:\s*false/);
  assert.match(source, /public_reads_through_intake_service:\s*true/);
  assert.match(source, /complaints_publicly_readable:\s*false/);
  assert.match(source, /raw_comments_publicly_readable:\s*false/);
  assert.doesNotMatch(source, /action:\s*["']delete["']/);
  assert.doesNotMatch(source, /fields:\s*\[\s*["']\*["']/);
});

