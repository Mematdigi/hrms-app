const initialState = {
  employees: [],
  loading: false,
  error: null,
};

const employeeReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_EMPLOYEES_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_EMPLOYEES_SUCCESS':
      return { ...state, employees: action.payload, loading: false };
    case 'FETCH_EMPLOYEES_FAILURE':
      return { ...state, error: action.payload, loading: false };
    case 'ADD_EMPLOYEE':
      return { ...state, employees: [...state.employees, action.payload] };
    case 'UPDATE_EMPLOYEE':
      return {
        ...state,
        employees: state.employees.map(emp => emp._id === action.payload._id ? action.payload : emp),
      };
    case 'DELETE_EMPLOYEE':
      return { ...state, employees: state.employees.filter(emp => emp._id !== action.payload) };
    default:
      return state;
  }
};

export default employeeReducer;
