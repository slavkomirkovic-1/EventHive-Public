let storageInterface = chrome.storage.local;
let runningState = 0;
let playingState = 0;

function setupListeners() {
    let recordButton = document.getElementById("record");
    let playButton = document.getElementById("play");
    let clearButton = document.getElementById("clear");
    let saveButton = document.getElementById("save");
    let loadButton = document.getElementById("load");

    // Event listener for the play button
    playButton.addEventListener("click", () => {
        console.log("Play button clicked, current state:", playingState);
        playingState = playingState === 1 ? 0 : 1;
        
        if (playingState === 1) {
            storageInterface.set({"runEvents": 1}, () => {
                console.log("Set runEvents to 1");
                playButton.textContent = "Stop";
            });
        } else {
            storageInterface.set({"runEvents": 0}, () => {
                console.log("Set runEvents to 0");
                playButton.textContent = "Play";
            });
        }
    });

    // Event listener for the record button
    recordButton.addEventListener("click", () => {
        if (runningState === 1) {
            // Stop recording
            storageInterface.set({"isRecording": 0});
            runningState = 0;
            recordButton.textContent = "Record";
        } else {
            // Start recording
            storageInterface.set({"isRecording": 1});
            runningState = 1;
            recordButton.textContent = "Stop"       
        }
    });

    // Event listener for clear button
    clearButton.addEventListener("click", async () => {
        await clearEvents();
    });

    // Event listener for save button
    saveButton.addEventListener("click", () => {
        chrome.windows.create({
            url: chrome.runtime.getURL('popup/save-dialog.html'),
            type: 'popup',
            width: 600,
            height: 600
        });
    });

    // Event listener for load button
    loadButton.addEventListener("click", () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const loadedEvents = JSON.parse(e.target.result);
                    
                    // Get current events to merge with loaded ones
                    storageInterface.get("events", (result) => {
                        let currentEvents = (result.events || []).map(event => JSON.parse(event));
                        
                        // Find the highest existing ID
                        let maxId = currentEvents.reduce((max, event) => 
                            Math.max(max, parseInt(event.id) || 0), 0);
                        
                        // Process loaded events
                        const processedEvents = loadedEvents.map(event => {
                            // If we're adding to existing events, assign new IDs
                            if (currentEvents.length > 0) {
                                maxId++;
                                event.id = maxId.toString();
                            }
                            return event;
                        });
                        
                        // Merge events if there are existing ones, otherwise use just loaded ones
                        const mergedEvents = [...currentEvents, ...processedEvents];
                        
                        // Convert back to storage format
                        const storageEvents = mergedEvents.map(event => JSON.stringify(event));
                        
                        // Update storage
                        storageInterface.set({ "events": storageEvents }, () => {
                            // Refresh the list with animation
                            let itemList = document.getElementById("itemList");
                            itemList.innerHTML = "";
                            
                            // Add all events with staggered animation
                            mergedEvents.forEach((event, index) => {
                                setTimeout(() => {
                                    let option = document.createElement("option");
                                    option.id = event.id;
                                    option.textContent = `${event.id}: ${event.type}`;
                                    option.style.animation = 'itemAppear 0.3s ease-out';
                                    itemList.appendChild(option);
                                }, index * 50); // 50ms delay between each item
                            });
                        });
                    });
                } catch (error) {
                    console.error('Error loading events:', error);
                    alert('Error loading events file. Please make sure it\'s a valid EventHive JSON file.');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    });
}

async function clearEvents() {
    const itemList = document.getElementById('itemList');
    const options = Array.from(itemList.getElementsByTagName('option'));
    
    if (options.length === 0) return;

    // Animate each option with a slight delay
    options.forEach((option, index) => {
        setTimeout(() => {
            option.classList.add('pop-out');
        }, index * 50); // 50ms delay between each option
    });

    // Wait for all animations to complete
    setTimeout(() => {
        itemList.innerHTML = '';
        storageInterface.set({"events": []}, () => {
            updateStates();
        });
    }, (options.length * 50) + 200); // Total delay plus animation duration
}

function updateStates() {
    // Check for saved recording state and update the button accordingly
    storageInterface.get("isRecording", (result) => {
        runningState = result.isRecording || 0;

        // Update button text based on running state
        let recordButton = document.getElementById("record");
        if (runningState === 1) {
            recordButton.textContent = "Stop";
        } else {
            recordButton.textContent = "Record";
        }
    });

    // Check for saved playing state and update the button accordingly
    storageInterface.get("runEvents", (result) => {
        playingState = result.runEvents || 0;
        let playButton = document.getElementById("play");
        if (playingState === 1) {
            playButton.textContent = "Stop";
        } else {
            playButton.textContent = "Play";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Get saved events from local storage and display them in the listbox
    storageInterface.get("events", (result) => {
        let events = result.events || [];
        let itemList = document.getElementById("itemList");
        events.forEach((event, index) => {
            let convertedEvent = JSON.parse(event);
            let option = document.createElement("option");
            option.id = convertedEvent.id;
            option.textContent = `${convertedEvent.id}: ${convertedEvent.type}`;
            option.style.animation = 'itemAppear 0.3s ease-out';
            // Add a small delay for each item to create a staggered animation
            setTimeout(() => {
                itemList.appendChild(option);
            }, index * 50);
        });
    });

    setupListeners();
    updateStates();
});

// Monitor the changes in the runningState and playingState
storageInterface.onChanged.addListener((changes, areaName) => {
    if (changes.isRecording || changes.runEvents) {
        updateStates();
    }
    
    // Add real-time event list updates
    if (changes.events) {
        const newEvents = changes.events.newValue || [];
        const oldEvents = changes.events.oldValue || [];
        
        // If we have new events
        if (newEvents.length > oldEvents.length) {
            const itemList = document.getElementById("itemList");
            
            // Get only the newly added events
            const newEventItems = newEvents.slice(oldEvents.length);
            
            // Add new events with animation
            newEventItems.forEach((event, index) => {
                const convertedEvent = JSON.parse(event);
                const option = document.createElement("option");
                option.id = convertedEvent.id;
                option.textContent = `${convertedEvent.id}: ${convertedEvent.type}`;
                option.style.animation = 'itemAppear 0.3s ease-out';
                itemList.appendChild(option);
            });
        }
    }
});

// Event listener for clicking on events to show details
document.addEventListener("click", (event) => { 
    if (event.target.tagName === "OPTION") {
        chrome.windows.create({
            url: chrome.runtime.getURL(`popup/event-details.html?eventId=${event.target.id}`),
            type: 'popup',
            width: 800,
            height: 600
        });
    }
});