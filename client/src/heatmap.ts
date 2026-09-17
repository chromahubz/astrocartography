import { scorePoint, scoreTo100 } from './cityScore';
import type { ChartResponse } from './api';

const WIDTH = 220;
const HEIGHT = 140;
const LAT_LIMIT = 85.05112878; // standard Web Mercator max latitude - matches Leaflet's own projection

export const HEATMAP_BOUNDS: [[number, number], [number, number]] = [
  [-LAT_LIMIT, -180],
  [LAT_LIMIT, 180],
];

// Leaflet's ImageOverlay just linearly CSS-stretches the bitmap between the two
// projected corner points, it doesn't re-project the image content itself. So a
// naive equirectangular (linear-in-latitude) image would come out vertically
// wrong once stretched across a Mercator map - the fix is to pre-warp the raster
// rows using the same Mercator formula the map itself uses, so the later linear
// stretch reproduces the correct result. This is the standard trick for overlaying
// a custom raster on a Mercator slippy map (same math as tile-row-to-latitude).
function mercatorRowToLat(rowFrac: number): number {
  const mercY = Math.PI * (1 - 2 * rowFrac);
  return (2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * (180 / Math.PI);
}

function scoreToColor(score100: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, score100 / 100));
  // Diverging red -> muted gray -> green, deliberately muted (not saturated) so
  // the base map stays legible underneath.
  if (t < 0.5) {
    const u = t / 0.5;
    return [Math.round(210 + (110 - 210) * u), Math.round(65 + (110 - 65) * u), Math.round(65 + (110 - 65) * u)];
  }
  const u = (t - 0.5) / 0.5;
  return [Math.round(110 + (55 - 110) * u), Math.round(110 + (175 - 110) * u), Math.round(110 + (95 - 110) * u)];
}

/** Renders a chart-derived good/bad shading of the whole world as a data URL,
 * meant to be shown via Leaflet's ImageOverlay bounded to HEATMAP_BOUNDS. */
export function buildHeatmapDataUrl(
  chart: ChartResponse,
  enabledLineTypes: Set<string>,
  includeLocalSpace: boolean
): string {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(WIDTH, HEIGHT);

  for (let row = 0; row < HEIGHT; row++) {
    const lat = mercatorRowToLat((row + 0.5) / HEIGHT);
    for (let col = 0; col < WIDTH; col++) {
      const lon = -180 + 360 * ((col + 0.5) / WIDTH);
      const { score } = scorePoint(chart, { lat, lon }, enabledLineTypes, includeLocalSpace);
      const s100 = scoreTo100(score);
      const [r, g, b] = scoreToColor(s100);
      // Fade toward transparent near neutral (50) so only genuinely good/bad
      // zones stand out, rather than tinting the whole map uniformly.
      const alpha = Math.max(0.1, Math.min(0.8, Math.abs(s100 - 50) / 50));
      const idx = (row * WIDTH + col) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
