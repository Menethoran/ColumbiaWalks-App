import sharp from "sharp";

import {
  TRASH_CAN_CATEGORIES,
  validateTrashCanSubmission
} from "./trash-can-validation.js";

const COLLECTIONS = Object.freeze({
  public_comment: "trash_can_comments",
  private_complaint: "trash_can_complaints"
});

const PUBLIC_CAN_FIELDS = [
  "public_trash_can_id",
  "label",
  "address",
  "latitude",
  "longitude",
  "description",
  "accessibility_notes"
].join(",");
const PUBLIC_COMMENT_FIELDS = [
  "public_trash_can_id",
  "categories",
  "public_comment",
  "approved_at"
].join(",");
const PUBLIC_COMMENT_CATEGORIES = new Set(TRASH_CAN_CATEGORIES.public_comment);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerTrashCanRoutes(app, options) {
  const directusUrl = options.directusUrl.replace(/\/+$/, "");
  const directusToken = options.directusToken;
  const fetchImplementation = options.fetchImplementation || fetch;

  app.post("/columbiawalks-api/trash-can-submissions", async (request, reply) => {
    let input;
    try {
      input = await readSubmissionRequest(request);
    } catch (error) {
      if (error?.code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.code(413).send({
          error: "The photo is larger than the upload limit."
        });
      }
      if (
        error?.code === "FST_FILES_LIMIT" ||
        error?.code === "FST_FIELDS_LIMIT" ||
        error?.code === "FST_PARTS_LIMIT"
      ) {
        return reply.code(400).send({
          error: "Submit one submission field and at most one photo."
        });
      }
      if (error instanceof TrashCanInputError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    const validation = validateTrashCanSubmission(input.value);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const submission = validation.submission;

    try {
      const existing = await findExistingSubmission(
        directusUrl,
        directusToken,
        submission.kind,
        submission.submission_id,
        fetchImplementation
      );
      if (existing) {
        return reply.code(200).send({
          data: submissionResponse(submission, Boolean(existing.photo)),
          duplicate: true
        });
      }

      const otherKind = submission.kind === "public_comment"
        ? "private_complaint"
        : "public_comment";
      const reusedAcrossKinds = await findExistingSubmission(
        directusUrl,
        directusToken,
        otherKind,
        submission.submission_id,
        fetchImplementation
      );
      if (reusedAcrossKinds) {
        return reply.code(409).send({
          error: "submission_id has already been used for another submission kind."
        });
      }
    } catch (error) {
      request.log.error(
        safeServiceError(error),
        "Could not check trash-can submission idempotency"
      );
      return reply.code(502).send({
        error: "The trash-can service could not verify this submission."
      });
    }

    let uploadedFileId = null;
    try {
      if (input.photoBytes !== null) {
        if (input.photoBytes.length === 0) {
          return reply.code(400).send({ error: "The attached photo is empty." });
        }
        let preparedPhoto;
        try {
          preparedPhoto = await prepareTrashCanPhoto(input.photoBytes);
        } catch (error) {
          request.log.warn(
            {
              ...safeServiceError(error),
              photoBytes: input.photoBytes.length
            },
            "Rejected an unreadable trash-can photo"
          );
          return reply.code(400).send({
            error: "This picture format could not be read. Try a JPEG or PNG picture."
          });
        }
        uploadedFileId = await uploadTrashCanPhoto(
          directusUrl,
          directusToken,
          submission.submission_id,
          preparedPhoto,
          fetchImplementation
        );
      }

      await createTrashCanSubmission(
        directusUrl,
        directusToken,
        submission,
        uploadedFileId,
        fetchImplementation
      );
      return reply.code(201).send({
        data: submissionResponse(submission, Boolean(uploadedFileId))
      });
    } catch (error) {
      if (uploadedFileId) {
        await safelyDeleteFile(
          directusUrl,
          directusToken,
          uploadedFileId,
          fetchImplementation,
          request.log
        );
      }

      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        try {
          const duplicate = await findExistingSubmission(
            directusUrl,
            directusToken,
            submission.kind,
            submission.submission_id,
            fetchImplementation
          );
          if (duplicate) {
            return reply.code(200).send({
              data: submissionResponse(submission, Boolean(duplicate.photo)),
              duplicate: true
            });
          }
        } catch (lookupError) {
          request.log.error(
            safeServiceError(lookupError),
            "Could not reconcile a duplicate trash-can submission"
          );
        }
      }

      request.log.error(
        safeServiceError(error),
        "Directus rejected a trash-can submission"
      );
      return reply.code(
        error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502
      ).send({
        error: "The trash-can service could not store this submission."
      });
    }
  });

  app.get("/columbiawalks-api/public/trash-cans", async (request, reply) => {
    try {
      const [trashCans, comments] = await Promise.all([
        readPublicTrashCans(
          directusUrl,
          directusToken,
          fetchImplementation
        ),
        readApprovedTrashCanComments(
          directusUrl,
          directusToken,
          fetchImplementation
        )
      ]);
      const activeTrashCanIds = new Set(trashCans.map(({ id }) => id));
      const linkedComments = comments.filter(({ public_trash_can_id: id }) =>
        id && activeTrashCanIds.has(id)
      );
      return reply
        .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
        .send({ data: { trash_cans: trashCans, comments: linkedComments } });
    } catch (error) {
      request.log.error(
        safeServiceError(error),
        "Could not build the public trash-can feed"
      );
      return reply.code(502).send({
        error: "The public trash-can information is temporarily unavailable."
      });
    }
  });
}

async function readSubmissionRequest(request) {
  if (!request.isMultipart()) {
    return { value: request.body, photoBytes: null };
  }

  let submissionValue = null;
  let photoBytes = null;
  let sawSubmission = false;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "photo" || photoBytes !== null) {
        await part.toBuffer();
        throw new TrashCanInputError(
          "Only one optional photo field is accepted."
        );
      }
      photoBytes = await part.toBuffer();
      continue;
    }
    if (part.fieldname !== "submission" || sawSubmission) {
      throw new TrashCanInputError(
        "Multipart requests must contain one submission field and at most one photo."
      );
    }
    sawSubmission = true;
    submissionValue = part.value;
  }

  if (!sawSubmission) {
    throw new TrashCanInputError("The submission field is required.");
  }
  try {
    return {
      value: typeof submissionValue === "string"
        ? JSON.parse(submissionValue)
        : submissionValue,
      photoBytes
    };
  } catch {
    throw new TrashCanInputError("The submission field is not valid JSON.");
  }
}

