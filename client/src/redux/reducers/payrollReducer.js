const initialState = {
  payrolls: [],
  loading: false,
  error: null,
};

const payrollReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'FETCH_PAYROLL_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_PAYROLL_SUCCESS':
      return { ...state, payrolls: action.payload, loading: false };
    case 'FETCH_PAYROLL_FAILURE':
      return { ...state, error: action.payload, loading: false };
    default:  
      return state;
  }
};

export default payrollReducer;
