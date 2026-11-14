import React from "react";
import ScanUploadProgress from "./ScanUploadProgress";

function progress(uploaded: number, failed: number, total: number) {
  const root = ScanUploadProgress({ uploaded, failed, total });
  const children = React.Children.toArray(root.props.children);
  const bar = children.find((child) =>
    React.isValidElement<{ accessibilityRole?: string }>(child) && child.props.accessibilityRole === "progressbar",
  );
  if (!React.isValidElement<{ accessibilityValue: { min: number; max: number; now: number; text: string }; children: React.ReactElement<{ style: unknown[] }> }>(bar)) {
    throw new Error("Missing progress bar");
  }
  return bar.props;
}

describe("scan upload progress", () => {
  it("starts at zero and advances for both successes and failures", () => {
    expect(progress(0, 0, 4).accessibilityValue).toMatchObject({ now: 0, max: 4 });
    const bar = progress(1, 1, 4);
    expect(bar.accessibilityValue).toMatchObject({ now: 2, max: 4, text: "2 of 4 scans processed" });
    expect(bar.children.props.style[1]).toEqual({ width: "50%" });
    expect(progress(3, 1, 4).children.props.style[1]).toEqual({ width: "100%" });
  });

  it("shows which file is being processed", () => {
    const root = ScanUploadProgress({ uploaded: 0, failed: 0, total: 2, currentFile: "scan-01.jpg" });
    const children = React.Children.toArray(root.props.children);
    expect(children.some((child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      Array.isArray(child.props.children) && child.props.children.includes("scan-01.jpg"),
    )).toBe(true);
  });
});
