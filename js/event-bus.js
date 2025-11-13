/**
 * EVENT BUS - Centralized event system
 * Handles application-wide events to keep UI synchronized
 *
 * Events:
 * - annotationCreated: When a new annotation is added
 * - annotationDeleted: When an annotation is removed
 * - annotationModified: When an annotation is edited
 * - imageDeleted: When an image is deleted
 * - classAdded: When a new class is created
 * - classModified: When a class is edited
 * - classDeleted: When a class is removed
 * - imageLoaded: When an image is loaded for annotation
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const callbacks = this.listeners.get(eventName);
        callbacks.push(callback);

        // Return unsubscribe function
        return () => {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {*} data - Data to pass to subscribers
     */
    emit(eventName, data) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for "${eventName}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} eventName - Name of the event
     */
    off(eventName) {
        this.listeners.delete(eventName);
    }

    /**
     * Remove all listeners
     */
    clear() {
        this.listeners.clear();
    }
}

// Create global event bus instance
window.eventBus = new EventBus();
