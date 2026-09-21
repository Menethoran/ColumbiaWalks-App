import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminDashboard,
  buildPublicInsights,
  parsePedestrianProfile
} from "../src/admin-data.js";

test("recognizes pedestrian profiles without treating malformed feedback as a profile", () => {
  const valid = parsePedestrianProfile(
    "Pedestrian Profile\n" +
      JSON.stringify({
        submission_type: "pedestrian_profile",
        responses: { walking_days_per_week: "5" }
      })
  );
  assert.equal(valid.responses.walking_days_per_week, "5");
  assert.equal(parsePedestrianProfile("Pedestrian Profile\nnot-json"), null);
  assert.equal(parsePedestrianProfile("Ordinary feedback"), null);
});

test("builds privacy-conscious aggregate statistics across collections", () => {
  const dashboard = buildAdminDashboard({
    now: new Date("2026-08-16T16:00:00Z"),
    rangeDays: 90,
    reports: [
      {
        id: 1,
        client_report_id: "report-one",
        date_created: "2026-08-10T12:00:00Z",
        categories: ["unsafe_crossing"],
        severity: "high",
        app_version: "3.12.0",
        latitude: 40.03371,
        longitude: -76.50441,
        review_status: "new",
        submission_mode: "web",
        details: "Drivers do not yield.",
        nearest_intersection: { label: "Locust & Third" },
        weather_status: "estimated",
        weather_dataset: "forecast",
        weather_summary:
          "Estimated weather near the reported location: 75°F; clear sky.",
        weather_valid_time_utc: "2026-08-10T12:00:00Z",
        weather_attribution: "Weather data by Open-Meteo.com (CC BY 4.0)."
      },
      {
        id: 2,
        date_created: "2025-01-01T12:00:00Z",
        categories: ["sidewalk_condition"],
        severity: "low"
      }
    ],
    feedback: [
      {
        id: 3,
        feedback_id: "profile-one",
        date_created: "2026-08-12T12:00:00Z",
        feedback_category: "other",
        feedback_text:
          "Pedestrian Profile\n" +
          JSON.stringify({
            submission_type: "pedestrian_profile",
            responses: {
              walking_days_per_week: "5",
              daily_walking_amount: "2",
              daily_walking_unit: "miles",
              walking_barriers: ["unsafe_crossings", "lighting_or_visibility"],
              walking_purposes: ["errands"],
              general_walking_safety: "2_unsafe",
              regularly_walks_with_children: "yes",
              mobility_or_accessibility_needs: ["cane_or_walker"],
              what_would_help_more_walking: "Safer crossings"
            }
          }),
        status: "new",
        submission_source: "wordpress"
      },
      {
        id: 4,
        feedback_id: "feedback-one",
        date_created: "2026-08-13T12:00:00Z",
        feedback_category: "feature_request",
        feedback_text: "Add more crossing data.",
        status: "in_review",
        submission_source: "web",
        contact_information_provided: true,
        consent_to_contact: true
      },
      {
        id: 9,
        feedback_id: "walking-one",
        date_created: "2026-08-15T15:00:00Z",
        feedback_category: "app_feedback",
        feedback_text:
          "Walking Metric\n" +
          JSON.stringify({
            submission_type: "walking_metric",
            period_start: "2026-08-15T14:00:00Z",
            period_end: "2026-08-15T15:00:00Z",
            distance_meters: 3218.688,
            duration_seconds: 3600,
            source: "tracked_walk"
          }),
        app_version: "3.14.0",
        status: "received",
        submission_source: "android"
      }
    ],
    complaints: [
      {
        id: 5,
        complaint_id: "complaint-one",
        date_created: "2026-08-14T12:00:00Z",
        interaction_sentiment: "not_labeled",
        reporter_perspective: "bystander",
        interaction_categories: ["routine_observation", "community_presence"],
        call_context: "already_present",
        encounter_type: "community_presence",
        presence_modes: ["on_foot"],
        safety_change: "somewhat_safer",
        response_timeliness: "unknown",
        went_out_of_way: "not_applicable",
        respect_rating: 8,
        professionalism_rating: 9,
        complaint_text: "Police spoke calmly with people near the intersection.",
        location_description: "Locust & Third",
        contact_email: "private@example.com",
        contact_information_provided: true,
        consent_to_contact: true,
        status: "closed"
      }
    ],
    updateEvents: [
      {
        id: 6,
        event_id: "cc9fb7b7-f757-4eeb-a4cc-365bdb295f41",
        event_type: "update_available",
        from_version_name: "3.13.0",
        target_version_name: "3.14.0",
        occurred_at: "2026-08-15T12:00:00Z"
      },
      {
        id: 7,
        event_id: "b403708d-9132-4fdf-8d9a-58c7ff6ffbb8",
        event_type: "download_verified",
        from_version_name: "3.13.0",
        target_version_name: "3.14.0",
        occurred_at: "2026-08-15T12:01:00Z"
      },
      {
        id: 8,
        event_id: "da46e57a-4307-424a-9392-e0c57c75e14d",
        event_type: "installed",
        from_version_name: "3.14.0",
        target_version_name: "3.14.0",
        occurred_at: "2026-08-15T12:05:00Z"
      }
    ]
  });

  assert.equal(dashboard.totals.safety_reports, 1);
  assert.equal(dashboard.totals.feedback, 1);
  assert.equal(dashboard.totals.pedestrian_profiles, 1);
  assert.equal(dashboard.totals.walking_metrics, 1);
  assert.equal(dashboard.totals.police_complaints, 1);
  assert.equal(dashboard.totals.issues, 3);
  assert.equal(dashboard.totals.open_issues, 2);
  assert.equal(dashboard.profile_metrics.average_walking_days, 5);
  assert.equal(dashboard.profile_metrics.estimated_average_daily_miles, 2);
  assert.equal(dashboard.profile_metrics.walks_with_children, 1);
  assert.equal(dashboard.profile_metrics.accessibility_need_responses, 1);
  assert.equal(dashboard.police_metrics.responses, 1);
  assert.equal(dashboard.police_metrics.bystander_reports, 1);
  assert.equal(dashboard.police_metrics.felt_safer, 1);
  assert.equal(dashboard.police_metrics.average_ratings.respect_rating, 8);
  assert.equal(dashboard.update_metrics.checks, 1);
  assert.equal(dashboard.update_metrics.verified_downloads, 1);
  assert.equal(dashboard.update_metrics.confirmed_installs, 1);
  assert.equal(dashboard.walking_metrics.total_miles, 2);
  assert.equal(dashboard.walking_metrics.average_miles, 2);
  assert.equal(dashboard.report_heatmap.points.length, 1);
  assert.equal(dashboard.report_heatmap.points[0].count, 1);
  assert.equal(dashboard.breakdowns.report_submission_channels[0].value, "android_app");
  assert.equal(dashboard.breakdowns.report_submission_channels[0].label, "Android app");
  assert.equal(dashboard.breakdowns.report_app_versions[0].value, "3.12.0");
  assert.equal(dashboard.breakdowns.update_target_versions[0].value, "3.14.0");
  assert.equal(dashboard.breakdowns.police_topics[0].count, 1);
  assert.equal(dashboard.breakdowns.profile_barriers[0].count, 1);
  assert.equal(dashboard.records.some((record) => "contact_email" in record), false);
  assert.equal(JSON.stringify(dashboard).includes("private@example.com"), false);
  assert.equal(JSON.stringify(dashboard).includes("device_id"), false);
  assert.equal(dashboard.records.some((record) => record.type === "walking_metric"), true);
  const safetyRecord = dashboard.records.find(
    (record) => record.type === "safety_report"
  );
  assert.equal(safetyRecord.details["Weather status"], "Estimated");
  assert.match(safetyRecord.details["Estimated weather"], /75°F/);
  assert.match(safetyRecord.details["Weather source"], /Open-Meteo/);
  const policeRecord = dashboard.records.find(
    (record) => record.type === "police_complaint"
  );
  assert.equal(policeRecord.title, "Unlabeled police observation");
  assert.equal(policeRecord.details.Respect, "8 / 10");
  assert.equal(
    dashboard.records.find((record) => record.type === "pedestrian_profile").summary,
    "Safer crossings"
  );
});