async function prepareTrashCanPhoto(photoBytes) {
  return sharp(photoBytes, {
    failOn: "error",
    limitInputPixels: 40_000_000
  })
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true
    })
    // Re-encoding without withMetadata() intentionally strips EXIF, GPS, XMP,
    // IPTC, and the source filename before the private evidence copy is stored.
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function uploadTrashCanPhoto(
  url,
  token,
  submissionId,
  photoBytes,
  fetchImplementation
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([photoBytes], { type: "image/jpeg" }),
    `columbiawalks-private-trash-can-${submissionId}.jpg`
  );
  form.append("title", `Private ColumbiaWalks trash-can submission ${submissionId}`);

  const result = await directusRequest(
    url,
    token,
    "/files",
    { method: "POST", body: form },
    fetchImplementation
  );
  if (!result.data?.id) {
    throw new Error("Directus did not return an uploaded file ID.");
  }
  return result.data.id;
}

async function createTrashCanSubmission(
  url,
  token,
  submission,
  photoId,
  fetchImplementation
) {
  const collection = COLLECTIONS[submission.kind];
  const { kind: _kind, ...shared } = submission;
  const payload = submission.kind === "public_comment"
    ? {
        ...shared,
        moderation_status: "moderation_pending"
      }
    : {
        ...shared,
        status: "new",
        privacy_status: "private"
      };
  if (photoId) payload.photo = photoId;

  await directusRequest(
    url,
    token,
    `/items/${collection}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    fetchImplementation
  );
}

async function findExistingSubmission(
  url,
  token,
  kind,
  submissionId,
  fetchImplementation
) {
  const query = new URLSearchParams();
  query.set("filter[submission_id][_eq]", submissionId);
  query.set("fields", "submission_id,photo");
  query.set("limit", "1");
  const result = await directusRequest(
    url,
    token,
    `/items/${COLLECTIONS[kind]}?${query}`,
    {},
    fetchImplementation
  );
  return Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;
}

function submissionResponse(submission, photoAttached) {
  return {
    submission_id: submission.submission_id,
    kind: submission.kind,
    status: submission.kind === "public_comment"
      ? "moderation_pending"
      : "new",
    photo_attached: photoAttached
  };
}

async function readPublicTrashCans(url, token, fetchImplementation) {
  const query = new URLSearchParams();
  query.set("filter[status][_eq]", "active");
  query.set("fields", PUBLIC_CAN_FIELDS);
  query.set("sort", "label");
  query.set("limit", "500");
  const result = await directusRequest(
    url,
    token,
    `/items/public_trash_cans?${query}`,
    {},
    fetchImplementation
  );
  return (Array.isArray(result.data) ? result.data : []).map((item) => ({
    id: uuidOrNull(item.public_trash_can_id),
    label: safeString(item.label),
    address: safeString(item.address),
    latitude: coordinateOrNull(item.latitude, -90, 90),
    longitude: coordinateOrNull(item.longitude, -180, 180),
    description: safeString(item.description),
    accessibility_notes: safeString(item.accessibility_notes)
  })).filter((item) => item.id && item.label);
}

async function readApprovedTrashCanComments(url, token, fetchImplementation) {
  const query = new URLSearchParams();
  query.set("filter[moderation_status][_eq]", "approved");
  query.set("filter[asset_scope][_eq]", "public");
  query.set("filter[public_comment][_nnull]", "true");
  query.set("fields", PUBLIC_COMMENT_FIELDS);
  query.set("sort", "-approved_at");
  query.set("limit", "250");
  const result = await directusRequest(
    url,
    token,
    `/items/trash_can_comments?${query}`,
    {},
    fetchImplementation
  );
  return (Array.isArray(result.data) ? result.data : []).map((item) => ({
    public_trash_can_id: uuidOrNull(item.public_trash_can_id),
    categories: Array.isArray(item.categories)
      ? [...new Set(item.categories)].filter((value) =>
          PUBLIC_COMMENT_CATEGORIES.has(value)
        ).slice(0, 3)
      : [],
    comment: safeString(item.public_comment).slice(0, 2000),
    approved_at: stringOrNull(item.approved_at)
  })).filter((item) => item.comment && item.categories.length > 0);
}

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function stringOrNull(value) {
  return typeof value === "string" && value ? value : null;
}

function uuidOrNull(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : null;
}

function coordinateOrNull(value, minimum, maximum) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

async function safelyDeleteFile(url, token, fileId, fetchImplementation, logger) {
  try {
    await directusRequest(
      url,
      token,
      `/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
      fetchImplementation
    );
  } catch (error) {
    logger.error(
      safeServiceError(error),
      "Could not remove an orphaned trash-can submission photo"
    );
  }
}

async function directusRequest(url, token, path, options, fetchImplementation) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  const response = await fetchImplementation(`${url}${path}`, {
    ...options,
    headers
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(`Directus request failed with HTTP ${response.status}.`);
    error.statusCode = response.status;
    error.directusCode = body?.errors?.[0]?.extensions?.code;
    throw error;
  }
  return body;
}

function safeServiceError(error) {
  const details = {};
  if (Number.isInteger(error?.statusCode)) {
    details.statusCode = error.statusCode;
  }
  if (typeof error?.directusCode === "string" && error.directusCode) {
    details.directusCode = error.directusCode;
  }
  if (typeof error?.name === "string" && error.name) {
    details.errorName = error.name;
  }
  return details;
}

class TrashCanInputError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
