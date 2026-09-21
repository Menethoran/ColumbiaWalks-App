import { readFileSync } from "node:fs";

import { buildPublicInsights } from "./admin-data.js";

const ALLOWED_RANGES = new Map([
  ["30", 30],
  ["90", 90],
  ["365", 365],
  ["all", Number.POSITIVE_INFINITY]
]);
const REPORT_FIELDS = [
  "date_created",
  "observed_at",
  "categories",
  "quick_report_type",
  "quick_report_types",
  "latitude",
  "longitude",
  "location"
].join(",");
const FEEDBACK_FIELDS = [
  "date_created",
  "date_updated",
  "feedback_category",
  "feedback_text",
  "status"
].join(",");

const pageHtml = readFileSync(
  new URL("./public-insights/index.html", import.meta.url),
  "utf8"
);
const pageCss = readFileSync(
  new URL("./public-insights/insights.css", import.meta.url),
  "utf8"
);
const pageJs = readFileSync(
  new URL("./public-insights/insights.js", import.meta.url),
  "utf8"
);
const leafletJs = readFileSync(
  new URL("./admin/vendor/leaflet/leaflet.js", import.meta.url),
  "utf8"
);
const leafletCss = readFileSync(
  new URL("./admin/vendor/leaflet/leaflet.css", import.meta.url),
  "utf8"
);
const leafletImages = new Map(
  ["marker-shadow.png", "marker-icon.png", "marker-icon-2x.png", "layers.png", "layers-2x.png"]
    .map((name) => [
      name,
      readFileSync(new URL(`./admin/vendor/leaflet/images/${name}`, import.meta.url))
    ])
);

export function registerPublicInsightsRoutes(app, options) {
  const directusUrl = options.directusUrl.replace(/\/+$/, "");
  const directusToken = options.directusToken;
  const fetchImplementation = options.fetchImplementation || fetch;

  app.get("/columbiawalks-insights", async (_request, reply) =>
    reply.redirect("/columbiawalks-insights/", 308)
  );
  app.get("/columbiawalks-insights/", async (_request, reply) =>
    securePublicPage(reply).type("text/html; charset=utf-8").send(pageHtml)
  );
  app.get("/columbiawalks-insights/insights.css", async (_request, reply) =>
    securePublicPage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("text/css; charset=utf-8")
      .send(pageCss)
  );
  app.get("/columbiawalks-insights/insights.js", async (_request, reply) =>
    securePublicPage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("application/javascript; charset=utf-8")
      .send(pageJs)
  );
  app.get("/columbiawalks-insights/vendor/leaflet/leaflet.css", async (_request, reply) =>
    securePublicPage(reply)
      .header("Cache-Control", "public, max-age=86400")
      .type("text/css; charset=utf-8")
      .send(leafletCss)
  );
  app.get("/columbiawalks-insights/vendor/leaflet/leaflet.js", async (_request, reply) =>
    securePublicPage(reply)
      .header("Cache-Control", "public, max-age=86400")
      .type("application/javascript; charset=utf-8")
      .send(leafletJs)
  );
  app.get(
    "/columbiawalks-insights/vendor/leaflet/images/:name",
    async (request, reply) => {
      const image = leafletImages.get(request.params.name);
      if (!image) return reply.code(404).send();
      return securePublicPage(reply)
        .header("Cache-Control", "public, max-age=86400")
        .type("image/png")
        .send(image);
    }
  );

  app.get("/columbiawalks-api/public/insights", async (request, reply) => {
    const requestedRange = String(request.query?.range || "90");
    if (!ALLOWED_RANGES.has(requestedRange)) {
      return publicDataReply(reply).code(400).send({
        error: "range must be 30, 90, 365, or all."
      });
    }
    try {
      const [reports, feedback] = await Promise.all([
        fetchCollection({
          directusUrl,
          directusToken,
          fetchImplementation,
          collection: "safety_reports",
          fields: REPORT_FIELDS
        }),
        fetchCollection({
          directusUrl,
          directusToken,
          fetchImplementation,
          collection: "feedback_submissions",
          fields: FEEDBACK_FIELDS
        })
      ]);
      return publicDataReply(reply).send({
        data: buildPublicInsights({
          reports,
          feedback,
          rangeDays: ALLOWED_RANGES.get(requestedRange)
        }),
        privacy:
          "Aggregate statistics only. Individual submissions, descriptions, photos, identifiers, and exact locations are not included."
      });
    } catch (error) {
      request.log.error({ error }, "Could not build public ColumbiaWalks insights");
      return publicDataReply(reply).code(502).send({
        error: "Community insights are temporarily unavailable."
      });
    }
  });
}

async function fetchCollection({
  directusUrl,
  directusToken,
  fetchImplementation,
  collection,
  fields
}) {
  const data = [];
  const pageSize = 100;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const query = new URLSearchParams({
      fields,
      limit: String(pageSize),
      offset: String(offset),
      sort: "-date_created"
    });
    const response = await fetchImplementation(
      `${directusUrl}/items/${collection}?${query}`,
      {
        headers: {
          Authorization: `Bearer ${directusToken}`,
          Accept: "application/json"
        }
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Directus request failed with HTTP ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }
    const page = Array.isArray(body.data) ? body.data : [];
    data.push(...page);
    if (page.length < pageSize) break;
  }
  return data;
}

function publicDataReply(reply) {
  return reply
    .header("Access-Control-Allow-Origin", "*")
    .header("Cache-Control", "public, max-age=120")
    .header("X-Content-Type-Options", "nosniff");
}

function securePublicPage(reply) {
  return reply
    .header("Cache-Control", "no-store")
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "strict-origin-when-cross-origin")
    .header("X-Frame-Options", "DENY")
    .header(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
}

