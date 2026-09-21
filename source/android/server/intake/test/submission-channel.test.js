import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySubmissionChannel,
  reportSubmissionChannel,
  submissionChannelLabel
} from "../src/submission-channel.js";

test("classifies native and web report channels from the request user agent", () => {
  assert.equal(classifySubmissionChannel({
    userAgent: "ColumbiaWalks-iOS/1.8.0",
    appVersion: "1.8.0"
  }), "iphone_app");
  assert.equal(classifySubmissionChannel({
    userAgent: "ColumbiaWalks-Android/3.14.0",
    appVersion: "3.14.0"
  }), "android_app");
  assert.equal(classifySubmissionChannel({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    appVersion: "wordpress-3.15.0"
  }), "iphone_web");
  assert.equal(classifySubmissionChannel({
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140 Mobile",
    appVersion: "web-3.15.0"
  }), "android_web");
  assert.equal(classifySubmissionChannel({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140",
    appVersion: "web-3.15.0"
  }), "desktop_web");
});

test("labels legacy reports without inventing a missing web device", () => {
  assert.equal(reportSubmissionChannel({ app_version: "3.13.0" }), "android_app");
  assert.equal(
    reportSubmissionChannel({ app_version: "wordpress-3.12.2" }),
    "web_unknown"
  );
  assert.equal(reportSubmissionChannel({}), "unknown");
  assert.equal(submissionChannelLabel("web_unknown"), "Web — device not recorded");
});

