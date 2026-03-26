export function toggleSidebar(state) {
    const { uiPanel, iconCollapse, mapBase, mapOverlay } = state;
    const sidebarContainer = document.getElementById('sidebar-container');
    const isCollapsed = uiPanel.classList.toggle('collapsed');
    
    if (sidebarContainer) {
        sidebarContainer.classList.toggle('collapsed', isCollapsed);
    }

    const mapWrapper = document.getElementById('map-wrapper');
    
    if (mapWrapper) {
        mapWrapper.classList.toggle('with-sidebar', !isCollapsed);
    }

    if (iconCollapse) {
        const isDesktop = window.innerWidth >= 768;
        if (isDesktop) {
            iconCollapse.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(90deg)';
        } else {
            iconCollapse.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    // Invalidate map size after transition
    setTimeout(() => {
        if (mapBase) mapBase.invalidateSize();
        if (mapOverlay) mapOverlay.invalidateSize();
    }, 310);
}

/**
 * Setup swipe gesture for the drawer (mobile only)
 */
export function setupDrawerSwipe(state) {
    const { uiPanel, btnHandle: handle, iconCollapse } = state;
    if (!handle || !uiPanel) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let startTime = 0;

    const onStart = (e) => {
        // Desktop check - usually handle is hidden on desktop anyway
        if (window.innerWidth >= 768) return;
        
        // If clicking on a range slider or select, don't start a drag
        if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
        if (e.target.tagName === 'BUTTON' && e.target !== handle) return;

        // Only drag from handle or if at the very top of scrollable content
        const isCollapsed = uiPanel.classList.contains('collapsed');
        if (!isCollapsed && uiPanel.scrollTop > 5 && e.target !== handle && !handle.contains(e.target)) return;

        startY = e.clientY;
        currentY = e.clientY;
        startTime = Date.now();
        isDragging = true;
        uiPanel.style.transition = 'none';
        
        // Capture pointer
        if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
        if (!isDragging) return;
        
        currentY = e.clientY;
        const diff = currentY - startY;
        const isCollapsed = uiPanel.classList.contains('collapsed');

        if (isCollapsed) {
            // Dragging UP to open
            if (diff < 0) {
                uiPanel.style.transform = `translateY(${diff}px)`;
            } else {
                uiPanel.style.transform = '';
            }
        } else {
            // Dragging DOWN to close
            if (diff > 0) {
                uiPanel.style.transform = `translateY(${diff}px)`;
            } else {
                uiPanel.style.transform = '';
            }
        }
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        uiPanel.style.transition = '';
        const diff = currentY - startY;
        const duration = Date.now() - startTime;
        const velocity = Math.abs(diff) / (duration || 1);
        
        const isCollapsed = uiPanel.classList.contains('collapsed');
        const threshold = 100;
        const velocityThreshold = 0.5;

        // Success if swiped far enough or fast enough
        const isSwipeSuccess = Math.abs(diff) > threshold || (Math.abs(diff) > 20 && velocity > velocityThreshold);

        if (isCollapsed) {
            // Check if we swiped up to open
            if (isSwipeSuccess && diff < 0) {
                toggleSidebar(state); // Use common logic
            }
        } else {
            // Check if we swiped down to close
            if (isSwipeSuccess && diff > 0) {
                toggleSidebar(state); // Use common logic
            }
        }

        uiPanel.style.transform = '';
        if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
    };

    handle.addEventListener('pointerdown', onStart);
    uiPanel.addEventListener('pointerdown', onStart);
    
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
}

export function setControlMode(mode, state) {
    const divOverlay = document.getElementById('map-overlay');
    const { btnBase, btnOverlay } = state;
    state.mode = mode;
    
    if (mode === 'base') {
        divOverlay.classList.add('interaction-disabled');
        divOverlay.classList.remove('interaction-enabled');
        state.mapBase.dragging.enable();
        btnBase.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-purple-600 text-white shadow-sm";
        btnOverlay.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors text-gray-600 hover:bg-gray-50";
    } else {
        divOverlay.classList.remove('interaction-disabled');
        divOverlay.classList.add('interaction-enabled');
        state.mapBase.dragging.disable();
        btnOverlay.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-blue-500 text-white shadow-sm";
        btnBase.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors text-gray-600 hover:bg-gray-50";
    }
}

export function swapLayers(state, tileProviders, mapBase, mapOverlay, mapFuncs) {
    const tempIndex = state.selBase.value;
    state.selBase.value = state.selOverlay.value;
    state.selOverlay.value = tempIndex;

    // Refresh layers
    mapFuncs.setLayer(mapBase, tileProviders[state.selBase.value], false, state);
    mapFuncs.setLayer(mapOverlay, tileProviders[state.selOverlay.value], true, state);
}
