(function () {
  "use strict";

  var map = null;
  var layer = null;
  var rangeSelect = document.getElementById("range-select");
  var loadingPanel = document.getElementById("loading-panel");
  var errorMessage = document.getElementById("error-message");
  var content = document.getElementById("insights-content");

  rangeSelect.addEventListener("change", loadInsights);
  loadInsights();

  async function loadInsights() {
    loadingPanel.hidden = false;
    errorMessage.hidden = true;
    try {
      var response = await fetch(
        "/columbiawalks-api/public/insights?range=" +
          encodeURIComponent(rangeSelect.value),
        { headers: { Accept: "application/json" } }
      );
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || "Insights could not be loaded.");
      render(payload.data);
      content.hidden = false;
      loadingPanel.hidden = true;
      window.setTimeout(function () {
        renderMap(payload.data.report_heatmap);
      }, 0);
    } catch (error) {
      loadingPanel.hidden = true;
      errorMessage.textContent = error.message || "Insights could not be loaded.";
      errorMessage.hidden = false;
    }
  }

  function render(data) {
    setText("metric-issues", data.totals.issues);
    setText("metric-reports", data.totals.safety_reports);
    setText("metric-profiles", data.totals.pedestrian_profiles);
    setText("metric-walks", data.totals.walking_activities);
    setText("profile-responses", data.profile_metrics.responses);
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
    setText("walking-total", formatNumber(data.walking_metrics.total_miles));
    renderBars("category-chart", data.breakdowns.report_categories, 8);
    renderBars("barrier-chart", data.breakdowns.profile_barriers, 6);
    renderBars("safety-chart", data.breakdowns.profile_safety, 6);
    renderBars("purpose-chart", data.breakdowns.walking_purposes, 6);
    document.getElementById("updated-at").textContent =
      "Updated " + formatDateTime(data.generated_at) +
      " · Public aggregate view · No individual submissions are available";
  }

  function renderMap(heatmap) {
    var points = heatmap?.points || [];
    var mappedReports = points.reduce(function (total, point) {
      return total + (Number(point.count) || 0);
    }, 0);
    document.getElementById("map-total").textContent =
      mappedReports + (mappedReports === 1 ? " report mapped" : " reports mapped");
    if (!window.L) return;
    if (!map) {
      map = window.L.map("public-heatmap", {
        scrollWheelZoom: false,
        minZoom: 12,
        maxZoom: 18
      });
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      layer = window.L.layerGroup().addTo(map);
    }
    layer.clearLayers();
    points.forEach(function (point) {
      var count = Math.max(1, Number(point.count) || 1);
      var radius = 13 + Math.min(25, Math.sqrt(count) * 8);
      var circle = window.L.circleMarker([point.latitude, point.longitude], {
        radius: radius,
        color: "#b83d2f",
        weight: 2,
        fillColor: "#ef745e",
        fillOpacity: 0.43
      });
      var categories = (point.categories || []).join(", ");
      circle.bindPopup(
        "<strong>" + count + (count === 1 ? " report" : " reports") +
          "</strong><p>" + escapeHtml(categories || "Community concern") + "</p>"
      );
      circle.addTo(layer);
    });
    var center = heatmap?.center || [40.0337, -76.5044];
    map.setView(center, heatmap?.zoom || 14);
    if (points.length > 1) {
      var bounds = window.L.latLngBounds(points.map(function (point) {
        return [point.latitude, point.longitude];
      }));
      map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
    }
    map.invalidateSize();
  }

  function renderBars(id, items, limit) {
    var container = document.getElementById(id);
    container.replaceChildren();
    var visible = (items || []).slice(0, limit);
    if (visible.length === 0) {
      container.appendChild(element("p", "chart-empty", "No aggregate data yet."));
      return;
    }
    var maximum = Math.max.apply(null, visible.map(function (item) {
      return Number(item.count) || 0;
    }));
    visible.forEach(function (item) {
      var row = element("div", "bar-row");
      var label = element("span", "bar-label", item.label || humanize(item.value));
      var track = element("span", "bar-track");
      var fill = element("span", "bar-fill");
      fill.style.width = Math.max(3, (Number(item.count) || 0) / maximum * 100) + "%";
      track.appendChild(fill);
      row.append(label, track, element("strong", "bar-value", item.count));
      container.appendChild(row);
    });
  }

  function setText(id, value) {
    document.getElementById(id).textContent = String(value ?? 0);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function humanize(value) {
    return String(value || "Not recorded")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatDateTime(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "recently" : date.toLocaleString();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }
})();

