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
  // Module: Relief Requests
  // ---------------------------------------------------------------------------
  const relief = {
    async submit(data) {
      return post('/relief-requests', data);
    },
    async track(token) {
      return get(`/relief-requests/track/${encodeURIComponent(token)}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Module: SOS
  // ---------------------------------------------------------------------------
  const sos = {
    async log(serviceType, lat, lng) {
      return post('/sos', { serviceType, latitude: lat, longitude: lng });
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
  // Public API
  // ---------------------------------------------------------------------------
  window.DisasterReadyAPI = {
    storage,
    geo,
    dashboard,
    alerts,
    announcements,
    hazards,
    facilities,
    preparedness,
    relief,
    sos,
    ui,
  };
})(window);
