// Event tracking and replay functionality
let trackedEventTypes = ["click", "mousedown", "mouseup", "keydown", "scroll", "paste", "cut"];
let storageInterface = chrome.storage.local;
let lastScrollTime = 0;
let lastClickTime = 0;
const SCROLL_THROTTLE = 150; // Throttle scroll events to every 150ms
const CLICK_THROTTLE = 50;
let isRecording = false;

// Create separate event handlers for each event type
const eventHandlers = {
    click: function(event) {
        if (!isRecording) return;
        const now = Date.now();
        if (now - lastClickTime < CLICK_THROTTLE) return;
        lastClickTime = now;
        handleEvent(event);
    },
    mousedown: function(event) {
        if (!isRecording) return;
        handleEvent(event);
    },
    mouseup: function(event) {
        if (!isRecording) return;
        handleEvent(event);
    },
    scroll: function(event) {
        if (!isRecording) return;
        const now = Date.now();
        if (now - lastScrollTime < SCROLL_THROTTLE) return;
        lastScrollTime = now;
        handleEvent(event);
    },
    keydown: function(event) {
        if (!isRecording) return;
        handleEvent(event);
    },
    paste: function(event) {
        if (!isRecording) return;
        handleEvent(event);
    },
    cut: function(event) {
        if (!isRecording) return;
        handleEvent(event);
    }
};

function getEventProps(event) {
    // Get the constructor name (e.g., "MouseEvent", "KeyboardEvent")
    const constructorName = event.constructor.name;
    
    // Initialize event details with core properties
    let eventDetails = {
        constructorName,
        type: event.type,
        url: window.location.href,
        id: createUniqueID(),
        target: window.xpathUtils.getXPath(event.target),
        bubbles: true,
        cancelable: true,
        timestamp: Date.now()
    };

    // For mouse events (click, mousedown, mouseup)
    if (event instanceof MouseEvent) {
        eventDetails.clientX = event.clientX;
        eventDetails.clientY = event.clientY;
        eventDetails.screenX = event.screenX;
        eventDetails.screenY = event.screenY;
        eventDetails.button = event.button;
        eventDetails.buttons = event.buttons;
        eventDetails.altKey = event.altKey;
        eventDetails.ctrlKey = event.ctrlKey;
        eventDetails.shiftKey = event.shiftKey;
        eventDetails.metaKey = event.metaKey;

        // Store the tag name and any relevant attributes
        const targetElement = event.target;
        eventDetails.targetTagName = targetElement.tagName.toLowerCase();
        
        // Store important attributes
        if (targetElement.hasAttribute('id')) {
            eventDetails.targetId = targetElement.getAttribute('id');
        }
        if (targetElement.hasAttribute('class')) {
            eventDetails.targetClass = targetElement.getAttribute('class');
        }
        if (targetElement.hasAttribute('href')) {
            eventDetails.targetHref = targetElement.getAttribute('href');
        }
        
        // Store the element's text content if it's not too long
        const textContent = targetElement.textContent?.trim();
        if (textContent && textContent.length < 100) {
            eventDetails.targetText = textContent;
        }
    }

    // For scroll events, capture scroll position
    if (event.type === 'scroll') {
        const scrollElement = event.target === document ? document.documentElement : event.target;
        const isDocumentScroll = event.target === document;
        eventDetails.scrollTop = isDocumentScroll ? window.pageYOffset : scrollElement.scrollTop;
        eventDetails.scrollLeft = isDocumentScroll ? window.pageXOffset : scrollElement.scrollLeft;
        eventDetails.isDocumentScroll = isDocumentScroll;
    }

    // For keydown events on input elements, capture the input state
    if (event.type === 'keydown' && 
        (event.target instanceof HTMLInputElement || 
         event.target instanceof HTMLTextAreaElement || 
         event.target instanceof HTMLSelectElement)) {
        eventDetails.value = event.target.value;
        eventDetails.selectionStart = event.target.selectionStart;
        eventDetails.selectionEnd = event.target.selectionEnd;
        eventDetails.key = event.key;
        eventDetails.keyCode = event.keyCode;
        eventDetails.inputType = event.target.type || 'text';
    }

    // For paste and cut events
    if (event.type === 'paste' || event.type === 'cut') {
        if (event.target instanceof HTMLInputElement || 
            event.target instanceof HTMLTextAreaElement || 
            event.target instanceof HTMLSelectElement) {
            eventDetails.value = event.target.value;
            eventDetails.selectionStart = event.target.selectionStart;
            eventDetails.selectionEnd = event.target.selectionEnd;
        }
    }

    // Get all enumerable properties from the event
    const eventProps = Object.getOwnPropertyNames(Object.getPrototypeOf(event));
    for (const prop of eventProps) {
        try {
            const value = event[prop];
            // Only include serializable properties
            if (prop !== 'target' && 
                typeof value !== 'function' && 
                typeof value !== 'object' &&
                typeof value !== 'undefined') {
                eventDetails[prop] = value;
            }
        } catch (error) {
            console.log(`Error capturing property ${prop}:`, error);
        }
    }

    return eventDetails;
}

