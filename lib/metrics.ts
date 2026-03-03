/**
 * Shared metric calculation helpers.
 * Use these instead of inline calculations to ensure consistency.
 */

/** ROAS = revenue / spend. Returns 0 if spend is 0. Rounded to 2 decimal places. */
export function calcROAS(revenue: number, spend: number): number {
  if (spend <= 0) return 0;
  return Math.round((revenue / spend) * 100) / 100;
}

/** CPA = spend / conversions. Returns 0 if conversions is 0. Rounded to 2 decimal places. */
export function calcCPA(spend: number, conversions: number): number {
  if (conversions <= 0) return 0;
  return Math.round((spend / conversions) * 100) / 100;
}

/** CTR = (clicks / impressions) * 100 (percentage). Returns 0 if impressions is 0. Rounded to 2 decimal places. */
export function calcCTR(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 10000) / 100;
}

/** CPM = (spend / impressions) * 1000. Returns 0 if impressions is 0. Rounded to 2 decimal places. */
export function calcCPM(spend: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((spend / impressions) * 100000) / 100;
}

/** CPC = spend / clicks. Returns 0 if clicks is 0. Rounded to 2 decimal places. */
export function calcCPC(spend: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return Math.round((spend / clicks) * 100) / 100;
}
