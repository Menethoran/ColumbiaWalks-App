import {
  reportSubmissionChannel,
  submissionChannelLabel
} from "./submission-channel.js";

const PROFILE_PREFIX = "Pedestrian Profile\n";
const WALKING_PREFIX = "Walking Metric\n";
const COLUMBIA_CENTER = { latitude: 40.0337, longitude: -76.5044 };
const COLUMBIA_REPORT_RADIUS_KM = 16;
const EARTH_RADIUS_KM = 6371;
const CLOSED_STATUSES = new Set([
  "closed",
  "completed",
  "resolved",
  "rejected",
  "published"
]);

export function parsePedestrianProfile(feedbackText) {
  if (typeof feedbackText !== "string" || !feedbackText.startsWith(PROFILE_PREFIX)) {
    return null;
  }
  try {
    const profile = JSON.parse(feedbackText.slice(PROFILE_PREFIX.length));
    if (
      profile?.submission_type !== "pedestrian_profile" ||
      !profile.responses ||
      typeof profile.responses !== "object" ||
      Array.isArray(profile.responses)
    ) {
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

export function parseWalkingMetric(feedbackText) {
  if (typeof feedbackText !== "string" || !feedbackText.startsWith(WALKING_PREFIX)) {
    return null;
  }
  try {
    const metric = JSON.parse(feedbackText.slice(WALKING_PREFIX.length));
    const distance = Number(metric?.distance_meters);
    const duration = Number(metric?.duration_seconds);
    const activityCount = Number(metric?.activity_count ?? 1);
    if (
      metric?.submission_type !== "walking_metric" ||
      !["tracked_walk", "health_connect"].includes(metric.source) ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      !Number.isInteger(activityCount) ||
      activityCount < 1
    ) {
      return null;
    }
    return {
      ...metric,
      distance_meters: distance,
      duration_seconds: duration,
      activity_count: activityCount
    };
  } catch {
    return null;
  }
}

export function buildAdminDashboard({
  reports = [],
  feedback = [],
  complaints = [],
  updateEvents = [],
  rangeDays = 90,
  now = new Date()
} = {}) {
  const cutoff = Number.isFinite(rangeDays)
    ? now.getTime() - rangeDays * 24 * 60 * 60 * 1000
    : null;
  const inRange = (record) => {
    if (cutoff === null) return true;
    const timestamp = recordTimestamp(record);
    return timestamp !== null && timestamp >= cutoff;
  };

  const selectedReports = reports.filter(inRange);
  const selectedFeedback = feedback.filter(inRange);
  const selectedComplaints = complaints.filter(inRange);
  const selectedUpdateEvents = updateEvents.filter(inRange);
  const profiles = [];
  const walkingMetrics = [];
  const ordinaryFeedback = [];
  for (const item of selectedFeedback) {
    const profile = parsePedestrianProfile(item.feedback_text);
    const walkingMetric = parseWalkingMetric(item.feedback_text);
    if (profile) profiles.push({ item, profile });
    else if (walkingMetric) walkingMetrics.push({ item, metric: walkingMetric });
    else ordinaryFeedback.push(item);
  }

  const records = [
    ...selectedReports.map(normalizeSafetyReport),
    ...ordinaryFeedback.map(normalizeFeedback),
    ...profiles.map(normalizeProfile),
    ...walkingMetrics.map(normalizeWalkingMetric),
    ...selectedComplaints.map(normalizeComplaint)
  ].sort((left, right) => Date.parse(right.date || 0) - Date.parse(left.date || 0));

  const lastThirtyDays = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const issueRecords = records.filter((record) =>
    !["pedestrian_profile", "walking_metric"].includes(record.type)
  );
  const openIssues = issueRecords.filter(
    (record) => !CLOSED_STATUSES.has(String(record.status || "").toLowerCase())
  ).length;

  return {
    generated_at: now.toISOString(),
    range_days: Number.isFinite(rangeDays) ? rangeDays : null,
    totals: {
      issues: issueRecords.length,
      safety_reports: selectedReports.length,
      feedback: ordinaryFeedback.length,
      pedestrian_profiles: profiles.length,
      walking_metrics: walkingMetrics.length,
      police_complaints: selectedComplaints.length,
      open_issues: openIssues,
      last_30_days: records.filter((record) => {
        const timestamp = Date.parse(record.date || 0);
        return Number.isFinite(timestamp) && timestamp >= lastThirtyDays;
      }).length
    },
    breakdowns: {
      report_categories: countValues(
        selectedReports.flatMap((report) => [
          ...asArray(report.categories),
          ...asArray(report.quick_report_types),
          ...(report.quick_report_type ? [report.quick_report_type] : [])
        ])
      ),
      severity: countValues(selectedReports.map((report) => report.severity)),
      issue_status: countValues(issueRecords.map((record) => record.status || "new")),
      submission_source: countValues(records.map((record) => record.source)),
      feedback_category: countValues(
        ordinaryFeedback.map((item) => item.feedback_category)
      ),
      profile_safety: countValues(
        profiles.map(({ profile }) => profile.responses.general_walking_safety)
      ),
      profile_barriers: countValues(
        profiles.flatMap(({ profile }) => asArray(profile.responses.walking_barriers))
      ),
      walking_purposes: countValues(
        profiles.flatMap(({ profile }) => asArray(profile.responses.walking_purposes))
      ),
      mobility_needs: countValues(
        profiles.flatMap(({ profile }) =>
          asArray(profile.responses.mobility_or_accessibility_needs)
        )
      ),
      vehicle_access: countValues(
        profiles.map(({ profile }) => profile.responses.motor_vehicle_access)
      ),
      police_interaction_sentiment: countValues(
        selectedComplaints.map((item) => item.interaction_sentiment || "not_labeled")
      ),
      police_perspective: countValues(
        selectedComplaints.map((item) => item.reporter_perspective)
      ),
      police_topics: countValues(
        selectedComplaints.flatMap((item) =>
          asArray(item.interaction_categories || item.complaint_categories)
        )
      ),
      police_safety_change: countValues(
        selectedComplaints.map((item) => item.safety_change)
      ),
      update_events: countValues(
        selectedUpdateEvents.map((item) => item.event_type)
      ),
      update_target_versions: countValues(
        selectedUpdateEvents.map((item) => item.target_version_name)
      ),
      update_failures: countValues(
        selectedUpdateEvents.map((item) => item.error_code)
      ),
      report_app_versions: countValues(
        selectedReports.map((item) => item.app_version || "legacy_not_recorded")
      ),
      report_submission_channels: countValues(
        selectedReports.map(reportSubmissionChannel)
      ).map((item) => ({
        ...item,
        label: submissionChannelLabel(item.value)
      })),
      walking_sources: countValues(
        walkingMetrics.map(({ metric }) => metric.source)
      )
    },
    profile_metrics: buildProfileMetrics(profiles),
    walking_metrics: buildWalkingMetrics(walkingMetrics),
    police_metrics: buildPoliceMetrics(selectedComplaints),
    update_metrics: buildUpdateMetrics(selectedUpdateEvents),
    report_heatmap: buildReportHeatmap(selectedReports),
    records
  };
}

export function buildPublicInsights(options = {}) {
  const dashboard = buildAdminDashboard({
    reports: options.reports || [],
    feedback: options.feedback || [],
    complaints: [],
    updateEvents: [],
    rangeDays: options.rangeDays ?? 90,
    now: options.now || new Date()
  });
  return {
    generated_at: dashboard.generated_at,
    range_days: dashboard.range_days,
    totals: {
      issues: dashboard.totals.issues,
      safety_reports: dashboard.totals.safety_reports,
      feedback: dashboard.totals.feedback,
      pedestrian_profiles: dashboard.totals.pedestrian_profiles,
      walking_activities: dashboard.walking_metrics.activities
    },
    breakdowns: {
      report_categories: dashboard.breakdowns.report_categories,
      profile_safety: dashboard.breakdowns.profile_safety,
      profile_barriers: dashboard.breakdowns.profile_barriers,
      walking_purposes: dashboard.breakdowns.walking_purposes,
      walking_sources: dashboard.breakdowns.walking_sources
    },
    profile_metrics: dashboard.profile_metrics,
    walking_metrics: dashboard.walking_metrics,
    report_heatmap: coarsenPublicHeatmap(dashboard.report_heatmap)
  };
}

function coarsenPublicHeatmap(heatmap) {
  const cells = new Map();
  for (const point of heatmap?.points || []) {
    const latitude = round(Number(point.latitude), 3);
    const longitude = round(Number(point.longitude), 3);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const key = `${latitude},${longitude}`;
    const existing = cells.get(key) || {
      latitude,
      longitude,
      count: 0,
      categories: []
    };
    existing.count += Number(point.count) || 0;
    existing.categories.push(...asArray(point.categories));
    cells.set(key, existing);
  }
  return {
    center: heatmap?.center || [COLUMBIA_CENTER.latitude, COLUMBIA_CENTER.longitude],
    zoom: heatmap?.zoom || 14,
    precision: "approximately 100 metres",
    points: [...cells.values()]
      .map((point) => ({
        ...point,
        categories: unique(point.categories).slice(0, 5)
      }))
      .sort((left, right) => right.count - left.count)
  };
}

function buildWalkingMetrics(walkingMetrics) {
  const totalMeters = walkingMetrics.reduce(
    (sum, { metric }) => sum + metric.distance_meters,
    0
  );
  const totalSeconds = walkingMetrics.reduce(
    (sum, { metric }) => sum + metric.duration_seconds,
    0
  );
  const activities = walkingMetrics.reduce(
    (sum, { metric }) => sum + metric.activity_count,
    0
  );
  return {
    activities,
    total_miles: round(totalMeters / 1609.344, 2),
    average_miles: activities
      ? round(totalMeters / activities / 1609.344, 2)
      : 0,
    total_hours: round(totalSeconds / 3600, 1)
  };
}

function buildReportHeatmap(reports) {
  const buckets = new Map();
  for (const report of reports) {
    const coordinates = reportCoordinates(report);
    if (!coordinates) continue;
    const latitude = round(coordinates.latitude, 4);
    const longitude = round(coordinates.longitude, 4);
    const key = `${latitude},${longitude}`;
    const existing = buckets.get(key) || {
      latitude,
      longitude,
      count: 0,
      categories: []
    };
    existing.count += 1;
    existing.categories.push(...asArray(report.categories));
    buckets.set(key, existing);
  }
  return {
    center: [COLUMBIA_CENTER.latitude, COLUMBIA_CENTER.longitude],
    zoom: 14,
    points: [...buckets.values()].map((point) => ({
      ...point,
      categories: unique(point.categories).map(humanize).slice(0, 5)
    }))
  };
}

function buildUpdateMetrics(events) {
  const count = (eventType) => events.filter(
    (item) => item.event_type === eventType
  ).length;
  return {
    events: events.length,
    checks: count("up_to_date") + count("update_available") + count("check_failed"),
    updates_available: count("update_available"),
    verified_downloads: count("download_verified"),
    installer_opened: count("installer_opened"),
    confirmed_installs: count("installed"),
    failures: events.filter((item) =>
      item.event_type.endsWith("_failed") ||
      item.event_type === "install_permission_denied"
    ).length
  };
}

function buildPoliceMetrics(complaints) {
  const safetyChanges = complaints.map((item) => item.safety_change);
  return {
    responses: complaints.length,
    bystander_reports: complaints.filter(
      (item) => item.reporter_perspective === "bystander"
    ).length,
    felt_safer: safetyChanges.filter((value) =>
      ["much_safer", "somewhat_safer"].includes(value)
    ).length,
    felt_less_safe: safetyChanges.filter((value) =>
      ["much_less_safe", "somewhat_less_safe"].includes(value)
    ).length,
    average_ratings: Object.fromEntries(
      [
        "safety_before_rating",
        "safety_during_rating",
        "safety_after_rating",
        "respect_rating",
        "communication_rating",
        "helpfulness_rating",
        "professionalism_rating",
        "fairness_rating",
        "outcome_rating"
      ].map((field) => {
        const ratings = complaints
          .map((item) => Number(item[field]))
          .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 10);
        return [field, ratings.length ? round(average(ratings), 1) : null];
      })
    )
  };
}

function buildProfileMetrics(profiles) {
  const walkingDays = profiles
    .map(({ profile }) => Number(profile.responses.walking_days_per_week))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 7);
  const dailyMiles = profiles
    .map(({ profile }) => {
      const responses = profile.responses;
      const amount = Number(responses.daily_walking_amount);
      if (!Number.isFinite(amount) || amount < 0) return null;
      if (responses.daily_walking_unit === "steps") return amount / 2000;
      return amount;
    })
    .filter((value) => value !== null);

  return {
    responses: profiles.length,
    average_walking_days:
      walkingDays.length > 0 ? round(average(walkingDays), 1) : null,
    estimated_average_daily_miles:
      dailyMiles.length > 0 ? round(average(dailyMiles), 2) : null,
    walks_with_children: profiles.filter(
      ({ profile }) => profile.responses.regularly_walks_with_children === "yes"
    ).length,
    accessibility_need_responses: profiles.filter(({ profile }) => {
      const values = asArray(profile.responses.mobility_or_accessibility_needs);
      return values.some((value) => !["none", "prefer_not_to_say"].includes(value));
    }).length
  };
}

function normalizeSafetyReport(report) {
  const categories = unique([
    ...asArray(report.categories),
    ...asArray(report.quick_report_types),
    ...(report.quick_report_type ? [report.quick_report_type] : [])
  ]);
  const location = locationLabel(report);
  return {
    id: `report-${report.id}`,
    record_id: report.id,
    public_id: report.client_report_id,
    type: "safety_report",
    title: categories.length > 0 ? categories.map(humanize).join(", ") : "Safety report",
    summary: cleanText(report.details) || "Community safety report",
    date: report.date_created || report.observed_at || null,
    observed_at: report.observed_at || null,
    status: report.review_status || "new",
    severity: report.severity || null,
    source: report.submission_mode || "report",
    location,
    categories,
    page_of_shame: report.submission_mode === "pos" ? {
      publication_status: report.publication_status || "private",
      has_photo: Boolean(normalizeFileId(report.photo)),
      can_approve:
        report.publication_status !== "published" &&
        Boolean(normalizeFileId(report.photo))
    } : null,
    details: {
      "Reported party": humanize(report.reported_party_type),
      "Police response": humanize(report.police_response),
      "Vehicle involved": report.vehicle_involved ? "Yes" : "No",
      "Publication status": humanize(report.publication_status),
      "Weather status": humanize(report.weather_status),
      "Estimated weather": cleanText(report.weather_summary),
      "Weather valid time": report.weather_valid_time_utc || "Not available",
      "Weather dataset": humanize(report.weather_dataset),
      "Weather source": cleanText(report.weather_attribution) || "Not available",
      "App version": report.app_version || "Legacy / not recorded",
      "Submission channel": submissionChannelLabel(reportSubmissionChannel(report))
    }
  };
}

function normalizeFileId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
}

