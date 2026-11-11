export type TemperatureUnit = "C" | "F";
export type DistanceUnit = "km" | "mi";

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

export function temperatureToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === "F" ? fahrenheitToCelsius(value) : value;
}

export function temperatureFromCelsius(value: number, unit: TemperatureUnit): number {
  return unit === "F" ? celsiusToFahrenheit(value) : value;
}

export function kmToMiles(kilometers: number): number {
  return kilometers * 0.621371;
}

export function milesToKm(miles: number): number {
  return miles / 0.621371;
}

function tidy(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return `${tidy(temperatureFromCelsius(celsius, unit))}°${unit}`;
}

export function formatDistance(kilometers: number, unit: DistanceUnit): string {
  return `${tidy(unit === "mi" ? kmToMiles(kilometers) : kilometers)} ${unit}`;
}

export function displayStoredTemperature(value: string | undefined, unit: TemperatureUnit): string | undefined {
  if (!value) return value;
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:°?\s*([CF]))?\s*$/i);
  if (!match) return value;
  const parsedUnit = match[2]?.toUpperCase() === "F" ? "F" : "C";
  const celsius = temperatureToCelsius(Number(match[1]), parsedUnit);
  return formatTemperature(celsius, unit);
}

export function storedTemperature(value: string, inputUnit: TemperatureUnit): string {
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:°?\s*([CF]))?\s*$/i);
  if (!match) return value.trim();
  const parsedUnit = match[2]?.toUpperCase() === "F" ? "F" : match[2]?.toUpperCase() === "C" ? "C" : inputUnit;
  const celsius = temperatureToCelsius(Number(match[1]), parsedUnit);
  return `${tidy(celsius)}°C`;
}
