/**
 * Helper functions for Task operations
 */

/**
 * Compare old and new values to find what changed
 * @param {Object} oldValues - Previous values
 * @param {Object} newValues - Current values
 * @param {Array<string>} fieldsToTrack - Fields to track for changes
 * @returns {Object} Object containing changes array, oldValue, and newValue objects
 */
const findChangedSet = (oldValues, newValues, fieldsToTrack = []) => {
    const changes = [];
    const oldValue = {};
    const newValue = {};

    fieldsToTrack.forEach(field => {
        // Map field name to database field name if needed
        const dbField = field === 'title' ? 'title' :
            field === 'assigned_to' ? 'assigned_to' :
                field === 'due_date' ? 'due_date' : field;

        const oldVal = oldValues[dbField];
        const newVal = newValues[dbField];

        // Compare values (handle null/undefined)
        if (oldVal !== newVal && (oldVal != null || newVal != null)) {
            changes.push(field);
            oldValue[field] = oldVal;
            newValue[field] = newVal;
        }
    });

    return {
        changes,
        oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
        newValue: Object.keys(newValue).length > 0 ? newValue : null
    };
};

/**
 * Determine activity type based on changes
 * @param {Array<string>} changes - Array of changed field names
 * @returns {string} Activity type
 */
const determineActivityType = (changes) => {
    if (changes.length === 0) {
        return 'updated';
    }

    if (changes.length === 1) {
        const change = changes[0];
    switch (change) {
      case 'task_status_id':
        return 'status_changed';
      case 'priority_label_id':
        return 'priority_changed';
      case 'assigned_to':
        return 'assigned';
      case 'completed':
        return 'completed';
      default:
        return 'updated';
    }
    }

    return 'updated';
};

/**
 * Generate description for activity log based on changes
 * @param {Array<string>} changes - Array of changed field names
 * @returns {string} Description text
 */
const generateActivityDescription = (changes) => {
    if (changes.length === 0) {
        return 'updated task';
    }

    if (changes.length === 1) {
        const change = changes[0];
    const fieldNames = {
      'title': 'title',
      'task_status_id': 'status',
      'priority_label_id': 'priority',
      'assigned_to': 'assignee',
      'due_date': 'due date',
      'description': 'description',
      'completed': 'completion status'
    };
        return `updated ${fieldNames[change] || change}`;
    }

    return `updated ${changes.join(', ')}`;
};

module.exports = {
    findChangedSet,
    determineActivityType,
    generateActivityDescription
};

