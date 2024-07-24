const templates = {
    "meeting-notes": `Meeting Notes
Date: 
Attendees: 
Agenda: 
Notes: 
Action Items: `,

    "to-do-list": `To-Do List
1. 
2. 
3. 
4. 
5. `,

    "journal-entry": `Journal Entry
Date: 
Mood: 
Highlights: 
Thoughts: `
};

document.addEventListener('DOMContentLoaded', () => {
    displayNotes();
    displayNoteHistory();
    loadCategories(); // Load categories on page load
    

    document.getElementById('save-note').addEventListener('click', saveNote);
    document.getElementById('search-bar').addEventListener('input', filterNotes);
    document.getElementById('save-edit-note').addEventListener('click', saveEditedNote);
    document.querySelector('.close-modal').addEventListener('click', closeEditModal);
    document.querySelector('.close-history-modal').addEventListener('click', closeHistoryModal);
    document.getElementById('template-selector').addEventListener('change', loadTemplate);
    document.getElementById('view-history').addEventListener('click', openHistoryModal);
    document.getElementById('add-category').addEventListener('click', addCategory);
    // JavaScript to handle dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    document.getElementById('delete-category').addEventListener('click', promptDeleteCategory);
    document.getElementById('category-selector').addEventListener('contextmenu', function (event) {
        event.preventDefault();
        promptDeleteCategory();
    });

});


function loadTemplate() {
    const templateKey = document.getElementById('template-selector').value;
    if (templateKey && templates[templateKey]) {
        document.getElementById('note-input').value = templates[templateKey];
    } else {
        document.getElementById('note-input').value = '';
    }
}
function promptDeleteCategory() {
    const categoryToDelete = prompt('Enter the category you want to delete:');
    if (categoryToDelete) {
        deleteCategory(categoryToDelete);   
    }
}
function showToast(type, message) {
    

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add message and icon to toast
    toast.innerHTML = `
   
        <span>${message}</span>
        <span class="close">&times;</span>
    `;
    
    // Append toast to container
    document.getElementById('toast-container').appendChild(toast);
    
    // Show toast with animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500); // Match this with the transition duration
    }, 5000);
}

function deleteCategory(categoryToDelete) {
    chrome.storage.sync.get('categories', data => {
        const categories = data.categories || [];
        
        if (categories.includes(categoryToDelete)) {
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            chrome.storage.sync.set({ categories: updatedCategories }, () => {
                loadCategories(); // Reload categories
                showToast('success', 'Category deleted successfully!');
            });

            // Remove category from existing notes
            chrome.storage.sync.get('notes', data => {
                const notes = data.notes || [];
                const updatedNotes = notes.map(note => {
                    if (note.category === categoryToDelete) {
                        return { ...note, category: '' }; // Remove category from note
                    }
                    return note;
                });
                chrome.storage.sync.set({ notes: updatedNotes }, () => {
                    displayNotes(); // Refresh notes display
                });
            });
        } else {
            showToast('error', 'Category does not exist!');
        }
    });
}







function saveNote() {
    const noteText = document.getElementById('note-input').value;
    const reminderTime = document.getElementById('reminder-time').value;
    const tag = document.getElementById('note-tag').value;
    const category = document.getElementById('category-selector').value;

    if (!noteText) return;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const url = tabs[0].url;
        const note = {
            text: noteText,
            url: url,
            timestamp: new Date().getTime(),
            reminderTime: reminderTime || null,
            tag: tag || '',
            category: category || '' // Add category to note
        };
        saveToStorage(note);
        logNoteHistory('created', note);
        showToast('success','Note saved')
    });
}

function saveToStorage(note) {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        notes.push(note);
        chrome.storage.sync.set({ notes }, () => {
            document.getElementById('note-input').value = '';
            document.getElementById('reminder-time').value = '';
            document.getElementById('note-tag').value = '';
            document.getElementById('category-selector').value = ''; // Clear category selector
            displayNotes();
        });
    });
}

