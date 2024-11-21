// XPath-related functions
function getXPath(element) {
    if (!element) return '';
    
    // If element has an id, use that directly
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }

    // Get the path parts
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        
        // Add index if there are siblings of the same type
        const siblings = Array.from(element.parentNode?.children || [])
            .filter(e => e.nodeName === element.nodeName);
        
        if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `[${index}]`;
        }
        
        parts.unshift(selector);
        element = element.parentNode;
    }
    
    return '/' + parts.join('/');
}

// Function to find element by XPath
function getElementByXPath(xpath) {
    return document.evaluate(
        xpath, 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
    ).singleNodeValue;
}

// Export functions to be used in other files
window.xpathUtils = {
    getXPath,
    getElementByXPath
};
