// redux/reducers/authReducer.js
const storedUser = localStorage.getItem('user')
  ? JSON.parse(localStorage.getItem('user'))
  : null;

// Initial state - checks if token exists in localStorage
const initialState = {
  user: storedUser, // User data will be null on page load
  token: localStorage.getItem('token') || null, // Check localStorage for existing token
  loading: false,
  error: null,
};

const authReducer = (state = initialState, action) => {
  switch (action.type) {
    // When login starts
    case 'LOGIN_REQUEST':
      return { ...state, loading: true, error: null };
    
    // When login is successful
    case 'LOGIN_SUCCESS':
      // Save token to localStorage
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));  
      return { 
        ...state, 
        user: action.payload.user, // Store user data
        token: action.payload.token, // Store token
        loading: false,
        error: null
      };
    
    // When login fails
    case 'LOGIN_FAILURE':
      return { 
        ...state, 
        error: action.payload, 
        loading: false,
        user: null,
        token: null
      };
    
    // When user logs out
    case 'LOGOUT':
      localStorage.removeItem('token'); // Remove token from localStorage
      localStorage.removeItem('user');  
      return { 
        ...state, 
        user: null, 
        token: null,
        error: null
      };
    
    // When registration is successful
    case 'REGISTER_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user)); 
      return { 
        ...state, 
        user: action.payload.user, 
        token: action.payload.token,
        loading: false,
        error: null
      };
    
    // ✅ NEW: Restore user data from token after page refresh
    case 'RESTORE_USER':
      console.log('✅ Restoring user:', action.payload); // Debug log
      return {
        ...state,
        user: action.payload, // Restore user data
        loading: false,
        error: null
      };
    
    // ✅ NEW: Handle authentication errors (invalid token, etc.)
    case 'AUTH_ERROR':
      console.log('❌ Auth error:', action.payload); // Debug log
      localStorage.removeItem('token'); // Remove invalid token
      localStorage.removeItem('user');  
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: action.payload
      };
    
    default:
      return state;
  }
};

export default authReducer;