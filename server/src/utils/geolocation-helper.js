/**
 * Geolocation Helper for Attendance System
 * Provides precise distance calculation using Haversine formula
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Ensure all inputs are numbers
    lat1 = parseFloat(lat1);
    lon1 = parseFloat(lon1);
    lat2 = parseFloat(lat2);
    lon2 = parseFloat(lon2);

    // Validate coordinates
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        throw new Error('Invalid coordinates provided');
    }

    // Earth's radius in meters
    const R = 6371000; // meters (more precise than using km)

    // Convert degrees to radians
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    // Haversine formula
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distance in meters
    const distance = R * c;

    return Math.round(distance); // Return rounded meters
}

/**
 * Check if user is within allowed radius of office location
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {number} officeLat - Office latitude
 * @param {number} officeLon - Office longitude
 * @param {number} allowedRadius - Allowed radius in meters (default: 100)
 * @returns {Object} { withinRadius: boolean, distance: number, allowedRadius: number }
 */
function isWithinRadius(userLat, userLon, officeLat, officeLon, allowedRadius = 100) {
    try {
        const distance = calculateDistance(userLat, userLon, officeLat, officeLon);
        
        return {
            withinRadius: distance <= allowedRadius,
            distance: distance,
            allowedRadius: allowedRadius,
            distanceFormatted: formatDistance(distance)
        };
    } catch (error) {
        console.error('Error calculating distance:', error);
        return {
            withinRadius: false,
            distance: null,
            allowedRadius: allowedRadius,
            error: error.message
        };
    }
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters}m`;
    } else {
        return `${(meters / 1000).toFixed(2)}km`;
    }
}

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if valid
 */
function validateCoordinates(lat, lon) {
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    
    return !isNaN(lat) && 
           !isNaN(lon) && 
           lat >= -90 && 
           lat <= 90 && 
           lon >= -180 && 
           lon <= 180;
}

module.exports = {
    calculateDistance,
    isWithinRadius,
    formatDistance,
    validateCoordinates
};
