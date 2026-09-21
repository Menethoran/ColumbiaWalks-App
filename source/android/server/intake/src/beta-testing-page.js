import { readFileSync } from "node:fs";

const pageHtml = readFileSync(
  new URL("./beta-testing/index.html", import.meta.url),
  "utf8"
);
const pageCss = readFileSync(
  new URL("./beta-testing/beta-testing.css", import.meta.url),
  "utf8"
);
const pageJs = readFileSync(
  new URL("./beta-testing/beta-testing.js", import.meta.url),
  "utf8"
);

export function registerBetaTestingPageRoutes(app) {
  app.get("/beta-testing", async (_request, reply) =>
    reply.redirect("/beta-testing/", 308)
  );
  app.get("/beta-testing/", async (_request, reply) =>
    securePage(reply).type("text/html; charset=utf-8").send(pageHtml)
  );
  app.get("/beta-testing/beta-testing.css", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("text/css; charset=utf-8")
      .send(pageCss)
  );
  app.get("/beta-testing/beta-testing.js", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("application/javascript; charset=utf-8")
      .send(pageJs)
  );
}

function securePage(reply) {
  return reply
    .header("Cache-Control", "no-store")
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "no-referrer")
    .header("X-Frame-Options", "DENY")
    .header(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
}

