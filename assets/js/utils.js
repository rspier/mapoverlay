let timeoutId = null;

export function getMapLoc(map) {
    const c = map.getCenter();
    return [Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4)), map.getZoom()].join(',');
}

export function updateURL(state) {
    const params = new URLSearchParams();
    
    // Map States
    params.set('b', state.selBase.value);
    params.set('bloc', getMapLoc(state.mapBase));
    params.set('o', state.selOverlay.value);
    params.set('oloc', getMapLoc(state.mapOverlay));
    
    // UI States
    params.set('op', state.rangeOpacity.value);
    params.set('tint', state.filterSelect.value);
    params.set('rot', state.rangeRot.value);
    params.set('sync', state.syncCheckbox.checked ? '1' : '0');

    // Search persistence
    if (state.searchQueryBase) params.set('sb', state.searchQueryBase);
    if (state.searchQueryOverlay) params.set('so', state.searchQueryOverlay);

    state.latestQueryString = params.toString();

    try {
        window.history.replaceState({}, '', `${window.location.pathname}?${state.latestQueryString}`);
    } catch (e) {
        // Fail silently in sandbox
    }
}

export function debouncedUpdateURL(state) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => updateURL(state), 500);
}

export async function copyShareLink(state) {
    updateURL(state); 
    const fullURL = `${window.location.origin}${window.location.pathname}?${state.latestQueryString}`;
    
    // Build dynamic title based on search queries
    let shareTitle = "Map Layer Comparator";
    if (state.searchQueryBase && state.searchQueryOverlay) {
        shareTitle = `${state.searchQueryBase} vs ${state.searchQueryOverlay}`;
    } else if (state.searchQueryBase) {
        shareTitle = state.searchQueryBase;
    } else if (state.searchQueryOverlay) {
        shareTitle = state.searchQueryOverlay;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: `Comparing ${shareTitle} using Map Layer Comparator.`,
                url: fullURL
            });
        } catch (err) {
            console.warn("Share failed", err);
        }
    } else {
        // Fallback to Clipboard
        navigator.clipboard.writeText(fullURL).then(() => {
            const btn = document.getElementById('btn-share');
            btn.classList.add('text-green-600');
            setTimeout(() => btn.classList.remove('text-green-600'), 1000);
        }).catch(err => {
            console.error("Clipboard failed", err);
            alert("Link: " + fullURL);
        });
    }
}

