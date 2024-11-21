// Event tracking and replay functionality
let trackedEventTypes = ["click", "mousedown", "input", "keydown"];
let storageInterface = chrome.storage.local;

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
        cancelable: true
    };

    // For input elements, capture the value
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLSelectElement) {
        eventDetails.value = event.target.value;
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
    
    // Create init object with all captured properties
    const eventInit = Object.keys(details).reduce((acc, key) => {
        if (!['id', 'url', 'target', 'type', 'constructorName'].includes(key)) {
            acc[key] = details[key];
        }
        return acc;
    }, {});

    // Create and return the event
    try {
        const event = new EventConstructor(details.type, eventInit);
        
        // Handle properties that need to be set directly
        if (details.value !== undefined && 
            (target instanceof HTMLInputElement || 
             target instanceof HTMLTextAreaElement || 
             target instanceof HTMLSelectElement)) {
            target.value = details.value;
        }
        
        return event;
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
        storageInterface.set({"events": events});
        console.log('Stored event:', eventDetails);
    });
}

function replayEvents() {
    storageInterface.get("events", async (result) => {
        let events = result.events || [];
        
        for (const event of events) {
            let parsedEvent = JSON.parse(event);
            
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
                    
                    // Mark event as executed
                    await new Promise(resolve => {
                        storageInterface.get("executedEvents", (result) => {
                            let executedEvents = result.executedEvents || [];
                            executedEvents.push(parsedEvent.id);
                            storageInterface.set({"executedEvents": executedEvents}, resolve);
                        });
                    });
                } else {
                    console.log(`Target element not found for event ${parsedEvent.id}`);
                }
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
    trackedEventTypes.forEach(eventType => {
        document[action](eventType, handleEvent, true);
    });
}

// listen for changes in the isRecording state
storageInterface.onChanged.addListener((changes, areaName) => {
    console.log(changes);
    if (changes.isRecording) {
        if (changes.isRecording.newValue === 1) {
            listenerAction("addEventListener");
        } else {
            listenerAction("removeEventListener");
        }
    }else if (changes.runEvents) {
        if (changes.runEvents.newValue === 1) {
            console.log("Replaying events");
            replayEvents();
        }
    }
});

// Check if the isRecording state is set to 1
storageInterface.get("isRecording", (result) => {
    if (result.isRecording === 1) {
        listenerAction("addEventListener");
    }
});

storageInterface.get("runEvents", (result) => {
    if (result.runEvents === 1) {
        replayEvents();
    }
});
