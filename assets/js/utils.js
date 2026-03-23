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

    state.latestQueryString = params.toString();

    try {
        // Try to update address bar (works in standard hosting)
        window.history.replaceState({}, '', `${window.location.pathname}?${state.latestQueryString}`);
    } catch (e) {
        // Fail silently in sandbox
    }
}

export function debouncedUpdateURL(state) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => updateURL(state), 500);
}

export function copyShareLink(state) {
    updateURL(state); 
    const fullURL = `${window.location.origin}${window.location.pathname}?${state.latestQueryString}`;
    
    navigator.clipboard.writeText(fullURL).then(() => {
        const btn = document.getElementById('btn-share');
        btn.classList.add('text-green-600');
        setTimeout(() => btn.classList.remove('text-green-600'), 1000);
    }).catch(err => {
        console.error("Clipboard failed", err);
        alert("Link: " + fullURL);
    });
}

export async function searchLocation(query, targetMap, state) {
    if (!query) return;
    
    const wasSynced = state.syncCheckbox.checked;
    if (wasSynced) {
        state.syncCheckbox.checked = false; 
    }
    
    try {
        const resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Network response was not ok');
        const data = await resp.json();
        if (data && data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            
            if (wasSynced) {
                targetMap.once('moveend', () => {
                    state.syncCheckbox.checked = true; 
                    debouncedUpdateURL(state);
                });
            }

            targetMap.flyTo([lat, lon], targetMap.getZoom());
        } else {
            alert("Location not found");
        }
    } catch (e) {
        console.error("Search failed:", e);
        alert("Search failed. Service might be unavailable.");
        if (wasSynced) state.syncCheckbox.checked = true;
    }
    
    debouncedUpdateURL(state);
}
