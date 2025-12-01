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

  // NEW: Month/Year Filter State
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // FORM data
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: "",
    workedDays: '',
    deductions: '',
    workingDays: '',
  });

  const { user } = useSelector((state) => state.auth);

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    fetchEmployees();
  }, [filterMonth, filterYear]); // Re-fetch when filter changes

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getPayrolls();
      console.log('Fetched employees: payroll', response.data);
      
      // Process employees and extract payroll for selected month/year
      const allEmployees = response.data.data || [];
      const processedEmployees = allEmployees.map(emp => {
        // Find the index where month and year match the filter
        const payrollIndex = emp.payroll?.month?.findIndex((m, idx) => 
          m === filterMonth && emp.payroll.year[idx] === filterYear
        );
        
        // If payroll exists for the filtered month/year, extract that specific data
        if (payrollIndex !== -1 && payrollIndex !== undefined) {
          return {
            ...emp,
            payroll: {
              month: emp.payroll.month[payrollIndex],
              year: emp.payroll.year[payrollIndex],
              baseSalary: emp.payroll.baseSalary[payrollIndex],
              workedDays: emp.payroll.workedDays[payrollIndex],
              deductions: emp.payroll.deductions[payrollIndex],
              netSalary: emp.payroll.netSalary[payrollIndex],
              workingDays: emp.payroll.workingDays[payrollIndex],
              status: emp.payroll.status[payrollIndex],
              employeeUniqueId: emp.payroll.employeeUniqueId[payrollIndex]
            }
          };
        } else {
          // No payroll for this month/year, return empty structure
          return {
            ...emp,
            payroll: {
              month: filterMonth,
              year: filterYear,
              baseSalary: null,
              workedDays: null,
              deductions: null,
              netSalary: null,
              workingDays: null,
              status: null,
              employeeUniqueId: null
            }
          };
        }
      });
      
      setEmployees(processedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  // ==================== MONTH/YEAR FILTER HANDLERS ====================
  const handleMonthChange = (e) => {
    setFilterMonth(parseInt(e.target.value));
    setCurrentPage(1);
    setSelectedEmployee(null);
    setShowForm(false);
  };

  const handleYearChange = (e) => {
    setFilterYear(parseInt(e.target.value));
    setCurrentPage(1);
    setSelectedEmployee(null);
    setShowForm(false);
  };

  const goToNextMonth = () => {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear(filterYear + 1);
    } else {
      setFilterMonth(filterMonth + 1);
    }
    setCurrentPage(1);
    setSelectedEmployee(null);
    setShowForm(false);
  };

  const goToPreviousMonth = () => {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear(filterYear - 1);
    } else {
      setFilterMonth(filterMonth - 1);
    }
    setCurrentPage(1);
    setSelectedEmployee(null);
    setShowForm(false);
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
    setFormData({
      month: filterMonth,
      year: filterYear,
      baseSalary: "",
      workedDays: '',
      deductions: '',
      workingDays: '',
    });
  };

  const nextPage = () => {
    if (currentPage < totalPages) paginate(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) paginate(currentPage - 1);
  };

  // ==================== HELPER FUNCTION: NUMBER TO WORDS ====================
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

      const baseSalary = parseFloat(employee.payroll.baseSalary) || 0;
      const workedDays = parseInt(employee.payroll.workedDays) || 0;
      const deductions = parseFloat(employee.payroll.deductions) || 0;
      const workingDays = parseInt(employee.payroll.workingDays) || 0;

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      let yPos = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Payslip', pageWidth / 2, yPos, { align: 'center' });

      yPos = 30;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Memat Digi pvt Ltd', pageWidth / 2, yPos, { align: 'center' });

      yPos += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Lawrence road, Shakurpur', pageWidth / 2, yPos, { align: 'center' });

      yPos += 5;
      doc.text('Delhi', pageWidth / 2, yPos, { align: 'center' });

      yPos = 50;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const leftX = 20;
      const rightX = 110;
      const labelWidth = 40;

      doc.text('Date of Joining', leftX, yPos);
      doc.text(': ' + new Date(employee.dateOfJoining).toLocaleDateString(), leftX + labelWidth, yPos);

      doc.text('Employee name', rightX, yPos);
      doc.text(': ' + employee.firstName + ' ' + employee.lastName, rightX + labelWidth, yPos);

      yPos += 5;

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const payMonth = monthNames[(employee.payroll.month || 1) - 1] || 'January';
      const payYear = employee.payroll.year || new Date().getFullYear();

      doc.text('Pay Period', leftX, yPos);
      doc.text(': ' + payMonth + ' ' + payYear, leftX + labelWidth, yPos);

      doc.text('Designation', rightX, yPos);
      doc.text(': ' + (employee.designation || 'N/A'), rightX + labelWidth, yPos);

      yPos += 5;

      doc.text('Worked Days', leftX, yPos);
      doc.text(': ' + workedDays, leftX + labelWidth, yPos);

      doc.text('Department', rightX, yPos);
      doc.text(': ' + (employee.department || 'N/A'), rightX + labelWidth, yPos);

      yPos += 15;

      const incentivePay = baseSalary * 0.10;
      const houseRent = baseSalary * 0.04;
      const mealAllowance = baseSalary * 0.02;
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

      yPos = doc.lastAutoTable.finalY + 10;

      const providentFund = baseSalary * 0.12;
      const professionalTax = baseSalary * 0.05;
      const leaves = deductions;
      const totaldeductions = providentFund + professionalTax + leaves;

      const deductionsData = [
        ['deductions', 'Amount'],
        ['Provident Fund', Math.round(providentFund).toString()],
        ['Professional Tax', Math.round(professionalTax).toString()],
        ['Leave', Math.round(leaves).toString()],
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

      const netPayY = doc.lastAutoTable.finalY;
      const netPay = totalEarnings - totaldeductions;

      autoTable(doc, {
        startY: netPayY,
        body: [['Net Pay', `Rs. ${Math.round(netPay).toString()}`]],
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

      yPos = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(Math.round(netPay).toString(), pageWidth / 2, yPos, { align: 'center' });

      yPos += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const netPayWords = numberToWords(Math.round(netPay));
      doc.text(`Rs. ${netPayWords} only`, pageWidth / 2, yPos, { align: 'center' });

      yPos = pageHeight - 50;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Employer Signature', 40, yPos);
      doc.line(30, yPos + 15, 80, yPos + 15);

      doc.text('Employee Signature', pageWidth - 60, yPos);
      doc.line(pageWidth - 80, yPos + 15, pageWidth - 30, yPos + 15);

      yPos = pageHeight - 20;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('This is system generated payslip', pageWidth / 2, yPos, { align: 'center' });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const newWindow = window.open(pdfUrl, '_blank');

      if (newWindow) {
        newWindow.document.title = `Payslip - ${employee.firstName} ${employee.lastName}`;
        toast.success('PDF opened in new tab!');
      } else {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Payslip_EMP00${employee.employeeId}_${employee.firstName}_${employee.lastName}.pdf`;
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
  const getEmployeeById = (id) => {
    return employees.find((e) => e._id === id) || null;
  };

  const selectEmployee = (employee) => {
    if (!employee) return;

    if (selectedEmployee === employee._id) {
      setSelectedEmployee(null);
      setShowForm(false);
      setFormData({
        month: filterMonth,
        year: filterYear,
        baseSalary: "",
        workedDays: '',
        deductions: '',
        workingDays: '',
      });
      return;
    }

    setSelectedEmployee(employee._id);
    setShowForm(false);

    const payroll = employee.payroll || {};
    setFormData({
      month: filterMonth,
      year: filterYear,
      baseSalary: payroll.baseSalary != null ? payroll.baseSalary : '',
      workedDays: payroll.workedDays != null ? payroll.workedDays : '',
      deductions: payroll.deductions != null ? payroll.deductions : '',
      workingDays: payroll.workingDays != null ? payroll.workingDays : '',
    });
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
        baseSalary: parseFloat(formData.baseSalary) || 0,
        workedDays: parseFloat(formData.workedDays) || 0,
        deductions: parseFloat(formData.deductions) || 0,
        workingDays: parseFloat(formData.workingDays) || 0,
        month: parseInt(formData.month),
        year: parseInt(formData.year)
      });

      await fetchEmployees();

      const updatedEmp = getEmployeeById(selectedEmployee);
      const updatedPayroll = updatedEmp?.payroll || {};

      setFormData({
        month: updatedPayroll.month || filterMonth,
        year: updatedPayroll.year || filterYear,
        baseSalary: updatedPayroll.baseSalary != null ? updatedPayroll.baseSalary : '',
        workedDays: updatedPayroll.workedDays != null ? updatedPayroll.workedDays : '',
        deductions: updatedPayroll.deductions != null ? updatedPayroll.deductions : '',
        workingDays: updatedPayroll.workingDays != null ? updatedPayroll.workingDays : '',
      });

      setShowForm(false);
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

  const isEmployeeSelected = (employeeId) => {
    return selectedEmployee === employeeId;
  };

  // ==================== MONTH NAME HELPER ====================
  const getMonthName = (monthNumber) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[monthNumber - 1] || '';
  };

  // ==================== RENDERING ====================
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="payroll-container">
      {/* ========== HEADER SECTION ========== */}
      <div className="payroll-header">
        <h1>Payroll Management</h1>

        {/* NEW: Month/Year Filter */}
        <div className="month-filter-container" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          margin: '20px 0',
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <button
            onClick={goToPreviousMonth}
            style={{
              padding: '8px 15px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Previous
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Filter by:</label>
            
            <select
              value={filterMonth}
              onChange={handleMonthChange}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '5px',
                border: '1px solid #ddd'
              }}
            >
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

            <select
              value={filterYear}
              onChange={handleYearChange}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '5px',
                border: '1px solid #ddd'
              }}
            >
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <button
            onClick={goToNextMonth}
            style={{
              padding: '8px 15px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Next →
          </button>

          <div className='add-btn'>
            {getMonthName(filterMonth)} {filterYear}
          </div>
        </div>

        <div className="pagination-info">
          Showing {indexOfFirstEmployee + 1} to {Math.min(indexOfLastEmployee, employees.length)} of {employees.length} employees
        </div>

        {(user?.role === 'admin' || user?.role === 'hr') && selectedEmployee && (
          <button
            onClick={() => {
              const willOpen = !showForm;
              setShowForm(willOpen);

              if (willOpen && selectedEmployee) {
                const emp = getEmployeeById(selectedEmployee);
                if (emp) {
                  const payroll = emp.payroll || {};
                  setFormData({
                    month: filterMonth,
                    year: filterYear,
                    baseSalary: payroll.baseSalary != null ? payroll.baseSalary : '',
                    workedDays: payroll.workedDays != null ? payroll.workedDays : '',
                    deductions: payroll.deductions != null ? payroll.deductions : '',
                    workingDays: payroll.workingDays != null ? payroll.workingDays : '',
                  });
                }
              }
            }}
            className="generate-btn"
          >
            {showForm ? 'Cancel' : 'Generate Payroll'}
          </button>
        )}
      </div>

      {/* ========== PAYROLL TABLE ========== */}
      <div className="payroll-table">
        <h2>Employee Payroll - {getMonthName(filterMonth)} {filterYear}</h2>
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Month</th>
              <th>Year</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Date of Joining</th>
              <th>Base Salary</th>
              <th>Worked Days</th>
              <th>Deductions</th>
              <th>Net Salary</th>
              <th>Working Days</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {currentEmployees.length === 0 ? (
              <tr>
                <td colSpan="15" style={{ textAlign: 'center', padding: '30px' }}>
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
                        onChange={() => selectEmployee(emp)}
                      />
                    </td>
                    <td>{`EMP00${emp.employeeId}`}</td>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.payroll?.month || '-'}</td>
                    <td>{emp.payroll?.year || '-'}</td>
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
                      <td colSpan="15">
                        <form onSubmit={handleSubmit} className="inline-payroll-form">
                          <h3>Generate Payroll for {getMonthName(filterMonth)} {filterYear}</h3>

                          <div className="selected-employees-box">
                            <h4>Selected Employee:</h4>
                            <div className="employee-chips">
                              <div className="employee-chip">
                                <span className="emp-id">{`EMP00${emp.employeeId}`}</span>
                                <span className="emp-name">{emp.firstName} {emp.lastName}</span>
                                <button
                                  type="button"
                                  className="remove-chip"
                                  onClick={() => {
                                    setSelectedEmployee(null);
                                    setShowForm(false);
                                    setFormData({
                                      month: filterMonth,
                                      year: filterYear,
                                      baseSalary: "",
                                      workedDays: '',
                                      deductions: '',
                                      workingDays: '',
                                    });
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
                              <label>Month * (Auto-filled)</label>
                              <input
                                type="text"
                                value={getMonthName(formData.month)}
                                readOnly
                                style={{ backgroundColor: '#f0f0f0' }}
                              />
                            </div>
                            <div className="form-group">
                              <label>Year * (Auto-filled)</label>
                              <input
                                type="number"
                                value={formData.year}
                                readOnly
                                style={{ backgroundColor: '#f0f0f0' }}
                              />
                            </div>

                            <div className="form-group">
                              <label>Base Salary</label>
                              <input type="number" name="baseSalary" placeholder="Enter base salary"
                                value={formData.baseSalary} onChange={handleChange}
                                 min="0" step="0.01" />
                            </div>

                            <div className="form-group">
                              <label>Worked Days</label>
                              <input type="number" name="workedDays" placeholder="Enter worked days"
                                value={formData.workedDays} onChange={handleChange}
                                min="0" step="1" />
                            </div>

                            <div className="form-group">
                              <label>Deductions</label>
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
                            <button type="submit" className="save-payroll-btn" style={{width:"85%"}}>Save Payroll</button>
                            <button type="button" className="cancel-btn" onClick={() => setShowForm(false)} style={{width:"15%"}}>
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