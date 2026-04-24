import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { employeeAPI, offboardingAPI } from '../services/api';
import BackButton from '../components/BackButton';

const EMPTY_PREV_EMP = {
    employeeName: '',
    department: '',
    designation: '',
    joiningDate: '',
    lastWorkingDay: '',
    exitType: '',
    reasonForExit: '',
    managerName: '',
    noticePeriodServed: '',
    finalSettlementDone: '',
    fnfDate: '',
    exitInterviewDate: '',
    companyAssetsReturned: '',
    hrRepresentative: '',
    remarks: ''
};

function Employees() {
    const navigate = useNavigate();

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // View Mode: 'grid', 'list', 'add', 'edit', 'bulk'
    const [viewMode, setViewMode] = useState('grid');

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('active'); // 'active' | 'inactive'

    // Bulk Import State
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [savedBulkFile, setSavedBulkFile] = useState(null);
    const [bulkTab, setBulkTab] = useState('sheet1'); // 'sheet1' | 'sheet2'
    const bulkFileRef = useRef(null);

    // Active form tab in add/edit
    const [formTab, setFormTab] = useState('employee'); // 'employee' | 'exit'

    // Main Form Data
    const [formData, setFormData] = useState({
        employeeId: 'MMD-',
        firstName: '',
        lastName: '',
        email: '',
        personalEmail: '',
        contact: '',
        address: '',
        currentAddress: '',
        password: '',
        department: '',
        designation: '',
        dateOfJoining: '',
        dateOfBirth: '',
        lastWorkingDay: '',
        baseSalary: '',
        status: 'Full Time',
        periodType: 'Permanent',
        isActive: true,
        workMode: 'Work From Office',
        gender: '',
        maritalStatus: '',
        nationality: '',
        panNumber: '',
        aadharNumber: '',
        bankName: '',
        bankAccountNumber: '',
        ifscCode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        adharCard: null,
        panCard: null,
        salarySlip: null,
        relievingLetter: null,
        experienceLetter: null,
        offerLetter: null,
        profilePhoto: null
    });

    // Previous Employment (Exit Details)
    const [prevEmpData, setPrevEmpData] = useState({ ...EMPTY_PREV_EMP });

    const [editingId, setEditingId] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [existingDocs, setExistingDocs] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    const { user } = useSelector((state) => state.auth);

    // ── Bulk Selection State (admin only) ─────────────────────────────────────
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => { fetchEmployees(); }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const response = await employeeAPI.getAll();
            setEmployees(response.data || []);
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Error fetching employees');
        } finally { setLoading(false); }
    };

    const handleEditClick = async (emp) => {
        const res = await employeeAPI.getById(emp._id);
        const employee = { ...res.data };
        setEditingId(employee._id);
        setFormData({
            employeeId: `${employee.employeeId}` || '',
            firstName: employee.firstName || '',
            lastName: employee.lastName || '',
            email: employee.email || '',
            personalEmail: employee.personalEmail || '',
            contact: employee.contact || '',
            address: employee.address || '',
            currentAddress: employee.currentAddress || '',
            password: '',
            department: employee.department || '',
            designation: employee.designation || '',
            dateOfJoining: employee.dateOfJoining ? new Date(employee.dateOfJoining).toISOString().split('T')[0] : '',
            dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
            lastWorkingDay: employee.lastWorkingDay ? new Date(employee.lastWorkingDay).toISOString().split('T')[0] : '',
            baseSalary: employee.baseSalary || '',
            status: employee.status || 'Full Time',
            periodType: employee.periodType || 'Permanent',
            isActive: employee.isActive === true || employee.isActive === 'true',
            workMode: employee.workMode || 'Work From Office',
            gender: employee.gender || '',
            maritalStatus: employee.maritalStatus || '',
            nationality: employee.nationality || '',
            panNumber: employee.panNumber || '',
            aadharNumber: employee.aadharNumber || '',
            bankName: employee.bankName || '',
            bankAccountNumber: employee.bankAccountNumber || '',
            ifscCode: employee.ifscCode || '',
            emergencyContactName: employee.emergencyContactName || '',
            emergencyContactPhone: employee.emergencyContactPhone || '',
            emergencyContactRelation: employee.emergencyContactRelation || '',
            adharCard: null, panCard: null, salarySlip: null,
            relievingLetter: null, experienceLetter: null, offerLetter: null, profilePhoto: null
        });

        if (employee.previousEmployment) {
            const pe = employee.previousEmployment;
            setPrevEmpData({
                employeeName: pe.employeeName || '',
                department: pe.department || '',
                designation: pe.designation || '',
                joiningDate: pe.joiningDate ? new Date(pe.joiningDate).toISOString().split('T')[0] : '',
                lastWorkingDay: pe.lastWorkingDay ? new Date(pe.lastWorkingDay).toISOString().split('T')[0] : '',
                exitType: pe.exitType || '',
                reasonForExit: pe.reasonForExit || '',
                managerName: pe.managerName || '',
                noticePeriodServed: pe.noticePeriodServed || '',
                finalSettlementDone: pe.finalSettlementDone || '',
                fnfDate: pe.fnfDate ? new Date(pe.fnfDate).toISOString().split('T')[0] : '',
                exitInterviewDate: pe.exitInterviewDate ? new Date(pe.exitInterviewDate).toISOString().split('T')[0] : '',
                companyAssetsReturned: pe.companyAssetsReturned || '',
                hrRepresentative: pe.hrRepresentative || '',
                remarks: pe.remarks || ''
            });
        } else {
            setPrevEmpData({ ...EMPTY_PREV_EMP });
        }

        if (employee.profilePhoto) {
            setPhotoPreview(`http://localhost:5000/uploads/${employee.profilePhoto}`);
        } else {
            setPhotoPreview(null);
        }

        setExistingDocs(employee.documents || {});
        setFormTab('employee');
        setViewMode('edit');
    };

    const handleChange = async (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        // When HR unticks "Active" in edit mode → save as inactive + go to offboarding
        if (name === 'isActive' && type === 'checkbox' && !checked && viewMode === 'edit' && editingId) {
            if (!window.confirm(`Marking this employee as inactive will start the offboarding process. Continue?`)) {
                return; // User cancelled — do not change checkbox
            }
            try {
                const data = new FormData();
                data.append('isActive', 'false');
                await employeeAPI.update(editingId, data);
                fetchEmployees();
                navigate(`/OffBoarding?employeeId=${editingId}`);
            } catch (err) {
                setErrorMessage('Failed to deactivate employee. Please try again.');
            }
            return;
        }

        // Use functional form of setState to avoid stale closure
        setFormData((prev) => ({ ...prev, [name]: newValue }));
    };

    const handlePrevEmpChange = (e) => {
        const { name, value } = e.target;
        setPrevEmpData({ ...prevEmpData, [name]: value });
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            const file = files[0];
            setFormData({ ...formData, [name]: file });
            if (name === 'profilePhoto') {
                const reader = new FileReader();
                reader.onloadend = () => setPhotoPreview(reader.result);
                reader.readAsDataURL(file);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const data = new FormData();
            const fileFields = ['adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter', 'profilePhoto'];

            Object.keys(formData).forEach((key) => {
                if (fileFields.includes(key)) {
                    if (formData[key]) data.append(key, formData[key]);
                } else {
                    if (key === 'password' && viewMode === 'edit' && !formData[key]) return;
                    if (formData[key] !== null && formData[key] !== undefined) {
                        data.append(key, formData[key]);
                    }
                }
            });

            // data.append('isActive', formData.isActive.toString());

            const hasPrevEmpData = Object.values(prevEmpData).some(v => v !== '');
            if (hasPrevEmpData) {
                data.append('prevEmp', JSON.stringify(prevEmpData));
            }

            if (viewMode === 'add') {
                await employeeAPI.create(data);
                setSuccessMessage('✅ Employee created successfully!');
            } else {
                await employeeAPI.update(editingId, data);
                setSuccessMessage('✅ Employee updated successfully!');
            }

            resetForm();
            fetchEmployees();
        } catch (error) {
            console.error('Submit error:', error);
            setErrorMessage(error?.response?.data?.message || 'Error saving details.');
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '', firstName: '', lastName: '', email: '', personalEmail: '', contact: '',
            address: '', currentAddress: '', password: '', department: '', designation: '',
            dateOfJoining: '', dateOfBirth: '', lastWorkingDay: '', baseSalary: '',
            status: 'Full Time', periodType: 'Permanent', isActive: true, workMode: 'Work From Office',
            gender: '', maritalStatus: '', nationality: '', panNumber: '', aadharNumber: '',
            bankName: '', bankAccountNumber: '', ifscCode: '',
            emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
            adharCard: null, panCard: null, salarySlip: null,
            relievingLetter: null, experienceLetter: null, offerLetter: null, profilePhoto: null
        });
        setPrevEmpData({ ...EMPTY_PREV_EMP });
        setPhotoPreview(null);
        setEditingId(null);
        setExistingDocs({});
        setShowPassword(false);
        setFormTab('employee');
        setViewMode('grid');
        setSelectionMode(false);
        setSelectedIds([]);
    };

    const handleDelete = async (employeeId, employeeName) => {
        if (!window.confirm(`Are you sure you want to delete ${employeeName}?`)) return;
        try {
            await employeeAPI.delete(employeeId);
            setSuccessMessage('✅ Employee deleted successfully!');
            fetchEmployees();
        } catch (error) { setErrorMessage(error?.response?.data?.message || 'Error deleting employee'); }
    };

    // ── Selection Handlers (admin only) ───────────────────────────────────────
    const toggleSelectionMode = () => {
        setSelectionMode((prev) => !prev);
        setSelectedIds([]);
    };

    const handleSelectToggle = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredEmployees.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredEmployees.map((e) => e._id));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected employee(s)? This cannot be undone.`)) return;
        try {
            await employeeAPI.bulkDelete(selectedIds);
            setSuccessMessage(`✅ ${selectedIds.length} employee(s) deleted successfully!`);
            setSelectedIds([]);
            setSelectionMode(false);
            fetchEmployees();
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Error deleting employees');
        }
    };

    // --- Bulk Import Handlers ---
    const handleBulkFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBulkFile(file);
            setBulkResult(null);
            setSavedBulkFile(null);
        }
    };

    const handleBulkImport = async () => {
        if (!bulkFile) { setErrorMessage('Please select an Excel file first.'); return; }
        setBulkLoading(true);
        setBulkResult(null);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const data = new FormData();
            data.append('excelFile', bulkFile);
            const response = await employeeAPI.bulkImport(data);
            setBulkResult(response.data);
            if (response.data.savedFile) {
                setSavedBulkFile(response.data.savedFile);
            }
            if (response.data.success?.length > 0) {
                setSuccessMessage(`✅ ${response.data.success.length} employees imported successfully!`);
                fetchEmployees();
            }
            if (response.data.failed?.length > 0) {
                setErrorMessage(`⚠️ ${response.data.failed.length} rows failed. See details below.`);
            }
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Bulk import failed.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleDownloadUploadedExcel = async () => {
        if (!savedBulkFile) return;
        try {
            const response = await employeeAPI.downloadUploadedExcel(savedBulkFile);
            const url = URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = savedBulkFile;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setErrorMessage('Could not download file. It may have been removed from server.');
        }
    };

    const handleDownloadTemplate = () => {
        const sheet1Headers = [
            'Employee ID', 'DATE OF JOINING', 'Name', 'Department', 'Designation',
            'Employee Type', 'Contact Number', 'Email', 'Date of Birth',
            'Employee period type', 'Gender', 'PAN Number', 'Aadhar Number',
            'Bank Account No', 'IFSC Code', 'Salary', 'Office mail id ',
            'Bank Name', 'Last Working Day', 'Permanent Address', 'Current Address',
            'Marital Status', 'Emergency contact Name ', 'Emeregncy Contact Number ', 'Nationality'
        ];
        const sheet1Sample = [
            'MMD-001', '01/01/2024', 'John Doe', 'Development Team', 'Software Engineer',
            'Full Time', '9876543210', 'john.doe@company.com', '01/01/1995',
            'Permanent', 'Male', 'ABCDE1234F', '123456789012', '1234567890',
            'SBIN0001234', '50000', 'john.doe@company.com', 'State Bank of India', '',
            '123 Main St, City', '456 Other St, City', 'Single', 'Jane Doe', '9876543211', 'Indian'
        ];

        const sheet2Headers = [
            'S.No', 'Employee Name', 'Department', 'Designation ', 'Joining Date', 'LWD',
            ' Exit Type', 'Reason for Exit', ' Manager/Supervisor Name',
            'Notice Period Served', ' Final Settlement Done', 'Fnf date',
            'Exit Interview Date', 'Company Assets Returned', ' HR Representative', 'Remarks'
        ];
        const sheet2Sample = [
            '1', 'John Doe', 'Development Team', 'Software Engineer', '01/01/2024', '31/12/2024',
            'Resignation', 'Better opportunity', 'Jane Manager',
            'Yes', 'Yes', '15/01/2025', '10/01/2025', 'Yes', 'HR Name', 'Good performer'
        ];

        const csvSheet1 = [sheet1Headers.join(','), sheet1Sample.join(',')].join('\n');
        const csvSheet2 = [sheet2Headers.join(','), sheet2Sample.join(',')].join('\n');
        const combined = `SHEET 1 - Employee Details\n${csvSheet1}\n\nSHEET 2 - Exit Details (match Employee Name with Sheet 1)\n${csvSheet2}`;

        const blob = new Blob([combined], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => { setSuccessMessage(''); setErrorMessage(''); }, 6000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // ── Filtered employees: active/inactive + search ──────────────────────────
    const activeCount = useMemo(() => employees.filter(e => e.isActive).length, [employees]);
    const inactiveCount = useMemo(() => employees.filter(e => !e.isActive).length, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            // Active / Inactive filter
            if (activeFilter === 'active' && !emp.isActive) return false;
            if (activeFilter === 'inactive' && emp.isActive) return false;

            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            return fullName.includes(searchLower) || emp.email.toLowerCase().includes(searchLower);
        });
    }, [employees, searchQuery, activeFilter]);

    const getAvatarColor = (name) => {
        const colors = ['#1e3a8a', '#2563eb', '#1d4ed8', '#1e40af'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading) return <div className="loading-spinner">Loading Employees...</div>;

    return (
        <div className="employees-page">
            {/* ── Bulk Selection CSS ── */}
            <style>{`
                .card-checkbox-wrap {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 10;
                }
                .card-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: #2563eb;
                }
                .employee-card { position: relative; }
                .card-selected {
                    outline: 2px solid #2563eb;
                    background: #eff6ff !important;
                }
                .row-selected { background: #eff6ff !important; }
                .select-all-bar {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 14px;
                    background: #f0f7ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    margin-bottom: 12px;
                    font-size: 14px;
                    color: #1e40af;
                }
                .select-all-bar input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    accent-color: #2563eb;
                    cursor: pointer;
                }
                .select-all-bar label { cursor: pointer; margin: 0; font-weight: 500; }
                .selection-count {
                    margin-left: auto;
                    background: #2563eb;
                    color: #fff;
                    border-radius: 20px;
                    padding: 2px 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .btn-danger-delete {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 16px;
                    background: #dc2626;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-danger-delete:hover { background: #b91c1c; }
            `}</style>
            {successMessage && <div className="alert-toast success">{successMessage}</div>}
            {errorMessage && <div className="alert-toast error">{errorMessage}</div>}

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1><span className="m-3"><BackButton /></span>
                        {viewMode === 'add' ? 'Add New Employee'
                            : viewMode === 'edit' ? 'Edit Details'
                                : viewMode === 'bulk' ? 'Bulk Import Employees'
                                    : 'Employees'}
                    </h1>
                    {/* <p>
                        {viewMode === 'grid' || viewMode === 'list'
                            ? 'Manage your team members.'
                            : viewMode === 'bulk'
                            ? 'Import multiple employees at once using an Excel sheet.'
                            : 'Manage employee information and documents.'}
                    </p> */}
                </div>
                {(user?.role === 'admin' || user?.role === 'hr') && (
                    viewMode === 'grid' || viewMode === 'list' ? (
                        <div className="header-actions">
                            {user?.role === 'admin' && (
                                <>
                                    {selectionMode ? (
                                        <>
                                            {selectedIds.length > 0 && (
                                                <button className="btn-danger-delete" onClick={handleBulkDelete}>
                                                    <i className="bi bi-trash3 me-2"></i>Delete Selected ({selectedIds.length})
                                                </button>
                                            )}
                                            <button className="btn-secondary-add" onClick={toggleSelectionMode}>
                                                <i className="bi bi-x me-2"></i>Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button className="btn-secondary-add" onClick={toggleSelectionMode}>
                                            <i className="bi bi-check2-square me-2"></i>Select
                                        </button>
                                    )}
                                </>
                            )}
                            <button className="btn-secondary-add" onClick={() => { setBulkResult(null); setBulkFile(null); setSavedBulkFile(null); setBulkTab('sheet1'); setViewMode('bulk'); }}>
                                <i className="bi bi-file-earmark-spreadsheet me-2"></i>Bulk Import
                            </button>
                            <button className="btn-primary-add" onClick={() => { resetForm(); setViewMode('add'); }}>
                                + Add Employee
                            </button>
                            <button className="btn-primary-add" onClick={() => { navigate('/OffBoarding'); }}>
                                Manage Exit Details
                            </button>
                        </div>
                    ) : (
                        <div className="form-footer-actions">
                            <button type="button" className="btn-primary-add" onClick={resetForm}>Cancel</button>
                        </div>
                    )
                )}
            </div>

            {/* --- BULK IMPORT VIEW --- */}
            {viewMode === 'bulk' && (
                <div className="bulk-import-container fade-in">
                    <div className="bulk-import-card">
                        <div className="bulk-header">
                            <div className="bulk-icon"><i className="bi bi-file-earmark-spreadsheet"></i></div>
                            <div>
                                <h3>Import Employees via Excel</h3>
                                <p className="text-muted">Upload an Excel file (.xlsx) with 2 sheets. Default password will be set as <strong>EmployeeID@123</strong>.</p>
                            </div>
                        </div>

                        {/* Bulk Tab Switcher */}
                        <div className="bulk-sheet-tabs">
                            <button
                                className={`bulk-tab-btn ${bulkTab === 'sheet1' ? 'active' : ''}`}
                                onClick={() => setBulkTab('sheet1')}
                            >
                                <i className="bi bi-person-lines-fill me-2"></i>Sheet 1 — Employee Details
                            </button>
                            <button
                                className={`bulk-tab-btn ${bulkTab === 'sheet2' ? 'active' : ''}`}
                                onClick={() => setBulkTab('sheet2')}
                            >
                                <i className="bi bi-box-arrow-right me-2"></i>Sheet 2 — Exit Details
                            </button>
                        </div>

                        {/* Sheet 1 Info */}
                        {bulkTab === 'sheet1' && (
                            <div className="bulk-columns-info">
                                <h5><i className="bi bi-table me-2"></i>Sheet 1 — Employee Details Columns</h5>
                                <p className="text-muted mb-2">Each row = one employee. <strong>Employee Name</strong> in Sheet 1 must match <strong>Employee Name</strong> in Sheet 2 for exit data to be linked.</p>
                                <div className="columns-grid">
                                    {[
                                        'Employee ID*', 'DATE OF JOINING', 'Name*', 'Department', 'Designation',
                                        'Employee Type', 'Contact Number', 'Email*', 'Date of Birth',
                                        'Employee period type', 'Gender', 'PAN Number', 'Aadhar Number',
                                        'Bank Account No', 'IFSC Code', 'Salary', 'Office mail id ',
                                        'Bank Name', 'Last Working Day', 'Permanent Address', 'Current Address',
                                        'Marital Status', 'Emergency contact Name ', 'Emeregncy Contact Number ', 'Nationality'
                                    ].map((col) => (
                                        <span key={col} className={`col-tag ${col.includes('*') ? 'required' : ''}`}>
                                            {col}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-muted mt-2"><span className="col-tag required" style={{ fontSize: '11px' }}>*</span> = Required fields</p>
                            </div>
                        )}

                        {/* Sheet 2 Info */}
                        {bulkTab === 'sheet2' && (
                            <div className="bulk-columns-info">
                                <h5><i className="bi bi-box-arrow-right me-2"></i>Sheet 2 — Exit Details Columns</h5>
                                <p className="text-muted mb-2">This sheet is <strong>optional</strong>. Fill exit details for employees who have left a previous company. <strong>Employee Name must match Sheet 1.</strong></p>
                                <div className="columns-grid">
                                    {[
                                        'S.No', 'Employee Name*', 'Department', 'Designation', 'Joining Date',
                                        'LWD (Last Working Day)', 'Exit Type', 'Reason for Exit',
                                        'Manager/Supervisor Name', 'Notice Period Served', 'Final Settlement Done',
                                        'Fnf date', 'Exit Interview Date', 'Company Assets Returned',
                                        'HR Representative', 'Remarks'
                                    ].map((col) => (
                                        <span key={col} className={`col-tag ${col.includes('*') ? 'required' : ''}`}>
                                            {col}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-muted mt-2">
                                    <strong>Exit Type values:</strong> Resignation, Termination, Retirement, Contract End, Layoff, Absconding, Other
                                </p>
                            </div>
                        )}

                        <div className="bulk-template-row">
                            <span><i className="bi bi-info-circle me-2 text-primary"></i>Download the template to see the required column format for both sheets.</span>
                            <button className="btn-download-template" onClick={handleDownloadTemplate}>
                                <i className="bi bi-download me-2"></i>Download Template
                            </button>
                        </div>

                        <div className="bulk-upload-area">
                            <label htmlFor="bulkFileInput" className={`drop-zone ${bulkFile ? 'has-file' : ''}`}>
                                <input
                                    type="file"
                                    id="bulkFileInput"
                                    ref={bulkFileRef}
                                    accept=".xlsx,.xls"
                                    onChange={handleBulkFileChange}
                                    hidden
                                />
                                <i className={`bi ${bulkFile ? 'bi-file-earmark-check' : 'bi-cloud-upload'}`}></i>
                                <span>{bulkFile ? bulkFile.name : 'Click to select Excel file (.xlsx, .xls) with 2 sheets'}</span>
                                {bulkFile && <small className="text-muted">{(bulkFile.size / 1024).toFixed(1)} KB</small>}
                            </label>
                        </div>

                        <div className="bulk-actions">
                            {bulkFile && (
                                <button
                                    className="btn-clear-file"
                                    onClick={() => { setBulkFile(null); setBulkResult(null); setSavedBulkFile(null); if (bulkFileRef.current) bulkFileRef.current.value = ''; }}
                                >
                                    <i className="bi bi-x me-1"></i>Clear
                                </button>
                            )}
                            {savedBulkFile && (
                                <button
                                    className="btn-download-uploaded"
                                    onClick={handleDownloadUploadedExcel}
                                    title="Download the Excel file you just uploaded"
                                >
                                    <i className="bi bi-file-earmark-arrow-down me-2"></i>Download Uploaded Excel
                                </button>
                            )}
                            <button
                                className="btn-primary-add"
                                onClick={handleBulkImport}
                                disabled={!bulkFile || bulkLoading}
                            >
                                {bulkLoading ? (
                                    <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Importing...</>
                                ) : (
                                    <><i className="bi bi-upload me-2"></i>Import Employees</>
                                )}
                            </button>
                        </div>

                        {/* Bulk Import Results */}
                        {bulkResult && (
                            <div className="bulk-results">
                                <div className="result-summary">
                                    <div className="result-stat success">
                                        <i className="bi bi-check-circle-fill"></i>
                                        <div><span className="count">{bulkResult.success?.length || 0}</span><span className="label">Imported</span></div>
                                    </div>
                                    <div className="result-stat failed">
                                        <i className="bi bi-x-circle-fill"></i>
                                        <div><span className="count">{bulkResult.failed?.length || 0}</span><span className="label">Failed</span></div>
                                    </div>
                                    <div className="result-stat total">
                                        <i className="bi bi-people-fill"></i>
                                        <div><span className="count">{bulkResult.totalProcessed || 0}</span><span className="label">Total</span></div>
                                    </div>
                                </div>

                                {bulkResult.success?.length > 0 && (
                                    <div className="result-table-wrap">
                                        <h6 className="text-success"><i className="bi bi-check-circle me-2"></i>Successfully Imported</h6>
                                        <table className="modern-table">
                                            <thead><tr><th>Row</th><th>Name</th><th>Employee ID</th><th>Email</th></tr></thead>
                                            <tbody>
                                                {bulkResult.success.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td>{item.row}</td>
                                                        <td>{item.name}</td>
                                                        <td>{item.employeeId}</td>
                                                        <td>{item.email}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {bulkResult.failed?.length > 0 && (
                                    <div className="result-table-wrap mt-3">
                                        <h6 className="text-danger"><i className="bi bi-x-circle me-2"></i>Failed Rows</h6>
                                        <table className="modern-table">
                                            <thead><tr><th>Row</th><th>Name</th><th>Reason</th></tr></thead>
                                            <tbody>
                                                {bulkResult.failed.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td>{item.row}</td>
                                                        <td>{item.name || '-'}</td>
                                                        <td className="text-danger">{item.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- ADD / EDIT FORM VIEW --- */}
            {(viewMode === 'add' || viewMode === 'edit') ? (
                <form className="add-employee-container fade-in" onSubmit={handleSubmit} encType="multipart/form-data">

                    {/* Left Sidebar */}
                    <div className="left-sidebar">
                        <div className="profile-upload-card">
                            <div className="avatar-preview">
                                {photoPreview ? <img src={photoPreview} alt="Preview" /> : <div className="placeholder">{formData.firstName ? formData.firstName[0] : 'U'}</div>}
                                <label htmlFor="profilePhotoInput" className="camera-icon"><i className="bi bi-camera"></i></label>
                                <input type="file" id="profilePhotoInput" name="profilePhoto" onChange={handleFileChange} accept="image/*" hidden />
                            </div>
                            <h3>{formData.firstName || 'First'} {formData.lastName || 'Last'}</h3>
                            <p className="role">{formData.designation || 'Designation'}</p>

                            <div className="divider"></div>

                            <div className="mini-info-row"><i className="bi bi-envelope"></i> <span>{formData.email || 'email@company.com'}</span></div>
                            <div className="mini-info-row"><i className="bi bi-telephone"></i> <span>{formData.contact || 'Contact No.'}</span></div>
                            <div className="mini-info-row"><i className="bi bi-geo-alt"></i> <span>{formData.address || 'Location'}</span></div>
                        </div>

                        <div className="form-section-card mt-3">
                            <h4>Quick Settings</h4>
                            <div className="input-group checkbox mt-2">
                                <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="activeCheck" />
                                <label htmlFor="activeCheck">Active Employee Account</label>
                            </div>
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="right-form-area">

                        {/* Form Tab Switcher */}
                        <div className="form-tab-switcher">
                            <button
                                type="button"
                                className={`form-tab-btn ${formTab === 'employee' ? 'active' : ''}`}
                                onClick={() => setFormTab('employee')}
                            >
                                <i className="bi bi-person-fill me-2"></i>Employee Details
                            </button>
                            <button
                                type="button"
                                className={`form-tab-btn ${formTab === 'exit' ? 'active' : ''}`}
                                onClick={() => setFormTab('exit')}
                            >
                                <i className="bi bi-box-arrow-right me-2"></i>Exit Details
                            </button>
                        </div>

                        {/* ═══ TAB 1: Employee Details ═══ */}
                        {formTab === 'employee' && (
                            <>
                                {/* Personal Information */}
                                <div className="form-section-card">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h4>Personal Information</h4>
                                        {viewMode === 'edit' && <span className="text-muted small"><i className="bi bi-pencil"></i> Editing Mode</span>}
                                    </div>
                                    <div className="form-row-grid">
                                        <div className="input-group"><label>First Name <span className="req">*</span></label><input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required /></div>
                                        <div className="input-group"><label>Last Name <span className="req">*</span></label><input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required /></div>
                                        <div className="input-group"><label>Email Address <span className="req">*</span></label><input type="email" name="email" value={formData.email} onChange={handleChange} required disabled={viewMode === 'edit'} /></div>
                                        <div className="input-group"><label>Personal Email</label><input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} placeholder="Personal email address" /></div>
                                        <div className="input-group"><label>Contact Number <span className="req">*</span></label><input type="tel" name="contact" value={formData.contact} onChange={handleChange} required /></div>
                                        <div className="input-group">
                                            <label>Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleChange}>
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Marital Status</label>
                                            <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange}>
                                                <option value="">Select Status</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Divorced">Divorced</option>
                                                <option value="Widowed">Widowed</option>
                                            </select>
                                        </div>
                                        <div className="input-group"><label>Date of Birth</label><input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} /></div>
                                        <div className="input-group"><label>Nationality</label><input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="e.g. Indian" /></div>
                                        <div className="input-group full-width"><label>Permanent Address</label><input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Permanent address" /></div>
                                        <div className="input-group full-width"><label>Current Address</label><input type="text" name="currentAddress" value={formData.currentAddress} onChange={handleChange} placeholder="Current address (if different)" /></div>
                                    </div>
                                </div>

                                {/* Identity Documents */}
                                <div className="form-section-card">
                                    <h4><i className="bi bi-person-vcard me-2"></i>Identity Details</h4>
                                    <div className="form-row-grid">
                                        <div className="input-group">
                                            <label>PAN Number</label>
                                            <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F" style={{ textTransform: 'uppercase' }} maxLength={10} />
                                        </div>
                                        <div className="input-group">
                                            <label>Aadhar Number</label>
                                            <input type="text" name="aadharNumber" value={formData.aadharNumber} onChange={handleChange} placeholder="12-digit Aadhar number" maxLength={12} />
                                        </div>
                                    </div>
                                </div>

                                {/* Employment Details */}
                                <div className="form-section-card">
                                    <h4>Employment Details</h4>
                                    <div className="form-row-grid">
                                        <div className="input-group"><label>Employee ID <span className="req">*</span></label><input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} required /></div>
                                        <div className="input-group">
                                            <label>Department</label>
                                            <select name="department" value={formData.department} onChange={handleChange}>
                                                <option value="" disabled>Select Department</option>
                                                <option value="Development">Development Team</option>
                                                <option value="Marketing">SEO Team</option>
                                                <option value="Content Creation">Content Team</option>
                                                <option value="social media">Video Team</option>
                                                <option value="Human Resource">Human Resource Team</option>
                                                <option value="Insurance">Insurance Team</option>
                                                <option value="Designing">Graphic Designing Team</option>
                                                <option value="Accounts">Accounts Team</option>
                                                <option value="Sales">Sales Team</option>
                                                <option value="PR">PR Team</option>
                                            </select>
                                        </div>
                                        <div className="input-group"><label>Designation</label><input type="text" name="designation" value={formData.designation} onChange={handleChange} /></div>
                                        <div className="input-group"><label>Joining Date</label><input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} /></div>
                                        <div className="input-group"><label>Last Working Day</label><input type="date" name="lastWorkingDay" value={formData.lastWorkingDay} onChange={handleChange} /></div>
                                        <div className="input-group">
                                            <label>Employment Status</label>
                                            <select name="status" value={formData.status} onChange={handleChange}>
                                                <option value="" disabled>Select Employee Type</option>
                                                <option value="Full Time">Full Time</option>
                                                <option value="Internship">Internship</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Period Type</label>
                                            <select name="periodType" value={formData.periodType} onChange={handleChange}>
                                                <option value="" disabled>Select Period Type</option>
                                                <option value="Probation">Probation</option>
                                                <option value="Permanent">Permanent</option>
                                                <option value="Contractual">Contractual</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Work Mode</label>
                                            <select name="workMode" value={formData.workMode} onChange={handleChange}>
                                                <option value="Work From Office">Work From Office</option>
                                                <option value="Work From Home">Work From Home</option>
                                                <option value="Hybrid">Hybrid</option>
                                            </select>
                                        </div>
                                        <div className="input-group"><label>Base Salary</label><input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleChange} /></div>
                                        <div className="input-group password-input-group"><label>Password {viewMode === 'add' && <span className="req">*</span>}</label><div className="password-input-wrapper"><input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required={viewMode === 'add'} placeholder={viewMode === 'edit' ? "Leave empty to keep current" : ""} /><button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Hide password" : "Show password"}><i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i></button></div></div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div className="form-section-card">
                                    <h4><i className="bi bi-bank me-2"></i>Bank Details</h4>
                                    <div className="form-row-grid">
                                        <div className="input-group"><label>Bank Name</label><input type="text" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="e.g. State Bank of India" /></div>
                                        <div className="input-group"><label>Account Number</label><input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} placeholder="Enter account number" /></div>
                                        <div className="input-group"><label>IFSC Code</label><input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} placeholder="e.g. SBIN0001234" style={{ textTransform: 'uppercase' }} /></div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="form-section-card">
                                    <h4><i className="bi bi-telephone-plus me-2"></i>Emergency Contact</h4>
                                    <div className="form-row-grid">
                                        <div className="input-group"><label>Contact Name</label><input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} placeholder="Full name" /></div>
                                        <div className="input-group"><label>Contact Phone</label><input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} placeholder="Phone number" /></div>
                                        <div className="input-group">
                                            <label>Relationship</label>
                                            <select name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange}>
                                                <option value="">Select Relationship</option>
                                                <option value="Spouse">Spouse</option>
                                                <option value="Parent">Parent</option>
                                                <option value="Sibling">Sibling</option>
                                                <option value="Child">Child</option>
                                                <option value="Friend">Friend</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Documents Upload */}
                                <div className="form-section-card">
                                    <h4>Documents Upload</h4>
                                    <div className="documents-grid">
                                        {[
                                            { label: "Aadhar Card", name: "adharCard" },
                                            { label: "PAN Card", name: "panCard" },
                                            { label: "Salary Slip", name: "salarySlip" },
                                            { label: "Relieving Letter", name: "relievingLetter" },
                                            { label: "Experience Letter", name: "experienceLetter" },
                                            { label: "Offer Letter", name: "offerLetter" }
                                        ].map((doc) => (
                                            <div className="file-upload-box" key={doc.name}>
                                                <label>{doc.label}</label>
                                                <div className={`file-input-wrapper ${existingDocs[doc.name] ? 'has-file' : ''}`}>
                                                    <input type="file" name={doc.name} onChange={handleFileChange} />
                                                    <div className="fake-btn">
                                                        <i className={`bi ${existingDocs[doc.name] && viewMode === 'edit' ? 'bi-check-circle-fill text-success' : 'bi-cloud-upload'}`}></i>
                                                        {viewMode === 'edit' ? (existingDocs[doc.name] ? ' Change File' : ' Upload File') : ' Choose File'}
                                                    </div>
                                                    <span className="file-name">
                                                        {formData[doc.name] ? formData[doc.name].name : (viewMode === 'edit' && existingDocs[doc.name] ? "Current File Uploaded" : "No file chosen")}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-footer-actions">
                                    <button type="button" className="btn-secondary-add" onClick={() => setFormTab('exit')}>
                                        Next: Exit Details <i className="bi bi-arrow-right ms-2"></i>
                                    </button>
                                    <button type="submit" className="btn-primary-add">{viewMode === 'add' ? 'Save Employee' : 'Update Changes'}</button>
                                </div>
                            </>
                        )}

                        {/* ═══ TAB 2: Exit Details ═══ */}
                        {formTab === 'exit' && (
                            <>
                                <div className="form-section-card">
                                    <div className="exit-details-header">
                                        <div>
                                            <h4><i className="bi bi-box-arrow-right me-2 text-warning"></i>Exit Details</h4>
                                            <p className="text-muted small mb-0">This section is optional. Fill exit/relieving details of the employee.</p>
                                        </div>
                                    </div>

                                    <div className="form-row-grid mt-3">
                                        <div className="input-group">
                                            <label>Employee Name</label>
                                            <input type="text" name="employeeName" value={prevEmpData.employeeName} onChange={handlePrevEmpChange} placeholder="Full name in previous company" />
                                        </div>
                                        <div className="input-group">
                                            <label>Department</label>
                                            <input type="text" name="department" value={prevEmpData.department} onChange={handlePrevEmpChange} placeholder="Department in last company" />
                                        </div>
                                        <div className="input-group">
                                            <label>Designation</label>
                                            <input type="text" name="designation" value={prevEmpData.designation} onChange={handlePrevEmpChange} placeholder="Designation in last company" />
                                        </div>
                                        <div className="input-group">
                                            <label>Joining Date</label>
                                            <input type="date" name="joiningDate" value={prevEmpData.joiningDate} onChange={handlePrevEmpChange} />
                                        </div>
                                        <div className="input-group">
                                            <label>Last Working Day (LWD)</label>
                                            <input type="date" name="lastWorkingDay" value={prevEmpData.lastWorkingDay} onChange={handlePrevEmpChange} />
                                        </div>
                                        <div className="input-group">
                                            <label>Exit Type</label>
                                            <select name="exitType" value={prevEmpData.exitType} onChange={handlePrevEmpChange}>
                                                <option value="">Select Exit Type</option>
                                                <option value="Resignation">Resignation</option>
                                                <option value="Termination">Termination</option>
                                                <option value="Retirement">Retirement</option>
                                                <option value="Contract End">Contract End</option>
                                                <option value="Layoff">Layoff</option>
                                                <option value="Absconding">Absconding</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="input-group full-width">
                                            <label>Reason for Exit</label>
                                            <input type="text" name="reasonForExit" value={prevEmpData.reasonForExit} onChange={handlePrevEmpChange} placeholder="e.g. Better opportunity, Personal reasons" />
                                        </div>
                                        <div className="input-group">
                                            <label>Manager / Supervisor Name</label>
                                            <input type="text" name="managerName" value={prevEmpData.managerName} onChange={handlePrevEmpChange} placeholder="Reporting manager name" />
                                        </div>
                                        <div className="input-group">
                                            <label>Notice Period Served</label>
                                            <select name="noticePeriodServed" value={prevEmpData.noticePeriodServed} onChange={handlePrevEmpChange}>
                                                <option value="">Select</option>
                                                <option value="Yes">Yes</option>
                                                <option value="No">No</option>
                                                <option value="Partial">Partial</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Final Settlement Done</label>
                                            <select name="finalSettlementDone" value={prevEmpData.finalSettlementDone} onChange={handlePrevEmpChange}>
                                                <option value="">Select</option>
                                                <option value="Yes">Yes</option>
                                                <option value="No">No</option>
                                                <option value="Pending">Pending</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>FnF Date (Full &amp; Final Settlement)</label>
                                            <input type="date" name="fnfDate" value={prevEmpData.fnfDate} onChange={handlePrevEmpChange} />
                                        </div>
                                        <div className="input-group">
                                            <label>Exit Interview Date</label>
                                            <input type="date" name="exitInterviewDate" value={prevEmpData.exitInterviewDate} onChange={handlePrevEmpChange} />
                                        </div>
                                        <div className="input-group">
                                            <label>Company Assets Returned</label>
                                            <select name="companyAssetsReturned" value={prevEmpData.companyAssetsReturned} onChange={handlePrevEmpChange}>
                                                <option value="">Select</option>
                                                <option value="Yes">Yes</option>
                                                <option value="No">No</option>
                                                <option value="Partial">Partial</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>HR Representative</label>
                                            <input type="text" name="hrRepresentative" value={prevEmpData.hrRepresentative} onChange={handlePrevEmpChange} placeholder="HR person who handled exit" />
                                        </div>
                                        <div className="input-group full-width">
                                            <label>Remarks</label>
                                            <input type="text" name="remarks" value={prevEmpData.remarks} onChange={handlePrevEmpChange} placeholder="Any additional notes" />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-footer-actions">
                                    <button type="button" className="btn-secondary-add" onClick={() => setFormTab('employee')}>
                                        <i className="bi bi-arrow-left me-2"></i>Back: Employee Details
                                    </button>
                                    <button type="submit" className="btn-primary-add">{viewMode === 'add' ? 'Save Employee' : 'Update Changes'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </form>
            ) : viewMode !== 'bulk' ? (
                /* --- NORMAL VIEW (Grid/List) --- */
                <>
                    {/* ── Filter Bar ── */}
                    <div className="filter-bar">
                        <div className="search-wrapper">
                            <i className="bi bi-search search-icon"></i>
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Active / Inactive Toggle */}
                        <div className="active-filter-toggle">
                            <button
                                className={`active-filter-btn ${activeFilter === 'active' ? 'selected active-selected' : ''}`}
                                onClick={() => setActiveFilter('active')}
                            >
                                <span className="filter-dot active-dot"></span>
                                Active
                                <span className="filter-count">{activeCount}</span>
                            </button>
                            <button
                                className={`active-filter-btn ${activeFilter === 'inactive' ? 'selected inactive-selected' : ''}`}
                                onClick={() => setActiveFilter('inactive')}
                            >
                                <span className="filter-dot inactive-dot"></span>
                                Inactive
                                <span className="filter-count">{inactiveCount}</span>
                            </button>
                        </div>

                        <div className="view-toggles">
                            <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><i className="bi bi-grid-fill"></i></button>
                            <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><i className="bi bi-list-ul"></i></button>
                        </div>
                    </div>

                    {/* ── Select All Bar (admin + selectionMode only) ── */}
                    {selectionMode && user?.role === 'admin' && filteredEmployees.length > 0 && (
                        <div className="select-all-bar">
                            <input
                                type="checkbox"
                                id="selectAll"
                                checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                                onChange={handleSelectAll}
                            />
                            <label htmlFor="selectAll">
                                {selectedIds.length === filteredEmployees.length
                                    ? 'Deselect All'
                                    : `Select All (${filteredEmployees.length})`}
                            </label>
                            {selectedIds.length > 0 && (
                                <span className="selection-count">{selectedIds.length} selected</span>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {filteredEmployees.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                {activeFilter === 'inactive' ? '😴' : '👥'}
                            </div>
                            <h3>No {activeFilter === 'inactive' ? 'Inactive' : 'Active'} Employees Found</h3>
                            <p>
                                {searchQuery
                                    ? `No results for "${searchQuery}". Try a different search.`
                                    : activeFilter === 'inactive'
                                        ? 'All employees are currently active.'
                                        : 'No active employees found.'}
                            </p>
                        </div>
                    )}

                    {viewMode === 'grid' && filteredEmployees.length > 0 ? (
                        <div className="employees-grid">
                            {filteredEmployees.map((emp) => (
                                <div
                                    className={`employee-card ${!emp.isActive ? 'inactive-card' : ''} ${selectionMode && selectedIds.includes(emp._id) ? 'card-selected' : ''}`}
                                    key={emp._id}
                                    onClick={selectionMode ? () => handleSelectToggle(emp._id) : undefined}
                                    style={selectionMode ? { cursor: 'pointer' } : {}}
                                >
                                    {/* Selection checkbox overlay (admin only) */}
                                    {selectionMode && user?.role === 'admin' && (
                                        <div className="card-checkbox-wrap" onClick={(e) => { e.stopPropagation(); handleSelectToggle(emp._id); }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(emp._id)}
                                                onChange={() => handleSelectToggle(emp._id)}
                                                className="card-checkbox"
                                            />
                                        </div>
                                    )}
                                    <div className="card-header-part">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="avatar" style={{ backgroundColor: emp.isActive ? getAvatarColor(emp.firstName) : '#9ca3af' }}>{emp.firstName[0]}</div>
                                            <div className="text-info"><h3>{emp.firstName} {emp.lastName}</h3><p className="role">{emp.designation || 'Employee'}</p></div>
                                        </div>
                                        {(user?.role === 'admin' || user?.role === 'hr') && (
                                            <button className="btn-icon-action ms-auto" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }}><i className="bi bi-pencil"></i></button>
                                        )}
                                    </div>
                                    <div className="card-body-part">
                                        <div className="contact-row"><i className="bi bi-envelope"></i> <span className="text-truncate">{emp.email}</span></div>
                                        <div className="contact-row"><i className="bi bi-telephone"></i> <span>{emp.contact || '-'}</span></div>
                                        <div className="contact-row"><i className="bi bi-laptop"></i> <span>{emp.workMode || 'Work From Office'}</span></div>
                                    </div>
                                    <div className="card-footer-part">
                                        <span className={`status-badge ${emp.isActive ? 'confirmed' : 'inactive'}`}>
                                            {emp.isActive ? emp.status : 'Inactive'}
                                        </span>
                                        <button className="view-profile-link" onClick={() => navigate(`/EmployeeDetails/${emp._id}`)}>View Profile <i className="bi bi-arrow-up-right"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : viewMode === 'list' && filteredEmployees.length > 0 ? (
                        <div className="table-card">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        {selectionMode && user?.role === 'admin' && (
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th>EMPLOYEE</th>
                                        <th>DEPARTMENT</th>
                                        <th>WORK MODE</th>
                                        <th>STATUS</th>
                                        <th>JOIN DATE</th>
                                        <th className="text-end">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.map((emp) => (
                                        <tr
                                            key={emp._id}
                                            className={`${!emp.isActive ? 'inactive-row' : ''} ${selectionMode && selectedIds.includes(emp._id) ? 'row-selected' : ''}`}
                                            onClick={selectionMode ? () => handleSelectToggle(emp._id) : undefined}
                                            style={selectionMode ? { cursor: 'pointer' } : {}}
                                        >
                                            {selectionMode && user?.role === 'admin' && (
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(emp._id)}
                                                        onChange={() => handleSelectToggle(emp._id)}
                                                    />
                                                </td>
                                            )}
                                            <td>
                                                <div className="profile-cell">
                                                    <div className="avatar" style={{ backgroundColor: emp.isActive ? getAvatarColor(emp.firstName) : '#9ca3af' }}>{emp.firstName[0]}</div>
                                                    <div className="info"><span className="name">{emp.firstName} {emp.lastName}</span><span className="role">{emp.designation}</span></div>
                                                </div>
                                            </td>
                                            <td className="text-secondary">{emp.department || '-'}</td>
                                            <td className="text-secondary">{emp.workMode || 'WFO'}</td>
                                            <td>
                                                <span className={`status-pill ${emp.isActive ? 'active' : 'inactive'}`}>
                                                    {emp.isActive ? emp.status : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-secondary">{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-GB') : '-'}</td>
                                            <td className="text-end action-cell-flex">
                                                <button className="btn-link-action me-3" onClick={() => navigate(`/EmployeeDetails/${emp._id}`)}>View <i className="bi bi-arrow-up-right ms-1"></i></button>
                                                {(user?.role === 'admin' || user?.role === 'hr') && (
                                                    <>
                                                        <button className="btn-icon-action ms-1" onClick={() => handleEditClick(emp)}><i className="bi bi-pencil"></i></button>
                                                        <button className="btn-icon-action delete ms-1" onClick={() => handleDelete(emp._id, emp.firstName)}><i className="bi bi-trash"></i></button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

export default Employees;