function normalizeWalkingMetric({ item, metric }) {
  const miles = round(metric.distance_meters / 1609.344, 2);
  return {
    id: `walking-${item.id}`,
    record_id: item.id,
    public_id: item.feedback_id,
    type: "walking_metric",
    title: metric.source === "health_connect" ? "Health Connect walking" : "Tracked walk",
    summary: `${miles} miles over ${formatDuration(metric.duration_seconds)}`,
    date: item.date_created || metric.period_end || null,
    status: item.status || "received",
    severity: null,
    source: metric.source,
    location: null,
    categories: [metric.source],
    details: {
      "Distance": `${miles} miles`,
      "Duration": formatDuration(metric.duration_seconds),
      "Walking activities": metric.activity_count,
      "Period start": metric.period_start,
      "Period end": metric.period_end,
      "Data source": humanize(metric.source),
      "App version": item.app_version || "Not recorded"
    }
  };
}

function normalizeFeedback(item) {
  return {
    id: `feedback-${item.id}`,
    record_id: item.id,
    public_id: item.feedback_id,
    type: "feedback",
    title: humanize(item.feedback_category || "feedback"),
    summary: cleanText(item.feedback_text) || "Feedback submission",
    date: item.date_created || item.date_updated || null,
    status: item.status || "new",
    severity: null,
    source: item.submission_source || "feedback",
    location: null,
    categories: [item.feedback_category].filter(Boolean),
    details: {
      "Contact information available": item.contact_information_provided ? "Yes" : "No",
      "Consent to contact": item.consent_to_contact ? "Yes" : "No",
      "App version": item.app_version || "Not recorded"
    }
  };
}

