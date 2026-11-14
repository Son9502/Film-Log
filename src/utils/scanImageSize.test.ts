import { Image } from "react-native";
import { readScanImageSize } from "./scanImageSize";

describe("readScanImageSize", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reports dimensions through Image.getSize for local and signed URLs", () => {
    const getSize = jest.spyOn(Image, "getSize").mockImplementation((uri, success) => {
      success?.(uri.startsWith("blob:") ? 2000 : 3000, 1000);
    });
    const onSize = jest.fn();
    readScanImageSize("blob:local-scan", onSize);
    readScanImageSize("https://example.com/signed-scan", onSize);
    expect(getSize).toHaveBeenCalledTimes(2);
    expect(onSize.mock.calls).toEqual([[{ width: 2000, height: 1000 }], [{ width: 3000, height: 1000 }]]);
  });

  it("ignores callbacks after cancellation", () => {
    let success: ((width: number, height: number) => void) | undefined;
    jest.spyOn(Image, "getSize").mockImplementation((_uri, callback) => { success = callback; });
    const onSize = jest.fn();
    const cancel = readScanImageSize("blob:local-scan", onSize);
    cancel();
    success?.(2000, 3000);
    expect(onSize).not.toHaveBeenCalled();
  });

  it("logs failures and rejects invalid dimensions", () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const getSize = jest.spyOn(Image, "getSize");
    const onSize = jest.fn();
    getSize.mockImplementationOnce((_uri, success) => { success?.(0, 1000); });
    getSize.mockImplementationOnce((_uri, _success, failure) => { failure?.(new Error("unavailable")); });
    readScanImageSize("blob:invalid", onSize);
    readScanImageSize("blob:failed", onSize);
    expect(onSize).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
  });
});
