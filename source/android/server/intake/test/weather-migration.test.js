import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../../directus-3.16-weather-upgrade.cjs",
  import.meta.url
);

test("weather migration is backup-first and expands only existing intake permissions", async () => {
  const source = await readFile(migrationPath, "utf8");
  for (const field of [
    "weather_status",
    "weather_provider",
    "weather_dataset",
    "weather_summary",
    "weather_event_time_utc",
    "weather_valid_time_utc",
    "weather_time_delta_minutes",
    "weather_retrieved_at_utc",
    "weather_attribution",
    "weather_data"
  ]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.match(source, /VACUUM INTO/);
  assert.match(source, /PRAGMA quick_check/);
  assert.match(source, /assertAdministrator/);
  assert.match(source, /userHasAdministratorPolicy/);
  assert.match(source, /directus_access/);
  assert.match(source, /directus_policies/);
  assert.match(source, /refusing to create a broader permission automatically/);
  assert.match(source, /for \(const action of \["create", "read"\]\)/);
  assert.match(source, /verifyPermissionFields/);
  assert.match(source, /verified_weather_fields/);
  assert.match(source, /custom_permission_rules_enabled/);
  assert.match(source, /BEGIN IMMEDIATE/);
  assert.match(source, /readonly:\s*true/);
  assert.doesNotMatch(source, /action:\s*"update"/);
  assert.doesNotMatch(source, /policy:\s*null/);
});
