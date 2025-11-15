import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { payrollAPI, employeeAPI } from '../services/api';
// import '../styles/Payroll.scss';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function Payroll() {
  // ==================== STATE MANAGEMENT ====================
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage] = useState(10);
  const [generatingPDF, setGeneratingPDF] = useState(null);
  
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    workedDays: '',
    deductions: '',
    workingDays: '',
  });
  
  const { user } = useSelector((state) => state.auth);

  // ==================== DATA FETCHING ====================
  
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getPayrolls();
      console.log('Fetched employees: payroll', response.data);
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  // ==================== PAGINATION LOGIC ====================
  
  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = employees.slice(indexOfFirstEmployee, indexOfLastEmployee);
  const totalPages = Math.ceil(employees.length / employeesPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    setSelectedEmployee(null);
    setShowForm(false);
  };

  const nextPage = () => {
    if (currentPage < totalPages) paginate(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) paginate(currentPage - 1);
  };

  // ==================== HELPER FUNCTION: NUMBER TO WORDS ====================
  
  /**
   * Convert number to words (Indian format)
   */
  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    const convertLessThanThousand = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    if (num < 1000) return convertLessThanThousand(num);
    if (num < 100000) {
      return convertLessThanThousand(Math.floor(num / 1000)) + ' Thousand' + 
             (num % 1000 !== 0 ? ' ' + convertLessThanThousand(num % 1000) : '');
    }
    if (num < 10000000) {
      return convertLessThanThousand(Math.floor(num / 100000)) + ' Lakh' + 
             (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '');
    }
    return convertLessThanThousand(Math.floor(num / 10000000)) + ' Crore' + 
           (num % 10000000 !== 0 ? ' ' + numberToWords(num % 10000000) : '');
  };

  // ==================== PDF GENERATION ====================
  
  /**
   * Generate Professional Payslip PDF (Exact Design Match)
   */
/**
 * Generate Professional Payslip PDF (Exact Design Match)
 */