function displayNotes() {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const notesContainer = document.getElementById('notes');
        notesContainer.innerHTML = '';
        notes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note';
            noteElement.innerHTML = `
                <p>${note.text}</p>
                <small>${note.url}</small>
                ${note.reminderTime ? `<div class="reminder">Reminder: ${new Date(note.reminderTime).toLocaleString()}</div>` : ''}
                ${note.tag ? `<span class="tag ${note.tag}">${note.tag}</span>` : ''}
                ${note.category ? `<span class="category ${note.category}">${note.category}</span>` : ''}
                <div class="note-actions">
                    <button data-timestamp="${note.timestamp}" class="edit-note">Edit</button>
                    <button data-timestamp="${note.timestamp}" class="delete-note">Delete</button>
                    <i data-timestamp="${note.timestamp}" class="fas fa-share-alt share-note"></i>
                </div>
            `;
            notesContainer.appendChild(noteElement);
            
        });

        document.querySelectorAll('.edit-note').forEach(button => {
            button.addEventListener('click', (e) => {
                const timestamp = parseInt(e.target.getAttribute('data-timestamp'), 10);
                openEditModal(timestamp);
                

            });
        });
        document.querySelectorAll('.delete-note').forEach(button => {
            button.addEventListener('click', (e) => {
                const timestamp = parseInt(e.target.getAttribute('data-timestamp'), 10);
                deleteNote(timestamp);
            });
        });
        document.querySelectorAll('.share-note').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const timestamp = parseInt(e.target.getAttribute('data-timestamp'), 10);
                shareNoteByEmail(timestamp);
            });
        });
    });
}

function filterNotes() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    document.querySelectorAll('.note').forEach(noteElement => {
        const text = noteElement.querySelector('p').textContent.toLowerCase();
        const tag = noteElement.querySelector('.tag') ? noteElement.querySelector('.tag').textContent.toLowerCase() : '';
        const category = noteElement.querySelector('.category') ? noteElement.querySelector('.category').textContent.toLowerCase() : '';
        noteElement.style.display = text.includes(query) || tag.includes(query) || category.includes(query) ? '' : 'none';
    });
}

function openEditModal(timestamp) {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const note = notes.find(note => note.timestamp === timestamp);
        if (note) {
            document.getElementById('edit-note-input').value = note.text;
            document.getElementById('edit-reminder-time').value = note.reminderTime ? new Date(note.reminderTime).toISOString().slice(0, 16) : '';
            document.getElementById('edit-note-tag').value = note.tag || '';
            document.getElementById('edit-note-category').value = note.category || '';
            document.getElementById('edit-modal').style.display = 'flex';
            document.getElementById('save-edit-note').setAttribute('data-timestamp', timestamp);
        }
    });
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function saveEditedNote() {
    const timestamp = parseInt(document.getElementById('save-edit-note').getAttribute('data-timestamp'), 10);
    const noteText = document.getElementById('edit-note-input').value;
    const reminderTime = document.getElementById('edit-reminder-time').value;
    const tag = document.getElementById('edit-note-tag').value;
    const category = document.getElementById('edit-note-category').value;

    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const updatedNotes = notes.map(note => {
            if (note.timestamp === timestamp) {
                const oldNote = { ...note }; // Keep a copy of the old note for history
                const updatedNote = {
                    ...note,
                    text: noteText,
                    reminderTime: reminderTime || null,
                    tag: tag || '',
                    category: category || ''
                };
                logNoteHistory('edited', oldNote, updatedNote);
                return updatedNote;
            }
            return note;
        });
        chrome.storage.sync.set({ notes: updatedNotes }, () => {
            closeEditModal();
            displayNotes();
            showToast('success', 'Note Edited successfully!');

        });
    });
}

function deleteNote(timestamp) {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const updatedNotes = notes.filter(note => note.timestamp !== timestamp);
        chrome.storage.sync.set({ notes: updatedNotes }, () => {
            logNoteHistory('deleted', notes.find(note => note.timestamp === timestamp));
            displayNotes();
            showToast('success', 'Note Deleted successfully!');
        });
    });
}

function logNoteHistory(action, oldNote, updatedNote) {
    const historyItem = {
        action: action,
        oldNote: oldNote || null,
        updatedNote: updatedNote || null,
        timestamp: new Date().getTime() // Current timestamp
    };

    chrome.storage.sync.get('noteHistory', data => {
        const history = data.noteHistory || [];
        history.push(historyItem);
        chrome.storage.sync.set({ noteHistory: history });
    });
}

function cleanupOldHistory() {
    const retentionPeriod = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
    const currentTime = new Date().getTime();

    chrome.storage.sync.get('noteHistory', data => {
        const history = data.noteHistory || [];
        const updatedHistory = history.filter(item => (currentTime - item.timestamp) <= retentionPeriod);
        chrome.storage.sync.set({ noteHistory: updatedHistory });
    });
}

// Run cleanupOldHistory every 24 hours (86400000 milliseconds)
setInterval(cleanupOldHistory, 24 * 60 * 60 * 1000);

// Run cleanupOldHistory immediately on startup
cleanupOldHistory();


