import * as topojson from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';

// Shared low-res world landmass geometry, used both to draw the polar view's
// coastlines and to test whether an arbitrary lat/lon point is on land (for the
// worldwide "any land" best-places search) via d3-geo's geoContains.
export const landFeature = topojson.feature(
  landTopo as never,
  (landTopo as never as { objects: { land: never } }).objects.land
) as never;