const handleGeneratePDF = async (employee) => {
  if (!employee.payroll || !employee.payroll.netSalary) {
    toast.error('No payroll data available for this employee');
    return;
  }

  try {
    setGeneratingPDF(employee._id);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // ========== CONVERT ALL VALUES TO NUMBERS ==========
    const baseSalary = parseFloat(employee.payroll.baseSalary) || 0;
    const workedDays = parseInt(employee.payroll.workedDays) || 0;
    const deductions = parseFloat(employee.payroll.deductions) || 0;
    const workingDays = parseInt(employee.payroll.workingDays) || 0;

    // ========== BACKGROUND ==========
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // ========== HEADER: PAYSLIP ==========
    let yPos = 20;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Payslip', pageWidth / 2, yPos, { align: 'center' });

    // ========== COMPANY INFO ==========
    yPos = 30;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Memat Digi pvt Ltd', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Lawrence road, Shakurpur', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5
    doc.text('Delhi', pageWidth / 2, yPos, { align: 'center' });

    // ========== EMPLOYEE DETAILS SECTION ==========
    yPos = 50;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Left Column
    const leftX = 20;
    const rightX = 110;
    const labelWidth = 40;

    // Date of Joining
    doc.text('Date of Joining', leftX, yPos);
    doc.text(': ' + new Date(employee.dateOfJoining).toLocaleDateString(), leftX + labelWidth, yPos);

    // Employee Name
    doc.text('Employee name', rightX, yPos);
    doc.text(': ' + employee.firstName + ' ' + employee.lastName, rightX + labelWidth, yPos);

    yPos += 5;

    // Pay Period
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const payMonth = monthNames[(employee.payroll.month || 1) - 1] || 'January';
    const payYear = employee.payroll.year || new Date().getFullYear();
    
    doc.text('Pay Period', leftX, yPos);
    doc.text(': ' + payMonth + ' ' + payYear, leftX + labelWidth, yPos);

    // Designation
    doc.text('Designation', rightX, yPos);
    doc.text(': ' + (employee.designation || 'N/A'), rightX + labelWidth, yPos);

    yPos += 5;

    // Worked Days
    doc.text('Worked Days', leftX, yPos);
    doc.text(': ' + workedDays, leftX + labelWidth, yPos);

    // Department
    doc.text('Department', rightX, yPos);
    doc.text(': ' + (employee.department || 'N/A'), rightX + labelWidth, yPos);

    // ========== EARNINGS TABLE ==========
    yPos += 15;

    const incentivePay = baseSalary * 0.10; // 10% incentive
    const houseRent = baseSalary * 0.04;     // 4% house rent
    const mealAllowance = baseSalary * 0.02; // 2% meal allowance
    const totalEarnings = baseSalary + incentivePay + houseRent + mealAllowance;

    const earningsData = [
      ['Earnings', 'Amount'],
      ['Basic', Math.round(baseSalary).toString()],
      ['Incentive Pay', Math.round(incentivePay).toString()],
      ['House Rent Allowance', Math.round(houseRent).toString()],
      ['Meal Allowance', Math.round(mealAllowance).toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [earningsData[0]],
      body: earningsData.slice(1),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    // Total Earnings Row
    const earningsY = doc.lastAutoTable.finalY;
    autoTable(doc, {
      startY: earningsY,
      body: [['Total Earnings', Math.round(totalEarnings).toString()]],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    // ========== deductions TABLE ==========
    yPos = doc.lastAutoTable.finalY + 10;

    const providentFund = baseSalary * 0.12;   // 12%
    const professionalTax = baseSalary * 0.05; // 5%
    const loan = deductions;
    const totaldeductions = providentFund + professionalTax + loan;

    const deductionsData = [
      ['deductions', 'Amount'],
      ['Provident Fund', Math.round(providentFund).toString()],
      ['Professional Tax', Math.round(professionalTax).toString()],
      ['Loan', Math.round(loan).toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [deductionsData[0]],
      body: deductionsData.slice(1),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    // Total deductions Row
    const deductionsY = doc.lastAutoTable.finalY;
    autoTable(doc, {
      startY: deductionsY,
      body: [['Total deductions', Math.round(totaldeductions).toString()]],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    // Net Pay Row
    const netPayY = doc.lastAutoTable.finalY;
    const netPay = totalEarnings - totaldeductions;
    
    autoTable(doc, {
      startY: netPayY,
      body: [['Net Pay',`Rs. ${Math.round(netPay).toString()}`]],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });

    // ========== NET PAY IN WORDS ==========
    yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(Math.round(netPay).toString(), pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const netPayWords = numberToWords(Math.round(netPay));
    doc.text(`Rs. ${netPayWords} only`, pageWidth / 2, yPos, { align: 'center' });

    // ========== SIGNATURE SECTION ==========
    yPos = pageHeight - 50;

    // Employer Signature
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Employer Signature', 40, yPos);
    doc.line(30, yPos + 15, 80, yPos + 15);

    // Employee Signature
    doc.text('Employee Signature', pageWidth - 60, yPos);
    doc.line(pageWidth - 80, yPos + 15, pageWidth - 30, yPos + 15);

    // ========== FOOTER ==========
    yPos = pageHeight - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('This is system generated payslip', pageWidth / 2, yPos, { align: 'center' });

    // ========== OPEN PDF IN NEW TAB ==========
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const newWindow = window.open(pdfUrl, '_blank');
    
    if (newWindow) {
      newWindow.document.title = `Payslip - ${employee.firstName} ${employee.lastName}`;
      toast.success('PDF opened in new tab!');
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Payslip_${employee.employeeId}_${employee.firstName}_${employee.lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.warning('Popup blocked! PDF downloaded instead.');
    }
    
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 100);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('Failed to generate PDF: ' + error.message);
  } finally {
    setGeneratingPDF(null);
  }
};
  // ==================== EVENT HANDLERS ====================
  
  const handleCheckboxChange = (employeeId) => {
    if (selectedEmployee === employeeId) {
      setSelectedEmployee(null);
      setShowForm(false);
    } else {
      setSelectedEmployee(employeeId);
      setShowForm(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      await payrollAPI.generate({
        employee: selectedEmployee,
        ...formData,
        baseSalary: parseFloat(formData.baseSalary),
        workedDays: parseFloat(formData.workedDays) || 0,
        deductions: parseFloat(formData.deductions) || 0,
        workingDays: parseFloat(formData.workingDays) || 0,
        month: parseInt(formData.month),
        year: parseInt(formData.year)
      });
      
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        baseSalary: '',
        workedDays: '',
        deductions: '',
        workingDays: '',
      });
      
      setSelectedEmployee(null);
      setShowForm(false);
      await fetchEmployees();
      toast.success('Payroll generated successfully!');
      
    } catch (error) {
      console.error('Error generating payroll:', error);
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to generate payroll';
      toast.error(errorMessage);
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  
  const isEmployeeSelected = (employeeId) => {
    return selectedEmployee === employeeId;
  };

  // ==================== RENDERING ====================
  
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="payroll-container">
      {/* ========== HEADER SECTION ========== */}
      <div className="payroll-header">
        <h1>Payroll Management</h1>
        
        <div className="pagination-info">
          Showing {indexOfFirstEmployee + 1} to {Math.min(indexOfLastEmployee, employees.length)} of {employees.length} employees
        </div>
        
        {(user?.role === 'admin' || user?.role === 'hr') && selectedEmployee && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="generate-btn"
          >
            {showForm ? 'Cancel' : 'Generate Payroll'}
          </button>
        )}
      </div>

      {/* ========== PAYROLL TABLE ========== */}
      <div className="payroll-table">
        <h2>Employee Payroll</h2>
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Date of Joining</th>
              <th>Salary</th>
              <th>Worked Days</th>
              <th>deductions</th>
              <th>Net Salary</th>
              <th>Working Days</th>
              <th>Actions</th>
            </tr>
          </thead>
          
          <tbody>
            {currentEmployees.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '30px' }}>
                  No employees found
                </td>
              </tr>
            ) : (
              currentEmployees.map((emp) => (
                <React.Fragment key={emp._id}>
                  <tr className={isEmployeeSelected(emp._id) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isEmployeeSelected(emp._id)}
                        onChange={() => handleCheckboxChange(emp._id)}
                      />
                    </td>
                    <td>{emp.employeeId}</td>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                    <td>₹{emp.payroll?.baseSalary?.toLocaleString('en-IN') || '-'}</td>
                    <td>{emp.payroll?.workedDays || '-'}</td>
                    <td>₹{emp.payroll?.deductions?.toLocaleString('en-IN') || '-'}</td>
                    <td>₹{emp.payroll?.netSalary?.toLocaleString('en-IN') || '-'}</td>
                    <td>{emp.payroll?.workingDays || '-'}</td>
                    <td>
                      <button
                        className={`pdf-btn ${!emp.payroll?.netSalary ? 'disabled' : ''}`}
                        onClick={() => handleGeneratePDF(emp)}
                        disabled={!emp.payroll?.netSalary || generatingPDF === emp._id}
                        title={emp.payroll?.netSalary ? 'View Payslip PDF' : 'No payroll data available'}
                      >
                        {generatingPDF === emp._id ? (
                          <span className="spinner"></span>
                        ) : (
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>

                  {/* Form Row */}
                  {showForm && selectedEmployee === emp._id && (
                    <tr className="form-row-container">
                      <td colSpan="13">
                        <form onSubmit={handleSubmit} className="inline-payroll-form">
                          <h3>Generate Payroll for Employee</h3>
                          
                          <div className="selected-employees-box">
                            <h4>Selected Employee:</h4>
                            <div className="employee-chips">
                              <div className="employee-chip">
                                <span className="emp-id">{emp.employeeId}</span>
                                <span className="emp-name">{emp.firstName} {emp.lastName}</span>
                                <button
                                  type="button"
                                  className="remove-chip"
                                  onClick={() => {
                                    setSelectedEmployee(null);
                                    setShowForm(false);
                                  }}
                                  title="Remove from selection"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="form-grid">
                            <div className="form-group">
                              <label>Month *</label>
                              <select name="month" value={formData.month} onChange={handleChange} required>
                                <option value="1">January</option>
                                <option value="2">February</option>
                                <option value="3">March</option>
                                <option value="4">April</option>
                                <option value="5">May</option>
                                <option value="6">June</option>
                                <option value="7">July</option>
                                <option value="8">August</option>
                                <option value="9">September</option>
                                <option value="10">October</option>
                                <option value="11">November</option>
                                <option value="12">December</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label>Year *</label>
                              <input type="number" name="year" min="2020" max="2030" 
                                     value={formData.year} onChange={handleChange} required />
                            </div>

                            <div className="form-group">
                              <label>Base Salary *</label>
                              <input type="number" name="baseSalary" placeholder="Enter base salary"
                                     value={formData.baseSalary} onChange={handleChange} 
                                     required min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                              <label>Worked Days</label>
                              <input type="number" name="workedDays" placeholder="Enter worked days"
                                     value={formData.workedDays} onChange={handleChange} 
                                     min="0" step="1" />
                            </div>

                            <div className="form-group">
                              <label>deductions</label>
                              <input type="number" name="deductions" placeholder="Enter deductions"
                                     value={formData.deductions} onChange={handleChange} 
                                     min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                              <label>Total Working Days</label>
                              <input type="number" name="workingDays" placeholder="Enter total working days"
                                     value={formData.workingDays} onChange={handleChange} 
                                     min="0" step="1" />
                            </div>
                          </div>

                          <div className="form-actions">
                            <button type="submit" className="save-payroll-btn">Save Payroll</button>
                            <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ========== PAGINATION CONTROLS ========== */}
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={prevPage} disabled={currentPage === 1} className="pagination-btn">
            Previous
          </button>
          
          <div className="pagination-numbers">
            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => paginate(index + 1)}
                className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <button onClick={nextPage} disabled={currentPage === totalPages} className="pagination-btn">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Payroll;