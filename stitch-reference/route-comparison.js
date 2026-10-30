document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const DR = window.DisasterReadyAPI;
  const main = document.querySelector('main > div');
  if (!DR || !main) return;
  const sections = Array.from(main.children);
  const titleSection = sections[2];
  const mapContainer = document.getElementById('map-container');
  const directionsSection = sections[9];
  const actionSection = sections[12];
  const copilotButton = document.querySelector('[aria-label="Ask AI Copilot for Route Assistance"]');
  if (copilotButton) {
    copilotButton.removeAttribute('onclick');
    copilotButton.addEventListener('click', async () => {
      copilotButton.disabled = true;
      copilotButton.textContent = 'Consulting Copilot...';
      try {
        const origin = JSON.parse(sessionStorage.getItem('dr_route_origin') || 'null');
        const destination = JSON.parse(sessionStorage.getItem('dr_route_destination') || 'null');
        const res = await DR.copilot.chat({
          query: 'What is the risk assessment and safest available option for this evacuation path?',
          requestedTool: 'compare_routes',
          toolParameters: {
            origin: origin || { lat: 12.9716, lng: 77.5946 },
            destination: destination || { lat: 12.9766, lng: 77.5996 },
            travelMode: 'WALK',
          },
        });
        alert(`DisasterReady AI Copilot:\n\n${res.response}\n\n[Official Safety Notice]: ${res.safetyDisclaimer}`);
      } catch (err) {
        DR.ui.toast(err.message || 'Route assistance unavailable. If floodwaters are rising, seek high ground immediately.');
      } finally {
        copilotButton.disabled = false;
        copilotButton.textContent = 'Ask AI Copilot for Route Assistance';
      }
    });
  }
  let comparison = null;
  const origin = JSON.parse(sessionStorage.getItem('dr_route_origin') || 'null');
  const destination = JSON.parse(sessionStorage.getItem('dr_route_destination') || 'null');
  let selectedRouteId = comparison?.recommendedRouteId || comparison?.alternatives?.[0]?.routeId;
  let monitorTimer;
  const polylines = new Map();

  [sections[3], sections[4], sections[5], sections[6], sections[7], sections[10], sections[11]].forEach(section => {
    if (section) section.hidden = true;
  });
  if (sections[1]) {
    sections[1].replaceChildren();
    sections[1].textContent = 'Route assessment source and freshness are shown with each provider result.';
  }
  const destinationText = titleSection?.querySelector('p.font-body-strong');
  if (destinationText && destination) {
    destinationText.textContent = `Destination: ${sessionStorage.getItem('dr_route_destination_label') || `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`}`;
  }

  const results = document.createElement('section');
  results.id = 'route-api-results';
  results.className = 'flex flex-col gap-3 mb-space-md';
  results.setAttribute('aria-live', 'polite');
  titleSection?.insertAdjacentElement('afterend', results);
  const mapStatus = document.createElement('p');
  mapStatus.id = 'google-route-map-status';
  mapStatus.className = 'p-2 font-caption text-caption text-on-surface-variant';
  mapContainer?.insertAdjacentElement('afterend', mapStatus);
  if (mapContainer) {
    mapContainer.replaceChildren();
    mapContainer.style.minHeight = '320px';
    mapContainer.setAttribute('aria-label', 'Google map showing provider route alternatives');
  }

  const formatDistance = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
  const formatDuration = value => {
    if (!value) return 'Travel time unavailable';
    const minutes = Math.round(value / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
  };

  function chooseRoute(routeId) {
    selectedRouteId = routeId;
    results.querySelectorAll('[data-route-card]').forEach(card => {
      const selected = card.dataset.routeCard === routeId;
      card.classList.toggle('bg-surface-container-low', selected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = selected;
    });
    polylines.forEach((line, id) => line.setOptions({ strokeWeight: id === routeId ? 8 : 5, zIndex: id === routeId ? 3 : 1 }));
  }

  async function drawMap(routes) {
    if (!mapContainer || !routes.length) return;
    try {
      await DR.maps.load();
      const map = new window.google.maps.Map(mapContainer, {
        center: routes[0].coordinates[0], zoom: 13, mapTypeControl: false, streetViewControl: false,
      });
      const bounds = new window.google.maps.LatLngBounds();
      routes.forEach((route, index) => {
        const path = route.coordinates.map(({ lat, lng }) => ({ lat, lng }));
        path.forEach(point => bounds.extend(point));
        polylines.set(route.routeId, new window.google.maps.Polyline({
          path, map, geodesic: true, strokeColor: ['#00512c', '#ba1a1a', '#0b5fa5'][index % 3], strokeOpacity: 0.9, strokeWeight: 5,
        }));
      });
      if (origin) new window.google.maps.Marker({ map, position: origin, title: 'Selected origin' });
      if (destination) new window.google.maps.Marker({ map, position: destination, title: 'Selected destination' });
      map.fitBounds(bounds, 32);
      mapStatus.textContent = 'Google Maps • Route geometry from Google Routes API. Hazard intersections are assessed by DisasterReady.';
    } catch (error) {
      mapStatus.textContent = error.message || 'Google Maps JavaScript is unavailable. The map is not displayed.';
    }
  }

  function render(data) {
    comparison = data;
    polylines.clear();
    results.replaceChildren();
    if (!data?.alternatives?.length) {
      results.textContent = 'No provider route alternatives are available. Return to journey selection and retry when routing is available.';
      if (mapContainer) mapContainer.hidden = true;
      return;
    }
    if (mapContainer) mapContainer.hidden = false;
    selectedRouteId = data.recommendedRouteId || data.alternatives[0].routeId;
    const banner = document.createElement('p');
    banner.className = data.noReliablyLowRiskRoute ? 'p-3 rounded-lg bg-error-container text-on-error-container' : 'p-3 rounded-lg bg-surface-container-high';
    banner.textContent = `${data.message} Source: ${data.source}. Fetched ${new Date(data.fetchedAt).toLocaleString()}.`;
    results.append(banner);
    if (data.noReliablyLowRiskRoute) {
      const warning = document.createElement('strong');
      warning.className = 'text-error';
      warning.textContent = 'No reliably low-risk route is currently available.';
      results.append(warning);
    }
    const cards = document.createElement('div');
    cards.className = 'flex flex-col gap-3';
    cards.setAttribute('role', 'radiogroup');
    cards.setAttribute('aria-label', 'Google route alternatives assessed against recorded hazards');
    data.alternatives.forEach(route => {
      const card = document.createElement('article');
      card.dataset.routeCard = route.routeId;
      card.className = 'p-3 border border-outline-variant rounded-lg bg-surface-container-lowest';
      const head = document.createElement('div');
      head.className = 'flex items-start gap-3';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'provider-route';
      radio.value = route.routeId;
      radio.setAttribute('aria-label', `Select ${route.label}`);
      radio.addEventListener('change', () => chooseRoute(route.routeId));
      const title = document.createElement('h2');
      title.className = 'font-headline-sm text-headline-sm';
      title.textContent = `Route ${route.rank}: ${route.label}`;
      head.append(radio, title);
      card.append(head);
      const details = [
        `${formatDistance(route.distanceMeters)} • ${formatDuration(route.durationSeconds)} • Risk score ${route.riskScore}/100`,
        `${route.hazardExposureMeters} m verified hazard exposure • ${route.hazardIntersections.length} polygon intersections • ${route.confirmedClosures} recorded closures`,
        route.riskExplanation,
        `${route.source} • Risk data updated ${new Date(route.dataUpdatedAt).toLocaleString()}`,
      ];
      details.forEach((text, index) => {
        const paragraph = document.createElement('p');
        paragraph.className = index === 3 ? 'font-caption text-caption text-on-surface-variant' : 'font-caption text-caption';
        paragraph.textContent = text;
        card.append(paragraph);
      });
      if (route.hazardIntersections.length) {
        const hazardList = document.createElement('ul');
        hazardList.className = 'list-disc pl-5 font-caption text-caption';
        route.hazardIntersections.forEach(hit => {
          const item = document.createElement('li');
          item.textContent = `${hit.hazardType || 'Hazard'} • ${hit.severity || 'severity not recorded'} • ${hit.verification} • updated ${new Date(hit.lastUpdated).toLocaleString()}`;
          hazardList.append(item);
        });
        card.append(hazardList);
      }
      if (route.roadClosures.length) {
        const closureList = document.createElement('ul');
        closureList.className = 'list-disc pl-5 font-caption text-caption text-error';
        route.roadClosures.forEach(closure => {
          const item = document.createElement('li');
          item.textContent = `${closure.status.replaceAll('_', ' ')} • recorded ${new Date(closure.lastUpdated).toLocaleString()}`;
          closureList.append(item);
        });
        card.append(closureList);
      }
      const factorSummary = document.createElement('p');
      factorSummary.className = 'font-caption text-caption';
      factorSummary.textContent = `Score factors: severity ${route.riskFactors.severity.toFixed(2)}, exposure ${route.riskFactors.exposure.toFixed(2)}, closures ${route.riskFactors.closure.toFixed(2)}, freshness ${route.riskFactors.freshness.toFixed(2)}, uncertainty ${route.riskFactors.uncertainty.toFixed(2)}.`;
      card.append(factorSummary);
      if (route.nearbyUnverifiedReports.length) {
        const note = document.createElement('p');
        note.className = 'font-caption text-caption text-secondary';
        note.textContent = `${route.nearbyUnverifiedReports.length} nearby unverified report(s); not treated as confirmed closures.`;
        card.append(note);
      }
      if (route.instructions.length) {
        const disclosure = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Route directions';
        const list = document.createElement('ol');
        list.className = 'list-decimal pl-5 font-caption text-caption';
        route.instructions.forEach(text => {
          const item = document.createElement('li');
          item.textContent = text;
          list.append(item);
        });
        disclosure.append(summary, list);
        card.append(disclosure);
      }
      cards.append(card);
    });
    results.append(cards);
    const weights = data.riskModel.weights;
    const model = document.createElement('p');
    model.className = 'font-caption text-caption text-on-surface-variant';
    model.textContent = `Risk weights: severity ${weights.severity}, exposure ${weights.exposure}, closure ${weights.closure}, freshness ${weights.freshness}, uncertainty ${weights.uncertainty}. ${data.riskModel.note}`;
    results.append(model);

    const monitor = document.createElement('section');
    monitor.className = 'flex flex-col gap-2 p-3 border border-outline-variant rounded-lg';
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 font-label-strong text-label-strong';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    const labelText = document.createElement('span');
    labelText.textContent = 'Monitor this route for recorded hazard or closure changes';
    label.append(toggle, labelText);
    const monitorStatus = document.createElement('p');
    monitorStatus.className = 'font-caption text-caption';
    monitor.append(label, monitorStatus);
    const recalculate = document.createElement('button');
    recalculate.type = 'button';
    recalculate.className = 'min-h-[44px] px-3 rounded-lg bg-primary text-on-primary font-label-strong';
    recalculate.textContent = 'Recalculate route alternatives';
    recalculate.addEventListener('click', async () => {
      if (!origin || !destination) return;
      recalculate.disabled = true;
      try {
        const updated = await DR.routing.compare({ origin, destination, travelMode: sessionStorage.getItem('dr_route_mode') || 'WALK' });
        render(updated);
      } catch (error) {
        monitorStatus.textContent = error.message || 'Route provider unavailable. No replacement routes were generated.';
      } finally {
        recalculate.disabled = false;
      }
    });
    monitor.append(recalculate);
    toggle.addEventListener('change', () => {
      clearInterval(monitorTimer);
      if (!toggle.checked) {
        monitorStatus.textContent = 'Route monitoring is off.';
        return;
      }
      monitorStatus.textContent = 'Checking recorded hazards and closures every 60 seconds. Minor GPS movement does not trigger recalculation.';
      const initialRoute = comparison.alternatives.find(route => route.routeId === selectedRouteId);
      let knownFeatureIds = [...initialRoute.hazardIntersections.map(item => item.id), ...initialRoute.roadClosures.map(item => item.id)];
      let previousRiskScore = initialRoute.riskScore;
      let previousFreshness = initialRoute.riskFactors.freshness;
      monitorTimer = setInterval(async () => {
        const route = comparison.alternatives.find(item => item.routeId === selectedRouteId);
        if (!route) return;
        try {
          const update = await DR.routing.checkRisk({ coordinates: route.coordinates, knownFeatureIds, previousRiskScore, previousFreshness });
          knownFeatureIds = update.currentFeatureIds;
          previousRiskScore = update.riskScore;
          previousFreshness = update.freshness;
          monitorStatus.textContent = update.materialChange
            ? `${update.message} Risk ${update.riskDelta >= 0 ? '+' : ''}${update.riskDelta} points.`
            : `${update.message} Checked ${new Date(update.checkedAt).toLocaleTimeString()}.`;
        } catch (error) {
          monitorStatus.textContent = error.message || 'Risk updates unavailable; do not assume route conditions are unchanged.';
        }
      }, 60000);
    });
    results.append(monitor);
    const start = actionSection?.querySelector('button[onclick="proceedToNavigation()"]');
    if (start) {
      start.textContent = 'Open navigation in Google Maps';
      start.removeAttribute('onclick');
      start.addEventListener('click', () => {
        if (!origin || !destination) return;
        const travelmode = sessionStorage.getItem('dr_route_mode') === 'WALK' ? 'walking' : 'driving';
        const params = new URLSearchParams({ api: '1', origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`, travelmode });
        window.open(`https://www.google.com/maps/dir/?${params}`, '_blank', 'noopener,noreferrer');
        monitorStatus.textContent = 'Google Maps calculates navigation independently. Its directions may differ from this risk assessment.';
      });
    }
    chooseRoute(selectedRouteId);
    drawMap(data.alternatives);
  }

  if (!comparison?.alternatives?.length) {
    results.textContent = origin && destination
      ? 'Requesting fresh Google route alternatives and checking recorded hazard data…'
      : 'Origin or destination is missing. Return to journey selection and choose both locations.';
    if (mapContainer) mapContainer.hidden = true;
    if (directionsSection) directionsSection.hidden = true;
    if (actionSection) actionSection.hidden = true;
    if (origin && destination) {
      DR.routing.compare({ origin, destination, travelMode: sessionStorage.getItem('dr_route_mode') || 'WALK' })
        .then(render)
        .catch(error => { results.textContent = error.message || 'Route provider unavailable. No route was generated.'; });
    }
    return;
  }
  if (directionsSection) directionsSection.hidden = true;
  render(comparison);
  window.addEventListener('beforeunload', () => clearInterval(monitorTimer));
});