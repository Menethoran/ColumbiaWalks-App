(function () {
  "use strict";

  var state = {
    data: null,
    records: [],
    filtered: [],
    user: null,
    reportMap: null,
    reportLayer: null,
    selectedRecord: null
  };
  var elements = {
    loginView: document.getElementById("login-view"),
    dashboardView: document.getElementById("dashboard-view"),
    loginForm: document.getElementById("login-form"),
    loginButton: document.getElementById("login-button"),
    loginMessage: document.getElementById("login-message"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    accountName: document.getElementById("account-name"),
    logoutButton: document.getElementById("logout-button"),
    rangeSelect: document.getElementById("range-select"),
    loadingPanel: document.getElementById("loading-panel"),
    dashboardContent: document.getElementById("dashboard-content"),
    collectionNotice: document.getElementById("collection-notice"),
    updatedAt: document.getElementById("updated-at"),
    searchInput: document.getElementById("search-input"),
    typeFilter: document.getElementById("type-filter"),
    statusFilter: document.getElementById("status-filter"),
    betaRequestCount: document.getElementById("beta-request-count"),
    betaIosCount: document.getElementById("beta-ios-count"),
    betaIosList: document.getElementById("beta-ios-list"),
    betaIosEmpty: document.getElementById("beta-ios-empty"),
    betaAndroidCount: document.getElementById("beta-android-count"),
    betaAndroidList: document.getElementById("beta-android-list"),
    betaAndroidEmpty: document.getElementById("beta-android-empty"),
    recordCount: document.getElementById("record-count"),
    recordsBody: document.getElementById("records-body"),
    recordsEmpty: document.getElementById("records-empty"),
    exportButton: document.getElementById("export-button"),
    dialog: document.getElementById("record-dialog"),
    dialogClose: document.getElementById("dialog-close"),
    dialogActions: document.getElementById("dialog-actions"),
    approvalMessage: document.getElementById("approval-message"),
    approvePosButton: document.getElementById("approve-pos-button")
  };

  elements.loginForm.addEventListener("submit", signIn);
  elements.logoutButton.addEventListener("click", signOut);
  elements.rangeSelect.addEventListener("change", loadDashboard);
  elements.searchInput.addEventListener("input", applyFilters);
  elements.typeFilter.addEventListener("change", applyFilters);
  elements.statusFilter.addEventListener("change", applyFilters);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.dialogClose.addEventListener("click", function () {
    elements.dialog.close();
  });
  elements.dialog.addEventListener("click", function (event) {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.approvePosButton.addEventListener("click", approvePageOfShame);

  restoreSession();

  async function restoreSession() {
    try {
      var response = await api("/columbiawalks-api/admin/session");
      state.user = response.data;
      showDashboard();
      await loadDashboard();
    } catch (error) {
      showLogin(error.status === 401 ? "" : "The admin service could not be reached.");
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setLoginMessage("");
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = "Signing in…";
    try {
      var response = await api("/columbiawalks-api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: elements.email.value.trim(),
          password: elements.password.value
        })
      });
      state.user = response.data;
      elements.password.value = "";
      showDashboard();
      await loadDashboard();
    } catch (error) {
      setLoginMessage(error.message || "Sign in failed. Please try again.");
    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = "Open dashboard";
    }
  }

  async function signOut() {
    try {
      await api("/columbiawalks-api/admin/logout", { method: "POST" });
    } catch {
      // The local session view is still cleared if the server session expired.
    }
    if (state.reportMap) state.reportMap.remove();
    state = {
      data: null,
      records: [],
      filtered: [],
      user: null,
      reportMap: null,
      reportLayer: null,
      selectedRecord: null
    };
    showLogin("");
  }

  async function loadDashboard() {
    elements.loadingPanel.hidden = false;
    elements.dashboardContent.hidden = true;
    elements.collectionNotice.hidden = true;
    try {
      var response = await api(
        "/columbiawalks-api/admin/dashboard?range=" +
          encodeURIComponent(elements.rangeSelect.value)
      );
      state.data = response.data;
      state.records = response.data.records || [];
      elements.loadingPanel.hidden = true;
      elements.dashboardContent.hidden = false;
      renderDashboard();
    } catch (error) {
      if (error.status === 401) {
        showLogin("Your session expired. Sign in again.");
        return;
      }
      elements.loadingPanel.textContent =
        error.message || "The dashboard could not be loaded. Please try again.";
    }
  }

  function renderDashboard() {
    var data = state.data;
    setText("metric-issues", data.totals.issues);
    setText("metric-open", data.totals.open_issues);
    setText("metric-reports", data.totals.safety_reports);
    setText("metric-profiles", data.totals.pedestrian_profiles);
    setText("metric-police", data.totals.police_complaints);
    setText("metric-recent", data.totals.last_30_days);
    elements.updatedAt.textContent =
      "Updated " + formatDateTime(data.generated_at) + " · private administrator view";

    renderBars("category-chart", data.breakdowns.report_categories, 7);
    renderBars("barrier-chart", data.breakdowns.profile_barriers, 6);
    renderBars("safety-chart", data.breakdowns.profile_safety, 6);
    renderBars("purpose-chart", data.breakdowns.walking_purposes, 6);
    renderBars(
      "police-sentiment-chart",
      data.breakdowns.police_interaction_sentiment,
      6
    );
    renderBars("police-topic-chart", data.breakdowns.police_topics, 7);
    renderBars("police-safety-chart", data.breakdowns.police_safety_change, 6);
    renderBars("update-event-chart", data.breakdowns.update_events, 8);
    renderBars("update-version-chart", data.breakdowns.update_target_versions, 6);
    renderBars("report-version-chart", data.breakdowns.report_app_versions, 8);
    renderBars(
      "report-channel-chart",
      data.breakdowns.report_submission_channels,
      7
    );
    renderBars("update-failure-chart", data.breakdowns.update_failures, 6);
    renderBars("walking-source-chart", data.breakdowns.walking_sources, 4);
    renderDonut(data.breakdowns.issue_status);

    setText(
      "profile-days",
      data.profile_metrics.average_walking_days === null
        ? "—"
        : data.profile_metrics.average_walking_days
    );
    setText(
      "profile-miles",
      data.profile_metrics.estimated_average_daily_miles === null
        ? "—"
        : data.profile_metrics.estimated_average_daily_miles
    );
    setText("profile-children", data.profile_metrics.walks_with_children);
    setText("profile-access", data.profile_metrics.accessibility_need_responses);
    setText("police-responses", data.police_metrics.responses);
    setText("police-bystanders", data.police_metrics.bystander_reports);
    setText("police-safer", data.police_metrics.felt_safer);
    setText("police-less-safe", data.police_metrics.felt_less_safe);
    setText("update-checks", data.update_metrics.checks);
    setText("update-available", data.update_metrics.updates_available);
    setText("update-downloads", data.update_metrics.verified_downloads);
    setText("update-installs", data.update_metrics.confirmed_installs);
    setText("walking-activities", data.walking_metrics.activities);
    setText("walking-total", data.walking_metrics.total_miles);
    setText("walking-average", data.walking_metrics.average_miles);
    setText("walking-hours", data.walking_metrics.total_hours);
    renderReportMap(data.report_heatmap);
    renderBetaTesterRequests(data.beta_tester_requests || {});

    renderCollectionNotice(data.available_collections || {});
    populateStatusFilter();
    applyFilters();
  }

  function renderBetaTesterRequests(requests) {
    var ios = Array.isArray(requests.ios) ? requests.ios : [];
    var android = Array.isArray(requests.android) ? requests.android : [];
    var total = ios.length + android.length;
    elements.betaRequestCount.textContent =
      total + (total === 1 ? " pending request" : " pending requests");
    renderBetaTesterPlatform("ios", ios, elements.betaIosList, elements.betaIosEmpty);
    renderBetaTesterPlatform(
      "android",
      android,
      elements.betaAndroidList,
      elements.betaAndroidEmpty
    );
  }

  function renderBetaTesterPlatform(platform, requests, list, emptyState) {
    var count = platform === "ios" ? elements.betaIosCount : elements.betaAndroidCount;
    count.textContent = String(requests.length);
    list.replaceChildren();
    emptyState.hidden = requests.length > 0;
    requests.forEach(function (request) {
      list.appendChild(betaTesterCard(platform, request));
    });
  }

  function betaTesterCard(platform, request) {
    var card = element("article", "beta-request-card");
    var heading = element("div", "beta-request-card-heading");
    var nameBlock = element("div");
    nameBlock.append(
      element("strong", "beta-request-name", request.name || "Name not supplied"),
      element("span", "beta-request-date", "Received " + formatDateTime(request.received_at))
    );
    heading.append(nameBlock, element("span", "status-badge", humanize(request.status)));

    var details = element("dl", "beta-request-details");
    var emailLink = element("a", "beta-request-email", request.email || "Email not supplied");
    if (request.email) emailLink.href = "mailto:" + request.email;
    details.append(
      element("dt", "", "Account email"),
      wrapDetail(emailLink),
      element("dt", "", "Columbia street"),
      element("dd", "", request.street || "Not supplied")
    );
    if (request.comments) {
      details.append(
        element("dt", "", "Comments"),
        element("dd", "beta-request-comments", request.comments)
      );
    }

    var actions = element("div", "beta-request-actions");
    var message = element("p", "beta-request-message");
    message.setAttribute("aria-live", "polite");
    var copyButton = element("button", "beta-copy-button", "Copy email");
    copyButton.type = "button";
    copyButton.disabled = !request.email;
    copyButton.addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(request.email);
        message.className = "beta-request-message success";
        message.textContent = "Email copied.";
      } catch {
        message.className = "beta-request-message error";
        message.textContent = "Copy failed. Select the linked email address instead.";
      }
    });
    var dismissButton = element("button", "beta-dismiss-button", "Mark added & dismiss");
    dismissButton.type = "button";
    dismissButton.addEventListener("click", function () {
      dismissBetaTesterRequest(platform, request, dismissButton, message);
    });
    actions.append(copyButton, dismissButton);
    card.append(heading, details, actions, message);
    return card;
  }

  function wrapDetail(node) {
    var detail = document.createElement("dd");
    detail.appendChild(node);
    return detail;
  }

  async function dismissBetaTesterRequest(platform, request, button, message) {
    button.disabled = true;
    button.textContent = "Dismissing…";
    message.className = "beta-request-message";
    message.textContent = "Saving the request as added…";
    try {
      await api(
        "/columbiawalks-api/admin/beta-testers/" +
          encodeURIComponent(request.id) +
          "/dismiss",
        { method: "POST" }
      );
      var requests = state.data.beta_tester_requests;
      requests[platform] = (requests[platform] || []).filter(function (item) {
        return item.id !== request.id;
      });
      requests.total = (requests.ios || []).length + (requests.android || []).length;
      renderBetaTesterRequests(requests);
    } catch (error) {
      if (error.status === 401) {
        showLogin("Your session expired. Sign in again.");
        return;
      }
      message.className = "beta-request-message error";
      message.textContent = error.message || "The request could not be dismissed.";
      button.disabled = false;
      button.textContent = "Try dismissing again";
    }
  }

  function renderReportMap(heatmap) {
    var container = document.getElementById("report-heatmap");
    var summary = document.getElementById("heatmap-summary");
    var points = (heatmap?.points || []).filter(function (point) {
      return isNearColumbia(Number(point.latitude), Number(point.longitude));
    });
    var reportCount = points.reduce(function (total, point) {
      return total + Number(point.count || 0);
    }, 0);
    summary.textContent = reportCount === 0
      ? "No reports with coordinates in this period."
      : reportCount + (reportCount === 1 ? " located report" : " located reports") +
        " grouped into " + points.length + (points.length === 1 ? " map area." : " map areas.");

    if (!window.L) {
      container.textContent = "The report map could not be loaded.";
      return;
    }
    if (!state.reportMap) {
      state.reportMap = window.L.map(container, {
        scrollWheelZoom: false,
        preferCanvas: true
      }).setView(heatmap?.center || [40.0337, -76.5044], heatmap?.zoom || 14);
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(state.reportMap);
      state.reportLayer = window.L.layerGroup().addTo(state.reportMap);
    }
    state.reportLayer.clearLayers();
    var bounds = [];
    var maximum = Math.max.apply(null, points.map(function (point) {
      return Number(point.count || 0);
    }).concat([1]));
    points.forEach(function (point) {
      var latitude = Number(point.latitude);
      var longitude = Number(point.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      var strength = Number(point.count || 0) / maximum;
      var marker = window.L.circleMarker([latitude, longitude], {
        radius: 9 + strength * 20,
        color: "#a9382b",
        weight: 1.5,
        fillColor: strength > 0.66 ? "#e2513f" : strength > 0.33 ? "#ef9a55" : "#f3c978",
        fillOpacity: 0.42 + strength * 0.38
      });
      var popup = document.createElement("div");
      var count = document.createElement("strong");
      count.textContent = point.count + (point.count === 1 ? " report" : " reports");
      popup.appendChild(count);
      if ((point.categories || []).length) {
        var categories = document.createElement("p");
        categories.textContent = point.categories.join(", ");
        popup.appendChild(categories);
      }
      marker.bindPopup(popup);
      marker.addTo(state.reportLayer);
      bounds.push([latitude, longitude]);
    });
    if (bounds.length > 1) state.reportMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    else if (bounds.length === 1) state.reportMap.setView(bounds[0], 16);
    else state.reportMap.setView(heatmap?.center || [40.0337, -76.5044], heatmap?.zoom || 14);
    window.setTimeout(function () { state.reportMap.invalidateSize(); }, 0);
  }

  function isNearColumbia(latitude, longitude) {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return false;
    }
    var latitudeDelta = toRadians(latitude - 40.0337);
    var longitudeDelta = toRadians(longitude + 76.5044);
    var startLatitude = toRadians(40.0337);
    var endLatitude = toRadians(latitude);
    var haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(startLatitude) * Math.cos(endLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    var distance = 2 * 6371 * Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    );
    return distance <= 16;
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function renderBars(elementId, values, limit) {
    var container = document.getElementById(elementId);
    container.replaceChildren();
    var visible = (values || []).slice(0, limit);
    if (visible.length === 0) {
      container.appendChild(element("p", "chart-empty", "No responses in this period."));
      return;
    }
    var maximum = Math.max.apply(
      null,
      visible.map(function (item) { return item.count; })
    );
    visible.forEach(function (item) {
      var row = element("div", "bar-row");
      var label = element("span", "bar-label", item.label);
      label.title = item.label;
      var track = element("span", "bar-track");
      var fill = element("span", "bar-fill");
      fill.style.width = Math.max(3, (item.count / maximum) * 100) + "%";
      track.appendChild(fill);
      row.append(label, track, element("strong", "bar-value", item.count));
      container.appendChild(row);
    });
  }

  function renderDonut(values) {
    var donut = document.getElementById("status-donut");
    var legend = document.getElementById("status-legend");
    legend.replaceChildren();
    var visible = (values || []).slice(0, 5);
    var total = visible.reduce(function (sum, item) { return sum + item.count; }, 0);
    donut.querySelector("span").textContent = total;
    if (total === 0) {
      donut.style.background = "#e7ece5";
      legend.appendChild(element("p", "chart-empty", "No issues yet."));
      return;
    }
    var colors = ["#174f46", "#bddc78", "#ef765f", "#6ea9c5", "#9b83bd"];
    var cursor = 0;
    var stops = [];
    visible.forEach(function (item, index) {
      var start = cursor;
      cursor += (item.count / total) * 100;
      stops.push(colors[index] + " " + start + "% " + cursor + "%");
      var row = element("div", "legend-row");
      var swatch = document.createElement("i");
      swatch.style.setProperty("--swatch", colors[index]);
      row.append(swatch, element("span", "", item.label), element("strong", "", item.count));
      legend.appendChild(row);
    });
    donut.style.background = "conic-gradient(" + stops.join(",") + ")";
  }

  function renderCollectionNotice(available) {
    var missing = Object.keys(available).filter(function (key) { return !available[key]; });
    if (missing.length === 0) return;
    elements.collectionNotice.textContent =
      "Some data collections are not installed or are unavailable: " +
      missing.map(humanize).join(", ") + ". Available data is shown below.";
    elements.collectionNotice.hidden = false;
  }

  function populateStatusFilter() {
    var current = elements.statusFilter.value;
    var statuses = Array.from(
      new Set(state.records.map(function (record) { return record.status; }).filter(Boolean))
    ).sort();
    elements.statusFilter.replaceChildren();
    var allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All statuses";
    elements.statusFilter.appendChild(allOption);
    statuses.forEach(function (status) {
      var option = document.createElement("option");
      option.value = status;
      option.textContent = humanize(status);
      elements.statusFilter.appendChild(option);
    });
    elements.statusFilter.value = statuses.includes(current) ? current : "all";
  }

  function applyFilters() {
    var query = elements.searchInput.value.trim().toLowerCase();
    var type = elements.typeFilter.value;
    var status = elements.statusFilter.value;
    state.filtered = state.records.filter(function (record) {
      if (type !== "all" && record.type !== type) return false;
      if (status !== "all" && record.status !== status) return false;
      if (!query) return true;
      var haystack = [
        record.title,
        record.summary,
        record.location,
        record.source,
        record.status,
        record.severity,
        (record.categories || []).join(" "),
        Object.values(record.details || {}).join(" ")
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    renderRecords();
  }

  function renderRecords() {
    elements.recordsBody.replaceChildren();
    elements.recordCount.textContent =
      state.filtered.length + (state.filtered.length === 1 ? " submission" : " submissions");
    elements.recordsEmpty.hidden = state.filtered.length > 0;
    state.filtered.slice(0, 150).forEach(function (record) {
      var row = document.createElement("tr");
      var typeCell = document.createElement("td");
      var typeBadge = element("span", "type-badge " + record.type, typeLabel(record.type));
      typeCell.appendChild(typeBadge);

      var summaryCell = document.createElement("td");
      summaryCell.append(
        element("span", "record-title", record.title || "Submission"),
        element("span", "record-summary", record.summary || "No summary supplied")
      );

      var locationCell = document.createElement("td");
      locationCell.textContent = record.location || humanize(record.source);
      var statusCell = document.createElement("td");
      statusCell.appendChild(element("span", "status-badge", humanize(record.status)));
      var dateCell = document.createElement("td");
      dateCell.textContent = formatDate(record.date);
      var actionCell = document.createElement("td");
      var button = element("button", "view-button", "View");
      button.type = "button";
      button.addEventListener("click", function () { showRecord(record); });
      actionCell.appendChild(button);
      row.append(typeCell, summaryCell, locationCell, statusCell, dateCell, actionCell);
      elements.recordsBody.appendChild(row);
    });
  }

  function showRecord(record) {
    state.selectedRecord = record;
    document.getElementById("dialog-type").textContent = typeLabel(record.type);
    document.getElementById("dialog-title").textContent = record.title || "Submission details";
    document.getElementById("dialog-summary").textContent = record.summary || "No summary supplied.";
    var list = document.getElementById("dialog-details");
    list.replaceChildren();
    var details = Object.assign(
      {
        Status: humanize(record.status),
        Severity: humanize(record.severity),
        Date: formatDateTime(record.date),
        Location: record.location || "Not recorded",
        Source: humanize(record.source),
        Categories: (record.categories || []).map(humanize).join(", ") || "None recorded",
        "Submission ID": record.public_id || record.record_id
      },
      record.details || {}
    );
    Object.keys(details).forEach(function (key) {
      list.append(element("dt", "", key), element("dd", "", details[key] || "Not recorded"));
    });
    var publication = record.page_of_shame;
    elements.dialogActions.hidden = !publication;
    if (publication) {
      elements.approvePosButton.hidden = !publication.can_approve;
      elements.approvePosButton.disabled = false;
      elements.approvePosButton.textContent = "Approve and publish";
      elements.approvalMessage.className = "";
      elements.approvalMessage.textContent = publication.can_approve
        ? "Approving publishes the submitted photo, optional caption, and grouped location."
        : publication.publication_status === "published"
          ? "This submission is approved and currently published."
          : "This Page of Shame submission cannot be published because it has no photo.";
    }
    elements.dialog.showModal();
  }

  async function approvePageOfShame() {
    var record = state.selectedRecord;
    if (!record?.page_of_shame?.can_approve) return;
    elements.approvePosButton.disabled = true;
    elements.approvePosButton.textContent = "Publishing…";
    elements.approvalMessage.className = "";
    elements.approvalMessage.textContent = "Publishing the approved submission…";
    try {
      await api(
        "/columbiawalks-api/admin/page-of-shame/" +
          encodeURIComponent(record.record_id) +
          "/approve",
        { method: "POST" }
      );
      record.status = "approved";
      record.page_of_shame.publication_status = "published";
      record.page_of_shame.can_approve = false;
      record.details["Publication status"] = "Published";
      elements.approvePosButton.hidden = true;
      elements.approvalMessage.className = "approval-success";
      elements.approvalMessage.textContent =
        "Approved. The submission is now available to the public Page of Shame.";
      populateStatusFilter();
      applyFilters();
    } catch (error) {
      if (error.status === 401) {
        elements.dialog.close();
        showLogin("Your session expired. Sign in again.");
        return;
      }
      elements.approvalMessage.className = "approval-error";
      elements.approvalMessage.textContent =
        error.message || "The submission could not be approved.";
      elements.approvePosButton.disabled = false;
      elements.approvePosButton.textContent = "Try approval again";
    }
  }

  function exportCsv() {
    var columns = [
      "type",
      "title",
      "summary",
      "location",
      "status",
      "severity",
      "source",
      "date",
      "submission_id",
      "estimated_weather",
      "weather_attribution"
    ];
    var lines = [columns.join(",")];
    state.filtered.forEach(function (record) {
      lines.push([
        typeLabel(record.type),
        record.title,
        record.summary,
        record.location,
        humanize(record.status),
        humanize(record.severity),
        humanize(record.source),
        record.date,
        record.public_id || record.record_id,
        record.details?.["Estimated weather"] || "",
        record.details?.["Weather source"] || ""
      ].map(csvCell).join(","));
    });
    var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "columbiawalks-admin-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showDashboard() {
    elements.loginView.hidden = true;
    elements.dashboardView.hidden = false;
    elements.accountName.textContent = state.user?.name || state.user?.email || "Administrator";
  }

  function showLogin(message) {
    elements.dashboardView.hidden = true;
    elements.loginView.hidden = false;
    setLoginMessage(message);
  }

  function setLoginMessage(message) {
    elements.loginMessage.textContent = message;
    elements.loginMessage.hidden = !message;
  }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }, options || {}));
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(payload.error || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function setText(id, value) {
    document.getElementById(id).textContent = String(value ?? 0);
  }

  function typeLabel(type) {
    return {
      safety_report: "Safety report",
      feedback: "Feedback",
      pedestrian_profile: "Pedestrian profile",
      walking_metric: "Walking summary",
      police_complaint: "Police complaint"
    }[type] || humanize(type);
  }

  function humanize(value) {
    if (value === undefined || value === null || value === "") return "Not recorded";
    return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function formatDate(value) {
    var date = new Date(value || 0);
    return Number.isNaN(date.getTime())
      ? "Not recorded"
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(value) {
    var date = new Date(value || 0);
    return Number.isNaN(date.getTime())
      ? "Not recorded"
      : date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
  }

  function csvCell(value) {
    var text = value === undefined || value === null ? "" : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }
})();
