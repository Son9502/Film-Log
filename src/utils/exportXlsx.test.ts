import { strFromU8, unzipSync } from "fflate";
import { buildWorkbookSheets, buildXlsx, columnLetter, sheetName } from "./exportXlsx";
import type { Roll } from "@/types";

const roll = (o: Partial<Roll>): Roll => ({
  id: "r1", filmStockId: "f1", cameraId: "c1", iso: "400", frameCount: 36, status: "Shooting",
  loadedAt: "2026-11-02", shots: [], createdAt: "", updatedAt: "", ...o,
} as Roll);
const names = { film: (id: string) => `Film ${id}`, camera: (id: string) => `Cam ${id}` };

describe("sheetName", () => {
  it("removes forbidden characters, truncates to 31 and de-duplicates", () => {
    const used = new Set<string>();
    expect(sheetName("Roll: a/b?", used)).toBe("Roll- a-b-");
    const long = "A very long roll name that keeps going on";
    expect(sheetName(long, used)).toHaveLength(31);
    expect(sheetName(long, used)).toMatch(/ \(2\)$/);
    expect(sheetName(long, used).length).toBeLessThanOrEqual(31);
    expect(sheetName("Rolls", used)).toBe("Rolls (2)"); // reserved for the summary sheet
  });
});

describe("columnLetter", () => {
  it("counts like spreadsheet columns", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });
});

describe("buildWorkbookSheets", () => {
  const rolls = [
    roll({ id: "a", name: "Yosemite", shots: [{ id: "s2", frame: 2 }, { id: "s1", frame: 1, notes: "first" }] as any }),
    roll({ id: "b", name: "Yosemite", loadedAt: "2026-11-02" }),
  ];
  const sheets = buildWorkbookSheets(rolls, names);

  it("has Rolls, All frames, then one sheet per roll with unique names", () => {
    expect(sheets.map((s) => s.name)).toEqual(["Rolls", "All frames", "Yosemite 2026-11-02", "Yosemite 2026-11-02 (2)"]);
  });
  it("links each roll to its sheet and back", () => {
    expect(sheets[0].rows[1][0]).toEqual({ text: "Yosemite", sheet: "Yosemite 2026-11-02" });
    expect(sheets[0].rows[2][0]).toEqual({ text: "Yosemite", sheet: "Yosemite 2026-11-02 (2)" });
    expect(sheets[2].rows[0][0]).toEqual({ text: "← All rolls", sheet: "Rolls" });
  });
  it("puts roll details above the frames, in order", () => {
    const sheet = sheets[2];
    expect(sheet.rows[1]).toEqual(["Yosemite"]);
    expect(sheet.rows).toContainEqual(["Film", "Film f1"]);
    expect(sheet.rows).toContainEqual(["Camera", "Cam c1"]);
    expect(sheet.rows[sheet.headerRow][0]).toBe("Frame");
    expect(sheet.rows.slice(sheet.headerRow + 1).map((r) => r[0])).toEqual([1, 2]);
    expect(sheets[1].rows).toHaveLength(3);
  });
  it("says so when a roll has no frames", () => {
    const sheet = sheets[3];
    expect(sheet.rows[sheet.headerRow + 1]).toEqual(["No frames logged yet."]);
  });
  it("names each scan as it appears in the scan ZIP", () => {
    const withScan = buildWorkbookSheets([roll({ id: "r9", name: "Lisbon", shots: [{ id: "s", frame: 7, scanUri: "u/r9/abc.TIF" }] as any })], names);
    const sheet = withScan[2];
    expect(sheet.rows[sheet.headerRow + 1].at(-1)).toBe("Lisbon-r9/frame-007.tif");
    expect(sheet.rows).toContainEqual(["Frames", "1 logged of 36 · 1 scanned"]);
  });
});

describe("buildXlsx", () => {
  it("writes a valid package with internal links and escaped text", () => {
    const files = unzipSync(buildXlsx([roll({ name: `Tom's <"roll"> & co`, shots: [{ id: "s", frame: 1, notes: "a\u0001b" }] as any })], names));
    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
      "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml",
    ]));
    const summary = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(summary).toContain(`location="'Tom''s &lt;&quot;roll&quot;&gt; &amp; co 2026-11-02'!A1"`);
    expect(summary).toContain("&lt;&quot;roll&quot;&gt; &amp; co");
    const rollSheet = strFromU8(files["xl/worksheets/sheet3.xml"]);
    expect(rollSheet).toContain(`location="'Rolls'!A1"`);
    expect(rollSheet).toContain("<t xml:space=\"preserve\">ab</t>"); // control characters dropped
    expect(strFromU8(files["xl/workbook.xml"])).toContain(`name="Tom's &lt;&quot;roll&quot;&gt; &amp; co 2026-11-02"`);
  });
});
