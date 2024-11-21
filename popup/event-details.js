let storageInterface = chrome.storage.local;

// Get the event ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('eventId');

// Function to display event details
function displayEventDetails(event) {
    const detailsContainer = document.getElementById('eventDetails');
    detailsContainer.innerHTML = ''; // Clear existing content

    // Sort the keys alphabetically
    const sortedKeys = Object.keys(event).sort();

    // Create elements for each property
    sortedKeys.forEach(key => {
        const propertyDiv = document.createElement('div');
        propertyDiv.className = 'property';

        const keyDiv = document.createElement('div');
        keyDiv.className = 'key';
        keyDiv.textContent = key;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'value';
        valueDiv.textContent = event[key];

        propertyDiv.appendChild(keyDiv);
        propertyDiv.appendChild(valueDiv);
        detailsContainer.appendChild(propertyDiv);
    });
}

// Load and display event details
if (eventId) {
    storageInterface.get("events", (result) => {
        const events = result.events || [];
        for (let eventStr of events) {
            const parsedEvent = JSON.parse(eventStr);
            if (parsedEvent.id === eventId) {
                displayEventDetails(parsedEvent);
                break;
            }
        }
    });
}
