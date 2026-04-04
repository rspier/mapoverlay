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

export async function searchLocation(query, targetMap, state, isBaseMap = false, existingFeature = null) {
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
        let feature = existingFeature;
        if (!feature) {
            const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}`);
            if (!resp.ok) throw new Error('Network response was not ok');
            const data = await resp.json();
            if (data && data.features && data.features.length > 0) {
                feature = data.features[0];
            }
        }

        if (feature) {
            const [lon, lat] = feature.geometry.coordinates;
            const coord = [lat, lon];
            
            // Clear old marker/boundary for the specific side only
            if (isBaseMap) {
                if (state.searchMarkerBase) state.mapBase.removeLayer(state.searchMarkerBase);
                if (state.searchLabelBase) state.mapBase.removeLayer(state.searchLabelBase);
            } else {
                if (state.searchMarkerOverlay) state.mapOverlay.removeLayer(state.searchMarkerOverlay);
                if (state.searchLabelOverlay) state.mapOverlay.removeLayer(state.searchLabelOverlay);
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

            boundaryGeoJSON = await tryFetchBoundary(osm_id, osm_type);

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

            const common = {
                pane: 'boundaryPane',
                weight: 5, 
                opacity: 1, 
                fillColor: 'transparent', 
                fillOpacity: 0
            };

            const locName = feature.properties.name || query;

            let labelClasses = "text-xs font-black uppercase tracking-wider";
            if (feature.properties.extent) {
                const [w, s, e, n] = feature.properties.extent;
                const diag = Math.sqrt(Math.pow(e - w, 2) + Math.pow(n - s, 2));
                
                if (diag > 5) labelClasses = "text-7xl font-black uppercase tracking-tighter"; 
                else if (diag > 1) labelClasses = "text-4xl font-black uppercase tracking-tight"; 
                else if (diag > 0.1) labelClasses = "text-2xl font-black"; 
                else if (diag > 0.02) labelClasses = "text-sm font-bold";
            }

            if (boundaryGeoJSON && (boundaryGeoJSON.type === 'Polygon' || boundaryGeoJSON.type === 'MultiPolygon')) {
                if (isBaseMap) {
                    state.searchMarkerBase = L.geoJSON(boundaryGeoJSON, { style: { ...common, color: '#a855f7' } }).addTo(state.mapBase);
                    state.searchLabelBase = L.marker(coord, {
                        icon: L.divIcon({
                            className: 'custom-map-label',
                            html: `<div class="${labelClasses} text-purple-700 whitespace-nowrap text-center" style="text-shadow: 0 0 10px white, 0 0 2px white;">${locName}</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        }),
                        pane: 'boundaryPane'
                    }).addTo(state.mapBase);
                } else {
                    state.overlayGeoJSON = boundaryGeoJSON;
                    state.searchMarkerOverlay = L.geoJSON(boundaryGeoJSON, { style: { ...common, color: '#3b82f6' } }).addTo(state.mapOverlay);
                    state.searchLabelOverlay = L.marker(coord, {
                        icon: L.divIcon({
                            className: 'custom-map-label',
                            html: `<div class="${labelClasses} text-blue-700 whitespace-nowrap text-center" style="text-shadow: 0 0 10px white, 0 0 2px white;">${locName}</div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        }),
                        pane: 'boundaryPane'
                    }).addTo(state.mapOverlay);
                }
                updateScaledOutline(state);
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
        if (state.searchMarkerScaled) state.mapOverlay.removeLayer(state.searchMarkerScaled);
        if (state.searchLabelScaled) state.mapOverlay.removeLayer(state.searchLabelScaled);
        state.searchMarkerOverlay = null;
        state.searchLabelOverlay = null;
        state.searchMarkerScaled = null;
        state.searchLabelScaled = null;
        state.overlayGeoJSON = null;
        state.searchQueryOverlay = "";
        document.getElementById('search-overlay').value = "";
        document.getElementById('btn-clear-overlay').classList.add('hidden');
    }
    debouncedUpdateURL(state);
}

export function updateScaledOutline(state) {
    if (!state.overlayGeoJSON || !state.mapBase || !state.mapOverlay) return;

    // Get current center latitudes
    const latOverlay = state.mapOverlay.getCenter().lat;
    const latBase = state.mapBase.getCenter().lat;
    
    // Mercator calculation: scale = 1 / cos(lat)
    // Factor to Scale overlay up to match base: cos(latOverlay) / cos(latBase)
    const factor = Math.cos(latOverlay * Math.PI / 180) / Math.cos(latBase * Math.PI / 180);
    
    // Only proceed if factor is meaningful
    if (isNaN(factor) || Math.abs(factor - 1) < 0.001 && state.searchMarkerScaled) {
        // If they are identical, remove scaled unless we want to keep it?
        // Let's keep it to show they match.
    }

    if (state.searchMarkerScaled) state.mapOverlay.removeLayer(state.searchMarkerScaled);
    if (state.searchLabelScaled) {
        state.mapOverlay.removeLayer(state.searchLabelScaled);
        state.searchLabelScaled = null;
    }

    // Scale the GeoJSON
    const feature = state.overlayGeoJSON;
    const center = L.latLngBounds(L.geoJSON(feature).getBounds()).getCenter();
    const pCenter = L.Projection.SphericalMercator.project(center);

    const scaledGeoJSON = JSON.parse(JSON.stringify(feature));
    
    function scaleRecursive(coords) {
        if (typeof coords[0] === 'number') {
            const p = L.Projection.SphericalMercator.project(L.latLng(coords[1], coords[0]));
            const newX = pCenter.x + (p.x - pCenter.x) * factor;
            const newY = pCenter.y + (p.y - pCenter.y) * factor;
            const newLL = L.Projection.SphericalMercator.unproject(L.point(newX, newY));
            return [newLL.lng, newLL.lat];
        } else {
            return coords.map(c => scaleRecursive(c));
        }
    }
    scaledGeoJSON.coordinates = scaleRecursive(scaledGeoJSON.coordinates);

    // Style for the "fair comparison" (True Scale) outline
    const style = {
        pane: 'boundaryPane',
        weight: 5,
        opacity: 0.8,
        color: '#f97316', // Orange
        dashArray: '10, 10',
        fillColor: 'transparent',
        fillOpacity: 0
    };

    state.searchMarkerScaled = L.geoJSON(scaledGeoJSON, { style }).addTo(state.mapOverlay);
}

let suggestTimeout = null;
export function fetchSuggestions(query, resultsDiv, targetMap, state, isBaseMap) {
    if (suggestTimeout) clearTimeout(suggestTimeout);
    
    if (!query || query.length < 2) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
        return;
    }

    suggestTimeout = setTimeout(async () => {
        try {
            const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`);
            const data = await resp.json();
            
            if (data.features && data.features.length > 0) {
                resultsDiv.innerHTML = '';
                resultsDiv.classList.remove('hidden');
                
                data.features.forEach(f => {
                    const item = document.createElement('div');
                    item.className = "px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 group transition-colors";
                    
                    const name = f.properties.name || "";
                    const city = f.properties.city || f.properties.state || "";
                    const country = f.properties.country || "";
                    const fullName = [name, city, country].filter(v => v).join(', ');
                    
                    item.innerHTML = `
                        <div class="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">${name}</div>
                        <div class="text-[10px] text-gray-400 capitalize">${[city, country].filter(v => v).join(', ')}</div>
                    `;
                    
                    item.onclick = (e) => {
                        e.stopPropagation();
                        const inputId = isBaseMap ? 'search-base' : 'search-overlay';
                        document.getElementById(inputId).value = fullName;
                        resultsDiv.classList.add('hidden');
                        searchLocation(fullName, targetMap, state, isBaseMap, f);
                    };
                    resultsDiv.appendChild(item);
                });
            } else {
                resultsDiv.classList.add('hidden');
            }
        } catch (e) { console.error(e); }
    }, 250); // 250ms debounce
}
