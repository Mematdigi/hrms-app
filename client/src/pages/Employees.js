import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useSelector } from 'react-redux';
import { employeeAPI } from '../services/api'; 

function Employees() {
  const navigate = useNavigate();
  
  // --- State Management ---
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // View Mode: 'grid', 'list', 'add', 'edit'
  const [viewMode, setViewMode] = useState('grid'); 

  // --- Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJoinDate, setFilterJoinDate] = useState('');

  // --- Main Form Data (Used for BOTH Add and Edit) ---
  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '', 
    lastName: '', 
    email: '', 
    contact: '', // ✅ Added
    address: '', // ✅ Added
    password: '',
    department: '', 
    designation: '', 
    dateOfJoining: '', 
    baseSalary: '',
    status: 'Full Time', 
    isActive: true,
    // Documents
    adharCard: null,
    panCard: null,
    salarySlip: null,
    relievingLetter: null,
    experienceLetter: null,
    offerLetter: null,
    profilePhoto: null
  });

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingDocs, setExistingDocs] = useState({}); // To show "File Uploaded" text

  const { user } = useSelector((state) => state.auth);

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

  // --- Handlers ---

  // ✅ FIXED: Populate ALL fields including Contact/Address for Editing
  const handleEditClick = (employee) => {
    setEditingId(employee._id);
    
    setFormData({
      employeeId: employee.employeeId || '',
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      contact: employee.contact || '', // ✅ Map Contact
      address: employee.address || '', // ✅ Map Address
      password: '', // Leave empty unless changing
      department: employee.department || '',
      designation: employee.designation || '',
      dateOfJoining: employee.dateOfJoining ? new Date(employee.dateOfJoining).toISOString().split('T')[0] : '',
      baseSalary: employee.baseSalary || '',
      status: employee.status || 'Full Time',
      isActive: employee.isActive,
      // Reset files (user must re-upload to change them)
      adharCard: null, panCard: null, salarySlip: null,
      relievingLetter: null, experienceLetter: null, offerLetter: null, profilePhoto: null
    });

    // Handle Photo Preview
    if (employee.profilePhoto) {
        setPhotoPreview(`http://localhost:5000/${employee.profilePhoto}`); 
    } else {
        setPhotoPreview(null);
    }

    // Set existing documents to show status
    setExistingDocs(employee.documents || {});

    setViewMode('edit'); // Switch to Full Page
  };

  const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
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

  // ✅ Unified Submit for Add and Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        // Files
        if (['adharCard', 'panCard', 'salarySlip', 'relievingLetter', 'experienceLetter', 'offerLetter', 'profilePhoto'].includes(key)) {
            if (formData[key]) data.append(key, formData[key]);
        } else {
            // Text (Skip password if empty in Edit mode)
            if (key === 'password' && viewMode === 'edit' && !formData[key]) return;
            data.append(key, formData[key]);
        }
      });

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
        console.error(error);
        setErrorMessage(error?.response?.data?.message || 'Error saving details.'); 
    }
  };

  const resetForm = () => {
      setFormData({
        employeeId: '', firstName: '', lastName: '', email: '', contact: '', address: '',
        password: '', department: '', designation: '', dateOfJoining: '', baseSalary: '',
        status: 'Full Time', isActive: true, adharCard: null, panCard: null, salarySlip: null,
        relievingLetter: null, experienceLetter: null, offerLetter: null, profilePhoto: null
      });
      setPhotoPreview(null);
      setEditingId(null);
      setExistingDocs({});
      setViewMode('grid');
  };

  const handleDelete = async (employeeId, employeeName) => {
    if (!window.confirm(`Are you sure you want to delete ${employeeName}?`)) return;
    try {
      await employeeAPI.delete(employeeId);
      setSuccessMessage('✅ Employee deleted successfully!');
      fetchEmployees();
    } catch (error) { setErrorMessage(error?.response?.data?.message || 'Error deleting employee'); }
  };

  // --- Helper Functions ---
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => { setSuccessMessage(''); setErrorMessage(''); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const handleResetFilters = () => {
    setSearchQuery(''); setFilterDepartment(''); setFilterDesignation(''); setFilterStatus(''); setFilterJoinDate('');
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const searchLower = searchQuery.toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchLower) || emp.email.toLowerCase().includes(searchLower);
      return matchesSearch; 
    });
  }, [employees, searchQuery]);

  const getAvatarColor = (name) => {
    const colors = ['#1e3a8a', '#2563eb', '#1d4ed8', '#1e40af']; 
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) return <div className="loading-spinner">Loading Employees...</div>;

  return (
    <div className="employees-page">
      {successMessage && <div className="alert-toast success">{successMessage}</div>}
      {errorMessage && <div className="alert-toast error">{errorMessage}</div>}

      {/* Header */}
      <div className="page-header">
        
        <div>
          <h1>{viewMode === 'add' ? 'Add New Employee' : viewMode === 'edit' ? 'Edit Details' : 'Employees'}</h1>
          <p>{viewMode === 'grid' || viewMode === 'list' ? 'Manage your team members.' : 'Manage employee information and documents.'}</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'hr') && (viewMode === 'grid' || viewMode === 'list') && (
          <button className="btn-primary-add" onClick={() => { resetForm(); setViewMode('add'); }}>
            + Add Employee
          </button>
        )}
      </div>

      {/* --- ADD / EDIT FORM VIEW (FULL PAGE) --- */}
      {(viewMode === 'add' || viewMode === 'edit') ? (
        <form className="add-employee-container fade-in" onSubmit={handleSubmit} encType="multipart/form-data">
            
            {/* Left Sidebar: Profile Photo & Basic Info */}
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
                    
                    <div className="mini-info-row">
                        <i className="bi bi-envelope"></i> <span>{formData.email || 'email@company.com'}</span>
                    </div>
                    <div className="mini-info-row">
                        <i className="bi bi-telephone"></i> <span>{formData.contact || 'Contact No.'}</span>
                    </div>
                    <div className="mini-info-row">
                        <i className="bi bi-geo-alt"></i> <span>{formData.address || 'Location'}</span>
                    </div>
                </div>

                {/* Quick Settings */}
                <div className="form-section-card mt-3">
                    <h4>Quick Settings</h4>
                    <div className="input-group checkbox mt-2">
                        <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="activeCheck"/>
                        <label htmlFor="activeCheck">Active Employee Account</label>
                    </div>
                </div>
            </div>

            {/* Right Side: Form Sections */}
            <div className="right-form-area">
                
                <div className="form-section-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4>Personal Information</h4>
                        {viewMode === 'edit' && <span className="text-muted small"><i className="bi bi-pencil"></i> Editing Mode</span>}
                    </div>
                    <div className="form-row-grid">
                        <div className="input-group"><label>First Name <span className="req">*</span></label><input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required /></div>
                        <div className="input-group"><label>Last Name <span className="req">*</span></label><input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required /></div>
                        <div className="input-group"><label>Email Address <span className="req">*</span></label><input type="email" name="email" value={formData.email} onChange={handleChange} required disabled={viewMode === 'edit'} /></div>
                        <div className="input-group"><label>Contact Number <span className="req">*</span></label><input type="tel" name="contact" value={formData.contact} onChange={handleChange} required /></div>
                        <div className="input-group full-width"><label>Address</label><input type="text" name="address" value={formData.address} onChange={handleChange} /></div>
                    </div>
                </div>

                <div className="form-section-card">
                    <h4>Employment Details</h4>
                    <div className="form-row-grid">
                        <div className="input-group"><label>Employee ID <span className="req">*</span></label><input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} required /></div>
                        <div className="input-group"><label>Department</label><input type="text" name="department" value={formData.department} onChange={handleChange} /></div>
                        <div className="input-group"><label>Designation</label><input type="text" name="designation" value={formData.designation} onChange={handleChange} /></div>
                        <div className="input-group"><label>Joining Date</label><input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} /></div>
                        <div className="input-group"><label>Status</label><select name="status" value={formData.status} onChange={handleChange}><option value="Full Time">Full Time</option><option value="Probation">Probation</option><option value="Internship">Internship</option></select></div>
                        <div className="input-group"><label>Base Salary</label><input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleChange} /></div>
                        <div className="input-group"><label>Password {viewMode === 'add' && <span className="req">*</span>}</label><input type="password" name="password" value={formData.password} onChange={handleChange} required={viewMode === 'add'} placeholder={viewMode === 'edit' ? "Leave empty to keep current" : ""} /></div>
                    </div>
                </div>

                <div className="form-section-card">
                    <h4>Documents Upload</h4>
                    <div className="documents-grid">
                        {[{ label: "Aadhar Card", name: "adharCard" }, { label: "PAN Card", name: "panCard" }, { label: "Salary Slip", name: "salarySlip" }, { label: "Relieving Letter", name: "relievingLetter" }, { label: "Experience Letter", name: "experienceLetter" }, { label: "Offer Letter", name: "offerLetter" }].map((doc) => (
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
                    <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
                    <button type="submit" className="btn-primary-add">{viewMode === 'add' ? 'Save Employee' : 'Update Changes'}</button>
                </div>
            </div>
        </form>
      ) : (
        /* --- NORMAL VIEW (Grid/List) --- */
        <>
            <div className="filter-bar">
                <div className="search-wrapper"><i className="bi bi-search search-icon"></i><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
                <button className="btn-icon-filter" onClick={handleResetFilters}><i className="bi bi-funnel"></i> Filter</button>
                <div className="view-toggles">
                    <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><i className="bi bi-grid-fill"></i></button>
                    <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><i className="bi bi-list-ul"></i></button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="employees-grid">
                    {filteredEmployees.map((emp) => (
                        <div className="employee-card" key={emp._id}>
                            <div className="card-header-part">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="avatar" style={{ backgroundColor: getAvatarColor(emp.firstName) }}>{emp.firstName[0]}</div>
                                    <div className="text-info"><h3>{emp.firstName} {emp.lastName}</h3><p className="role">{emp.designation || 'Employee'}</p></div>
                                </div>
                                {(user?.role === 'admin' || user?.role === 'hr') && (
                                    <button className="btn-icon-action ms-auto" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }}><i className="bi bi-pencil"></i></button>
                                )}
                            </div>
                            <div className="card-body-part">
                                <div className="contact-row"><i className="bi bi-envelope"></i> <span className="text-truncate">{emp.email}</span></div>
                                <div className="contact-row"><i className="bi bi-telephone"></i> <span>{emp.contact || '-'}</span></div>
                            </div>
                            <div className="card-footer-part">
                                <span className={`status-badge ${emp.isActive ? 'confirmed' : 'inactive'}`}>{emp.isActive ? 'Active' : 'Inactive'}</span>
                                <button className="view-profile-link" onClick={() => navigate(`/EmployeeDetails/${emp._id}`)}>View Profile <i className="bi bi-arrow-up-right"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="table-card">
                    <table className="modern-table">
                        <thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>STATUS</th><th>JOIN DATE</th><th className="text-end">ACTIONS</th></tr></thead>
                        <tbody>
                            {filteredEmployees.map((emp) => (
                                <tr key={emp._id}>
                                    <td>
                                        <div className="profile-cell">
                                            <div className="avatar" style={{ backgroundColor: getAvatarColor(emp.firstName) }}>{emp.firstName[0]}</div>
                                            <div className="info"><span className="name">{emp.firstName} {emp.lastName}</span><span className="role">{emp.designation}</span></div>
                                        </div>
                                    </td>
                                    <td className="text-secondary">{emp.department || '-'}</td>
                                    <td><span className={`status-pill ${emp.isActive ? 'active' : 'inactive'}`}>{emp.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td className="text-secondary">{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-GB') : '-'}</td>
                                    <td className="text-end action-cell-flex">
                                        <button className="btn-link-action me-3" onClick={() => navigate(`/EmployeeDetails/${emp._id}`)}>View <i className="bi bi-arrow-up-right ms-1"></i></button>
                                        {(user?.role === 'admin' || user?.role === 'hr') && (
                                            <><button className="btn-icon-action ms-1" onClick={() => handleEditClick(emp)}><i className="bi bi-pencil"></i></button><button className="btn-icon-action delete ms-1" onClick={() => handleDelete(emp._id, emp.firstName)}><i className="bi bi-trash"></i></button></>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
      )}
    </div>
  );
}

export default Employees;