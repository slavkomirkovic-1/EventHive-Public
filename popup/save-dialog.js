document.addEventListener('DOMContentLoaded', () => {
    const eventList = document.getElementById('eventList');
    const selectAll = document.getElementById('selectAll');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadLink = document.getElementById('downloadLink');

    // Get events from storage and populate the list
    chrome.storage.local.get('events', (result) => {
        const events = result.events || [];
        events.forEach((event, index) => {
            const eventData = JSON.parse(event);
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `event-${index}`;
            checkbox.checked = true;
            checkbox.dataset.eventIndex = index;

            const label = document.createElement('label');
            label.htmlFor = `event-${index}`;
            label.textContent = `${eventData.id}: ${eventData.type}`;

            eventItem.appendChild(checkbox);
            eventItem.appendChild(label);
            eventList.appendChild(eventItem);
        });

        // Update select all state
        updateSelectAllState();
    });

    // Select All functionality
    selectAll.addEventListener('change', (e) => {
        const checkboxes = eventList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
    });

    // Update select all state when individual checkboxes change
    eventList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            updateSelectAllState();
        }
    });

    // Save button click handler
    saveBtn.addEventListener('click', () => {
        chrome.storage.local.get('events', (result) => {
            const events = result.events || [];
            const selectedEvents = [];
            
            // Get all checkboxes
            const checkboxes = eventList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const eventIndex = parseInt(checkbox.dataset.eventIndex);
                    const eventData = JSON.parse(events[eventIndex]);
                    selectedEvents.push(eventData);
                }
            });

            // Create the JSON file
            const jsonContent = JSON.stringify(selectedEvents, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Set up download
            downloadLink.href = url;
            downloadLink.download = 'eventhive-events.json';
            
            // Trigger download and close window
            downloadLink.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                window.close();
            }, 100);
        });
    });

    // Cancel button click handler
    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    function updateSelectAllState() {
        const checkboxes = Array.from(eventList.querySelectorAll('input[type="checkbox"]'));
        const allChecked = checkboxes.every(checkbox => checkbox.checked);
        const someChecked = checkboxes.some(checkbox => checkbox.checked);
        
        selectAll.checked = allChecked;
        selectAll.indeterminate = someChecked && !allChecked;
    }
});
