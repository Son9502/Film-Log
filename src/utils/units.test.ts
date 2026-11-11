import {
  celsiusToFahrenheit,
  displayStoredTemperature,
  formatDistance,
  formatTemperature,
  fahrenheitToCelsius,
  kmToMiles,
  milesToKm,
  storedTemperature,
} from "./units";

describe("unit conversions", () => {
  it("converts temperatures both ways and formats the selected unit", () => {
    expect(celsiusToFahrenheit(20)).toBe(68);
    expect(fahrenheitToCelsius(68)).toBe(20);
    expect(formatTemperature(20, "F")).toBe("68°F");
    expect(formatTemperature(20, "C")).toBe("20°C");
  });

  it("converts distances and formats the selected unit", () => {
    expect(kmToMiles(1)).toBeCloseTo(0.621371);
    expect(milesToKm(1)).toBeCloseTo(1.609344);
    expect(formatDistance(5, "mi")).toBe("3.1 mi");
    expect(formatDistance(5, "km")).toBe("5 km");
  });

  it("normalizes temperature input to Celsius without rewriting free-form values", () => {
    expect(storedTemperature("68", "F")).toBe("20°C");
    expect(storedTemperature("20°C", "F")).toBe("20°C");
    expect(storedTemperature("Developer's note", "F")).toBe("Developer's note");
    expect(displayStoredTemperature("20°C", "F")).toBe("68°F");
    expect(displayStoredTemperature("legacy note", "F")).toBe("legacy note");
  });
});
