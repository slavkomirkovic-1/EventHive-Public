document.addEventListener('DOMContentLoaded', () => {
    // Handle search box
    const searchBox = document.querySelector('.search-box');
    searchBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchBox.value.trim();
            if (query) {
                if (query.startsWith('http://') || query.startsWith('https://') || query.includes('.')) {
                    let url = query;
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    window.location.href = url;
                } else {
                    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                }
            }
        }
    });

    // Define shortcuts with Material Icons
    const shortcuts = [
        { name: 'Gmail', url: 'https://mail.google.com', icon: 'mail' },
        { name: 'Drive', url: 'https://drive.google.com', icon: 'folder' },
        { name: 'Calendar', url: 'https://calendar.google.com', icon: 'calendar_month' },
        { name: 'Maps', url: 'https://maps.google.com', icon: 'location_on' },
        { name: 'YouTube', url: 'https://youtube.com', icon: 'smart_display' },
        { name: 'Photos', url: 'https://photos.google.com', icon: 'photo_library' },
        { name: 'Translate', url: 'https://translate.google.com', icon: 'translate' },
        { name: 'Keep', url: 'https://keep.google.com', icon: 'note_alt' }
    ];

    // Add shortcuts to the page
    const shortcutsContainer = document.getElementById('shortcuts');
    shortcuts.forEach(shortcut => {
        const shortcutElement = document.createElement('a');
        shortcutElement.href = shortcut.url;
        shortcutElement.className = 'shortcut';
        shortcutElement.innerHTML = `
            <div class="shortcut-icon">
                <span class="material-icons-round">${shortcut.icon}</span>
            </div>
            <div class="shortcut-name">${shortcut.name}</div>
        `;
        shortcutsContainer.appendChild(shortcutElement);
    });
});
