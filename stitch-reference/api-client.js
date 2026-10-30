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
  // Config — picks up from env if running via a build tool, else defaults to dev
  // ---------------------------------------------------------------------------
  const BASE_URL = window.DR_API_BASE || 'http://localhost:5001/api/v1';

  // ---------------------------------------------------------------------------
  // Internal HTTP helper
  // ---------------------------------------------------------------------------
  async function http(method, path, body, isFormData) {
    const opts = {
      method,
      credentials: 'include',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    };
    if (body) {
      opts.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${path}`, opts);
    const json = await res.json().catch(() => ({
      success: false,
      error: { code: 'PARSE_ERROR', message: 'Unexpected server response.' },
    }));

    if (!res.ok) {
      const err = new Error(json.error?.message || 'API error');
      err.code = json.error?.code || 'API_ERROR';
      err.status = res.status;
      err.details = json.error?.details;
      throw err;
    }
    return json.data;
  }

  const get = (path) => http('GET', path);
  const post = (path, body, isFormData) => http('POST', path, body, isFormData);

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
    load() {
      if (window.google?.maps?.importLibrary) return window.google.maps.importLibrary('maps');
      if (window._drMapsLoadPromise) return window._drMapsLoadPromise;
      window._drMapsLoadPromise = get('/maps/config').then((config) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const params = new URLSearchParams({ key: config.browserApiKey, loading: 'async', libraries: 'maps,marker', v: 'weekly' });
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.async = true;
        script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load.'));
        script.onload = () => {
          if (!window.google?.maps?.importLibrary) return reject(new Error('Google Maps JavaScript API is unavailable.'));
          resolve(window.google.maps.importLibrary('maps'));
        };
        document.head.append(script);
      })).catch((error) => {
        window._drMapsLoadPromise = null;
        throw error;
      });
      return window._drMapsLoadPromise;
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
  // Public API
  // ---------------------------------------------------------------------------
  window.DisasterReadyAPI = {
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
    simulation,
    transparency,
    broadcast,
    ui,
  };
})(window);