function openHistoryModal() {
    const historyModal = document.getElementById('history-modal');
    const historyContainer = document.getElementById('history');
    
    chrome.storage.sync.get('noteHistory', data => {
        const history = data.noteHistory || [];
        historyContainer.innerHTML = '';
        history.forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.innerHTML = `
                <p><strong>Action:</strong> ${item.action}</p>
                <p><strong>Timestamp:</strong> ${new Date(item.timestamp).toLocaleString()}</p>
                ${item.oldNote ? `<p><strong>Old Note:</strong> ${item.oldNote.text}</p>` : ''}
                ${item.updatedNote ? `<p><strong>Updated Note:</strong> ${item.updatedNote.text}</p>` : ''}
                <button data-timestamp="${item.timestamp}" class="delete-history">Delete</button>
                <hr>
            `;
            historyContainer.appendChild(historyElement);
            
        });

        document.querySelectorAll('.delete-history').forEach(button => {
            button.addEventListener('click', (e) => {
              var input = prompt("Are you sure you want to delete this history?")
              if(input === null || input.toLowerCase() === "no" ) {
                    return false;
              } 
                const timestamp = parseInt(e.target.getAttribute('data-timestamp'), 10);
                deleteNoteHistory(timestamp);
            });
        });

        historyModal.style.display = 'flex';
    });
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

function deleteNoteHistory(timestamp) {
    chrome.storage.sync.get('noteHistory', data => {
        const history = data.noteHistory || [];
        const updatedHistory = history.filter(item => item.timestamp !== timestamp);
        chrome.storage.sync.set({ noteHistory: updatedHistory }, () => {
            openHistoryModal(); // Refresh the history modal
        });
    });
}

function shareNoteByEmail(timestamp) {
    chrome.storage.sync.get('notes', data => {
        const notes = data.notes || [];
        const note = notes.find(note => note.timestamp === timestamp);
        if (note) {
            const subject = 'Shared Note';
            const body = `Here is the note you shared:\n\n${note.text}\n\nURL: ${note.url}\nReminder Time: ${note.reminderTime ? new Date(note.reminderTime).toLocaleString() : 'None'}\nTag: ${note.tag}\nCategory: ${note.category}`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        }
    });
}




// Category Management
function loadCategories() {
    chrome.storage.sync.get('categories', data => {
        const categories = data.categories || [];
        const categorySelector = document.getElementById('category-selector');
        const editCategorySelector = document.getElementById('edit-note-category');

        // Clear existing options
        categorySelector.innerHTML = '<option value="">Select a category</option>';
        editCategorySelector.innerHTML = '<option value="">Select a category</option>';

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelector.appendChild(option);
            editCategorySelector.appendChild(option.cloneNode(true));
        });
    });
}
function addCategory() {
    const newCategory = prompt('Enter new category:');
    if (newCategory) {
        chrome.storage.sync.get('categories', data => {
            const categories = data.categories || [];
            if (!categories.includes(newCategory)) {
                categories.push(newCategory);
                chrome.storage.sync.set({ categories }, () => {
                    loadCategories(); // Reload categories
                    showToast('success', 'Category added successfully!');
                });
            } else {
                showToast('warning', 'Category already exists!');
            }
        });
    } else {
        showToast('error', 'Category name cannot be empty!');
    }
}

function displayNoteHistory() {
    const historyContainer = document.getElementById('history');
    chrome.storage.sync.get('noteHistory', data => {
        const history = data.noteHistory || [];
        historyContainer.innerHTML = '';
        
        history.forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.innerHTML = `
                <p><strong>Action:</strong> ${item.action}</p>
                <p><strong>Timestamp:</strong> ${new Date(item.timestamp).toLocaleString()}</p>
                ${item.oldNote ? `<p><strong>Old Note:</strong> ${item.oldNote.text}</p>` : ''}
                ${item.updatedNote ? `<p><strong>Updated Note:</strong> ${item.updatedNote.text}</p>` : ''}
                <button data-timestamp="${item.timestamp}" class="delete-history">Delete</button>
                <hr>
            `;
            historyContainer.appendChild(historyElement);
        });
    });
}


darkModeToggle.addEventListener('change', function() {
  if (darkModeToggle.checked) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
});

// guide.js

// JavaScript to toggle the user guide modal
document.addEventListener('DOMContentLoaded', () => {
    const userGuideModal = document.getElementById('user-guide-modal');
    const openUserGuideButton = document.getElementById('open-user-guide'); // Button to open guide
    const closeUserGuideModal = document.querySelector('.close-user-guide-modal');

    // Open the modal
    openUserGuideButton.addEventListener('click', () => {
        userGuideModal.style.display = 'block';
    });

    // Close the modal
    closeUserGuideModal.addEventListener('click', () => {
        userGuideModal.style.display = 'none';
    });

    // Close the modal if the user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === userGuideModal) {
            userGuideModal.style.display = 'none';
        }
    });
});