function normalizeProfile({ item, profile }) {
  const responses = profile.responses;
  const comments = [
    cleanText(responses.what_would_help_more_walking),
    cleanText(responses.other_pedestrian_experience)
  ].filter(Boolean);
  return {
    id: `profile-${item.id}`,
    record_id: item.id,
    public_id: item.feedback_id,
    type: "pedestrian_profile",
    title: "Pedestrian profile",
    summary:
      comments.join(" — ") ||
      "Anonymous profile response with walking habits and conditions",
    date: item.date_created || profile.submitted_at || null,
    status: item.status || "new",
    severity: responses.general_walking_safety || null,
    source: item.submission_source || "wordpress",
    location: cleanText(responses.neighborhood_or_cross_streets) || null,
    categories: asArray(responses.walking_barriers),
    details: {
      "General walking safety": humanize(responses.general_walking_safety),
      "Walking days per week": responses.walking_days_per_week ?? "Not answered",
      "Typical walk duration": humanize(responses.typical_walk_duration),
      "Motor vehicle access": humanize(responses.motor_vehicle_access),
      "Walks with children": humanize(responses.regularly_walks_with_children),
      "Walking barriers": asArray(responses.walking_barriers).map(humanize).join(", ") ||
        "None recorded",
      "Walking purposes": asArray(responses.walking_purposes).map(humanize).join(", ") ||
        "None recorded"
    }
  };
}

