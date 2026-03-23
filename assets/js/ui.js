export function toggleSidebar(uiPanel, iconCollapse) {
    const isCollapsed = uiPanel.classList.toggle('collapsed');
    iconCollapse.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

export function setControlMode(mode, state) {
    const divOverlay = document.getElementById('map-overlay');
    const { btnBase, btnOverlay } = state;
    
    if (mode === 'base') {
        divOverlay.classList.add('interaction-disabled');
        divOverlay.classList.remove('interaction-enabled');
        btnBase.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-blue-500 text-white shadow-sm";
        btnOverlay.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors text-gray-600 hover:bg-gray-50";
    } else {
        divOverlay.classList.remove('interaction-disabled');
        divOverlay.classList.add('interaction-enabled');
        btnOverlay.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors bg-blue-500 text-white shadow-sm";
        btnBase.className = "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors text-gray-600 hover:bg-gray-50";
    }
}
