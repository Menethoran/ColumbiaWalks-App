import { randomUUID } from "node:crypto";

const directusUrl = process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055";
const intakeUrl = process.env.INTAKE_INTERNAL_URL ||
  "http://columbiawalks-intake:8080";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("Directus administrator credentials are required for cleanup.");
}

const eventId = randomUUID();
const event = {
  event_id: eventId,
  event_type: "up_to_date",
  from_version_code: 31300,
  from_version_name: "3.13.0",
  target_version_code: 31300,
  target_version_name: "3.13.0",
  occurred_at: new Date().toISOString(),
  platform: "android"
};

let accessToken = "";
let recordId = null;
try {
  const intakeResponse = await fetch(
    intakeUrl + "/columbiawalks-api/app-update-events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    }
  );
  if (intakeResponse.status !== 201) {
    throw new Error(`Intake verification failed with HTTP ${intakeResponse.status}.`);
  }

  const loginResponse = await fetch(directusUrl + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, mode: "json" })
  });
  const login = await loginResponse.json();
  accessToken = login.data?.access_token || "";
  if (!loginResponse.ok || !accessToken) {
    throw new Error("Could not authenticate for verification cleanup.");
  }

  const query = new URLSearchParams({
    "filter[event_id][_eq]": eventId,
    fields: "id,event_id,event_type,platform",
    limit: "1"
  });
  const readResponse = await fetch(
    directusUrl + `/items/app_update_events?${query}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const read = await readResponse.json();
  const stored = read.data?.[0];
  if (
    !readResponse.ok ||
    stored?.event_id !== eventId ||
    stored?.event_type !== "up_to_date" ||
    stored?.platform !== "android"
  ) {
    throw new Error("The stored verification event did not match the request.");
  }
  recordId = stored.id;
  console.log("Verified the app update event endpoint and private Directus storage.");
} finally {
  if (accessToken && recordId !== null) {
    const deleteResponse = await fetch(
      directusUrl + `/items/app_update_events/${recordId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!deleteResponse.ok) {
      throw new Error("Verification passed, but its temporary event could not be removed.");
    }
    console.log("Removed the temporary verification event.");
  }
}

