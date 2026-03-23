/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mapConfig, tileProviders } from './config.js';
import * as utils from './utils.js';
import * as ui from './ui.js';
import * as mapFuncs from './map.js';

// State Management
const state = {
    layerBase: null,
    layerOverlay: null,
    currentRotation: 0,
    latestQueryString: "",

    // Selectors & UI Elements
    selBase: document.getElementById('select-base'),
    selOverlay: document.getElementById('select-overlay'),
    syncCheckbox: document.getElementById('sync-zoom'),
    rangeOpacity: document.getElementById('opacity-slider'),
    valOpacity: document.getElementById('opacity-val'),
    filterSelect: document.getElementById('filter-overlay'),
    rangeRot: document.getElementById('rot-slider'),
    valRot: document.getElementById('rot-val'),
    uiPanel: document.getElementById('ui-panel'),
    iconCollapse: document.getElementById('icon-collapse'),
    btnBase: document.getElementById('ctrl-base'),
    btnOverlay: document.getElementById('ctrl-overlay'),
    searchMarkerBase: null,
    searchMarkerOverlay: null,
    searchQueryBase: "",
    searchQueryOverlay: "",
};

// Initialize Maps
const mapBase = L.map('map-base', {
    zoomControl: false,
    attributionControl: false
}).setView(mapConfig.center, mapConfig.zoom);
mapBase.createPane('boundaryPane').style.zIndex = '650';
mapBase.getPane('boundaryPane').style.pointerEvents = 'none';

// mapOverlay Initialization
const mapOverlay = L.map('map-overlay', {
    zoomControl: false,
    attributionControl: true,
    dragging: false // Custom dragging for rotation
}).setView(mapConfig.center, mapConfig.zoom);

mapOverlay.createPane('boundaryPane').style.zIndex = '650';
mapOverlay.getPane('boundaryPane').style.pointerEvents = 'none';

L.control.zoom({ position: 'topright' }).addTo(mapBase);

state.mapBase = mapBase;
state.mapOverlay = mapOverlay;

function initApp() {
    // Populate Selects
    tileProviders.forEach((p, i) => {
        state.selBase.add(new Option(p.name, i));
        state.selOverlay.add(new Option(p.name, i));
    });

    // Parse URL
    const params = new URLSearchParams(window.location.search);
    const hasParams = params.has('b');

    // Defaults or Params
    state.selBase.value = params.get('b') || 7;
    state.selOverlay.value = params.get('o') || 5;

    const op = params.get('op') || 0.7;
    state.rangeOpacity.value = op;
    state.valOpacity.innerText = Math.round(op * 100) + '%';

    state.filterSelect.value = params.get('tint') || 'filter-normal';

    const rot = params.get('rot') || 0;
    state.rangeRot.value = rot;
    mapFuncs.setRotation(rot, state);

    if (params.has('sync')) {
        state.syncCheckbox.checked = (params.get('sync') === '1');
    }

    // Set Initial View
    if (hasParams && params.get('bloc')) {
        const [lat, lng, z] = params.get('bloc').split(',').map(Number);
        mapBase.setView([lat, lng], z, { animate: false });
    }
    if (hasParams && params.get('oloc')) {
        const [lat, lng, z] = params.get('oloc').split(',').map(Number);
        mapOverlay.setView([lat, lng], z, { animate: false });
    }

    // Init Logic
    mapFuncs.setLayer(mapBase, tileProviders[state.selBase.value], false, state);
    mapFuncs.setLayer(mapOverlay, tileProviders[state.selOverlay.value], true, state);

    mapFuncs.setupSync(mapBase, mapOverlay, state);
    mapFuncs.setupCustomDrag(mapBase, mapOverlay, state);
    ui.setControlMode('overlay', state);

    // Initial Searches from URL
    if (params.has('sb')) {
        const query = params.get('sb');
        document.getElementById('search-base').value = query;
        utils.searchLocation(query, mapBase, state, true);
    }
    if (params.has('so')) {
        const query = params.get('so');
        document.getElementById('search-overlay').value = query;
        utils.searchLocation(query, mapOverlay, state, false);
    }
}

// Event Listeners
state.selBase.onchange = () => mapFuncs.setLayer(mapBase, tileProviders[state.selBase.value], false, state);
state.selOverlay.onchange = () => mapFuncs.setLayer(mapOverlay, tileProviders[state.selOverlay.value], true, state);

state.rangeOpacity.oninput = (e) => {
    const val = e.target.value;
    state.valOpacity.innerText = Math.round(val * 100) + '%';
    if (state.layerOverlay) {
        state.layerOverlay.eachLayer(layer => layer.setOpacity(val));
    }
    utils.debouncedUpdateURL(state);
};

state.rangeRot.oninput = (e) => {
    mapFuncs.setRotation(e.target.value, state);
};

state.filterSelect.onchange = () => mapFuncs.applyOverlayFilter(state);
state.syncCheckbox.onchange = () => utils.debouncedUpdateURL(state);

mapBase.on('moveend zoomend', () => utils.debouncedUpdateURL(state));
mapOverlay.on('moveend zoomend', () => utils.debouncedUpdateURL(state));

// Button Handlers
document.getElementById('btn-share').onclick = () => utils.copyShareLink(state);
document.getElementById('btn-swap').onclick = () => ui.swapLayers(state, tileProviders, mapBase, mapOverlay, mapFuncs);
document.getElementById('btn-collapse').onclick = () => ui.toggleSidebar(state.uiPanel, state.iconCollapse);
document.getElementById('ctrl-base').onclick = () => ui.setControlMode('base', state);
document.getElementById('ctrl-overlay').onclick = () => ui.setControlMode('overlay', state);

// Search logic
document.getElementById('btn-search-base').onclick = () => {
    utils.searchLocation(document.getElementById('search-base').value, mapBase, state, true);
    ui.setControlMode('base', state);
};
document.getElementById('search-base').onkeypress = (e) => {
    if (e.key === 'Enter') {
        utils.searchLocation(e.target.value, mapBase, state, true);
        ui.setControlMode('base', state);
    }
};
document.getElementById('btn-search-overlay').onclick = () => {
    utils.searchLocation(document.getElementById('search-overlay').value, mapOverlay, state, false);
    ui.setControlMode('overlay', state);
};
document.getElementById('search-overlay').onkeypress = (e) => {
    if (e.key === 'Enter') {
        utils.searchLocation(e.target.value, mapOverlay, state, false);
        ui.setControlMode('overlay', state);
    }
};

// Start
initApp();
