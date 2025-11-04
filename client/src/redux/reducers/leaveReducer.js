const initialState = {
  leaves: [],
  loading: false,
  error: null,
};

const leaveReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_LEAVES_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_LEAVES_SUCCESS':
      return { ...state, leaves: action.payload, loading: false };
    case 'FETCH_LEAVES_FAILURE':
      return { ...state, error: action.payload, loading: false };
    case 'ADD_LEAVE':
      return { ...state, leaves: [...state.leaves, action.payload] };
    default:
      return state;
  }
};

export default leaveReducer;
