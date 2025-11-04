import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import authReducer from './reducers/authReducer';
import employeeReducer from './reducers/employeeReducer';
import attendanceReducer from './reducers/attendanceReducer';
import leaveReducer from './reducers/leaveReducer';
import payrollReducer from './reducers/payrollReducer';
import performanceReducer from './reducers/performanceReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  employees: employeeReducer,
  attendance: attendanceReducer,
  leave: leaveReducer,
  payroll: payrollReducer,
  performance: performanceReducer,
});

const store = createStore(rootReducer, applyMiddleware(thunk));

export default store;