function createEventFromDetails(details, target) {
    // Get the event constructor (MouseEvent, KeyboardEvent, etc.)
    const EventConstructor = window[details.constructorName] || Event;
    
    // Handle scroll events differently
    if (details.type === 'scroll') {
        try {
            if (details.isDocumentScroll) {
                window.scrollTo({
                    top: details.scrollTop,
                    left: details.scrollLeft,
                    behavior: 'smooth'
                });
            } else {
                const scrollElement = target === document ? document.documentElement : target;
                scrollElement.scrollTo({
                    top: details.scrollTop,
                    left: details.scrollLeft,
                    behavior: 'smooth'
                });
            }
            return new Event(details.type);
        } catch (error) {
            console.log('Error during scroll replay:', error);
            return new Event(details.type);
        }
    }

    // Handle mouse events
    if (details.type === 'click' || details.type === 'mousedown' || details.type === 'mouseup') {
        try {
            const mouseInit = {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1,
                screenX: details.screenX,
                screenY: details.screenY,
                clientX: details.clientX,
                clientY: details.clientY,
                ctrlKey: details.ctrlKey,
                altKey: details.altKey,
                shiftKey: details.shiftKey,
                metaKey: details.metaKey,
                button: details.button,
                buttons: details.buttons
            };
            return new MouseEvent(details.type, mouseInit);
        } catch (error) {
            console.log(`Error creating MouseEvent, falling back to Event`, error);
            return new Event(details.type, { bubbles: true, cancelable: true });
        }
    }

    // Handle input value updates from keydown, paste, and cut events
    if ((details.type === 'keydown' || details.type === 'paste' || details.type === 'cut') &&
        (target instanceof HTMLInputElement || 
         target instanceof HTMLTextAreaElement || 
         target instanceof HTMLSelectElement)) {
        
        // For keydown events
        if (details.type === 'keydown') {
            let newValue = details.value || '';
            
            // Handle special keys
            if (details.key === 'Backspace') {
                if (details.selectionStart === details.selectionEnd) {
                    newValue = target.value.slice(0, details.selectionStart - 1) + 
                              target.value.slice(details.selectionStart);
                } else {
                    newValue = target.value.slice(0, details.selectionStart) + 
                              target.value.slice(details.selectionEnd);
                }
            } else if (details.key === 'Delete') {
                if (details.selectionStart === details.selectionEnd) {
                    newValue = target.value.slice(0, details.selectionStart) + 
                              target.value.slice(details.selectionStart + 1);
                } else {
                    newValue = target.value.slice(0, details.selectionStart) + 
                              target.value.slice(details.selectionEnd);
                }
            } else if (details.key.length === 1) {
                // Regular character input
                newValue = target.value.slice(0, details.selectionStart) + 
                          details.key +
                          target.value.slice(details.selectionEnd);
            }
            
            target.value = newValue;
            target.setSelectionRange(details.selectionStart, details.selectionEnd);
        }
        
        // For paste and cut events
        if (details.type === 'paste' || details.type === 'cut') {
            target.value = details.value;
            if (details.selectionStart !== undefined && details.selectionEnd !== undefined) {
                target.setSelectionRange(details.selectionStart, details.selectionEnd);
            }
        }
    }
    
    // Create init object with all captured properties
    const eventInit = Object.keys(details).reduce((acc, key) => {
        if (!['id', 'url', 'target', 'type', 'constructorName', 'scrollTop', 'scrollLeft', 'isDocumentScroll', 
             'timestamp', 'value', 'selectionStart', 'selectionEnd', 'inputType', 'targetTagName', 'targetId', 
             'targetClass', 'targetHref', 'targetText'].includes(key)) {
            acc[key] = details[key];
        }
        return acc;
    }, {});

    // Create and return the event
    try {
        return new EventConstructor(details.type, eventInit);
    } catch (error) {
        console.log(`Error creating ${details.constructorName}, falling back to Event`, error);
        return new Event(details.type, { bubbles: true, cancelable: true });
    }
}

