/** General public API: 60 req / 1 min per IP */
export declare const publicRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** Hazard submission: 5 submissions / 10 min per IP (spam protection) */
export declare const hazardReportRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** Relief request submission: 100 submissions / 10 min per IP, skipped for loopback/test */
export declare const reliefRequestRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** SOS logging: 10 / 5 min per IP */
export declare const sosRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** Google Maps-backed public queries: 10 provider requests / minute per IP */
export declare const mapsQueryRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
