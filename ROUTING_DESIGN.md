# Route Intelligence

## Providers And Credentials

- `GOOGLE_MAPS_API_KEY` is a private server credential used only by the Routes API and Geocoding API. Restrict it in Google Cloud to those APIs and trusted server egress IP addresses.
- `GOOGLE_MAPS_BROWSER_API_KEY` is intentionally public and is returned only by `/api/v1/maps/config`. Restrict it in Google Cloud by exact HTTP referrer origins and enable only Maps JavaScript API (plus the required map libraries).
- Do not use the server key in browser HTML, browser JavaScript, query strings, logs, or client storage. Keep the two keys separate.
- Route and geocoding responses are fetched live and are not written to local storage, session storage, or a server cache. The transient selected origin/destination is held for the current browser tab only.
- If a provider key is missing, a provider request fails, or route-risk data cannot be checked, the service returns an explicit error and does not invent a fallback route.

## Route Risk Heuristic

For each Google route alternative, the service calculates a bounded 0–100 prioritization score:

`risk = 100 * (w1 * severity + w2 * exposure + w3 * closure + w4 * freshness + w5 * uncertainty) / sum(weights)`

Default weights are `severity=0.35`, `exposure=0.25`, `closure=0.20`, `freshness=0.10`, and `uncertainty=0.10`. Override them with `ROUTE_RISK_W1` through `ROUTE_RISK_W5`.

- Severity uses the maximum intersected verified hazard severity (LOW 0.20, MODERATE 0.45, SEVERE 0.75, CRITICAL 1.00).
- Exposure is the PostGIS-computed length of route intersections with active verified hazard polygons, normalized by route length and capped at 1.
- Closure is 1 when the route intersects a stored `CLOSED_SUBMERGED` or `DEBRIS_BLOCKED` road segment, otherwise 0.
- Freshness increases as the newest intersected record ages: 0 through 15 minutes, 0.35 through 60 minutes, 0.70 through 4 hours, then 1.00. With no intersecting records, freshness uncertainty is 0.50.
- Uncertainty increases with unverified incident points within 100 m of the route and unverified polygon intersections. These reports are never counted as confirmed closures.

Alternatives are ordered first by confirmed closures, then verified severe/critical hazard intersections, then total score, travel time, and distance. A low-risk recommendation is withheld when every option has a confirmed closure, a verified severe hazard, or a score of 30 or more. The score is a configurable heuristic, not scientifically validated and not a guarantee of safety.

## Data And Limitations

- Hazard zones are intersected with route geometries using PostGIS `ST_Intersects` and measured with geography length. Road closures use stored road-segment line geometry or their stored endpoints.
- A road segment with a closure status is treated as an authority road record; the current schema has no separate closure-verification flag. Its inspection timestamp is surfaced as freshness information.
- The route endpoint currently evaluates up to 500 incident records and 500 closure records. Production deployments should add indexed geometry columns and district/bounding-box filters before operating at national scale.
- Monitoring checks only the selected route geometry against current hazard and closure records every 60 seconds when explicitly enabled. It flags new closures, new verified severe hazards, and risk-score changes of at least five points. It does not claim that a route is continuously observed or safe.
- Opening navigation in Google Maps triggers a separate Google navigation calculation. Those directions can differ from the route that was risk-assessed in DisasterReady.

## Local Setup

Copy the credential placeholders from `.env.example`, create separate Google Cloud keys, and apply the restrictions above. Enable billing and Routes API, Geocoding API, and Maps JavaScript API for the corresponding keys. Do not commit credentials. In keyless local development, route comparison and map loading intentionally show provider-not-configured states.