function handleEvent(event) {
    const eventDetails = getEventProps(event);
    
    // Store the event
    storageInterface.get("events", (result) => {
        let events = result.events || [];
        events.push(JSON.stringify(eventDetails));
        storageInterface.set({"events": events}, () => {
            if (chrome.runtime.lastError) {
                console.error('Error storing event:', chrome.runtime.lastError);
            } else {
                console.log('Successfully stored event:', eventDetails);
            }
        });
    });
}

function replayEvents() {
    storageInterface.get("events", async (result) => {
        let events = result.events || [];
        
        // Sort events by timestamp to ensure correct order
        events = events
            .map(event => JSON.parse(event))
            .sort((a, b) => a.timestamp - b.timestamp);

        for (const parsedEvent of events) {
            // Check if event was already executed
            const wasExecuted = await new Promise(resolve => {
                storageInterface.get("executedEvents", (result) => {
                    let executedEvents = result.executedEvents || [];
                    resolve(executedEvents.includes(parsedEvent.id));
                });
            });

            if (wasExecuted) {
                console.log(`Event ${parsedEvent.id} was already executed, skipping...`);
                continue;
            }

            // Add delay between events
            await new Promise(resolve => setTimeout(resolve, 250));

            try {
                // Update the url if its not the same and make sure to wait for the window to load
                if (parsedEvent.url !== window.location.href) {
                    window.location.href = parsedEvent.url;
                    await new Promise(resolve => {
                        window.addEventListener("load", resolve);
                    });
                }

                let eventTarget = window.xpathUtils.getElementByXPath(parsedEvent.target);
                if (eventTarget) {
                    const eventToDispatch = createEventFromDetails(parsedEvent, eventTarget);
                    eventTarget.dispatchEvent(eventToDispatch);
                    console.log(`Executed ${parsedEvent.type} event:`, parsedEvent);
                    
                } else {
                    console.log(`Target element not found for event ${parsedEvent.id}`);
                }
                // Mark event as executed
                await new Promise(resolve => {
                    storageInterface.get("executedEvents", (result) => {
                        let executedEvents = result.executedEvents || [];
                        executedEvents.push(parsedEvent.id);
                        storageInterface.set({"executedEvents": executedEvents}, resolve);
                    });
                });
            } catch (error) {
                console.log(`Error executing event ${parsedEvent.id}:`, error);
            }
        }

        console.log("Finished replaying all events");
        storageInterface.set({"runEvents": 0, "executedEvents": []});
    });
}

function createUniqueID(){
    return Date.now().toString(16).substring(2);
}

