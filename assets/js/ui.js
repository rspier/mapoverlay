export function toggleSidebar(uiPanel, iconCollapse) {
    const isCollapsed = uiPanel.classList.toggle('collapsed');
    iconCollapse.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

export function setControlMode(mode, state) {
    const divOverlay = document.getElementById('map-overlay');
    const { btnBase, btnOverlay } = state;
    state.mode = mode;
    
    if (mode === 'base') {
        divOverlay.classList.add('interaction-disabled');
        divOverlay.classList.remove('interaction-enabled');
        state.mapBase.dragging.enable();
        btnBase.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-blue-500 text-white shadow-sm";
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
