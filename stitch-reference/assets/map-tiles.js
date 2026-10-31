/**
 * DisasterReady India — Shared Map Tiles Module
 * 
 * Provides unified, resilient tile layers across all Leaflet maps:
 * - Primary: ArcGIS World Street Map (high reliability, no OSM policy blocks)
 * - Fallback 1: CARTO Voyager (clean raster tiles, auto-failover on 403/429/network error)
 * - Fallback 2: Esri World Topo / World Imagery
 * - Automatic <meta name="referrer"> injection for tile authorization
 * - Invalidation hooks for container visibility, window resize, theme, and language changes
 * - Layer switcher support (Street, Satellite, Terrain)
 */
(function (window, document) {
  'use strict';

  // 1. Ensure Referrer Meta Policy is set for secure tile fetching
  (function ensureReferrerPolicy() {
    let meta = document.querySelector('meta[name="referrer"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'strict-origin-when-cross-origin';
      document.head.prepend(meta);
    }
  })();

  // 2. Default Configuration
  const DEFAULT_CONFIG = {
    mapTileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    mapTileFallbackUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    esriTopoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    esriSatelliteUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    esriTerrainUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    attributionEsriStreet: 'Tiles &copy; Esri &mdash; &copy; OpenStreetMap contributors',
    attributionCarto: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    attributionEsriImagery: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    attributionEsriTopo: 'Tiles &copy; Esri &mdash; Sources: Esri, USGS, NOAA',
    attributionEsriTerrain: 'Tiles &copy; Esri'
  };

  let activeConfig = { ...DEFAULT_CONFIG, ...(window.__DR_CONFIG__ || {}) };
  let configPromise = null;

  // 3. Fetch Config from backend /api/v1/config or /api/v1/maps/config
  async function fetchConfig() {
    if (configPromise) return configPromise;

    configPromise = (async () => {
      // If config already preloaded by config.js, use it immediately
      if (window.__DR_CONFIG__) {
        activeConfig = { ...activeConfig, ...window.__DR_CONFIG__ };
      }

      try {
        const apiBase = (typeof window !== 'undefined' && window.location && (window.location.port === '5001' || !window.location.port))
          ? '/api/v1'
          : 'http://localhost:5001/api/v1';

        const endpoints = [`${apiBase}/config`, `${apiBase}/maps/config`, `${apiBase}/citizen/maps/config`];
        for (const url of endpoints) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              const d = json.data || json;
              if (d.mapTileUrl || d.tileUrl) {
                activeConfig.mapTileUrl = d.mapTileUrl || d.tileUrl || activeConfig.mapTileUrl;
                activeConfig.mapTileFallbackUrl = d.mapTileFallbackUrl || d.fallbackTileUrl || activeConfig.mapTileFallbackUrl;
                if (d.esriSatelliteUrl) activeConfig.esriSatelliteUrl = d.esriSatelliteUrl;
                if (d.esriTopoUrl) activeConfig.esriTopoUrl = d.esriTopoUrl;
                if (d.esriTerrainUrl) activeConfig.esriTerrainUrl = d.esriTerrainUrl;
                break;
              }
            }
          } catch (_) {
            // try next endpoint
          }
        }
      } catch (e) {
        // use default config
      }
      return activeConfig;
    })();

    return configPromise;
  }

  // Pre-trigger config fetch
  fetchConfig();

  // 4. Provider Specifications
  function getProviderSpecs(cfg) {
    return {
      street: {
        id: 'esri-street',
        name: 'Street',
        url: cfg.mapTileUrl,
        options: {
          maxZoom: 19,
          attribution: cfg.attributionEsriStreet,
          crossOrigin: true
        }
      },
      carto: {
        id: 'carto-voyager',
        name: 'CARTO Voyager',
        url: cfg.mapTileFallbackUrl,
        options: {
          subdomains: 'abcd',
          maxZoom: 20,
          attribution: cfg.attributionCarto,
          crossOrigin: true
        }
      },
      topo: {
        id: 'esri-topo',
        name: 'Topographic',
        url: cfg.esriTopoUrl,
        options: {
          maxZoom: 19,
          attribution: cfg.attributionEsriTopo,
          crossOrigin: true
        }
      },
      satellite: {
        id: 'esri-satellite',
        name: 'Satellite',
        url: cfg.esriSatelliteUrl,
        options: {
          maxZoom: 19,
          attribution: cfg.attributionEsriImagery,
          crossOrigin: true
        }
      },
      terrain: {
        id: 'esri-terrain',
        name: 'Terrain',
        url: cfg.esriTerrainUrl,
        options: {
          maxZoom: 13,
          attribution: cfg.attributionEsriTerrain,
          crossOrigin: true
        }
      }
    };
  }

  /**
   * Creates a robust, self-healing Tile Layer on a Leaflet map.
   * If primary tiles fail (403, 429, or network drop), automatically switches to fallback providers without error alerts.
   */
  function createRobustTileLayer(map, options = {}) {
    const L = window.L;
    if (!L) {
      console.warn('DisasterReadyMapTiles: Leaflet (L) is not loaded yet.');
      return null;
    }

    const cfg = { ...activeConfig, ...(options.config || {}) };
    const specs = getProviderSpecs(cfg);
    const layerType = options.type || 'street';

    if (layerType === 'satellite') {
      const sat = L.tileLayer(specs.satellite.url, { ...specs.satellite.options, ...options });
      if (map) sat.addTo(map);
      return sat;
    }
    if (layerType === 'terrain') {
      const ter = L.tileLayer(specs.terrain.url, { ...specs.terrain.options, ...options });
      if (map) ter.addTo(map);
      return ter;
    }
    if (layerType === 'topo') {
      const top = L.tileLayer(specs.topo.url, { ...specs.topo.options, ...options });
      if (map) top.addTo(map);
      return top;
    }

    // Street layer with self-healing fallback chain: Primary -> CARTO -> Esri Topo -> Esri Satellite
    const fallbackChain = [
      specs.carto,
      specs.topo,
      specs.satellite
    ];

    let currentLayer = null;
    let fallbackIndex = 0;
    let isFailingOver = false;

    function buildLayer(providerSpec) {
      const layer = L.tileLayer(providerSpec.url, {
        ...providerSpec.options,
        ...options
      });

      let tileErrors = 0;
      layer.on('tileerror', function (errorEvent) {
        tileErrors++;
        // If 2 or more tiles fail, trigger automatic fallback
        if (tileErrors >= 2 && !isFailingOver && fallbackIndex < fallbackChain.length) {
          isFailingOver = true;
          const nextProvider = fallbackChain[fallbackIndex++];
          
          setTimeout(() => {
            if (!map) return;
            try {
              const nextLayer = buildLayer(nextProvider);
              if (map.hasLayer(layer)) {
                map.removeLayer(layer);
              }
              nextLayer.addTo(map);
              if (typeof nextLayer.bringToBack === 'function') {
                nextLayer.bringToBack();
              }
              currentLayer = nextLayer;
              map.__activeTileLayer = nextLayer;

              // Notify any listeners
              window.dispatchEvent(new CustomEvent('dr:tile-fallback-triggered', {
                detail: {
                  provider: nextProvider.name,
                  url: nextProvider.url
                }
              }));
            } catch (err) {
              // silent failover
            } finally {
              isFailingOver = false;
            }
          }, 50);
        }
      });

      return layer;
    }

    currentLayer = buildLayer(specs.street);
    if (map) {
      currentLayer.addTo(map);
      if (typeof currentLayer.bringToBack === 'function') {
        currentLayer.bringToBack();
      }
      map.__activeTileLayer = currentLayer;
    }

    return currentLayer;
  }

  /**
   * Sets up automated map.invalidateSize() triggers for:
   * 1. Container visibility and dimensions (ResizeObserver & IntersectionObserver)
   * 2. Window resizing
   * 3. Dark/Light Theme toggles
   * 4. Multi-language switching
   */
  function setupMapWatchers(map, container) {
    if (!map) return;
    const el = typeof container === 'string' ? document.getElementById(container) : (container || map.getContainer());
    if (!el) return;

    function safeInvalidate() {
      try {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: false });
        }
      } catch (_) {}
    }

    // 1. ResizeObserver for dynamic layout changes
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        safeInvalidate();
      });
      ro.observe(el);
    }

    // 2. IntersectionObserver for wizard step transitions & visibility
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            safeInvalidate();
          }
        });
      }, { threshold: 0.1 });
      io.observe(el);
    }

    // 3. Window resize
    window.addEventListener('resize', safeInvalidate);

    // 4. Dark/Light Theme Change Watcher
    const themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class' || m.attributeName === 'data-theme') {
          setTimeout(safeInvalidate, 50);
          break;
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    // 5. Language & Theme LocalStorage changes
    window.addEventListener('storage', (e) => {
      if (e.key === 'dr_lang' || e.key === 'dr_theme' || e.key === 'theme') {
        setTimeout(safeInvalidate, 100);
      }
    });

    window.addEventListener('dr:lang-change', () => {
      setTimeout(safeInvalidate, 100);
    });

    // Initial delayed invalidate to catch post-render reflows
    setTimeout(safeInvalidate, 100);
    setTimeout(safeInvalidate, 500);
  }

  /**
   * Layer switcher helper (Street, Satellite, Terrain)
   */
  function createLayers(map) {
    const L = window.L;
    if (!L) return null;
    const cfg = activeConfig;
    const specs = getProviderSpecs(cfg);

    const streetLayer = createRobustTileLayer(map, { type: 'street' });
    const satLayer = L.tileLayer(specs.satellite.url, specs.satellite.options);
    const terrainLayer = L.tileLayer(specs.terrain.url, specs.terrain.options);

    const baseLayers = {
      'Street (सड़क मार्ग)': streetLayer,
      'Satellite (उपग्रह)': satLayer,
      'Terrain (भूभाग)': terrainLayer
    };

    return {
      baseLayers,
      street: streetLayer,
      satellite: satLayer,
      terrain: terrainLayer,
      addToMap: (controlOptions = { position: 'topright' }) => {
        if (map) {
          return L.control.layers(baseLayers, null, controlOptions).addTo(map);
        }
        return null;
      }
    };
  }

  /**
   * High-level map initializer
   */
  function initMap(container, options = {}) {
    const L = window.L;
    if (!L) throw new Error('Leaflet library is required.');

    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) throw new Error('Container element not found for map.');

    const center = options.center || [20.5937, 78.9629];
    const zoom = options.zoom || 5;

    const map = L.map(el, {
      center,
      zoom,
      zoomControl: options.zoomControl !== false,
      ...options
    });

    createRobustTileLayer(map, options);
    setupMapWatchers(map, el);

    return map;
  }

  // 5. Expose globally
  const DisasterReadyMapTiles = {
    getConfig: () => activeConfig,
    fetchConfig,
    createTileLayer: createRobustTileLayer,
    setupMapWatchers,
    createLayers,
    initMap,
    getProviderSpecs: () => getProviderSpecs(activeConfig)
  };

  window.DisasterReadyMapTiles = DisasterReadyMapTiles;

  // 6. Monkey-patch DR.maps if api-client is loaded or loads later
  function patchDrMaps() {
    if (window.DisasterReadyAPI && window.DisasterReadyAPI.maps) {
      const maps = window.DisasterReadyAPI.maps;
      maps.createMap = function (container, options = {}) {
        return initMap(container, options);
      };
      maps.createTileLayer = function (map, options) {
        return createRobustTileLayer(map, options);
      };
      maps.setupMapWatchers = function (map, container) {
        return setupMapWatchers(map, container);
      };
      maps.createLayers = function (map) {
        return createLayers(map);
      };
    }
  }

  patchDrMaps();
  window.addEventListener('DOMContentLoaded', patchDrMaps);

})(window, document);