function normalizeComplaint(item) {
  const categories = unique([
    ...asArray(item.interaction_categories),
    ...asArray(item.complaint_categories),
    ...[item.complaint_type || item.category || item.reason].filter(Boolean)
  ]);
  const sentiment = item.interaction_sentiment || "not_labeled";
  const sentimentTitle = sentiment === "not_labeled"
    ? "Unlabeled police observation"
    : `${humanize(sentiment)} police interaction`;
  return {
    id: `complaint-${item.id}`,
    record_id: item.id,
    public_id: item.complaint_id || item.reference_number || null,
    type: "police_complaint",
    title: sentimentTitle,
    summary:
      cleanText(
        item.complaint_text ||
          item.summary ||
          item.details ||
          item.complaint_details
      ) || "Rating or observation-only police interaction report",
    date:
      item.date_created || item.incident_at || item.incident_date || item.observed_at || null,
    status: item.status || item.review_status || "new",
    severity: item.safety_change || item.severity || null,
    source: "police interaction",
    location:
      cleanText(item.location_description || item.location_label || item.location) || null,
    categories,
    details: {
      "Reference number": item.reference_number || "Not assigned",
      "Interaction label": humanize(sentiment),
      "Reporter perspective": humanize(item.reporter_perspective),
      "Incident date": item.incident_at || item.incident_date || "Not recorded",
      "Call context": humanize(item.call_context),
      "Encounter type": humanize(item.encounter_type),
      "Police presence": asArray(item.presence_modes).map(humanize).join(", ") ||
        "Not recorded",
      "Safety effect": humanize(item.safety_change),
      "Response timeliness": humanize(item.response_timeliness),
      "Went out of their way": humanize(item.went_out_of_way),
      "Safety while present": formatRating(item.safety_during_rating),
      "Respect": formatRating(item.respect_rating),
      "Communication": formatRating(item.communication_rating),
      "Helpfulness": formatRating(item.helpfulness_rating),
      "Professionalism": formatRating(item.professionalism_rating),
      "Fairness": formatRating(item.fairness_rating),
      "Outcome": formatRating(item.outcome_rating),
      "Contact information available": item.contact_information_provided ? "Yes" : "No",
      "Consent to contact": item.consent_to_contact ? "Yes" : "No"
    }
  };
}

function formatRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 10
    ? `${rating} / 10`
    : "Not rated";
}

function locationLabel(report) {
  const nearest = parseJson(report.nearest_intersection);
  if (nearest && typeof nearest === "object") {
    const label = nearest.label || nearest.name || nearest.intersection;
    if (typeof label === "string" && label.trim()) return label.trim();
    if (Array.isArray(nearest.streets)) return nearest.streets.join(" & ");
  }
  const location = parseJson(report.location);
  if (typeof location === "string") return cleanText(location);
  if (location && typeof location === "object") {
    return cleanText(location.label || location.name || location.address);
  }
  const latitude = finiteCoordinate(report.latitude);
  const longitude = finiteCoordinate(report.longitude);
  if (latitude !== null && longitude !== null) {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
  return null;
}

function reportCoordinates(report) {
  const latitude = finiteCoordinate(report.latitude);
  const longitude = finiteCoordinate(report.longitude);
  if (isNearColumbia(latitude, longitude)) {
    return { latitude, longitude };
  }
  const location = parseJson(report.location);
  if (location?.type === "Point" && Array.isArray(location.coordinates)) {
    const locationLatitude = finiteCoordinate(location.coordinates[1]);
    const locationLongitude = finiteCoordinate(location.coordinates[0]);
    if (isNearColumbia(locationLatitude, locationLongitude)) {
      return { latitude: locationLatitude, longitude: locationLongitude };
    }
  }
  return null;
}

function finiteCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function isNearColumbia(latitude, longitude) {
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }
  const latitudeDelta = toRadians(latitude - COLUMBIA_CENTER.latitude);
  const longitudeDelta = toRadians(longitude - COLUMBIA_CENTER.longitude);
  const startLatitude = toRadians(COLUMBIA_CENTER.latitude);
  const endLatitude = toRadians(latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_KM * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine)
  );
  return distance <= COLUMBIA_REPORT_RADIUS_KM;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function recordTimestamp(record) {
  const value =
    record.date_created ||
    record.observed_at ||
    record.incident_at ||
    record.incident_date ||
    record.occurred_at ||
    record.date_updated;
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function countValues(values) {
  const counts = new Map();
  for (const rawValue of values) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    const value = String(rawValue);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: humanize(value), count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function asArray(value) {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (parsed === undefined || parsed === null || parsed === "") return [];
  return [parsed];
}

function parseJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !["[", "{"].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function humanize(value) {
  if (value === undefined || value === null || value === "") return "Not recorded";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatDuration(totalSeconds) {
  const minutes = Math.round(Number(totalSeconds || 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}
