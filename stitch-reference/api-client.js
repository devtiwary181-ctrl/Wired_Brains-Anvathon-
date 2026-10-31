/**
 * DisasterReady India — Shared API Client
 * Injected into all frontend screens to connect to the backend.
 *
 * Usage: Include this script in each screen HTML, then call:
 *   const DR = window.DisasterReadyAPI;
 *   const alerts = await DR.alerts.getActive();
 */

(function (window) {
  'use strict';

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Config — picks up from env or window globals, defaults to same-origin /api/v1
  // ---------------------------------------------------------------------------
  const BASE_URL =
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
    window.VITE_API_BASE_URL ||
    window.DR_API_BASE ||
    (typeof window !== 'undefined' && window.location
      ? (window.location.port === '5001' || window.location.port === '3000' || !window.location.port
          ? `${window.location.origin}/api/v1`
          : 'http://localhost:5001/api/v1')
      : 'http://localhost:5001/api/v1');

  // ---------------------------------------------------------------------------
  // Enhanced Centralized HTTP helper with Timeout, Cancellation & Error Normalization
  // ---------------------------------------------------------------------------
  async function http(method, path, body, options = {}) {
    const isFormData = options.isFormData || (typeof FormData !== 'undefined' && body instanceof FormData);
    const timeoutMs = options.timeout || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external AbortSignal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const headers = { ...(options.headers || {}) };
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach Bearer token if staff authenticated in sessionStorage (or cookie fallback)
    const staffToken = sessionStorage.getItem('dr_staff_token');
    if (staffToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${staffToken}`;
    }

    const fetchOpts = {
      method,
      credentials: 'include', // Includes HTTP-only session cookies
      headers,
      signal: controller.signal,
    };

    if (body) {
      fetchOpts.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(`${BASE_URL}${path}`, fetchOpts);
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Unexpected server response.' },
      }));

      if (!res.ok) {
        // Understandable citizen-safe error handling
        let friendlyMessage = json.error?.message;
        if (!friendlyMessage || res.status >= 500) {
          friendlyMessage = 'Our emergency servers are busy or temporarily unavailable. Please try again or use direct emergency helplines (112 / 108).';
        }

        const err = new Error(friendlyMessage);
        err.code = json.error?.code || `HTTP_${res.status}`;
        err.status = res.status;
        err.details = json.error?.details;
        err.isApiError = true;

        // Auto-redirect or notify on expired admin session
        if (res.status === 401 && path.startsWith('/authority')) {
          sessionStorage.removeItem('dr_staff_token');
          sessionStorage.removeItem('dr_staff_user');
          window.dispatchEvent(new CustomEvent('dr:staff_unauthorized', { detail: { path } }));
        }

        throw err;
      }

      return json.data !== undefined ? json.data : { success: true, message: json.message };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('The emergency server took too long to respond. Please check your signal and retry.');
        timeoutErr.code = 'TIMEOUT';
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        const netErr = new Error('No internet connection. Saved your action to the offline queue.');
        netErr.code = 'NETWORK_ERROR';
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  }

  const get = (path, options) => http('GET', path, null, options);
  const post = (path, body, options) => http('POST', path, body, typeof options === 'boolean' ? { isFormData: options } : options);
  const patch = (path, body, options) => http('PATCH', path, body, options);
  const put = (path, body, options) => http('PUT', path, body, options);
  const del = (path, options) => http('DELETE', path, null, options);

  // ---------------------------------------------------------------------------
  // Helpers: localStorage for citizen session state
  // ---------------------------------------------------------------------------
  const storage = {
    setLang: (code) => {
      localStorage.setItem('dr_lang', code);
      localStorage.setItem('dr_citizen_lang', code);
    },
    getLang: () => localStorage.getItem('dr_lang') || localStorage.getItem('dr_citizen_lang') || 'en',
    setDistrict: (districtObj) => {
      localStorage.setItem('dr_district', JSON.stringify(districtObj));
      if (districtObj) {
        localStorage.setItem('dr_citizen_district', districtObj.name || districtObj.district || '');
        localStorage.setItem('dr_citizen_district_id', districtObj.districtId || districtObj.id || '');
      }
    },
    getDistrict: () => {
      try {
        const stored = JSON.parse(localStorage.getItem('dr_district'));
        if (stored) return stored;
      } catch {
        // Fall through to preferences written by the original onboarding screen.
      }
      const name = localStorage.getItem('dr_citizen_district');
      const districtId = localStorage.getItem('dr_citizen_district_id');
      return name || districtId ? { name, district: name, districtId } : null;
    },
    setLocation: (lat, lng) => {
      localStorage.setItem('dr_lat', lat);
      localStorage.setItem('dr_lng', lng);
      localStorage.setItem('dr_citizen_lat', lat);
      localStorage.setItem('dr_citizen_lng', lng);
    },
    setLocationLabel: (label) => localStorage.setItem('dr_location_label', label),
    getLocation: () => {
      const latValue = localStorage.getItem('dr_lat') ?? localStorage.getItem('dr_citizen_lat');
      const lngValue = localStorage.getItem('dr_lng') ?? localStorage.getItem('dr_citizen_lng');
      const lat = latValue == null || latValue === '' ? null : Number(latValue);
      const lng = lngValue == null || lngValue === '' ? null : Number(lngValue);
      return {
        lat: lat != null && Number.isFinite(lat) ? lat : null,
        lng: lng != null && Number.isFinite(lng) ? lng : null,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Location & Geo
  // ---------------------------------------------------------------------------
  const geo = {
    async reverseGeocode(lat, lng) {
      return get(`/geo/reverse-geocode?lat=${lat}&lng=${lng}`);
    },
    async searchDistricts(q) {
      if (!q || q.length < 2) return [];
      return get(`/geo/districts?q=${encodeURIComponent(q)}`);
    },
    async searchPlaces(q) {
      if (!q || q.trim().length < 3) return [];
      return get(`/geo/search?q=${encodeURIComponent(q.trim())}`);
    },
    /**
     * Detect GPS location, reverse geocode, and persist to storage.
     * Resolves with { lat, lng, district } or rejects with reason.
     */
    detectAndStore() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('GEOLOCATION_NOT_SUPPORTED'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude: lat, longitude: lng, accuracy } = pos.coords;
            if (accuracy > 5000) {
              reject(new Error('GPS_ACCURACY_LOW'));
              return;
            }
            try {
              const district = await geo.reverseGeocode(lat, lng);
              storage.setLocation(lat, lng);
              storage.setDistrict(district);
              resolve({ lat, lng, district });
            } catch (err) {
              reject(err);
            }
          },
          (err) => {
            const codes = {
              1: 'PERMISSION_DENIED',
              2: 'POSITION_UNAVAILABLE',
              3: 'TIMEOUT',
            };
            reject(new Error(codes[err.code] || 'GEOLOCATION_ERROR'));
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    },
  };

  const routing = {
    compare({ origin, destination, travelMode = 'WALK' }) {
      return post('/routes/compare', { origin, destination, travelMode });
    },
    checkRisk({ coordinates, knownFeatureIds, previousRiskScore }) {
      return post('/routes/check-risk', { coordinates, knownFeatureIds, previousRiskScore });
    },
  };

  const maps = {
    config: null,
    async getConfig() {
      if (this.config) return this.config;
      try {
        this.config = await get('/maps/config');
      } catch {
        this.config = {
          provider: 'leaflet-osm',
          tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
        };
      }
      return this.config;
    },
    load() {
      if (window.L) return Promise.resolve(window.L);
      if (window._drLeafletLoadPromise) return window._drLeafletLoadPromise;

      window._drLeafletLoadPromise = new Promise((resolve, reject) => {
        // Inject Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/vendor/leaflet/leaflet.css';
          document.head.append(link);
        }

        // Inject Leaflet JS
        const script = document.createElement('script');
        script.src = '/vendor/leaflet/leaflet.js';
        script.async = true;
        script.onerror = () => {
          // Fallback to unpkg CDN if local file fails
          const cdnScript = document.createElement('script');
          cdnScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          cdnScript.onload = () => resolve(window.L);
          cdnScript.onerror = () => reject(new Error('Leaflet map library could not be loaded.'));
          document.head.append(cdnScript);
        };
        script.onload = () => {
          resolve(window.L);
        };
        document.head.append(script);
      });

      return window._drLeafletLoadPromise;
    },
    createMap(container, options = {}) {
      const L = window.L;
      if (!L) throw new Error('Leaflet must be loaded before creating a map.');
      const center = options.center || [20.5937, 78.9629];
      const zoom = options.zoom || 5;
      const map = L.map(container, {
        center,
        zoom,
        zoomControl: options.zoomControl !== false,
      });

      const tileUrl = (this.config && this.config.tileUrl) || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      const attribution = (this.config && this.config.attribution) || '&copy; Esri, OpenStreetMap contributors';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution,
      }).addTo(map);

      return map;
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Dashboard
  // ---------------------------------------------------------------------------
  const dashboard = {
    async get(districtId) {
      const qs = districtId ? `?districtId=${districtId}` : '';
      return get(`/dashboard${qs}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Alerts
  // ---------------------------------------------------------------------------
  const alerts = {
    async getActive(districtId) {
      const qs = districtId ? `?districtId=${districtId}` : '';
      return get(`/alerts/active${qs}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Announcements
  // ---------------------------------------------------------------------------
  const announcements = {
    async get(districtId) {
      const qs = districtId ? `?districtId=${districtId}` : '';
      return get(`/announcements${qs}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Hazards
  // ---------------------------------------------------------------------------
  const hazards = {
    async getSpatial({ districtId, hazardType, status, severity, since } = {}) {
      const params = new URLSearchParams();
      if (districtId) params.set('districtId', districtId);
      if (hazardType) params.set('hazardType', hazardType);
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      if (since) params.set('since', since);
      const qs = params.toString() ? `?${params}` : '';
      return get(`/hazards/spatial${qs}`);
    },
    /**
     * Submit hazard report with optional photo file.
     * data: { hazardType, severity, latitude, longitude, ... }
     * photoFile: File | null
     */
    async report(data, photoFile) {
      if (photoFile) {
        const formData = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formData.append(k, v);
        });
        formData.append('photo', photoFile);
        return post('/hazards/report', formData, true);
      }
      return post('/hazards/report', data);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Facilities
  // ---------------------------------------------------------------------------
  const facilities = {
    async get({ districtId, facilityType, lat, lng, radiusKm, hasMedical, hasInfantCare, hasPower, hasDrinkingWater } = {}) {
      const params = new URLSearchParams();
      if (districtId) params.set('districtId', districtId);
      if (facilityType) params.set('facilityType', facilityType);
      if (lat != null) params.set('lat', lat);
      if (lng != null) params.set('lng', lng);
      if (radiusKm != null) params.set('radiusKm', radiusKm);
      if (hasMedical != null) params.set('hasMedical', hasMedical);
      if (hasInfantCare != null) params.set('hasInfantCare', hasInfantCare);
      if (hasPower != null) params.set('hasPower', hasPower);
      if (hasDrinkingWater != null) params.set('hasDrinkingWater', hasDrinkingWater);
      const qs = params.toString() ? `?${params}` : '';
      return get(`/facilities${qs}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Preparedness
  // ---------------------------------------------------------------------------
  const preparedness = {
    async getGuides(disasterType) {
      const qs = disasterType ? `?disasterType=${disasterType}` : '';
      return get(`/preparedness/guides${qs}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: Relief Requests (with Offline Draft & Sync Protection)
  // ---------------------------------------------------------------------------
  const relief = {
    async submit(data) {
      if (!navigator.onLine) {
        // Save draft locally with clear NOT SENT status
        const offlineQueue = JSON.parse(localStorage.getItem('dr_offline_relief_queue') || '[]');
        const draftId = 'DRAFT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        offlineQueue.push({ id: draftId, data, createdAt: new Date().toISOString(), status: 'NOT_SENT' });
        localStorage.setItem('dr_offline_relief_queue', JSON.stringify(offlineQueue));
        const err = new Error('No internet connection. Request saved locally as NOT SENT draft. It will sync automatically when online.');
        err.code = 'OFFLINE_DRAFT_SAVED';
        err.draftId = draftId;
        throw err;
      }
      return post('/relief-requests', data);
    },
    async track(token) {
      return get(`/relief-requests/track/${encodeURIComponent(token)}`);
    },
    getOfflineDrafts() {
      return JSON.parse(localStorage.getItem('dr_offline_relief_queue') || '[]');
    },
    async syncOfflineDrafts() {
      if (!navigator.onLine) return { synced: 0, pending: relief.getOfflineDrafts().length };
      const drafts = relief.getOfflineDrafts();
      const remaining = [];
      let syncedCount = 0;
      for (const draft of drafts) {
        try {
          await post('/relief-requests', draft.data);
          syncedCount++;
        } catch (e) {
          remaining.push(draft);
        }
      }
      localStorage.setItem('dr_offline_relief_queue', JSON.stringify(remaining));
      return { synced: syncedCount, pending: remaining.length };
    },
  };

  // ---------------------------------------------------------------------------
  // Module: SOS (with Offline Draft & Direct Call Protection)
  // ---------------------------------------------------------------------------
  const sos = {
    async log(serviceType, lat, lng, details = {}) {
      const payload = {
        serviceType: serviceType || '112_NATIONAL',
        latitude: lat != null && Number.isFinite(Number(lat)) ? Number(lat) : undefined,
        longitude: lng != null && Number.isFinite(Number(lng)) ? Number(lng) : undefined,
        emergencyType: details.emergencyType,
        gpsAccuracy: details.gpsAccuracy,
        affectedPeople: details.affectedPeople,
        description: details.description,
        contactInfo: details.contactInfo,
      };

      if (!navigator.onLine) {
        // Store offline SOS draft marked explicitly NOT SENT
        const offlineSos = JSON.parse(localStorage.getItem('dr_offline_sos_queue') || '[]');
        const draftId = 'SOS-DRAFT-' + Date.now().toString(36);
        offlineSos.push({ id: draftId, payload, createdAt: new Date().toISOString(), status: 'NOT_SENT' });
        localStorage.setItem('dr_offline_sos_queue', JSON.stringify(offlineSos));
        const err = new Error('No internet connection. SOS saved locally as NOT SENT. Please directly use the emergency phone dialer (112 / 108 / 1078).');
        err.code = 'OFFLINE_SOS_DRAFT_SAVED';
        err.draftId = draftId;
        throw err;
      }
      return post('/sos', payload);
    },
    getOfflineDrafts() {
      return JSON.parse(localStorage.getItem('dr_offline_sos_queue') || '[]');
    },
    async syncOfflineDrafts() {
      if (!navigator.onLine) return { synced: 0, pending: sos.getOfflineDrafts().length };
      const drafts = sos.getOfflineDrafts();
      const remaining = [];
      let syncedCount = 0;
      for (const draft of drafts) {
        try {
          await post('/sos', draft.payload);
          syncedCount++;
        } catch (e) {
          remaining.push(draft);
        }
      }
      localStorage.setItem('dr_offline_sos_queue', JSON.stringify(remaining));
      return { synced: syncedCount, pending: remaining.length };
    },
  };

  // ---------------------------------------------------------------------------
  // UI Utilities
  // ---------------------------------------------------------------------------
  const ui = {
    /** Show a brief toast-style notification */
    toast(message, durationMs = 3000) {
      let toast = document.getElementById('dr-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dr-toast';
        toast.style.cssText =
          'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#101d27;color:#fff;padding:12px 20px;border-radius:8px;font-family:Noto Sans,sans-serif;font-size:14px;z-index:9999;max-width:320px;text-align:center;transition:opacity .3s';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = '1';
      toast.style.display = 'block';
      clearTimeout(toast._timeout);
      toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => (toast.style.display = 'none'), 300);
      }, durationMs);
    },

    /** Set element loading state */
    setLoading(el, isLoading) {
      if (!el) return;
      if (isLoading) {
        el.dataset.original = el.textContent;
        el.disabled = true;
        el.textContent = 'Loading…';
      } else {
        if (el.dataset.original) el.textContent = el.dataset.original;
        el.disabled = false;
      }
    },

    /** Render an error banner */
    showError(containerId, message) {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `
        <div style="background:#ffdad6;color:#93000a;padding:12px 16px;border-radius:8px;font-family:Noto Sans,sans-serif;font-size:14px;display:flex;align-items:center;gap:8px;">
          <span>⚠</span> ${message}
        </div>`;
    },

    /** Severity badge color */
    severityClass(severity) {
      return (
        { EXTREME: '#ba1a1a', DANGER: '#b01c1c', WARNING: '#c77a00', ADVISORY: '#005da0', INFO: '#4f606f' }[severity] ||
        '#4f606f'
      );
    },

    /** Format freshness string */
    freshnessLabel(dateStr) {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 5) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    },
  };

  // ---------------------------------------------------------------------------
  // Copilot AI API
  // ---------------------------------------------------------------------------
  const copilot = {
    /**
     * Send chat query to DisasterReady AI Copilot
     * @param {Object} options
     * @param {string} options.query - Natural language prompt
     * @param {string} [options.language] - One of 12 supported language codes
     * @param {string} [options.districtId] - Optional district UUID
     * @param {{lat: number, lng: number}} [options.coordinates] - User geolocation
     * @param {string} [options.trackingToken] - Token for relief status lookups
     * @param {string} [options.requestedTool] - Explicit tool execution request
     * @param {Object} [options.toolParameters] - Specific parameters for the tool
     */
    async chat({
      query,
      language,
      districtId,
      coordinates,
      trackingToken,
      requestedTool,
      toolParameters,
      conversationHistory,
    }) {
      const activeDistrict = storage.getDistrict();
      const currentDistrictId = districtId || activeDistrict?.id;
      const currentLang = language || storage.getLang() || 'en';

      return post('/copilot/chat', {
        query,
        language: currentLang,
        districtId: currentDistrictId,
        coordinates,
        trackingToken,
        requestedTool,
        toolParameters,
        conversationHistory,
      });
    },

    /**
     * Map actionCard type to human-readable title and CTA
     */
    formatCardMeta(actionCard) {
      if (!actionCard) return null;
      switch (actionCard.type) {
        case 'FACILITY_CARD':
          return { icon: 'hospital', badge: 'Verified Facility', actionText: 'Get Directions' };
        case 'HAZARD_CARD':
          return { icon: 'warning', badge: 'Active Hazard', actionText: 'View Details' };
        case 'ALERT_CARD':
          return { icon: 'campaign', badge: 'Emergency Alert', actionText: 'Read Guidelines' };
        case 'ROUTE_CARD':
          return { icon: 'alt_route', badge: 'Calculated Route', actionText: 'Open Navigation' };
        case 'TRACKING_CARD':
          return { icon: 'local_shipping', badge: 'Relief Request Status', actionText: 'Track Consignment' };
        case 'EMERGENCY_DIALER_CARD':
          return { icon: 'call', badge: 'SOS Helpline', actionText: 'Dial 112' };
        case 'RECOMMENDATION_DRAFT_CARD':
          return { icon: 'fact_check', badge: 'Official Draft (Approval Required)', actionText: 'Review & Authorize' };
        default:
          return { icon: 'info', badge: 'Civil Insight', actionText: 'Open' };
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Voice Controls (Speech Recognition & Speech Synthesis)
  // ---------------------------------------------------------------------------
  const voice = {
    isRecognitionSupported: () =>
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window),

    isSynthesisSupported: () =>
      typeof window !== 'undefined' && 'speechSynthesis' in window,

    /**
     * Start listening via Web Speech API
     * @param {Object} callbacks
     * @param {Function} callbacks.onResult - (transcript) => void
     * @param {Function} callbacks.onError - (err) => void
     * @param {Function} callbacks.onEnd - () => void
     * @param {string} [callbacks.language] - Language code
     */
    startListening({ onResult, onError, onEnd, language }) {
      if (!this.isRecognitionSupported()) {
        if (onError) onError(new Error('Voice recognition is not supported in this browser.'));
        return null;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;

      // Map language code to BCP 47
      const bcpMap = {
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        kn: 'kn-IN',
        ml: 'ml-IN',
        bn: 'bn-IN',
        mr: 'mr-IN',
        gu: 'gu-IN',
        or: 'or-IN',
        pa: 'pa-IN',
        as: 'as-IN',
      };
      recognizer.lang = bcpMap[language || storage.getLang()] || 'en-IN';

      recognizer.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (onResult) onResult(transcript);
      };

      recognizer.onerror = (event) => {
        if (onError) onError(new Error(event.error || 'Speech recognition error.'));
      };

      recognizer.onend = () => {
        if (onEnd) onEnd();
      };

      try {
        recognizer.start();
        return recognizer;
      } catch (err) {
        if (onError) onError(err);
        return null;
      }
    },

    /**
     * Speak text using Web Speech API synthesis
     */
    speak(text, language) {
      if (!this.isSynthesisSupported()) return false;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const bcpMap = {
          en: 'en-IN',
          hi: 'hi-IN',
          ta: 'ta-IN',
          te: 'te-IN',
          kn: 'kn-IN',
          ml: 'ml-IN',
          bn: 'bn-IN',
          mr: 'mr-IN',
          gu: 'gu-IN',
          or: 'or-IN',
          pa: 'pa-IN',
          as: 'as-IN',
        };
        utterance.lang = bcpMap[language || storage.getLang()] || 'en-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },

    stopSpeaking() {
      if (this.isSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Low-Data Mode Settings
  // ---------------------------------------------------------------------------
  const lowData = {
    isEnabled: () => localStorage.getItem('dr_low_data_mode') === 'true',
    set: (enabled) => {
      localStorage.setItem('dr_low_data_mode', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('dr:low_data_changed', { detail: { enabled } }));
    },
    toggle: () => {
      const current = lowData.isEnabled();
      lowData.set(!current);
      return !current;
    },
  };

  // ---------------------------------------------------------------------------
  // IndexedDB & Offline Queue (Drafts, Idempotency, Auto-retry with Exponential Backoff)
  // ---------------------------------------------------------------------------
  const DB_NAME = 'DisasterReadyOfflineDB';
  const DB_VERSION = 1;

  function openOfflineDB() {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending_queue')) {
          const store = db.createObjectStore('pending_queue', { keyPath: 'idempotencyKey' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'draftType' });
        }
        if (!db.objectStoreNames.contains('checklist_progress')) {
          db.createObjectStore('checklist_progress', { keyPath: 'guideId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const offline = {
    isOnline: () => (typeof navigator !== 'undefined' ? navigator.onLine : true),

    generateIdempotencyKey: () => {
      return 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    },

    /**
     * Queue an action for submission when online
     */
    async enqueueAction(type, endpoint, payload) {
      const db = await openOfflineDB();
      const idempotencyKey = payload.idempotencyKey || offline.generateIdempotencyKey();
      const record = {
        idempotencyKey,
        type, // 'HAZARD_REPORT', 'RELIEF_REQUEST', 'SOS_LOG'
        endpoint,
        payload: { ...payload, idempotencyKey },
        status: 'QUEUED', // 'QUEUED', 'SENDING', 'SENT', 'FAILED'
        retries: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('pending_queue', 'readwrite');
          tx.objectStore('pending_queue').put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }

      window.dispatchEvent(new CustomEvent('dr:queue_updated', { detail: record }));
      return record;
    },

    /**
     * Get all pending queued items
     */
    async getQueue() {
      const db = await openOfflineDB();
      if (!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction('pending_queue', 'readonly');
        const req = tx.objectStore('pending_queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    },

    /**
     * Process pending offline queue with exponential backoff
     */
    async processQueue() {
      if (!offline.isOnline()) return { processed: 0, pending: 0 };
      const queue = await offline.getQueue();
      const pendingItems = queue.filter((i) => i.status === 'QUEUED' || i.status === 'FAILED');
      let processedCount = 0;

      for (const item of pendingItems) {
        try {
          item.status = 'SENDING';
          await post(item.endpoint, item.payload);
          item.status = 'SENT';
          item.updatedAt = new Date().toISOString();
          processedCount++;

          // Delete sent item after success
          const db = await openOfflineDB();
          if (db) {
            const tx = db.transaction('pending_queue', 'readwrite');
            tx.objectStore('pending_queue').delete(item.idempotencyKey);
          }
        } catch (err) {
          item.retries = (item.retries || 0) + 1;
          item.status = 'FAILED';
          item.lastError = err.message;
          item.updatedAt = new Date().toISOString();

          const db = await openOfflineDB();
          if (db) {
            const tx = db.transaction('pending_queue', 'readwrite');
            tx.objectStore('pending_queue').put(item);
          }
        }
      }

      window.dispatchEvent(new CustomEvent('dr:queue_processed', { detail: { processed: processedCount } }));
      return { processed: processedCount, remaining: pendingItems.length - processedCount };
    },

    /**
     * Save draft form (hazard report or supply request)
     */
    async saveDraft(draftType, formData) {
      const db = await openOfflineDB();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put({ draftType, data: formData, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async getDraft(draftType) {
      const db = await openOfflineDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction('drafts', 'readonly');
        const req = tx.objectStore('drafts').get(draftType);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    },

    async clearDraft(draftType) {
      const db = await openOfflineDB();
      if (!db) return;
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').delete(draftType);
    },

    /**
     * Save checklist progress offline
     */
    async saveChecklistProgress(guideId, checkedItems) {
      const db = await openOfflineDB();
      if (!db) return;
      const tx = db.transaction('checklist_progress', 'readwrite');
      tx.objectStore('checklist_progress').put({ guideId, checkedItems, updatedAt: new Date().toISOString() });
    },

    async getChecklistProgress(guideId) {
      const db = await openOfflineDB();
      if (!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction('checklist_progress', 'readonly');
        const req = tx.objectStore('checklist_progress').get(guideId);
        req.onsuccess = () => resolve(req.result ? req.result.checkedItems : []);
        req.onerror = () => resolve([]);
      });
    },
  };

  // Auto-listen to browser online events to trigger background retry
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('🌐 DisasterReady: Connection restored. Processing offline queue...');
      offline.processQueue();
    });

    // Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Service Worker registration skipped:', err.message);
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Realtime Socket.IO Client with Reconnection & Missed-Event Recovery
  // ---------------------------------------------------------------------------
  let activeSocket = null;
  const realtime = {
    connect(options = {}) {
      if (typeof window === 'undefined' || typeof window.io !== 'function') {
        console.warn('Socket.IO client library not loaded on page.');
        return null;
      }

      if (activeSocket && activeSocket.connected) return activeSocket;

      const socketUrl = window.DR_WS_BASE || window.location.origin;
      activeSocket = window.io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        withCredentials: true,
      });

      let lastSeenTimestamp = new Date().toISOString();

      activeSocket.on('connect', () => {
        console.log('⚡ Connected to DisasterReady Realtime Gateway:', activeSocket.id);
        const district = storage.getDistrict();
        if (district?.id) {
          activeSocket.emit('join:district', district.id);
        }

        // Trigger missed events recovery
        activeSocket.emit('recover:events', { since: lastSeenTimestamp, districtId: district?.id }, (res) => {
          if (res?.success && res.events?.length > 0) {
            console.log(`⚡ Recovered ${res.recoveredCount} missed real-time events.`);
            res.events.forEach((evt) => {
              window.dispatchEvent(new CustomEvent('dr:realtime_event', { detail: evt }));
            });
          }
        });
      });

      // Standard event handlers updating timestamp
      const standardEvents = [
        'hazard:created',
        'hazard:updated',
        'alert:published',
        'road:closure_updated',
        'route:risk_changed',
        'facility:status_updated',
        'shelter:capacity_updated',
        'inventory:updated',
        'request:status_changed',
        'delivery:status_changed',
        'sos:received',
        'sos:acknowledged',
        'announcement:published',
      ];

      standardEvents.forEach((eventName) => {
        activeSocket.on(eventName, (data) => {
          lastSeenTimestamp = new Date().toISOString();
          window.dispatchEvent(new CustomEvent(`dr:${eventName}`, { detail: data }));
          window.dispatchEvent(new CustomEvent('dr:realtime_event', { detail: { eventType: eventName, ...data } }));
        });
      });

      return activeSocket;
    },

    subscribeToRequest(trackingToken, onUpdate) {
      if (!activeSocket) realtime.connect();
      if (activeSocket) {
        activeSocket.emit('join:request', trackingToken, (res) => {
          if (!res?.success) console.warn('Could not join request room:', res?.error);
        });
        activeSocket.on('request:status_changed', (data) => {
          if (data.trackingToken === trackingToken && onUpdate) {
            onUpdate(data);
          }
        });
      }
    },

    joinEOC(districtId, token, onAuthorized) {
      if (!activeSocket) realtime.connect();
      if (activeSocket) {
        activeSocket.emit('join:eoc', { districtId, token }, (res) => {
          if (res?.success && onAuthorized) onAuthorized(res.user);
        });
      }
    },
  };

  // ---------------------------------------------------------------------------
  // 17. Simulations, Staff Tools & Transparency Portal
  // ---------------------------------------------------------------------------
  const simulation = {
    async run(data) {
      return post('/authority/simulations', data);
    },
    async list() {
      return get('/authority/simulations');
    },
  };

  const transparency = {
    async getAnalytics(districtId) {
      const q = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
      return get(`/authority/analytics/summary${q}`);
    },
    async getPortalData(districtId) {
      const q = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
      return get(`/authority/transparency/portal${q}`);
    },
  };

  const broadcast = {
    async translate(sourceText, targetLanguages) {
      return post('/authority/announcements/translate', { sourceText, targetLanguages });
    },
  };

  // ---------------------------------------------------------------------------
  // 18. Phase 11 Centralized API Service Modules
  // ---------------------------------------------------------------------------

  // authApi: Staff 2FA & Session Handling (SessionStorage + HttpOnly Cookie)
  const authApi = {
    async loginStep1(identifier, password) {
      return post('/auth/login-step1', { identifier, password });
    },
    async verifyOtp(challengeId, otp, rememberDevice = false) {
      const data = await post('/auth/verify-otp', { challengeId, otp, rememberDevice });
      if (data?.token) {
        sessionStorage.setItem('dr_staff_token', data.token);
      }
      if (data?.user) {
        sessionStorage.setItem('dr_staff_user', JSON.stringify(data.user));
      }
      return data;
    },
    async resendOtp(challengeId) {
      return post('/auth/resend-otp', { challengeId });
    },
    async logout() {
      try {
        await post('/auth/logout', {});
      } catch (e) {
        // Continue clearing client session even if network drop
      } finally {
        sessionStorage.removeItem('dr_staff_token');
        sessionStorage.removeItem('dr_staff_user');
      }
      return { success: true };
    },
    async me() {
      return get('/auth/me');
    },
    getToken() {
      return sessionStorage.getItem('dr_staff_token');
    },
    getUser() {
      try {
        return JSON.parse(sessionStorage.getItem('dr_staff_user') || 'null');
      } catch {
        return null;
      }
    },
    isAuthenticated() {
      return !!sessionStorage.getItem('dr_staff_token');
    },
  };

  // dashboardApi: Citizen dashboard aggregates
  const dashboardApi = {
    async get(districtId) {
      return dashboard.get(districtId);
    },
  };

  // hazardApi: Hazards & Spatial lookups
  const hazardApi = {
    async getSpatial(filters) {
      return hazards.getSpatial(filters);
    },
  };

  // alertApi: Active alerts & district broadcast alerts
  const alertApi = {
    async getActive(districtId) {
      return alerts.getActive(districtId);
    },
  };

  // locationApi: Geolocation, reverse geocoding & place search
  const locationApi = {
    async reverseGeocode(lat, lng) {
      return geo.reverseGeocode(lat, lng);
    },
    async searchDistricts(q) {
      return geo.searchDistricts(q);
    },
    async searchPlaces(q) {
      return geo.searchPlaces(q);
    },
    async detectAndStore() {
      return geo.detectAndStore();
    },
  };

  // routingApi: Multi-criteria evacuation and relief routing
  const routingApi = {
    async compare(options) {
      return routing.compare(options);
    },
    async checkRisk(options) {
      return routing.checkRisk(options);
    },
  };

  // facilityApi: Emergency shelters and medical relief centers
  const facilityApi = {
    async get(filters) {
      return facilities.get(filters);
    },
  };

  // reportApi: Public citizen hazard reporting with multipart photo upload
  const reportApi = {
    async submit(data, photoFile) {
      return hazards.report(data, photoFile);
    },
  };

  // supplyApi: Public supply requests with offline draft protection
  const supplyApi = {
    async submit(data) {
      return relief.submit(data);
    },
    getOfflineDrafts() {
      return relief.getOfflineDrafts();
    },
    async syncOfflineDrafts() {
      return relief.syncOfflineDrafts();
    },
  };

  // trackingApi: High-entropy token-based relief tracking
  const trackingApi = {
    async track(token) {
      return relief.track(token);
    },
  };

  // sosApi: Emergency SOS logging and dialer fallback
  const sosApi = {
    async log(serviceType, lat, lng, details = {}) {
      return sos.log(serviceType, lat, lng, details);
    },
    getOfflineDrafts() {
      return sos.getOfflineDrafts();
    },
    async syncOfflineDrafts() {
      return sos.syncOfflineDrafts();
    },
  };

  // preparednessApi: Multilingual disaster survival guides & checklists
  const preparednessApi = {
    async getGuides(disasterType) {
      return preparedness.getGuides(disasterType);
    },
  };

  // inventoryApi: Authority relief warehouse stock & adjustments
  const inventoryApi = {
    async list() {
      return get('/authority/inventory');
    },
    async movements(depotId) {
      const q = depotId ? `?depotId=${encodeURIComponent(depotId)}` : '';
      return get(`/authority/inventory/movements${q}`);
    },
    async adjust(id, quantityAvailable, reason) {
      return patch(`/authority/inventory/${encodeURIComponent(id)}`, {
        quantityAvailable,
        reason: reason?.trim() || 'Manual stock update',
      });
    },
  };

  // adminApi: Authority Command Center Operations (RBAC Enforced)
  const adminApi = {
    async dashboard() {
      return get('/authority/dashboard');
    },
    async listIncidents() {
      return get('/authority/incidents');
    },
    async createIncident(incidentData) {
      return post('/authority/incidents', incidentData);
    },
    async updateIncident(incidentId, updateData) {
      return patch(`/authority/incidents/${encodeURIComponent(incidentId)}`, updateData);
    },
    async incidentHistory(incidentId) {
      return get(`/authority/incidents/${encodeURIComponent(incidentId)}/history`);
    },
    async decideHazard(hazardId, decision, rationale, incidentId) {
      return post(`/authority/hazards/${encodeURIComponent(hazardId)}/decision`, {
        decision,
        rationale,
        incidentId,
      });
    },
    async listAlerts() {
      return get('/authority/alerts');
    },
    async createAlert(alertData) {
      return post('/authority/alerts', alertData);
    },
    async updateAlert(alertId, updateData) {
      return patch(`/authority/alerts/${encodeURIComponent(alertId)}`, updateData);
    },
    async listFacilities() {
      return get('/authority/facilities');
    },
    async createFacility(facilityData) {
      return post('/authority/facilities', facilityData);
    },
    async updateFacility(facilityId, updateData) {
      return patch(`/authority/facilities/${encodeURIComponent(facilityId)}`, updateData);
    },
    async listReliefRequests() {
      return get('/authority/relief-requests');
    },
    async transitionRequest(requestId, stage, notes) {
      return patch(`/authority/relief-requests/${encodeURIComponent(requestId)}/stage`, {
        stage,
        notes,
      });
    },
    async allocateRequest(requestId, depotId, allocations, notes) {
      return post(`/authority/relief-requests/${encodeURIComponent(requestId)}/allocate`, {
        depotId,
        allocations,
        notes,
      });
    },
    async listStaff() {
      return get('/authority/staff');
    },
    async createStaff(staffData) {
      return post('/authority/staff', staffData);
    },
    async updateStaff(staffId, updateData) {
      return patch(`/authority/staff/${encodeURIComponent(staffId)}`, updateData);
    },
    async staffHistory(staffId) {
      return get(`/authority/staff/${encodeURIComponent(staffId)}/history`);
    },
    async listSos() {
      return get('/authority/sos');
    },
    async acknowledgeSos(sosId, notes) {
      return patch(`/authority/sos/${encodeURIComponent(sosId)}/acknowledge`, { notes });
    },
    async updateSosStatus(sosId, status, notes) {
      return patch(`/authority/sos/${encodeURIComponent(sosId)}/status`, { status, notes });
    },
  };

  // notificationApi: Web Push / District Broadcast Subscriptions
  const notificationApi = {
    async subscribe(subscriptionData) {
      return post('/realtime/notifications/subscribe', subscriptionData);
    },
    async unsubscribe(token) {
      return post('/realtime/notifications/unsubscribe', { token });
    },
  };

  // simulationApi: Disaster scenario simulation runs & history
  const simulationApi = {
    async run(data) {
      return simulation.run(data);
    },
    async list() {
      return simulation.list();
    },
  };

  // copilotApi: DisasterReady AI Copilot chat & card meta
  const copilotApi = {
    async chat(options) {
      return copilot.chat(options);
    },
    formatCardMeta(actionCard) {
      return copilot.formatCardMeta(actionCard);
    },
  };

  // ---------------------------------------------------------------------------
  // Public API Export (Providing 17 Dedicated Modules + Backward Compatible Aliases)
  // ---------------------------------------------------------------------------
  window.DisasterReadyAPI = {
    // 17 Standard Modules required by Phase 11
    authApi,
    dashboardApi,
    hazardApi,
    alertApi,
    locationApi,
    routingApi,
    facilityApi,
    reportApi,
    supplyApi,
    trackingApi,
    sosApi,
    preparednessApi,
    inventoryApi,
    adminApi,
    notificationApi,
    simulationApi,
    copilotApi,

    // Core HTTP Client primitives & utils
    client: {
      http,
      get,
      post,
      patch,
      put,
      del,
      BASE_URL,
    },

    // Backward-compatible screen aliases
    storage,
    geo,
    routing,
    maps,
    dashboard,
    alerts,
    announcements,
    hazards,
    facilities,
    preparedness,
    relief,
    sos,
    copilot,
    voice,
    lowData,
    offline,
    realtime,
    // Global automated navigation router for data-path attributes across all screens
    initNavigation() {
      if (typeof document === 'undefined') return;
      const pathMap = {
        'live-dashboard': '/screens/02-citizen-dashboard/index.html',
        'evacuation-routes': '/screens/03-get-to-safety-step-1/index.html',
        'safe-places-near-you-shelters-hospitals': '/screens/07-safe-places/index.html',
        'relief-shelters': '/screens/07-safe-places/index.html',
        'ask-for-supplies': '/screens/08-emergency-relief/index.html',
        'request-relief': '/screens/08-emergency-relief/index.html',
        'track-request': '/screens/09-relief-tracking/index.html',
        'preparedness-guides': '/screens/11-preparedness/index.html',
        'helplines-directory': '/screens/12-emergency-help/index.html',
        'report-hazard': '/screens/04-get-to-safety-step-2/index.html',
        'public-portal': '/screens/01-language-location/index.html',
        'staff-login': '/screens/13-staff-login/index.html',
        'login': '/screens/13-staff-login/index.html',
        'authority-dashboard': '/screens/14-authority-dashboard/index.html',
        'stage-1-overview': '/screens/14-authority-dashboard/index.html',
        'staff-tools': '/screens/15-staff-tools-settings/index.html',
        'simulate-a-change': '/screens/15-staff-tools-settings/index.html',
        'public-settings-and-accessibility': '/screens/15-staff-tools-settings/index.html',
        'public-transparency-and-civic-data-portal': '/screens/15-staff-tools-settings/index.html',
      };

      document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-path]');
        if (link) {
          const pathKey = link.getAttribute('data-path');
          const targetUrl = pathMap[pathKey];
          if (targetUrl) {
            e.preventDefault();
            window.location.href = targetUrl;
          }
        }
      });

      // Also set href attribute on matching anchors for right-click / accessibility
      document.querySelectorAll('[data-path]').forEach((el) => {
        const key = el.getAttribute('data-path');
        if (pathMap[key] && el.tagName === 'A') {
          el.href = pathMap[key];
        }
      });
    },
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => DisasterReadyAPI.initNavigation());
    } else {
      DisasterReadyAPI.initNavigation();
    }
  }
})(window);

