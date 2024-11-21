// Handle extension icon click
chrome.action.onClicked.addListener(() => {
    // Get system display information
    chrome.system.display.getInfo((displays) => {
        // Use primary display or first available display
        const display = displays[0];
        
        // Calculate window dimensions (70% of screen size)
        const width = Math.floor(display.workArea.width * 0.7);
        const height = Math.floor(display.workArea.height * 0.7);
        
        // Calculate center position
        const left = Math.floor((display.workArea.width - width) / 2);
        const top = Math.floor((display.workArea.height - height) / 2);

        // Create a new window with the popup
        chrome.windows.create({
            url: chrome.runtime.getURL("popup/popup.html"),
            type: "popup",
            width: width,
            height: height,
            left: left,
            top: top,
            focused: true
        });
    });
});

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "markForScraping",
        title: "Mark for Scraping",
        contexts: ["all"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "markForScraping") {
        chrome.tabs.sendMessage(tab.id, { 
            action: "markForScraping",
            targetElementInfo: {
                tagName: info.targetElementTag,
                src: info.srcUrl,
                link: info.linkUrl,
                text: info.selectionText
            }
        });
    }
});

// Listen for window updates to handle window state
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.get(windowId, { populate: true }, (window) => {
            if (window.type === "popup" && 
                window.tabs && 
                window.tabs[0].url.includes("popup.html")) {
                // The popup window was focused
                console.log("EventHive window focused");
            }
        });
    }
});