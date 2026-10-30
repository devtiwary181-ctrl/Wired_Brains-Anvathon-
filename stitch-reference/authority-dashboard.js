(function () {
  'use strict';

  const API_BASE = window.DR_API_BASE || 'http://localhost:5001/api/v1';
  const stage = document.getElementById('stage-panel-1');
  if (!stage) return;

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.error?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.code = body?.error?.code;
      throw error;
    }
    return body?.data;
  }

  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value == null ? 'Unknown' : String(value);
    if (className) node.className = className;
    return node;
  }

  const liveRegion = document.createElement('section');
  liveRegion.id = 'authority-live-operations';
  liveRegion.className = 'flex flex-col gap-space-sm p-space-sm rounded-lg border border-surface-variant bg-surface-container-lowest';
  liveRegion.setAttribute('aria-live', 'polite');
  const panelTitle = text('h2', 'Live authority operations', 'font-headline-sm text-headline-sm');
  const message = text('p', 'Loading database-backed authority records…', 'font-caption text-caption text-on-surface-variant');
  const metricGrid = document.createElement('div');
  metricGrid.className = 'grid grid-cols-2 md:grid-cols-4 gap-2';
  const inventory = document.createElement('div');
  inventory.className = 'flex flex-col gap-1';
  const facilityStatus = document.createElement('div');
  facilityStatus.className = 'flex flex-wrap gap-2';
  const recent = document.createElement('ol');
  recent.className = 'flex flex-col gap-1';
  const operations = document.createElement('div');
  operations.id = 'authority-operation-panels';
  operations.className = 'flex flex-col gap-2';
  liveRegion.append(panelTitle, message, metricGrid, text('h3', 'Facilities', 'font-label-strong text-label-strong'), facilityStatus, text('h3', 'Inventory status', 'font-label-strong text-label-strong'), inventory, text('h3', 'Recent audited updates', 'font-label-strong text-label-strong'), recent, operations);
  stage.prepend(liveRegion);

  function operationPanel(title) {
    const details = document.createElement('details');
    details.className = 'border border-surface-variant rounded-lg bg-surface-container-lowest';
    const summary = text('summary', title, 'p-2 cursor-pointer font-label-strong text-label-strong');
    const body = document.createElement('div');
    body.className = 'p-2 flex flex-col gap-2';
    details.append(summary, body);
    operations.append(details);
    return body;
  }

  const incidentOps = operationPanel('Incident management');
  const alertOps = operationPanel('Official alerts');
  const facilityOps = operationPanel('Facility operations');
  const requestOps = operationPanel('Supply request triage');
  const inventoryOps = operationPanel('Inventory adjustments');
  const staffOps = operationPanel('Staff and role management');
  const sosOps = operationPanel('SOS records');

  function inputField(label, type = 'text', options = {}) {
    const wrapper = document.createElement('label');
    wrapper.className = 'flex flex-col gap-1 font-caption text-caption';
    wrapper.append(document.createTextNode(label));
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.required = options.required !== false;
    input.maxLength = options.maxLength || 500;
    input.className = 'min-h-[40px] px-2 py-1 border border-outline-variant rounded bg-surface';
    wrapper.append(input);
    return { wrapper, input };
  }

  function selectField(label, values) {
    const wrapper = document.createElement('label');
    wrapper.className = 'flex flex-col gap-1 font-caption text-caption';
    wrapper.append(document.createTextNode(label));
    const select = document.createElement('select');
    select.className = 'min-h-[40px] px-2 border border-outline-variant rounded bg-surface';
    values.forEach(([value, name]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      select.append(option);
    });
    wrapper.append(select);
    return { wrapper, select };
  }

  function statusMessage(container, value, isError = false) {
    let node = container.querySelector('[data-operation-status]');
    if (!node) {
      node = document.createElement('p');
      node.dataset.operationStatus = 'true';
      node.setAttribute('role', 'status');
      container.append(node);
    }
    node.className = `font-caption text-caption ${isError ? 'text-error' : 'text-on-surface-variant'}`;
    node.textContent = value;
  }

  function actionButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'min-h-[40px] px-3 rounded bg-primary text-on-primary font-label-strong text-label-strong';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  const incidentList = document.createElement('div');
  incidentList.className = 'flex flex-col gap-2';
  incidentOps.append(incidentList);
  const newIncidentForm = document.createElement('form');
  newIncidentForm.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-surface-container-low rounded';
  const incidentType = selectField('Hazard type', [['WATERLOGGING', 'Waterlogging'], ['LANDSLIDE', 'Landslide'], ['FALLEN_TREE', 'Fallen tree'], ['LIVE_WIRE', 'Live wire'], ['BRIDGE_SUBMERGED', 'Bridge'], ['FIRE', 'Fire'], ['BUILDING_COLLAPSE', 'Building collapse']]);
  const incidentSeverity = selectField('Severity', [['LOW', 'Low'], ['MODERATE', 'Moderate'], ['SEVERE', 'Severe'], ['CRITICAL', 'Critical']]);
  const incidentLat = inputField('Latitude', 'number'); incidentLat.input.step = 'any';
  const incidentLng = inputField('Longitude', 'number'); incidentLng.input.step = 'any';
  const incidentLandmark = inputField('Landmark', 'text', { required: false });
  const incidentDescription = inputField('Description', 'textarea', { required: false, maxLength: 2000 });
  const incidentNotes = inputField('Operational note', 'textarea', { required: false, maxLength: 2000 });
  const incidentStatus = selectField('Initial status', [['UNVERIFIED', 'Unverified'], ['VERIFIED_ACTIVE', 'Official active']]);
  const incidentAssignee = selectField('Assign staff member', [['', 'Unassigned']]);
  const affectedAreaCoordinates = inputField('Affected area polygon as JSON [[lat,lng], ...] (optional)', 'textarea', { required: false, maxLength: 12000 });
  const affectedAreaType = selectField('Affected area type', [['INUNDATION_ZONE', 'Inundation zone'], ['EVACUATION_CORRIDOR_CLOSED', 'Evacuation corridor closed'], ['DEBRIS_FIELD', 'Debris field']]);
  const affectedAreaDepth = inputField('Affected area depth in metres', 'number', { required: false });
  affectedAreaDepth.input.step = 'any';
  const incidentSubmit = document.createElement('button');
  incidentSubmit.type = 'submit';
  incidentSubmit.className = 'min-h-[40px] px-3 rounded bg-primary text-on-primary font-label-strong';
  incidentSubmit.textContent = 'Create incident';
  [incidentType.wrapper, incidentSeverity.wrapper, incidentLat.wrapper, incidentLng.wrapper, incidentLandmark.wrapper, incidentDescription.wrapper, incidentNotes.wrapper, incidentStatus.wrapper, incidentAssignee.wrapper, affectedAreaCoordinates.wrapper, affectedAreaType.wrapper, affectedAreaDepth.wrapper, incidentSubmit].forEach(node => newIncidentForm.append(node));
  newIncidentForm.addEventListener('submit', async event => {
    event.preventDefault();
    incidentSubmit.disabled = true;
    try {
      let affectedArea;
      if (affectedAreaCoordinates.input.value.trim()) {
        affectedArea = {
          coordinates: JSON.parse(affectedAreaCoordinates.input.value),
          zoneType: affectedAreaType.select.value,
          depthM: affectedAreaDepth.input.value ? Number(affectedAreaDepth.input.value) : undefined,
        };
      }
      await api('/authority/incidents', { method: 'POST', body: JSON.stringify({
        hazardType: incidentType.select.value,
        severity: incidentSeverity.select.value,
        latitude: Number(incidentLat.input.value),
        longitude: Number(incidentLng.input.value),
        addressLandmark: incidentLandmark.input.value || undefined,
        description: incidentDescription.input.value || undefined,
        notes: incidentNotes.input.value || undefined,
        status: incidentStatus.select.value,
        assignedStaffId: incidentAssignee.select.value || undefined,
        affectedArea,
      }) });
      statusMessage(incidentOps, 'Incident created and audit logged.');
      await refresh();
    } catch (error) { statusMessage(incidentOps, error.message, true); }
    finally { incidentSubmit.disabled = false; }
  });
  incidentOps.append(text('h4', 'Create incident', 'font-label-strong text-label-strong'), newIncidentForm);

  const alertList = document.createElement('div');
  alertList.className = 'flex flex-col gap-1';
  const alertForm = document.createElement('form');
  alertForm.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-surface-container-low rounded';
  const alertTitle = inputField('Alert title');
  const alertSeverity = selectField('Severity', [['INFO', 'Info'], ['ADVISORY', 'Advisory'], ['WARNING', 'Warning'], ['DANGER', 'Danger'], ['EXTREME', 'Extreme']]);
  const alertType = selectField('Disaster type', [['FLOOD', 'Flood'], ['CYCLONE', 'Cyclone'], ['EARTHQUAKE', 'Earthquake'], ['LANDSLIDE', 'Landslide'], ['FIRE', 'Fire']]);
  const alertSummary = inputField('Summary', 'textarea', { maxLength: 2000 });
  const alertInstructions = inputField('Public instructions', 'textarea', { maxLength: 4000 });
  const alertAgency = inputField('Issuing agency', 'text');
  const alertExpiry = inputField('Expiry', 'datetime-local', { required: false });
  const alertLanguage = inputField('Translation language code (optional)', 'text', { required: false, maxLength: 10 });
  const alertTranslatedTitle = inputField('Translated title (optional)', 'text', { required: false });
  const alertTranslatedSummary = inputField('Translated summary (optional)', 'textarea', { required: false, maxLength: 2000 });
  const alertTranslatedInstructions = inputField('Translated instructions (optional)', 'textarea', { required: false, maxLength: 4000 });
  const alertPublish = document.createElement('input');
  alertPublish.type = 'checkbox';
  const alertPublishLabel = document.createElement('label');
  alertPublishLabel.className = 'flex items-center gap-2 font-caption text-caption';
  alertPublishLabel.append(alertPublish, document.createTextNode('Publish publicly now (requires confirmation)'));
  const alertSubmit = document.createElement('button');
  alertSubmit.type = 'submit'; alertSubmit.className = 'min-h-[40px] px-3 rounded bg-primary text-on-primary font-label-strong'; alertSubmit.textContent = 'Save alert draft';
  [alertTitle.wrapper, alertSeverity.wrapper, alertType.wrapper, alertSummary.wrapper, alertInstructions.wrapper, alertAgency.wrapper, alertExpiry.wrapper, alertLanguage.wrapper, alertTranslatedTitle.wrapper, alertTranslatedSummary.wrapper, alertTranslatedInstructions.wrapper, alertPublishLabel, alertSubmit].forEach(node => alertForm.append(node));
  alertForm.addEventListener('submit', async event => {
    event.preventDefault();
    const publish = alertPublish.checked;
    if (publish && !window.confirm('Publish this alert to citizens now?')) return;
    const language = alertLanguage.input.value.trim();
    const translated = language && alertTranslatedTitle.input.value && alertTranslatedSummary.input.value && alertTranslatedInstructions.input.value
      ? { [language]: { title: alertTranslatedTitle.input.value, summary: alertTranslatedSummary.input.value, instructions: alertTranslatedInstructions.input.value } }
      : undefined;
    alertSubmit.disabled = true;
    try {
      await api('/authority/alerts', { method: 'POST', body: JSON.stringify({
        title: alertTitle.input.value,
        severity: alertSeverity.select.value,
        disasterType: alertType.select.value,
        summary: alertSummary.input.value,
        instructions: alertInstructions.input.value,
        sourceAgency: alertAgency.input.value,
        expiresAt: alertExpiry.input.value ? new Date(alertExpiry.input.value).toISOString() : undefined,
        publish,
        confirmationText: publish ? 'PUBLISH' : undefined,
        translations: translated,
      }) });
      statusMessage(alertOps, publish ? 'Alert published and audit logged.' : 'Alert draft created.');
      alertForm.reset();
      await refresh();
    } catch (error) { statusMessage(alertOps, error.message, true); }
    finally { alertSubmit.disabled = false; }
  });
  alertOps.append(alertList, text('h4', 'Create alert', 'font-label-strong text-label-strong'), alertForm);

  const facilityList = document.createElement('div');
  facilityList.className = 'flex flex-col gap-2';
  facilityOps.append(facilityList);
  const facilityForm = document.createElement('form');
  facilityForm.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-surface-container-low rounded';
  const facilityType = selectField('Facility type', [['SHELTER', 'Shelter'], ['HOSPITAL', 'Hospital'], ['FOOD_WATER_POINT', 'Food/water point'], ['COMMUNITY_KITCHEN', 'Community kitchen']]);
  const facilityName = inputField('Name');
  const facilityAddress = inputField('Address');
  const facilityLat = inputField('Latitude', 'number'); facilityLat.input.step = 'any';
  const facilityLng = inputField('Longitude', 'number'); facilityLng.input.step = 'any';
  const facilityPhone = inputField('Verified contact phone');
  const facilityCapacity = inputField('Known total capacity', 'number');
  const facilityOccupancy = inputField('Known current occupancy', 'number');
  const facilityOperatingStatus = selectField('Operating status', [['OPERATIONAL', 'Operational'], ['FILLING_UP', 'Filling up'], ['FULL', 'Full'], ['DAMAGED_CLOSED', 'Damaged/closed'], ['UNKNOWN', 'Unknown']]);
  const facilityServices = ['hasMedicalSupport', 'hasGeneratorPower', 'hasDrinkingWater', 'hasInfantCare', 'isPetFriendly'].map(name => {
    const label = document.createElement('label'); label.className = 'flex items-center gap-2 font-caption text-caption';
    const input = document.createElement('input'); input.type = 'checkbox'; label.append(input, document.createTextNode(name.replace('has', '').replace(/([A-Z])/g, ' $1'))); return { name, input, label };
  });
  const facilitySubmit = document.createElement('button'); facilitySubmit.type = 'submit'; facilitySubmit.className = 'min-h-[40px] px-3 rounded bg-primary text-on-primary font-label-strong'; facilitySubmit.textContent = 'Add facility';
  [facilityType.wrapper, facilityName.wrapper, facilityAddress.wrapper, facilityLat.wrapper, facilityLng.wrapper, facilityPhone.wrapper, facilityCapacity.wrapper, facilityOccupancy.wrapper, facilityOperatingStatus.wrapper, ...facilityServices.map(item => item.label), facilitySubmit].forEach(node => facilityForm.append(node));
  facilityForm.addEventListener('submit', async event => {
    event.preventDefault(); facilitySubmit.disabled = true;
    try {
      const booleans = Object.fromEntries(facilityServices.map(item => [item.name, item.input.checked]));
      await api('/authority/facilities', { method: 'POST', body: JSON.stringify({
        facilityType: facilityType.select.value, name: facilityName.input.value, address: facilityAddress.input.value,
        latitude: Number(facilityLat.input.value), longitude: Number(facilityLng.input.value), contactPhone: facilityPhone.input.value,
        totalCapacity: Number(facilityCapacity.input.value), currentOccupancy: Number(facilityOccupancy.input.value), operatingStatus: facilityOperatingStatus.select.value, ...booleans,
      }) });
      statusMessage(facilityOps, 'Facility added and audit logged.'); facilityForm.reset(); await refresh();
    } catch (error) { statusMessage(facilityOps, error.message, true); }
    finally { facilitySubmit.disabled = false; }
  });
  facilityOps.append(text('h4', 'Add facility with known values', 'font-label-strong text-label-strong'), facilityForm);

  const requestList = document.createElement('div'); requestList.className = 'flex flex-col gap-2'; requestOps.append(requestList);
  const inventoryList = document.createElement('div'); inventoryList.className = 'flex flex-col gap-2'; inventoryOps.append(inventoryList);
  const staffList = document.createElement('div'); staffList.className = 'flex flex-col gap-2'; staffOps.append(staffList);
  const sosList = document.createElement('div'); sosList.className = 'flex flex-col gap-2'; sosOps.append(sosList);
  const staffForm = document.createElement('form'); staffForm.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-surface-container-low rounded';
  const staffUsername = inputField('Username');
  const staffName = inputField('Full name');
  const staffEmail = inputField('Email', 'email');
  const staffPhone = inputField('Phone number', 'tel');
  const staffPassword = inputField('Temporary password (12+ characters)', 'password', { maxLength: 128 });
  const staffRole = selectField('Role', [['DATA_OPERATOR', 'Data operator'], ['FIELD_COMMANDER', 'Field commander'], ['LOGISTICS_OFFICER', 'Logistics officer'], ['EOC_DIRECTOR', 'EOC director']]);
  const staffSubmit = document.createElement('button'); staffSubmit.type = 'submit'; staffSubmit.className = 'min-h-[40px] px-3 rounded bg-primary text-on-primary font-label-strong'; staffSubmit.textContent = 'Create staff account';
  [staffUsername.wrapper, staffName.wrapper, staffEmail.wrapper, staffPhone.wrapper, staffPassword.wrapper, staffRole.wrapper, staffSubmit].forEach(node => staffForm.append(node));
  staffForm.addEventListener('submit', async event => {
    event.preventDefault(); staffSubmit.disabled = true;
    try {
      await api('/authority/staff', { method: 'POST', body: JSON.stringify({ username: staffUsername.input.value, fullName: staffName.input.value, email: staffEmail.input.value, phoneNumber: staffPhone.input.value, password: staffPassword.input.value, role: staffRole.select.value }) });
      statusMessage(staffOps, 'Staff account created. Permissions follow the assigned role.'); staffForm.reset(); await refresh();
    } catch (error) { statusMessage(staffOps, error.message, true); }
    finally { staffSubmit.disabled = false; }
  });
  staffOps.append(text('h4', 'Create staff account', 'font-label-strong text-label-strong'), staffForm);

  const queueHeading = [...stage.querySelectorAll('h3')].find(heading => /Hazard Reports for Verification/i.test(heading.textContent || ''));
  const queueCard = queueHeading?.closest('.bg-surface-container-lowest');
  const queueBody = queueCard?.querySelector('.flex.flex-col.gap-space-sm');
  const queueCount = queueHeading?.parentElement?.nextElementSibling;

  function updateSummaryTile(labelPattern, label, value, detail) {
    const tile = [...stage.querySelectorAll('.grid > div')].find(card => labelPattern.test(card.querySelector('.font-label-default')?.textContent || ''));
    if (!tile) return;
    const labelNode = tile.querySelector('.font-label-default');
    const valueNode = tile.querySelector('.font-headline-lg');
    const detailNode = tile.querySelector('.mt-space-xs');
    const badges = tile.querySelectorAll('.font-caption');
    if (labelNode) labelNode.textContent = label;
    if (valueNode) valueNode.textContent = value == null ? 'Not available' : String(value);
    if (detailNode) detailNode.textContent = detail;
    if (badges.length) badges[0].textContent = 'Database records';
  }

  function updateMetric(label, value, detail) {
    const metric = document.createElement('article');
    metric.className = 'p-2 rounded bg-surface-container-low';
    metric.append(text('span', label, 'block font-caption text-caption text-on-surface-variant'), text('strong', value ?? 'Not available', 'block font-headline-sm text-headline-sm'), text('span', detail, 'block font-caption text-caption'));
    metricGrid.append(metric);
  }

  function renderQueue(records) {
    if (!queueBody) return;
    queueBody.replaceChildren();
    if (!records.length) {
      queueBody.append(text('p', 'No reports are pending verification.', 'font-caption text-caption text-on-surface-variant'));
      if (queueCount) queueCount.textContent = '0 Pending Review';
      return;
    }
    if (queueCount) queueCount.textContent = `${records.length} Pending Review`;
    records.forEach(record => {
      const card = document.createElement('article');
      card.className = 'p-space-sm bg-surface rounded flex flex-col gap-space-xs border border-surface-variant';
      card.dataset.hazardId = record.id;
      const heading = text('h4', `${record.hazardType.replaceAll('_', ' ')} • ${record.severity}`, 'font-label-strong text-label-strong text-on-surface');
      const district = record.district ? `${record.district.name}, ${record.district.state}` : 'District not assigned';
      card.append(heading, text('p', `${record.addressLandmark || 'Location description unavailable'} • ${district}`, 'font-caption text-caption text-on-surface-variant'));
      if (record.description) card.append(text('p', record.description, 'font-body-default text-body-default'));
      if (record.waterDepthCm > 0) card.append(text('p', `Reported water depth: ${record.waterDepthCm} cm`, 'font-caption text-caption'));
      card.append(text('p', `Observed ${record.observedAt ? new Date(record.observedAt).toLocaleString() : 'time not supplied'} • Submitted ${new Date(record.createdAt).toLocaleString()}`, 'font-caption text-caption text-on-surface-variant'));
      if (record.evidence?.length) {
        const evidenceList = document.createElement('ul');
        evidenceList.className = 'flex flex-wrap gap-2';
        record.evidence.forEach(evidence => {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.href = evidence.mediaUrl.startsWith('http') ? evidence.mediaUrl : `${window.location.origin}${evidence.mediaUrl}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = `Evidence (${evidence.mediaType})`;
          link.className = 'text-primary underline font-caption text-caption';
          item.append(link);
          evidenceList.append(item);
        });
        card.append(evidenceList);
      }
      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap items-center justify-between gap-2';
      const locationLink = document.createElement('a');
      locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${record.coordinates.lat},${record.coordinates.lng}`)}`;
      locationLink.target = '_blank';
      locationLink.rel = 'noopener noreferrer';
      locationLink.textContent = `Inspect location (${record.coordinates.lat.toFixed(5)}, ${record.coordinates.lng.toFixed(5)})`;
      locationLink.className = 'text-primary underline font-caption text-caption';
      const buttons = document.createElement('div');
      buttons.className = 'flex gap-2';
      [['REJECT', 'Reject'], ['VERIFY', 'Verify official']].forEach(([decision, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.className = decision === 'VERIFY' ? 'px-2 py-1 bg-primary text-on-primary rounded font-label-strong' : 'px-2 py-1 bg-surface-container-highest rounded font-caption';
        button.addEventListener('click', async () => {
          const reason = window.prompt(`Required audit reason for ${label.toLowerCase()}:`);
          if (!reason || reason.trim().length < 5) {
            message.textContent = 'A reason of at least five characters is required. No change was made.';
            return;
          }
          button.disabled = true;
          try {
            await api(`/authority/hazards/${record.id}/decision`, {
              method: 'PATCH',
              body: JSON.stringify({ decision, reason: reason.trim() }),
            });
            message.textContent = `Report ${decision === 'VERIFY' ? 'verified' : 'rejected'} and audit logged.`;
            await refresh();
          } catch (error) {
            message.textContent = error.message;
            button.disabled = false;
          }
        });
        buttons.append(button);
      });
      actions.append(locationLink, buttons);
      card.append(actions);
      queueBody.append(card);
    });
  }

  async function refresh() {
    metricGrid.replaceChildren();
    facilityStatus.replaceChildren();
    inventory.replaceChildren();
    recent.replaceChildren();
    message.textContent = 'Loading database-backed authority records…';
    try {
      const data = await api('/authority/dashboard');
      const metrics = data.metrics;
      updateSummaryTile(/Total Emergency Requests/i, 'Open Supply Requests', metrics.openSupplyRequests, 'Requests not delivered or cancelled');
      updateSummaryTile(/People Affected \(Tracked\)/i, 'People in Open Supply Requests', metrics.trackedPeopleInOpenRequests, 'Headcounts from active request records');
      updateSummaryTile(/Requests Unmet \(Critical\)/i, 'Critical Requests Unallocated', metrics.criticalUnallocatedRequests, 'Critical life-safety requests awaiting allocation');
      updateSummaryTile(/Aggregate Stock Level/i, 'Inventory Line Items', data.inventory.length, 'Real inventory records; no minimum-stock threshold configured');
      updateMetric('Active incidents', metrics.activeIncidents, 'Verified active records');
      updateMetric('Active hazards', metrics.activeHazards, 'Verified and pending');
      updateMetric('Critical alerts', metrics.criticalAlerts, 'Published and active');
      updateMetric('Pending reports', metrics.pendingReports, 'Awaiting staff review');
      updateMetric('Verified reports', metrics.verifiedReports, 'Official active records');
      updateMetric('Unresolved SOS', metrics.unresolvedSos, metrics.unresolvedSos == null ? 'Not included in your permission scope' : 'Database records');
      updateMetric('Open supply requests', metrics.openSupplyRequests, 'Not delivered or cancelled');
      updateMetric('Scope', data.scope, data.districtId || 'No district assigned');
      data.facilities.forEach(item => facilityStatus.append(text('span', `${item.facilityType.replaceAll('_', ' ')} • ${item.status.replaceAll('_', ' ')}: ${item.count}`, 'px-2 py-1 rounded bg-surface-container text-caption font-caption')));
      if (!data.facilities.length) facilityStatus.append(text('span', 'Facility status not available for this role.', 'font-caption text-caption text-on-surface-variant'));
      data.inventory.forEach(item => inventory.append(text('p', `${item.depotName} • ${item.itemName}: ${item.quantityUnreserved} ${item.unit} unreserved (${item.quantityReserved} reserved) • Updated ${new Date(item.lastRestockedAt).toLocaleString()}`, 'font-caption text-caption')));
      if (!data.inventory.length) inventory.append(text('p', 'Inventory not available for this role.', 'font-caption text-caption text-on-surface-variant'));
      data.recentUpdates.forEach(item => recent.append(text('li', `${item.action} • ${item.entityType} • ${item.actor} • ${new Date(item.timestamp).toLocaleString()}`, 'font-caption text-caption')));
      if (!data.recentUpdates.length) recent.append(text('li', 'No audit updates available for this role.', 'font-caption text-caption text-on-surface-variant'));
      message.textContent = `${data.demoDataLabel} Updated ${new Date(data.fetchedAt).toLocaleString()}.`;
    } catch (error) {
      message.textContent = error.status === 401
        ? 'Staff sign-in required. Authenticate with the existing staff login before loading operations.'
        : error.status === 403
          ? 'Your account does not have authority dashboard permission.'
          : error.message;
    }

            await Promise.all([loadInventory(), loadStaff()]);

    try {
      const hazards = await api('/authority/hazards?status=UNVERIFIED');
      renderQueue(hazards);
    } catch (error) {
      if (queueBody) {
        queueBody.replaceChildren(text('p', error.status === 403 ? 'Hazard verification permission required.' : error.status === 401 ? 'Sign in to view the verification queue.' : error.message, 'font-caption text-caption text-on-surface-variant'));
        if (queueCount) queueCount.textContent = 'Unavailable';
      }
    }

    try {
      const incidents = await api('/authority/incidents');
      renderIncidentTable(incidents);
      await renderIncidentMap(incidents);
      renderIncidentOperations(incidents);
    } catch (error) {
      renderIncidentUnavailable(error);
      incidentList.replaceChildren(text('p', error.status === 403 ? 'Incident view permission required.' : error.status === 401 ? 'Sign in to view incidents.' : error.message, 'font-caption text-caption text-on-surface-variant'));
    }
    await Promise.all([loadAlerts(), loadFacilities(), loadReliefRequests(), loadSos()]);
  }

  function renderIncidentTable(records) {
    const container = document.getElementById('gis-table-container');
    if (!container) return;
    const table = document.createElement('table');
    table.className = 'w-full text-left font-label-default text-label-default';
    const head = document.createElement('thead');
    head.className = 'bg-surface-container font-label-strong text-label-strong text-on-surface';
    const headerRow = document.createElement('tr');
    ['Hazard', 'Severity', 'Location', 'Status', 'Last update'].forEach(value => headerRow.append(text('th', value, 'p-space-xs')));
    head.append(headerRow);
    const body = document.createElement('tbody');
    if (!records.length) {
      const row = document.createElement('tr');
      const cell = text('td', 'No incident records are available in your district scope.', 'p-space-xs font-caption text-caption');
      cell.colSpan = 5;
      row.append(cell);
      body.append(row);
    }
    records.forEach(record => {
      const row = document.createElement('tr');
      row.className = 'border-b border-surface-variant';
      [record.hazardType.replaceAll('_', ' '), record.severity, record.addressLandmark || `${record.coordinates.lat}, ${record.coordinates.lng}`, record.status.replaceAll('_', ' '), new Date(record.updatedAt).toLocaleString()].forEach(value => row.append(text('td', value, 'p-space-xs')));
      body.append(row);
    });
    table.append(head, body);
    container.replaceChildren(table);
  }

  function renderIncidentUnavailable(error) {
    const mapContainer = document.getElementById('gis-map-container');
    const tableContainer = document.getElementById('gis-table-container');
    const messageText = error.status === 401 ? 'Sign in to load authority incident data.' : error.status === 403 ? 'Incident view permission required.' : error.message;
    if (mapContainer) {
      mapContainer.replaceChildren(text('p', messageText, 'p-3 font-caption text-caption text-on-surface-variant'));
    }
    if (tableContainer) tableContainer.replaceChildren(text('p', messageText, 'p-3 font-caption text-caption text-on-surface-variant'));
  }

  function renderIncidentOperations(records) {
    incidentList.replaceChildren();
    if (!records.length) incidentList.append(text('p', 'No incidents are available in your scope.', 'font-caption text-caption text-on-surface-variant'));
    records.slice(0, 100).forEach(record => {
      const card = document.createElement('article'); card.className = 'p-2 border border-surface-variant rounded bg-surface';
      card.append(text('strong', `${record.hazardType.replaceAll('_', ' ')} • ${record.severity}`, 'font-label-strong text-label-strong'));
      card.append(text('p', `${record.addressLandmark || `${record.coordinates.lat}, ${record.coordinates.lng}`} • ${record.status.replaceAll('_', ' ')}`, 'font-caption text-caption'));
      if (record.operationalNotes) card.append(text('p', `Latest note: ${record.operationalNotes}`, 'font-caption text-caption text-on-surface-variant'));
      const controls = document.createElement('div'); controls.className = 'flex flex-wrap gap-2';
      const severity = selectField('Severity', [['LOW', 'Low'], ['MODERATE', 'Moderate'], ['SEVERE', 'Severe'], ['CRITICAL', 'Critical']]); severity.select.value = record.severity;
      const status = selectField('Status', [['UNVERIFIED', 'Unverified'], ['VERIFIED_ACTIVE', 'Verified active'], ['RESOLVED', 'Resolved / closed'], ['REJECTED', 'Rejected']]); status.select.value = record.status;
      const assignee = selectField('Assigned staff', [['', 'Unassigned'], ...cachedStaff.map(person => [person.id, `${person.fullName} • ${person.role}`])]);
      assignee.select.value = record.assignedStaffId || '';
      const update = actionButton('Save incident update', async () => {
        const notes = window.prompt('Operational note / reason for change (required):');
        if (!notes || notes.trim().length < 3) return;
        update.disabled = true;
        try {
          await api(`/authority/incidents/${record.id}`, { method: 'PATCH', body: JSON.stringify({ severity: severity.select.value, status: status.select.value, assignedStaffId: assignee.select.value || null, notes: notes.trim() }) });
          statusMessage(incidentOps, 'Incident updated; history recorded.'); await refresh();
        } catch (error) { statusMessage(incidentOps, error.message, true); update.disabled = false; }
      });
      controls.append(severity.wrapper, status.wrapper, assignee.wrapper, update);
      controls.append(actionButton('View incident history', async () => {
        try {
          const history = await api(`/authority/incidents/${record.id}/history`);
          window.alert(history.map(item => `${new Date(item.timestamp).toLocaleString()} • ${item.action} • ${item.staffUser?.fullName || 'Staff'} • ${JSON.stringify(item.metadata || {})}`).join('\n') || 'No incident history recorded.');
        } catch (error) { statusMessage(incidentOps, error.message, true); }
      }));
      card.append(controls);
      if (record.verifiedAt) card.append(text('p', `Verified by staff ${record.verifiedByStaffId || 'unknown'} at ${new Date(record.verifiedAt).toLocaleString()}`, 'font-caption text-caption text-on-surface-variant'));
      incidentList.append(card);
    });
  }

  async function loadAlerts() {
    alertList.replaceChildren();
    try {
      const alerts = await api('/authority/alerts');
      if (!alerts.length) alertList.append(text('p', 'No alerts recorded.', 'font-caption text-caption text-on-surface-variant'));
      alerts.slice(0, 60).forEach(alert => {
        const row = document.createElement('article'); row.className = 'p-2 border border-surface-variant rounded';
        row.append(text('strong', `${alert.title} • ${alert.severity} • ${alert.isActive ? 'Published' : 'Inactive/draft'}`, 'font-label-strong text-label-strong'));
        row.append(text('p', `${alert.district.name}, ${alert.district.state} • issued ${new Date(alert.issuedAt).toLocaleString()}${alert.expiresAt ? ` • expires ${new Date(alert.expiresAt).toLocaleString()}` : ''}`, 'font-caption text-caption'));
        if (alert.translations && Object.keys(alert.translations).length) row.append(text('p', `Translations: ${Object.keys(alert.translations).join(', ')}`, 'font-caption text-caption'));
        row.append(actionButton('Edit alert text', async () => {
          if (alert.isActive && !window.confirm('Update this published alert for citizens now?')) return;
          const title = window.prompt('Updated alert title:', alert.title);
          if (title == null) return;
          const summary = window.prompt('Updated public summary:', alert.summary);
          if (summary == null) return;
          const instructions = window.prompt('Updated public instructions:', alert.instructions);
          if (instructions == null) return;
          try { await api(`/authority/alerts/${alert.id}`, { method: 'PATCH', body: JSON.stringify({ title, summary, instructions, confirmationText: alert.isActive ? 'UPDATE_AND_PUBLISH' : undefined }) }); statusMessage(alertOps, 'Alert content updated and history logged.'); await refresh(); }
          catch (error) { statusMessage(alertOps, error.message, true); }
        }));
        if (alert.isActive) row.append(actionButton('Cancel alert', async () => {
          if (!window.confirm(`Cancel the public alert “${alert.title}”?`)) return;
          try { await api(`/authority/alerts/${alert.id}`, { method: 'PATCH', body: JSON.stringify({ cancel: true, confirmationText: 'CANCEL' }) }); statusMessage(alertOps, 'Alert cancelled and audit logged.'); await refresh(); }
          catch (error) { statusMessage(alertOps, error.message, true); }
        }));
        alertList.append(row);
      });
    } catch (error) { alertList.append(text('p', error.status === 403 ? 'Alert view permission required.' : error.message, 'font-caption text-caption text-on-surface-variant')); }
  }

  async function loadFacilities() {
    facilityList.replaceChildren();
    try {
      const facilities = await api('/authority/facilities');
      if (!facilities.length) facilityList.append(text('p', 'No facilities found in scope.', 'font-caption text-caption text-on-surface-variant'));
      facilities.slice(0, 100).forEach(facility => {
        const card = document.createElement('article'); card.className = 'p-2 border border-surface-variant rounded';
        const quality = facility.dataQuality?.unknownFields?.length ? `Unknown: ${facility.dataQuality.unknownFields.join(', ')}` : facility.dataQuality?.stale ? 'Record may be stale' : 'Record current';
        card.append(text('strong', `${facility.name} • ${facility.facilityType}`, 'font-label-strong text-label-strong'));
        card.append(text('p', `${facility.address} • ${facility.operatingStatus.replaceAll('_', ' ')} • Capacity ${facility.totalCapacity} / occupancy ${facility.currentOccupancy} • ${quality}`, 'font-caption text-caption'));
        const status = selectField('Operating status', [['OPERATIONAL', 'Operational'], ['FILLING_UP', 'Filling up'], ['FULL', 'Full'], ['DAMAGED_CLOSED', 'Damaged/closed'], ['UNKNOWN', 'Unknown']]); status.select.value = facility.operatingStatus;
        const update = actionButton('Update status', async () => {
          try { await api(`/authority/facilities/${facility.id}`, { method: 'PATCH', body: JSON.stringify({ operatingStatus: status.select.value }) }); statusMessage(facilityOps, 'Facility status saved and audited.'); await refresh(); }
          catch (error) { statusMessage(facilityOps, error.message, true); }
        });
        const unknown = actionButton('Mark capacity/contact unknown', async () => {
          try { await api(`/authority/facilities/${facility.id}`, { method: 'PATCH', body: JSON.stringify({ markUnknown: ['totalCapacity', 'currentOccupancy', 'contactPhone'] }) }); statusMessage(facilityOps, 'Capacity and contact marked unknown. Citizen searches will not present those values as current.'); await refresh(); }
          catch (error) { statusMessage(facilityOps, error.message, true); }
        });
        card.append(status.wrapper, update, unknown); facilityList.append(card);
      });
    } catch (error) { facilityList.append(text('p', error.status === 403 ? 'Facility view permission required.' : error.message, 'font-caption text-caption text-on-surface-variant')); }
  }

  async function loadReliefRequests() {
    requestList.replaceChildren();
    try {
      const requests = await api('/authority/relief-requests');
      if (!requests.length) requestList.append(text('p', 'No relief requests in scope.', 'font-caption text-caption text-on-surface-variant'));
      requests.slice(0, 80).forEach(item => {
        const card = document.createElement('article'); card.className = 'p-2 border border-surface-variant rounded';
        const total = item.headcountAdults + item.headcountChildren + item.headcountInfants + item.headcountSeniors;
        card.append(text('strong', `${item.urgencyLevel} • ${item.stage} • ${total} people`, 'font-label-strong text-label-strong'));
        card.append(text('p', `${item.landmarkNotes || 'Location notes unavailable'} • ${item.district.name} • ${new Date(item.createdAt).toLocaleString()}`, 'font-caption text-caption'));
        const nextStages = { STAGE_1_TRIAGED: 'STAGE_2_VERIFIED', STAGE_3_ALLOCATED: 'STAGE_4_IN_TRANSIT', STAGE_4_IN_TRANSIT: 'STAGE_5_DELIVERED' };
        const next = nextStages[item.stage];
        if (next) card.append(actionButton(`Advance to ${next}`, async () => {
          const notes = window.prompt('Required operational note for this stage change:');
          if (!notes || notes.trim().length < 3) return;
          try { await api(`/authority/relief-requests/${item.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: next, notes: notes.trim() }) }); statusMessage(requestOps, 'Request stage advanced and audited.'); await refresh(); }
          catch (error) { statusMessage(requestOps, error.message, true); }
        }));
        if (item.stage === 'STAGE_2_VERIFIED') {
          const depotChoices = [...new Map(cachedInventory.map(stock => [stock.depotId, { id: stock.depotId, name: stock.depot.name }])).values()];
          const depot = selectField('Distribution centre', depotChoices.map(choice => [choice.id, choice.name]));
          const skuSelect = selectField('Requested stock item', []);
          const quantity = inputField('Quantity to reserve', 'number'); quantity.input.min = '1'; quantity.input.step = '1';
          const allocationNotes = inputField('Allocation note', 'text', { maxLength: 300 });
          const fillSkuOptions = () => {
            skuSelect.select.replaceChildren();
            cachedInventory.filter(stock => stock.depotId === depot.select.value && Number(item.itemsRequested?.[stock.itemSku === 'WATER_20L' ? 'drinkingWater' : stock.itemSku === 'DRY_RATION_KIT' ? 'foodKits' : stock.itemSku === 'BABY_FORMULA' ? 'babyFormula' : stock.itemSku === 'FIRST_AID_KIT' ? 'firstAidKit' : stock.itemSku === 'TARPAULIN' ? 'tarpaulin' : '']) > 0)
              .forEach(stock => {
                const option = document.createElement('option'); option.value = stock.itemSku; option.textContent = `${stock.itemName} • ${Math.max(0, stock.quantityAvailable - stock.quantityReserved)} unreserved`; skuSelect.select.append(option);
              });
          };
          depot.select.addEventListener('change', fillSkuOptions);
          fillSkuOptions();
          const allocate = actionButton('Reserve and allocate stock', async () => {
            const amount = Number(quantity.input.value);
            if (!depot.select.value || !skuSelect.select.value || !Number.isInteger(amount) || amount < 1 || !allocationNotes.input.value.trim()) {
              statusMessage(requestOps, 'Choose an available depot and requested item, enter quantity and an operational note.', true);
              return;
            }
            allocate.disabled = true;
            try {
              await api(`/authority/relief-requests/${item.id}/allocate`, { method: 'POST', body: JSON.stringify({ depotId: depot.select.value, allocations: [{ itemSku: skuSelect.select.value, quantity: amount }], notes: allocationNotes.input.value.trim() }) });
              statusMessage(requestOps, 'Stock reserved and request advanced to allocated.');
              await refresh();
            } catch (error) { statusMessage(requestOps, error.message, true); allocate.disabled = false; }
          });
          card.append(depot.wrapper, skuSelect.wrapper, quantity.wrapper, allocationNotes.wrapper, allocate);
          if (!depotChoices.length) card.append(text('p', 'No inventory allocation data is available for this role/district.', 'font-caption text-caption text-on-surface-variant'));
        }
        requestList.append(card);
      });
    } catch (error) { requestList.append(text('p', error.status === 403 ? 'Relief triage permission required.' : error.message, 'font-caption text-caption text-on-surface-variant')); }
  }

  async function loadInventory() {
    inventoryList.replaceChildren();
    try {
      const stock = await api('/authority/inventory');
      cachedInventory = stock;
      if (!stock.length) inventoryList.append(text('p', 'No inventory records in scope.', 'font-caption text-caption text-on-surface-variant'));
      stock.forEach(item => {
        const row = document.createElement('div'); row.className = 'flex flex-wrap items-center justify-between gap-2 p-2 border border-surface-variant rounded';
        row.append(text('span', `${item.depot.name} • ${item.itemName}: ${item.quantityAvailable} ${item.unit} available, ${item.quantityReserved} reserved`, 'font-caption text-caption'));
        row.append(actionButton('Adjust total', async () => {
          const quantity = Number(window.prompt('Enter verified total quantity available:', String(item.quantityAvailable)));
          if (!Number.isInteger(quantity) || quantity < 0) return;
          const reason = window.prompt('Required stock adjustment reason:');
          if (!reason || reason.trim().length < 5) return;
          try { await api(`/authority/inventory/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantityAvailable: quantity, reason: reason.trim() }) }); statusMessage(inventoryOps, 'Inventory adjustment committed and audited.'); await refresh(); }
          catch (error) { statusMessage(inventoryOps, error.message, true); }
        }));
        inventoryList.append(row);
      });
    } catch (error) { inventoryList.append(text('p', error.status === 403 ? 'Inventory permission required.' : error.message, 'font-caption text-caption text-on-surface-variant')); }
  }

  async function loadStaff() {
    staffList.replaceChildren();
    try {
      const users = await api('/authority/staff');
      cachedStaff = users.filter(user => user.isActive);
      const selectedAssignee = incidentAssignee.select.value;
      incidentAssignee.select.replaceChildren();
      [['', 'Unassigned'], ...cachedStaff.map(person => [person.id, `${person.fullName} • ${person.role}`])].forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; incidentAssignee.select.append(option);
      });
      incidentAssignee.select.value = selectedAssignee;
      if (!users.length) staffList.append(text('p', 'No staff accounts in scope.', 'font-caption text-caption text-on-surface-variant'));
      users.forEach(user => {
        const row = document.createElement('div'); row.className = 'flex flex-wrap items-center gap-2 p-2 border border-surface-variant rounded';
        row.append(text('span', `${user.fullName} • ${user.username} • ${user.role} • ${user.isActive ? 'Active' : 'Disabled'}`, 'font-caption text-caption'));
        const role = selectField('Role', [['DATA_OPERATOR', 'Data operator'], ['FIELD_COMMANDER', 'Field commander'], ['LOGISTICS_OFFICER', 'Logistics officer'], ['EOC_DIRECTOR', 'EOC director']]);
        role.select.value = user.role;
        row.append(role.wrapper, actionButton('Save role', async () => {
          try { await api(`/authority/staff/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: role.select.value }) }); statusMessage(staffOps, 'Role updated; permissions follow the configured role policy.'); await refresh(); }
          catch (error) { statusMessage(staffOps, error.message, true); }
        }));
        if (user.isActive) row.append(actionButton('Disable account / revoke sessions', async () => {
          if (!window.confirm(`Disable ${user.fullName} and revoke active sessions?`)) return;
          try { await api(`/authority/staff/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }); statusMessage(staffOps, 'Account disabled and sessions revoked.'); await refresh(); }
          catch (error) { statusMessage(staffOps, error.message, true); }
        }));
        staffList.append(row);
      });
    } catch (error) { staffList.append(text('p', error.status === 403 ? 'Staff management permission required.' : error.message, 'font-caption text-caption text-on-surface-variant')); }
  }

  async function loadSos() {
    sosList.replaceChildren();
    try {
      const records = await api('/authority/sos');
      if (!records.length) sosList.append(text('p', 'No unresolved SOS records in the available scope.', 'font-caption text-caption text-on-surface-variant'));
      records.forEach(record => sosList.append(text('article', `${record.serviceType} • ${record.status} • ${record.latitude == null || record.longitude == null ? 'Location unavailable' : `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`} • ${new Date(record.triggeredAt).toLocaleString()}`, 'p-2 border border-surface-variant rounded font-caption text-caption')));
    } catch (error) {
      sosList.append(text('p', error.status === 403 ? 'SOS view permission required.' : error.message, 'font-caption text-caption text-on-surface-variant'));
    }
  }

  async function renderIncidentMap(records) {
    const mapContainer = document.getElementById('gis-map-container');
    if (!mapContainer) return;
    let mapSurface = document.getElementById('authority-live-map');
    if (!mapSurface) {
      mapContainer.replaceChildren();
      mapContainer.classList.add('relative');
      mapSurface = document.createElement('div');
      mapSurface.id = 'authority-live-map';
      mapSurface.className = 'w-full h-full min-h-[360px]';
      const status = text('p', 'Loading Google Maps…', 'absolute top-2 left-2 z-10 p-2 rounded bg-white font-caption text-caption');
      status.id = 'authority-map-status';
      mapContainer.append(mapSurface, status);
    }
    try {
      await window.DisasterReadyAPI.maps.load();
      const status = document.getElementById('authority-map-status');
      if (!records.length) {
        status.textContent = 'No hazard records in scope. This does not indicate the area is safe.';
        const map = new window.google.maps.Map(mapSurface, { center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, mapTypeControl: false, streetViewControl: false });
        return;
      }
      const map = new window.google.maps.Map(mapSurface, { center: records[0].coordinates, zoom: 11, mapTypeControl: false, streetViewControl: false });
      const bounds = new window.google.maps.LatLngBounds();
      records.forEach(record => {
        const position = record.coordinates;
        bounds.extend(position);
        new window.google.maps.Marker({
          map,
          position,
          title: `${record.hazardType} • ${record.severity} • ${record.status}`,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: record.status === 'UNVERIFIED' ? '#8a4b00' : '#ba1a1a', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        });
        record.polygons.forEach(feature => {
          const coordinates = Array.isArray(feature.coordinates) ? feature.coordinates : [];
          if (coordinates.length < 3 || !coordinates.every(point => Array.isArray(point) && point.length >= 2)) return;
          const polygon = new window.google.maps.Polygon({ paths: coordinates.map(([lat, lng]) => ({ lat, lng })), strokeColor: '#ba1a1a', strokeWeight: 2, fillColor: '#ba1a1a', fillOpacity: 0.18, map });
          void polygon;
        });
      });
      map.fitBounds(bounds, 32);
      const mapStatus = document.getElementById('authority-map-status');
      mapStatus.textContent = `${records.length} authority incident records • Google Maps • Updated ${new Date().toLocaleString()}`;
    } catch (error) {
      mapSurface.replaceChildren(text('p', error.message || 'Google Maps JavaScript API unavailable. No map is being simulated.', 'p-3 font-caption text-caption text-on-surface-variant'));
      const status = document.getElementById('authority-map-status');
      if (status) status.textContent = 'Map provider unavailable.';
    }
  }

  const refreshButton = [...document.querySelectorAll('button')].find(button => /Force Refresh/i.test(button.textContent || ''));
  refreshButton?.addEventListener('click', refresh);
  refresh();
})();
