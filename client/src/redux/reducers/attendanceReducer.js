const initialState = {
  attendance: [],
  loading: false,
  error: null,
};

const attendanceReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_ATTENDANCE_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_ATTENDANCE_SUCCESS':
      return { ...state, attendance: action.payload, loading: false };
    case 'FETCH_ATTENDANCE_FAILURE':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
};

export default attendanceReducer;
