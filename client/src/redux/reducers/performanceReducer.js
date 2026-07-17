const initialState = {
  reviews: [],
  loading: false,
  error: null,
};

const performanceReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_REVIEWS_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_REVIEWS_SUCCESS':
      return { ...state, reviews: action.payload, loading: false };
    case 'FETCH_REVIEWS_FAILURE':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
};

export default performanceReducer;
