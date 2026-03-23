import { debouncedUpdateURL } from './utils.js';

export function setupSync(mapBase, mapOverlay, state) {
    let isSyncing = false;
    
    function sync(sourceMap, targetMap) {
        if (!state.syncCheckbox.checked) return;
        if (isSyncing) return; // Prevent loop
        
        isSyncing = true;
        const z = sourceMap.getZoom();
        if (targetMap.getZoom() !== z) {
            targetMap.setZoom(z, { animate: false });
        }
        isSyncing = false;
    }

    mapBase.on('zoom', () => sync(mapBase, mapOverlay));
    mapOverlay.on('zoom', () => sync(mapOverlay, mapBase));
}

export function setLayer(mapInstance, provider, isOverlay, state) {
    if (isOverlay && state.layerOverlay) mapInstance.removeLayer(state.layerOverlay);
    if (!isOverlay && state.layerBase) mapInstance.removeLayer(state.layerBase);

    const newLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        opacity: isOverlay ? parseFloat(state.rangeOpacity.value) : 1
    }).addTo(mapInstance);

    if (isOverlay) {
        state.layerOverlay = newLayer;
        setTimeout(() => applyOverlayFilter(state), 10); 
    } else {
        state.layerBase = newLayer;
    }
    debouncedUpdateURL(state);
}

export function applyOverlayFilter(state) {
    if (!state.layerOverlay) return;
    const filterClass = state.filterSelect.value;
    const container = state.layerOverlay.getContainer();
    if (container) {
        container.classList.remove('filter-normal', 'filter-invert', 'filter-red', 'filter-blue', 'filter-green', 'filter-high-contrast');
        container.classList.add(filterClass);
    }
    debouncedUpdateURL(state);
}

export function setRotation(degrees, state) {
    state.currentRotation = parseFloat(degrees);
    const overlayContainer = document.getElementById('map-overlay');
    overlayContainer.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
    state.valRot.innerText = `${degrees}°`;
    debouncedUpdateURL(state);
}

export function setupCustomDrag(mapOverlay, state) {
    const overlayDiv = document.getElementById('map-overlay');
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    overlayDiv.addEventListener('mousedown', (e) => {
        if (overlayDiv.classList.contains('interaction-disabled')) return;
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        overlayDiv.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        overlayDiv.style.cursor = '';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        const rad = state.currentRotation * (Math.PI / 180);

        const mapDx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const mapDy = dx * Math.sin(-rad) + dy * Math.cos(-rad);

        mapOverlay.panBy([-mapDx, -mapDy], { animate: false });

        lastX = e.clientX;
        lastY = e.clientY;
    });
}
