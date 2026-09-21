import assert from "node:assert/strict";
import test from "node:test";

import { chooseNearestIntersection } from "../src/intersection.js";

test("prefers a nearby major intersection over a barely closer minor one", () => {
  const result = chooseNearestIntersection(
    {
      elements: [
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.0001, lon: -76.0 }],
          tags: { name: "Minor A", highway: "residential" }
        },
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.0001, lon: -76.0 }],
          tags: { name: "Minor B", highway: "residential" }
        },
        {
          type: "way",
          nodes: [2],
          geometry: [{ lat: 40.00025, lon: -76.0 }],
          tags: { name: "Major Road", highway: "secondary" }
        },
        {
          type: "way",
          nodes: [2],
          geometry: [{ lat: 40.00025, lon: -76.0 }],
          tags: { name: "Side Street", highway: "residential" }
        }
      ]
    },
    40.0,
    -76.0,
    35
  );

  assert.equal(result.label, "Major Road & Side Street");
  assert.equal(result.major, true);
});

test("keeps the closest minor intersection when a major one is much farther", () => {
  const result = chooseNearestIntersection(
    {
      elements: [
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.00005, lon: -76.0 }],
          tags: { name: "Minor A", highway: "residential" }
        },
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.00005, lon: -76.0 }],
          tags: { name: "Minor B", highway: "residential" }
        },
        {
          type: "way",
          nodes: [2],
          geometry: [{ lat: 40.001, lon: -76.0 }],
          tags: { name: "Major Road", highway: "primary" }
        },
        {
          type: "way",
          nodes: [2],
          geometry: [{ lat: 40.001, lon: -76.0 }],
          tags: { name: "Side Street", highway: "residential" }
        }
      ]
    },
    40.0,
    -76.0,
    35
  );

  assert.equal(result.label, "Minor A & Minor B");
  assert.equal(result.major, false);
});

