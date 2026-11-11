import { formatDate } from "./index";

it("shows a bare date as that calendar day, whatever the time zone", () => {
  // Jest's TZ is set per process; this runs under TZ=America/Los_Angeles in the check below.
  expect(formatDate("2026-10-20")).toBe("Oct 20, 2026");
  expect(formatDate(undefined)).toBe("—");
});
