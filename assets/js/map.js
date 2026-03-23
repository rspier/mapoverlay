import { debouncedUpdateURL } from './utils.js';

export function setupSync(mapBase, mapOverlay, state) {
    let isSyncing = false;
    
    function sync(sourceMap, targetMap) {
        if (!state.syncCheckbox.checked || isSyncing) return;
        
        isSyncing = true;
        // With zoomSnap: 0.1, getZoom() returns precise fractional values
        targetMap.setZoom(sourceMap.getZoom(), { animate: false });
        isSyncing = false;
    }

    mapBase.on('zoom', () => sync(mapBase, mapOverlay));
    mapOverlay.on('zoom', () => sync(mapOverlay, mapBase));
}

export function setLayer(mapInstance, provider, isOverlay, state) {
    if (isOverlay && state.layerOverlay) mapInstance.removeLayer(state.layerOverlay);
    if (!isOverlay && state.layerBase) mapInstance.removeLayer(state.layerBase);

    // If source is a single URL, wrap it in an array for consistent handling
    const urls = Array.isArray(provider.url) ? provider.url : [provider.url];
    
    // We create a LayerGroup to hold multiple tile layers if needed
    const layerGroup = L.layerGroup();
    
    urls.forEach(url => {
        L.tileLayer(url, {
            attribution: provider.attribution,
            opacity: isOverlay ? parseFloat(state.rangeOpacity.value) : 1
        }).addTo(layerGroup);
    });

    layerGroup.addTo(mapInstance);

    if (isOverlay) {
        state.layerOverlay = layerGroup;
        // Small delay to ensure container is ready for filter class
        setTimeout(() => applyOverlayFilter(state), 10); 
    } else {
        state.layerBase = layerGroup;
    }
    debouncedUpdateURL(state);
}

export function applyOverlayFilter(state) {
    if (!state.layerOverlay) return;
    const filterClass = state.filterSelect.value;
    
    // For a LayerGroup, we need to apply filters to each tile layer's container
    state.layerOverlay.eachLayer(layer => {
        const container = layer.getContainer();
        if (container) {
            container.classList.remove('filter-normal', 'filter-invert', 'filter-red', 'filter-blue', 'filter-green', 'filter-high-contrast');
            container.classList.add(filterClass);
        }
    });
    debouncedUpdateURL(state);
}

export function setRotation(degrees, state) {
    state.currentRotation = parseFloat(degrees);
    const overlayContainer = document.getElementById('map-overlay');
    overlayContainer.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
    state.valRot.innerText = `${degrees}°`;
    debouncedUpdateURL(state);
}

export function setupCustomDrag(mapBase, mapOverlay, state) {
    const overlayDiv = document.getElementById('map-overlay');
    // For the base map, we access the Leaflet container
    const baseDiv = mapBase.getContainer();
    
    let isDragging = false;
    let dragMapInstance = null;
    let lastX = 0;
    let lastY = 0;

    const startDrag = (e, targetMap) => {
        isDragging = true;
        dragMapInstance = targetMap;
        lastX = e.clientX;
        lastY = e.clientY;
        document.body.style.cursor = 'grabbing';
        
        // Temporarily disable built-in dragging on the map being manipulated
        mapBase.dragging.disable();
        
        // Capture pointer to continue receiving events even if the pointer leaves the element
        if (e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
        }
    };

    const stopDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        dragMapInstance = null;
        document.body.style.cursor = '';
        
        if (state.mode === 'base') {
            mapBase.dragging.enable();
        }

        if (e && e.target.releasePointerCapture) {
            e.target.releasePointerCapture(e.pointerId);
        }
    };

    overlayDiv.addEventListener('pointerdown', (e) => {
        // Prevent default browser touch behavior (pan/zoom/scroll)
        if (state.mode === 'overlay') {
            e.preventDefault(); 
            startDrag(e, e.ctrlKey ? mapBase : mapOverlay);
            e.stopPropagation();
        }
    }, { passive: false });

    baseDiv.addEventListener('pointerdown', (e) => {
        if (state.mode === 'base' && e.ctrlKey) {
            e.preventDefault(); 
            startDrag(e, mapOverlay);
            e.stopPropagation();
        }
    }, { passive: false });

    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    window.addEventListener('pointermove', (e) => {
        if (!isDragging || !dragMapInstance) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        if (dragMapInstance === mapOverlay) {
            if (e.altKey) {
                // Rotation Mode
                const sensitivity = 0.5; 
                let newRot = state.currentRotation + (dx * sensitivity);
                state.rangeRot.value = Math.round(newRot);
                setRotation(state.rangeRot.value, state);
            } else {
                // Panning Mode
                const rad = state.currentRotation * (Math.PI / 180);
                const mapDx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
                const mapDy = dx * Math.sin(-rad) + dy * Math.cos(-rad);
                mapOverlay.panBy([-mapDx, -mapDy], { animate: false });
            }
        } else {
            // Standard move for base map
            mapBase.panBy([-dx, -dy], { animate: false });
        }

        lastX = e.clientX;
        lastY = e.clientY;
    });
}