test("keeps the heatmap centered on Columbia and ignores missing or remote coordinates", () => {
  const date_created = "2026-08-16T12:00:00Z";
  const dashboard = buildAdminDashboard({
    now: new Date("2026-08-17T12:00:00Z"),
    rangeDays: 30,
    reports: [
      {
        id: 1,
        date_created,
        latitude: 40.0337,
        longitude: -76.5044,
        categories: ["unsafe_crossing"]
      },
      {
        id: 2,
        date_created,
        latitude: null,
        longitude: null,
        categories: ["lighting"]
      },
      {
        id: 3,
        date_created,
        latitude: "",
        longitude: "",
        categories: ["sidewalk_condition"]
      },
      {
        id: 4,
        date_created,
        latitude: 37.422,
        longitude: -122.084,
        categories: ["test_report"]
      },
      {
        id: 5,
        date_created,
        latitude: null,
        longitude: null,
        location: {
          type: "Point",
          coordinates: [-76.4924, 40.0343]
        },
        categories: ["crosswalk_markings"]
      }
    ]
  });

  assert.deepEqual(dashboard.report_heatmap.center, [40.0337, -76.5044]);
  assert.equal(dashboard.report_heatmap.points.length, 2);
  assert.equal(
    dashboard.report_heatmap.points.reduce((total, point) => total + point.count, 0),
    2
  );
  assert.equal(
    dashboard.records.find((record) => record.record_id === 2).location,
    null
  );
  assert.equal(
    dashboard.records.find((record) => record.record_id === 3).location,
    null
  );
});

test("builds a coarse public projection without submission records", () => {
  const insights = buildPublicInsights({
    now: new Date("2026-08-21T12:00:00Z"),
    rangeDays: 90,
    reports: [{
      id: 99,
      client_report_id: "private-report-id",
      date_created: "2026-08-20T12:00:00Z",
      categories: ["unsafe_crossing"],
      latitude: 40.03371,
      longitude: -76.50441,
      details: "Private narrative that must never be public",
      nearest_intersection: { label: "Exact private location" }
    }],
    feedback: [{
      id: 100,
      feedback_id: "private-profile-id",
      date_created: "2026-08-20T13:00:00Z",
      feedback_category: "other",
      feedback_text: "Pedestrian Profile\n" + JSON.stringify({
        submission_type: "pedestrian_profile",
        responses: {
          walking_days_per_week: "4",
          walking_barriers: ["unsafe_crossings"],
          walking_purposes: ["errands"],
          general_walking_safety: "3_neutral"
        }
      })
    }]
  });

  assert.equal(insights.totals.safety_reports, 1);
  assert.equal(insights.totals.pedestrian_profiles, 1);
  assert.equal(insights.report_heatmap.points[0].latitude, 40.034);
  assert.equal(insights.report_heatmap.points[0].longitude, -76.504);
  assert.equal(insights.report_heatmap.precision, "approximately 100 metres");
  assert.equal("records" in insights, false);
  const serialized = JSON.stringify(insights);
  assert.doesNotMatch(serialized, /private-report-id|private-profile-id/);
  assert.doesNotMatch(serialized, /Private narrative|Exact private location/);
});
