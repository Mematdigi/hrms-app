const initialState = {
  user: null,
  token: localStorage.getItem('token') || null,
  loading: false,
  error: null,
};

const authReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'LOGIN_REQUEST':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return { ...state, user: action.payload.user, token: action.payload.token, loading: false };
    case 'LOGIN_FAILURE':
      return { ...state, error: action.payload, loading: false };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return { ...state, user: null, token: null };
    case 'REGISTER_SUCCESS':
      return { ...state, user: action.payload.user, token: action.payload.token };
    default:
      return state;
  }
};

export default authReducer;
