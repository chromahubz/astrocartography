export type DistanceUnit = 'km' | 'mi';

export function formatDistance(km: number, unit: DistanceUnit): string {
  return unit === 'mi' ? `${Math.round(km * 0.621371)} mi` : `${Math.round(km)} km`;
}