// Add event listeners for each event type
function listenerAction(action) {
    Object.keys(eventHandlers).forEach(eventType => {
        const options = {
            capture: true,
            passive: eventType === 'scroll'
        };
        
        if (action === "addEventListener") {
            document[action](eventType, eventHandlers[eventType], options);
            // Also add to window to catch events that might not bubble to document
            window[action](eventType, eventHandlers[eventType], options);
        } else {
            document[action](eventType, eventHandlers[eventType], options);
            window[action](eventType, eventHandlers[eventType], options);
        }
    });
}

// listen for changes in the isRecording state
storageInterface.onChanged.addListener((changes, areaName) => {
    if (changes.isRecording) {
        isRecording = changes.isRecording.newValue === 1;
        if (isRecording) {
            console.log("Starting recording");
            listenerAction("addEventListener");
        } else {
            console.log("Stopping recording");
            listenerAction("removeEventListener");
        }
    } else if (changes.runEvents) {
        if (changes.runEvents.newValue === 1) {
            console.log("Replaying events");
            replayEvents();
        }
    }
});

// Initialize recording state
storageInterface.get("isRecording", (result) => {
    isRecording = result.isRecording === 1;
    if (isRecording) {
        listenerAction("addEventListener");
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "markForScraping") {
        // Get the element that was right-clicked
        const element = document.elementFromPoint(lastClickX, lastClickY);
        if (element) {
            // Get computed styles as a plain object
            const computedStyle = window.getComputedStyle(element);
            const styles = {};
            for (let i = 0; i < computedStyle.length; i++) {
                const prop = computedStyle[i];
                styles[prop] = computedStyle.getPropertyValue(prop);
            }

            const rect = element.getBoundingClientRect();
            
            // Create flattened event details
            const scrapingDetails = {
                type: 'scraping_mark',
                timestamp: Date.now(),
                id: createUniqueID(),
                xpath: window.xpathUtils.getXPath(element),
                tagName: element.tagName.toLowerCase(),
                elementId: element.id || '',
                className: element.className || '',
                elementName: element.name || '',
                href: element.href || '',
                src: element.src || '',
                alt: element.alt || '',
                title: element.title || '',
                textContent: element.textContent?.trim() || '',
                value: element.value || '',
                inputType: element.type || '',
                checked: element.checked || false,
                selected: element.selected || false,
                placeholder: element.placeholder || '',
                attributes: JSON.stringify(Array.from(element.attributes).map(attr => ({
                    name: attr.name,
                    value: attr.value
                }))),
                boundingTop: rect.top,
                boundingRight: rect.right,
                boundingBottom: rect.bottom,
                boundingLeft: rect.left,
                boundingWidth: rect.width,
                boundingHeight: rect.height,
                boundingX: rect.x,
                boundingY: rect.y,
                computedStyles: JSON.stringify(styles),
                innerHTML: element.innerHTML,
                outerHTML: element.outerHTML,
                childElementCount: element.childElementCount,
                isVisible: !(element.offsetParent === null),
                zIndex: computedStyle.zIndex,
                position: computedStyle.position,
                url: window.location.href,
                pageTitle: document.title,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                clientX: lastClickX,
                clientY: lastClickY,
                screenX: lastScreenX,
                screenY: lastScreenY
            };

            // Store the scraping mark event
            storageInterface.get("events", (result) => {
                let events = result.events || [];
                events.push(JSON.stringify(scrapingDetails));
                storageInterface.set({"events": events}, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error storing scraping mark:', chrome.runtime.lastError);
                    } else {
                        console.log('Successfully marked element for scraping:', scrapingDetails);
                        // Visual feedback
                        element.style.outline = '2px solid #ff4081';
                        setTimeout(() => {
                            element.style.outline = '';
                        }, 1000);
                    }
                });
            });
        }
    }
});

// Track last click position for context menu
let lastClickX = 0;
let lastClickY = 0;
let lastScreenX = 0;
let lastScreenY = 0;
document.addEventListener('mousedown', function(e) {
    lastClickX = e.clientX;
    lastClickY = e.clientY;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
}, true);

storageInterface.get("runEvents", (result) => {
    if (result.runEvents === 1) {
        replayEvents();
    }
});
