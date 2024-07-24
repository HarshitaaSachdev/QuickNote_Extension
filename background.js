chrome.alarms.onAlarm.addListener(alarm => {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const note = notes.find(note => note.timestamp.toString() === alarm.name);

        if (note) {
            chrome.notifications.create('', {
                type: 'basic',
                 iconUrl: 'icons/note128.png',
                title: 'QuickNote Reminder',
                message: `Reminder for note: ${note.text}`
            });
        }
    });
});
