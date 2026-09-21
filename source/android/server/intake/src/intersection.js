const MAJOR_HIGHWAY_TYPES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary"
]);

export async function resolveNearestIntersection({
  latitude,
  longitude,
  fetchImplementation = fetch,
  overpassUrl = "https://overpass-api.de/api/interpreter",
  majorPreferenceMeters = 35
}) {
  const query = [
    "[out:json][timeout:12];",
    `way(around:220,${latitude},${longitude})[highway][name];`,
    "out body geom;"
  ].join("");
  const response = await fetchImplementation(overpassUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "ColumbiaWalks-Intake/0.7.5"
    },
    body: new URLSearchParams({ data: query })
  });
  if (!response.ok) {
    throw new Error(`Intersection service returned HTTP ${response.status}.`);
  }
  return chooseNearestIntersection(
    await response.json(),
    latitude,
    longitude,
    majorPreferenceMeters
  );
}

export function chooseNearestIntersection(
  overpassResult,
  latitude,
  longitude,
  majorPreferenceMeters = 35
) {
  const nodes = new Map();
  for (const way of overpassResult?.elements || []) {
    if (
      way.type !== "way" ||
      !Array.isArray(way.nodes) ||
      !Array.isArray(way.geometry) ||
      typeof way.tags?.name !== "string"
    ) {
      continue;
    }
    for (let index = 0; index < way.nodes.length; index++) {
      const geometry = way.geometry[index];
      if (!geometry) continue;
      const nodeId = way.nodes[index];
      const candidate = nodes.get(nodeId) || {
        latitude: geometry.lat,
        longitude: geometry.lon,
        roads: new Map()
      };
      candidate.roads.set(way.tags.name, way.tags.highway || "unclassified");
      nodes.set(nodeId, candidate);
    }
  }

  const candidates = [];
  for (const candidate of nodes.values()) {
    if (candidate.roads.size < 2) continue;
    const roadNames = [...candidate.roads.keys()].sort();
    const distanceMeters = distanceInMeters(
      latitude,
      longitude,
      candidate.latitude,
      candidate.longitude
    );
    candidates.push({
      label: roadNames.join(" & "),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      distance_meters: Math.round(distanceMeters),
      major: [...candidate.roads.values()].some((type) =>
        MAJOR_HIGHWAY_TYPES.has(type)
      )
    });
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((left, right) =>
    left.distance_meters - right.distance_meters
  );
  const nearest = candidates[0];
  const preferredMajor = candidates
    .filter(
      (candidate) =>
        candidate.major &&
        candidate.distance_meters <=
          nearest.distance_meters + majorPreferenceMeters
    )
    .sort((left, right) =>
      left.distance_meters - right.distance_meters
    )[0];
  return preferredMajor || nearest;
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

