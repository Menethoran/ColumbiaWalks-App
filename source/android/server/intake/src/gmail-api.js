export class GmailApiError extends Error {
  constructor(message, {
    statusCode = null,
    code = "gmail_error",
    retryable = false,
    ambiguous = false
  } = {}) {
    super(message);
    this.name = "GmailApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const OFFICIAL_SENDER = "columbiawalks@gmail.com";

export function createGmailApiClient({
  clientId,
  clientSecret,
  refreshToken,
  fetchImplementation = fetch,
  tokenUrl = "https://oauth2.googleapis.com/token",
  apiUrl = "https://gmail.googleapis.com/gmail/v1",
  accountEmail = OFFICIAL_SENDER,
  timeoutMs = 30_000,
  now = () => Date.now()
}) {
  for (const [name, value] of [
    ["Gmail OAuth client ID", clientId],
    ["Gmail OAuth client secret", clientSecret],
    ["Gmail OAuth refresh token", refreshToken]
  ]) {
    if (!String(value || "").trim()) throw new Error(`${name} is required.`);
  }
  if (String(accountEmail || "").trim().toLowerCase() !== OFFICIAL_SENDER) {
    throw new Error("The Gmail API account must be columbiawalks@gmail.com.");
  }
  let cachedToken = null;
  let expiresAt = 0;

  async function accessToken() {
    if (cachedToken && expiresAt - 60_000 > now()) return cachedToken;
    const body = new URLSearchParams({
      client_id: String(clientId).trim(),
      client_secret: String(clientSecret).trim(),
      refresh_token: String(refreshToken).trim(),
      grant_type: "refresh_token"
    });
    let response;
    try {
      response = await timedFetch(fetchImplementation, tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      }, timeoutMs);
    } catch (error) {
      throw new GmailApiError("Gmail OAuth token refresh could not be reached.", {
        code: "oauth_network",
        retryable: true,
        ambiguous: false
      });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new GmailApiError("Gmail OAuth token refresh was rejected.", {
        statusCode: response.status,
        code: response.status >= 500 ? "oauth_server" : "oauth_rejected",
        retryable: response.status === 429 || response.status >= 500,
        ambiguous: false
      });
    }
    if (payload.scope) {
      const scopes = String(payload.scope).trim().split(/\s+/).filter(Boolean);
      if (scopes.length !== 1 || scopes[0] !== GMAIL_SEND_SCOPE) {
        throw new GmailApiError(
          "The Gmail OAuth token reports a scope other than gmail.send.",
          {
            statusCode: response.status,
            code: "oauth_scope",
            retryable: false,
            ambiguous: false
          }
        );
      }
    }
    cachedToken = payload.access_token;
    expiresAt = now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000;
    return cachedToken;
  }

  return {
    async sendRaw(raw) {
      if (typeof raw !== "string" || raw.length === 0) {
        throw new Error("A base64url-encoded Gmail message is required.");
      }
      const token = await accessToken();
      let response;
      try {
        response = await timedFetch(
          fetchImplementation,
          `${apiUrl.replace(/\/+$/, "")}/users/${encodeURIComponent(OFFICIAL_SENDER)}/messages/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw })
          },
          timeoutMs
        );
      } catch (error) {
        throw new GmailApiError(
          "The Gmail send result is uncertain because the connection ended without a response.",
          {
            code: "send_ambiguous_network",
            retryable: false,
            ambiguous: true
          }
        );
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new GmailApiError("Gmail rejected the message send request.", {
          statusCode: response.status,
          code: response.status === 429
            ? "gmail_rate_limited"
            : response.status >= 500
              ? "gmail_server_error"
              : response.status === 401 || response.status === 403
                ? "gmail_authorization"
                : "gmail_rejected",
          retryable: response.status === 429 || response.status >= 500,
          ambiguous: false
        });
      }
      if (!payload.id) {
        throw new GmailApiError("Gmail returned success without a message ID.", {
          code: "gmail_invalid_success",
          ambiguous: true
        });
      }
      return {
        id: String(payload.id),
        threadId: payload.threadId ? String(payload.threadId) : null
      };
    },
    clearCachedAccessToken() {
      cachedToken = null;
      expiresAt = 0;
    }
  };
}

async function timedFetch(fetchImplementation, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImplementation(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
