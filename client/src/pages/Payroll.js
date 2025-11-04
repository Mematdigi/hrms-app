import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { payrollAPI } from '../services/api';
import '../styles/Payroll.css';

function Payroll() {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    allowances: '',
    deductions: '',
    tax: '',
  });
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const response = await payrollAPI.getPayroll({
        employeeId: user?.id,
      });
      setPayrolls(response.data);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await payrollAPI.generate({
        employeeId: user?.id,
        ...formData,
        baseSalary: parseFloat(formData.baseSalary),
        allowances: parseFloat(formData.allowances),
        deductions: parseFloat(formData.deductions),
        tax: parseFloat(formData.tax),
      });
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        baseSalary: '',
        allowances: '',
        deductions: '',
        tax: '',
      });
      setShowForm(false);
      fetchPayroll();
    } catch (error) {
      console.error('Error generating payroll:', error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="payroll-container">
      <div className="payroll-header">
        <h1>Payroll</h1>
        {(user?.role === 'admin' || user?.role === 'hr') && (
          <button onClick={() => setShowForm(!showForm)} className="generate-btn">
            {showForm ? 'Cancel' : 'Generate Payroll'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="payroll-form">
          <div className="form-group">
            <label>Month</label>
            <input
              type="number"
              name="month"
              min="1"
              max="12"
              value={formData.month}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Year</label>
            <input
              type="number"
              name="year"
              value={formData.year}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Base Salary</label>
            <input
              type="number"
              name="baseSalary"
              value={formData.baseSalary}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Allowances</label>
            <input
              type="number"
              name="allowances"
              value={formData.allowances}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Deductions</label>
            <input
              type="number"
              name="deductions"
              value={formData.deductions}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Tax</label>
            <input
              type="number"
              name="tax"
              value={formData.tax}
              onChange={handleChange}
            />
          </div>
          <button type="submit">Generate Payroll</button>
        </form>
      )}

      <div className="payroll-table">
        <table>
          <thead>
            <tr>
              <th>Month/Year</th>
              <th>Base Salary</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Tax</th>
              <th>Net Salary</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((payroll) => (
              <tr key={payroll._id}>
                <td>{payroll.month}/{payroll.year}</td>
                <td>₹{payroll.baseSalary}</td>
                <td>₹{payroll.allowances}</td>
                <td>₹{payroll.deductions}</td>
                <td>₹{payroll.tax}</td>
                <td>₹{payroll.netSalary}</td>
                <td>{payroll.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Payroll;