export async function searchLocation(query, targetMap, state, isBaseMap = false) {
    if (!query) return;
    
    // Persist search query in state
    if (isBaseMap) {
        state.searchQueryBase = query;
    } else {
        state.searchQueryOverlay = query;
    }

    const wasSynced = state.syncCheckbox.checked;
    if (wasSynced) {
        state.syncCheckbox.checked = false; 
    }
    
    try {
        const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Network response was not ok');
        const data = await resp.json();
        if (data && data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lon, lat] = feature.geometry.coordinates;
            const coord = [lat, lon];
            
            // Clear old marker/boundary for the specific side only
            if (isBaseMap) {
                if (state.searchMarkerBase) state.mapBase.removeLayer(state.searchMarkerBase);
            } else {
                if (state.searchMarkerOverlay) state.mapOverlay.removeLayer(state.searchMarkerOverlay);
            }

            // Fetch Boundary (GeoJSON) from Nominatim
            let { osm_id, osm_type } = feature.properties;
            let boundaryGeoJSON = null;
            
            async function tryFetchBoundary(oid, otype) {
                if (!oid || !otype) return null;
                try {
                    const lookupResp = await fetch(`https://nominatim.openstreetmap.org/lookup?osm_ids=${otype}${oid}&format=json&polygon_geojson=1`);
                    const lookupData = await lookupResp.json();
                    if (lookupData && lookupData[0] && lookupData[0].geojson) {
                        const geo = lookupData[0].geojson;
                        if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') return geo;
                    }
                } catch (err) { console.warn("Boundary lookup failed", err); }
                return null;
            }

            // 1. Try direct match
            boundaryGeoJSON = await tryFetchBoundary(osm_id, osm_type);

            // 2. If no boundary for the specific point, try reverse lookup to find containing area
            if (!boundaryGeoJSON) {
                try {
                    const revResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
                    const revData = await revResp.json();
                    if (revData && revData.osm_id && revData.osm_type) {
                        const typePrefix = revData.osm_type.charAt(0).toUpperCase();
                        boundaryGeoJSON = await tryFetchBoundary(revData.osm_id, typePrefix);
                    }
                } catch (err) { console.warn("Reverse boundary lookup failed", err); }
            }

            // Styles for each layer
            const common = {
                pane: 'boundaryPane',
                weight: 5, 
                opacity: 1, 
                fillColor: 'transparent', 
                fillOpacity: 0
            };

            const locName = feature.properties.name || query;

            // --- Label Scaling Logic ---
            let labelClasses = "text-xs px-2 py-0.5 border text-center";
            if (feature.properties.extent) {
                const [w, s, e, n] = feature.properties.extent;
                const diag = Math.sqrt(Math.pow(e - w, 2) + Math.pow(n - s, 2));
                
                // Broad categories for visual hierarchy
                if (diag > 5) labelClasses = "text-5xl px-12 py-6 border-[6px] rounded-[3rem]"; // National / Large State
                else if (diag > 1) labelClasses = "text-3xl px-8 py-4 border-4 rounded-[2rem]"; // Region / Large City
                else if (diag > 0.1) labelClasses = "text-xl px-4 py-2 border-2 rounded-2xl"; // District
                else if (diag > 0.02) labelClasses = "text-sm px-3 py-1 border-2 rounded-xl"; // Neighborhood
            }

            if (boundaryGeoJSON && (boundaryGeoJSON.type === 'Polygon' || boundaryGeoJSON.type === 'MultiPolygon')) {
                if (isBaseMap) {
                    state.searchMarkerBase = L.geoJSON(boundaryGeoJSON, { style: { ...common, color: '#a855f7' } }).addTo(state.mapBase);
                    
                    // Add Label
                    if (state.searchLabelBase) state.mapBase.removeLayer(state.searchLabelBase);
                    state.searchLabelBase = L.marker(coord, {
                        icon: L.divIcon({
                            className: 'custom-map-label',
                            html: `<div class="bg-white/90 backdrop-blur-sm ${labelClasses} border-purple-300 text-purple-700 font-bold whitespace-nowrap shadow-xl">${locName}</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        }),
                        pane: 'boundaryPane'
                    }).addTo(state.mapBase);

                } else {
                    state.searchMarkerOverlay = L.geoJSON(boundaryGeoJSON, { style: { ...common, color: '#3b82f6' } }).addTo(state.mapOverlay);
                    
                    // Add Label
                    if (state.searchLabelOverlay) state.mapOverlay.removeLayer(state.searchLabelOverlay);
                    state.searchLabelOverlay = L.marker(coord, {
                        icon: L.divIcon({
                            className: 'custom-map-label',
                            html: `<div class="bg-white/90 backdrop-blur-sm ${labelClasses} border-blue-300 text-blue-700 font-bold whitespace-nowrap shadow-xl">${locName}</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        }),
                        pane: 'boundaryPane'
                    }).addTo(state.mapOverlay);
                }
            }

            if (wasSynced) {
                targetMap.once('moveend', () => {
                    state.syncCheckbox.checked = true; 
                    debouncedUpdateURL(state);
                });
            }

            targetMap.flyTo(coord, targetMap.getZoom());
        } else {
            alert("Location not found");
        }
    } catch (e) {
        console.error("Search failed:", e);
        if (wasSynced) state.syncCheckbox.checked = true;
    }
    
    // Show clear button
    const clearBtnId = isBaseMap ? 'btn-clear-base' : 'btn-clear-overlay';
    document.getElementById(clearBtnId).classList.remove('hidden');

    debouncedUpdateURL(state);
}

export function clearSearch(targetMap, state, isBaseMap = false) {
    if (isBaseMap) {
        if (state.searchMarkerBase) state.mapBase.removeLayer(state.searchMarkerBase);
        if (state.searchLabelBase) state.mapBase.removeLayer(state.searchLabelBase);
        state.searchMarkerBase = null;
        state.searchLabelBase = null;
        state.searchQueryBase = "";
        document.getElementById('search-base').value = "";
        document.getElementById('btn-clear-base').classList.add('hidden');
    } else {
        if (state.searchMarkerOverlay) state.mapOverlay.removeLayer(state.searchMarkerOverlay);
        if (state.searchLabelOverlay) state.mapOverlay.removeLayer(state.searchLabelOverlay);
        state.searchMarkerOverlay = null;
        state.searchLabelOverlay = null;
        state.searchQueryOverlay = "";
        document.getElementById('search-overlay').value = "";
        document.getElementById('btn-clear-overlay').classList.add('hidden');
    }
    debouncedUpdateURL(state);
}
