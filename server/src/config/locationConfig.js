/**
 * Location Configuration
 * Office location and attendance settings
 */

const locationConfig = {
  // Office geolocation settings
  office: {
    latitude: 28.570419,
    longitude: 77.453722,
    radiusInMeters: 1000000
  },

  // Working hours settings
  workingHours: {
    // Standard check-in time (9:40 AM)
    latestCheckInTime: { hours: 9, minutes: 40 },
    
    // Earliest check-out time (6:30 PM)
    earliestCheckOutTime: { hours: 18, minutes: 30 },
    
    // Minimum working hours for half-day
    minimumHoursForHalfDay: 4,
    
    // Standard work hours per day
    standardHours: 8
  },

  // Attendance tracking settings
  attendance: {
    // Timezone for attendance tracking
    timezone: 'Asia/Kolkata',
    
    // Enable location validation
    enableLocationValidation: true
  }
};

module.exports = locationConfig;
