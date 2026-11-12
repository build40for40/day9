import { expect, test } from "vitest";
import { VIEWS } from "../registry";
import { components } from "./registry";

test("every built view can be reached by search, and nothing built is missing", () => {
  const built = components.filter((c) => c.available).map((c) => c.id);
  expect(built.toSorted()).toEqual(VIEWS.map((view) => view.id).toSorted());
});
