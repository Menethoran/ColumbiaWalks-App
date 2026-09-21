const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055")
  .replace(/\/+$/, "");
const adminToken = process.env.ADMIN_TOKEN || "";
const applyChanges = process.env.APPLY === "true";

if (!adminToken) {
  throw new Error("Set ADMIN_TOKEN to a short-lived Directus administrator token.");
}

async function request(method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`
    );
  }
  return payload;
}

function fileId(value) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : "";
}

function locationLabel(value) {
  let parsed = value;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(value);
    } catch {
      return "";
    }
  }
  return String(parsed?.label || parsed?.name || "").trim().slice(0, 200);
}

(async () => {
  const query = new URLSearchParams({
    "filter[submission_mode][_eq]": "pos",
    "filter[photo][_nnull]": "true",
    "filter[publication_status][_neq]": "published",
    fields:
      "id,photo,details,nearest_intersection,latitude,longitude,publication_status",
    limit: "-1"
  });
  const result = await request("GET", `/items/safety_reports?${query}`);
  const reports = Array.isArray(result.data) ? result.data : [];
  const preview = reports.map((report) => ({
    id: report.id,
    photo: fileId(report.photo),
    current_status: report.publication_status || "not_set"
  }));
  if (!applyChanges) {
    console.log(JSON.stringify({ dry_run: true, candidates: preview }, null, 2));
    return;
  }

  let published = 0;
  for (const report of reports) {
    const publicPhoto = fileId(report.photo);
    if (!publicPhoto) continue;
    await request("PATCH", `/items/safety_reports/${report.id}`, {
      publication_status: "published",
      public_photo: publicPhoto,
      published_at: new Date().toISOString(),
      heatmap_eligible:
        Number.isFinite(Number(report.latitude)) &&
        Number.isFinite(Number(report.longitude)),
      public_caption: String(report.details || "").trim().slice(0, 500),
      public_location_label: locationLabel(report.nearest_intersection),
      publish_full_plate: false
    });
    published += 1;
  }
  console.log(JSON.stringify({ dry_run: false, published }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

