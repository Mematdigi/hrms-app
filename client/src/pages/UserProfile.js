import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import api, { employeeAPI } from "../services/api";
import { Modal, Button, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

const UserProfile = () => {
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState("personal");

  // State for profile data
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for profile image
  const [profileImage, setProfileImage] = useState("https://via.placeholder.com/120");
  const [isUploading, setIsUploading] = useState(false);

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [currentDocumentType, setCurrentDocumentType] = useState("");

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact: "",
    address: "",
    department: "",
    designation: "",
    dateOfJoining: "",
    baseSalary: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    bankName: "",
    bankAccountNumber: "",
    ifscCode: ""
  });

  // Document Upload State
  const [documentUpload, setDocumentUpload] = useState({
    documentType: "",
    file: null,
    preview: null
  });

  // Helper function to get full image URL
  const getProfileImageUrl = (imagePath) => {
    if (!imagePath) return "https://via.placeholder.com/120";
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // If it's a data URL (base64), return as is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Otherwise, prepend the server URL
    return `http://localhost:5000/uploads/${imagePath}`;
  };

  // Fetch user profile data on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const response = await employeeAPI.getById(user.id);
        setProfileData(response.data);

        // Populate edit form with current data
        setEditFormData({
          firstName: response.data.firstName || "",
          lastName: response.data.lastName || "",
          email: response.data.email || "",
          contact: response.data.contact || "",
          address: response.data.address || "",
          department: response.data.department || "",
          designation: response.data.designation || "",
          dateOfJoining: response.data.dateOfJoining ? response.data.dateOfJoining.split('T')[0] : "",
          baseSalary: response.data.baseSalary || "",
          emergencyContactName: response.data.emergencyContactName || "",
          emergencyContactPhone: response.data.emergencyContactPhone || "",
          emergencyContactRelation: response.data.emergencyContactRelation || "",
          bankName: response.data.bankName || "",
          bankAccountNumber: response.data.bankAccountNumber || "",
          ifscCode: response.data.ifscCode || ""
        });

        // Set profile photo from response - use profilePhoto field
        if (response.data.profilePhoto) {
          setProfileImage(getProfileImageUrl(response.data.profilePhoto));
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile data");
        setProfileData(user);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
        uploadProfileImage(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfileImage = async (file) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      // Use 'profilePhoto' to match backend field name
      formData.append("profilePhoto", file);

      // Use the existing update endpoint
      await employeeAPI.update(user.id, formData);

      // Refresh profile data to get the updated photo
      const response = await employeeAPI.getById(user.id);
      if (response.data.profilePhoto) {
        setProfileImage(getProfileImageUrl(response.data.profilePhoto));
      }

      alert("Profile image updated successfully!");
    } catch (err) {
      console.error("Error uploading image:", err);
      alert("Failed to upload profile image");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Edit Form Changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Edit Form Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();

    try {
      await employeeAPI.update(user.id, editFormData);

      // Refresh profile data
      const response = await employeeAPI.getById(user.id);
      setProfileData(response.data);

      setShowEditModal(false);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile");
    }
  };

  // Handle Document File Selection
  const handleDocumentFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);

      setDocumentUpload(prev => ({
        ...prev,
        file: file,
        preview: previewUrl
      }));
    }
  };

  // Handle Document Type Selection
  const handleDocumentTypeChange = (e) => {
    setDocumentUpload(prev => ({
      ...prev,
      documentType: e.target.value
    }));
  };

  // Handle Document Upload Submit
  // const handleDocumentUpload = async (e) => {
  //   e.preventDefault();

  //   if (!documentUpload.file || !documentUpload.documentType) {
  //     alert("Please select document type and file");
  //     return;
  //   }

  //   try {
  //     const formData = new FormData();
  //     formData.append("document", documentUpload.file);
  //     formData.append("documentType", documentUpload.documentType);

  //     await api.post(`/api/employees/${user.id}/upload-document`, formData, {
  //       headers: {
  //         "Content-Type": "multipart/form-data",
  //       },
  //     });

  //     // Refresh profile data to get updated documents
  //     const response = await employeeAPI.getById(user.id);
  //     setProfileData(response.data);

  //     // Reset form
  //     setDocumentUpload({
  //       documentType: "",
  //       file: null,
  //       preview: null
  //     });

  //     setShowUploadModal(false);
  //     alert("Document uploaded successfully!");
  //   } catch (err) {
  //     console.error("Error uploading document:", err);
  //     alert("Failed to upload document");
  //   }
  // };
  const handleDocumentUpload = async (e) => {
    e.preventDefault();

    if (!documentUpload.file || !documentUpload.documentType) {
      alert("Please select document type and file");
      return;
    }

    try {
      const data = new FormData();
      // Use the specific document type as the key to match Employees.js logic
      data.append(documentUpload.documentType, documentUpload.file);

      // Use the standard update endpoint as seen in Employees.js
      await employeeAPI.update(user.id, data);

      // Refresh profile data
      const response = await employeeAPI.getById(user.id);
      setProfileData(response.data);

      // Reset state
      setDocumentUpload({ documentType: "", file: null, preview: null });
      setShowUploadModal(false);
      alert("✅ Document uploaded successfully!");
    } catch (err) {
      console.error("Error uploading document:", err);
      setError(err?.response?.data?.message || "Failed to upload document");
    }
  };

  // Handle View Document
  const handleViewDocument = (docType, docUrl) => {
    setCurrentDocumentType(docType);
    setSelectedDocument(docUrl);
    setShowViewModal(true);
  };

  // Handle Upload Specific Document
  const handleUploadSpecificDocument = (docType) => {
    setDocumentUpload(prev => ({
      ...prev,
      documentType: docType
    }));
    setShowUploadModal(true);
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="user-profile">
        <div style={{ textAlign: "center", padding: "50px" }}>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profileData) {
    return (
      <div className="user-profile">
        <div style={{ textAlign: "center", padding: "50px", color: "red" }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const displayData = profileData || user;

  return (
    <div className="user-profile">
      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-header-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              <img src={profileImage} alt="Profile" />
              <button className="edit-avatar-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" style={{ cursor: "pointer" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.334 2.00004C11.5091 1.82494 11.7169 1.68605 11.9457 1.59129C12.1745 1.49653 12.4197 1.44775 12.6673 1.44775C12.9149 1.44775 13.1601 1.49653 13.3889 1.59129C13.6177 1.68605 13.8256 1.82494 14.0007 2.00004C14.1758 2.17513 14.3147 2.383 14.4094 2.61178C14.5042 2.84055 14.553 3.08575 14.553 3.33337C14.553 3.58099 14.5042 3.82619 14.4094 4.05497C14.3147 4.28374 14.1758 4.49161 14.0007 4.66671L5.00065 13.6667L1.33398 14.6667L2.33398 11L11.334 2.00004Z"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </label>
              </button>
            </div>
          </div>

          <div className="profile-info">
            <h1 className="profile-name">
              {displayData?.firstName} {displayData?.lastName}
            </h1>
            <p className="profile-designation">
              {displayData?.role || "Employee"}
            </p>
            <div className="profile-meta">
              <span className="meta-item">
                {displayData?.employeeId ? `EMP-${displayData.employeeId}` : "N/A"}
              </span>
              <span className="meta-item">
                {displayData?.department || "General"}
              </span>
              <span className="meta-badge">
                {displayData?.status || "Full-time"}
              </span>
            </div>
          </div>

          <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.75 2.25005C12.9489 2.05114 13.1853 1.89382 13.4462 1.78741C13.7071 1.68099 13.9874 1.62744 14.2702 1.62988C14.553 1.63232 14.8323 1.6907 15.0913 1.80162C15.3503 1.91254 15.5839 2.07385 15.7791 2.27629C15.9743 2.47873 16.1278 2.71838 16.2301 2.98106C16.3323 3.24374 16.3812 3.52447 16.3739 3.80658C16.3665 4.08869 16.3031 4.36643 16.1877 4.62318C16.0724 4.87993 15.9072 5.11048 15.7013 5.30005L5.62502 15.3751L1.12502 16.5001L2.25002 12.0001L12.75 2.25005Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="profile-tabs">
        <button
          className={`tab-btn ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          Personal Details
        </button>
        <button
          className={`tab-btn ${activeTab === "work" ? "active" : ""}`}
          onClick={() => setActiveTab("work")}
        >
          Work Details
        </button>
        <button
          className={`tab-btn ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          Documents
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        {/* Personal Details Tab */}
        {activeTab === "personal" && (
          <div className="tab-content">
            <div className="content-grid">
              {/* Contact Information */}
              <div className="info-card">
                <div className="card-header">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16.6667 17.5V15.8333C16.6667 14.9493 16.3155 14.1014 15.6904 13.4763C15.0653 12.8512 14.2174 12.5 13.3334 12.5H6.66671C5.78265 12.5 4.93480 12.8512 4.30968 13.4763C3.68456 14.1014 3.33337 14.9493 3.33337 15.8333V17.5M13.3334 5.83333C13.3334 7.67428 11.8410 9.16667 10.0000 9.16667C8.15909 9.16667 6.66671 7.67428 6.66671 5.83333C6.66671 3.99238 8.15909 2.5 10.0000 2.5C11.8410 2.5 13.3334 3.99238 13.3334 5.83333Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h3>Contact Information</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <div className="info-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3.33337 3.33334H16.6667C17.5834 3.33334 18.3334 4.08334 18.3334 5.00001V15C18.3334 15.9167 17.5834 16.6667 16.6667 16.6667H3.33337C2.41671 16.6667 1.66671 15.9167 1.66671 15V5.00001C1.66671 4.08334 2.41671 3.33334 3.33337 3.33334Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18.3334 5L10 10.8333L1.66671 5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Email</span>
                      <span className="info-value">{displayData?.email || "N/A"}</span>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.3334 14.1V16.6C18.3343 16.8321 18.2867 17.0618 18.1937 17.2745C18.1008 17.4871 17.9644 17.678 17.7934 17.8349C17.6224 17.9918 17.4205 18.1112 17.2006 18.1856C16.9808 18.26 16.7478 18.2876 16.5167 18.2667C13.9524 17.9881 11.4892 17.1118 9.32505 15.7084C7.31164 14.4289 5.60455 12.7218 4.32505 10.7084C2.91672 8.53438 2.04027 6.05916 1.76672 3.48337C1.74589 3.2531 1.77336 3.02094 1.84719 2.80176C1.92102 2.58257 2.03963 2.38117 2.19562 2.21052C2.35162 2.03988 2.54149 1.90354 2.75315 1.81036C2.96481 1.71717 3.19348 1.66905 3.42505 1.66671H5.92505C6.32953 1.66282 6.72148 1.80628 7.02822 2.07113C7.33497 2.33598 7.53521 2.70234 7.59172 3.10004C7.69717 3.89599 7.89286 4.68006 8.17505 5.43337C8.2871 5.73616 8.31139 6.06414 8.24491 6.38015C8.17843 6.69616 8.02404 6.98726 7.80005 7.21671L6.74172 8.27504C7.92795 10.3682 9.63182 12.0721 11.725 13.2584L12.7834 12.2C13.0128 11.976 13.3039 11.8216 13.6199 11.7552C13.936 11.6887 14.2639 11.713 14.5667 11.825C15.32 12.1072 16.1041 12.3029 16.9 12.4084C17.3023 12.4654 17.6718 12.6693 17.9375 12.9813C18.2032 13.2932 18.3445 13.6914 18.3334 14.1Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Phone</span>
                      <span className="info-value">+91 {displayData?.contact || "N/A"}</span>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.5 8.33334C17.5 14.1667 10 19.1667 10 19.1667C10 19.1667 2.5 14.1667 2.5 8.33334C2.5 6.34422 3.29018 4.4366 4.6967 3.03007C6.10322 1.62355 8.01088 0.833344 10 0.833344C11.9891 0.833344 13.8968 1.62355 15.3033 3.03007C16.7098 4.4366 17.5 6.34422 17.5 8.33334Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 10.8333C11.3807 10.8333 12.5 9.71406 12.5 8.33334C12.5 6.95263 11.3807 5.83334 10 5.83334C8.61929 5.83334 7.5 6.95263 7.5 8.33334C7.5 9.71406 8.61929 10.8333 10 10.8333Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Address</span>
                      <span className="info-value">{displayData?.address || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="info-card">
                <div className="card-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.3334 14.1V16.6C18.3343 16.8321 18.2867 17.0618 18.1937 17.2745C18.1008 17.4871 17.9644 17.678 17.7934 17.8349C17.6224 17.9918 17.4205 18.1112 17.2006 18.1856C16.9808 18.26 16.7478 18.2876 16.5167 18.2667C13.9524 17.9881 11.4892 17.1118 9.32505 15.7084C7.31164 14.4289 5.60455 12.7218 4.32505 10.7084C2.91672 8.53438 2.04027 6.05916 1.76672 3.48337C1.74589 3.2531 1.77336 3.02094 1.84719 2.80176C1.92102 2.58257 2.03963 2.38117 2.19562 2.21052C2.35162 2.03988 2.54149 1.90354 2.75315 1.81036C2.96481 1.71717 3.19348 1.66905 3.42505 1.66671H5.92505C6.32953 1.66282 6.72148 1.80628 7.02822 2.07113C7.33497 2.33598 7.53521 2.70234 7.59172 3.10004C7.69717 3.89599 7.89286 4.68006 8.17505 5.43337C8.2871 5.73616 8.31139 6.06414 8.24491 6.38015C8.17843 6.69616 8.02404 6.98726 7.80005 7.21671L6.74172 8.27504C7.92795 10.3682 9.63182 12.0721 11.725 13.2584L12.7834 12.2C13.0128 11.976 13.3039 11.8216 13.6199 11.7552C13.936 11.6887 14.2639 11.713 14.5667 11.825C15.32 12.1072 16.1041 12.3029 16.9 12.4084C17.3023 12.4654 17.6718 12.6693 17.9375 12.9813C18.2032 13.2932 18.3445 13.6914 18.3334 14.1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>Emergency Contact</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Contact Name</span>
                      <span className="info-value">{displayData?.emergencyContactName || "N/A"}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Contact Phone</span>
                      <span className="info-value">{displayData?.emergencyContactPhone || "N/A"}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Relationship</span>
                      <span className="info-value">{displayData?.emergencyContactRelation || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Work Details Tab */}
        {activeTab === "work" && (
          <div className="tab-content">
            <div className="content-grid">
              {/* Employment Details */}
              <div className="info-card">
                <div className="card-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.6667 5.83333H3.33337C2.41289 5.83333 1.66671 6.57952 1.66671 7.5V16.6667C1.66671 17.5871 2.41289 18.3333 3.33337 18.3333H16.6667C17.5872 18.3333 18.3334 17.5871 18.3334 16.6667V7.5C18.3334 6.57952 17.5872 5.83333 16.6667 5.83333Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.3334 18.3333V4.16667C13.3334 3.72464 13.1578 3.30072 12.8452 2.98816C12.5327 2.67559 12.1088 2.5 11.6667 2.5H8.33337C7.89135 2.5 7.46742 2.67559 7.15486 2.98816C6.8423 3.30072 6.66671 3.72464 6.66671 4.16667V18.3333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>Employment Details</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Date of Joining</span>
                      <span className="info-value">{formatDate(displayData?.dateOfJoining)}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Department</span>
                      <span className="info-value">{displayData?.department || "N/A"}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Designation</span>
                      <span className="info-value">{displayData?.designation || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compensation */}
              <div className="info-card">
                <div className="card-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18.3333C14.6024 18.3333 18.3334 14.6024 18.3334 10C18.3334 5.39763 14.6024 1.66667 10 1.66667C5.39765 1.66667 1.66669 5.39763 1.66669 10C1.66669 14.6024 5.39765 18.3333 10 18.3333Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 5V10L13.3334 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>Compensation</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Base Salary</span>
                      <span className="info-value">
                        {displayData?.baseSalary ? `₹${displayData.baseSalary.toLocaleString("en-IN")}` : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Employment Type</span>
                      <span className="info-value">{displayData?.status || "N/A"}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Work Mode</span>
                      <span className="info-value">{displayData?.workMode || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="info-card">
                <div className="card-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.5 5.83333L10 1.66667L2.5 5.83333M17.5 5.83333V14.1667M17.5 5.83333L10 10M2.5 5.83333V14.1667M2.5 5.83333L10 10M10 10V18.3333M2.5 14.1667L10 18.3333M2.5 14.1667H1.66667M10 18.3333L17.5 14.1667M17.5 14.1667H18.3333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3>Bank Details</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Bank Name</span>
                      <span className="info-value">{displayData?.bankName || "N/A"}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">Account Number</span>
                      <span className="info-value">
                        {displayData?.bankAccountNumber ? `****${displayData.bankAccountNumber.slice(-4)}` : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-text">
                      <span className="info-label">IFSC Code</span>
                      <span className="info-value">{displayData?.ifscCode || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="tab-content">
            <div className="documents-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div className="documents-title">
                <h3>Uploaded Documents</h3>
              </div>
              <button className="upload-btn" onClick={() => setShowUploadModal(true)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.75 11.25V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V11.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12.75 6L9 2.25L5.25 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 2.25V11.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Upload Document
              </button>
            </div>

            <div className="documents-grid">
              {/* Aadhar Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.adharCard ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Aadhar Card</h4>
                  <span className={`document-status ${displayData?.documents?.adharCard ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.adharCard ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.adharCard && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Aadhar Card", getProfileImageUrl(displayData.documents.adharCard))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("adharCard")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>


              {/* PAN Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.panCard ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Pan Card</h4>
                  <span className={`document-status ${displayData?.documents?.panCard ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.panCard ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.panCard && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Pan Card", getProfileImageUrl(displayData.documents.panCard))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("panCard")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>

              {/* salarySlip Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.salarySlip ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Salary Slip</h4>
                  <span className={`document-status ${displayData?.documents?.salarySlip ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.panCard ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.salarySlip && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Salary Slip", getProfileImageUrl(displayData.documents.salarySlip))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("salarySlip")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>

              {/* relievingLetter Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.relievingLetter ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Relieving Letter</h4>
                  <span className={`document-status ${displayData?.documents?.relievingLetter ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.panCard ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.adharCard && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Relieving Letter", getProfileImageUrl(displayData.documents.relievingLetter))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("relievingLetter")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>

              {/* experienceLetter Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.experienceLetter ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Experience Letter</h4>
                  <span className={`document-status ${displayData?.documents?.experienceLetter ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.experienceLetter ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.experienceLetter && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Experience Letter", getProfileImageUrl(displayData.documents.experienceLetter))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("experienceLetter")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>

              {/* offerLetter Card */}
              <div className="document-card">
                <div className={`document-icon ${displayData?.documents?.offerLetter ? 'verified' : 'pending'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Offer Letter</h4>
                  <span className={`document-status ${displayData?.documents?.offerLetter ? 'verified' : 'pending'}`}>
                    {displayData?.documents?.offerLetter ? "Verified" : "Not Uploaded"}
                  </span>
                </div>
                <div className="document-actions">
                  {displayData?.documents?.offerLetter && (
                    <button className="action-btn view-btn" onClick={() => handleViewDocument("Offer Letter", getProfileImageUrl(displayData.documents.offerLetter))} title="View Document">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn upload-btn" onClick={() => handleUploadSpecificDocument("offerLetter")} title="Upload Document">
                    <i className="bi bi-cloud-upload"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Profile</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEditSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Group>
                  <Form.Label>First Name</Form.Label>
                  <Form.Control type="text" name="firstName" value={editFormData.firstName} onChange={handleEditChange} required />
                </Form.Group>
              </div>
              <div className="col-md-6 mb-3">
                <Form.Group>
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control type="text" name="lastName" value={editFormData.lastName} onChange={handleEditChange} required />
                </Form.Group>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" name="email" disabled value={editFormData.email} required />
                </Form.Group>
              </div>
              <div className="col-md-6 mb-3">
                <Form.Group>
                  <Form.Label>Contact</Form.Label>
                  <Form.Control type="text" name="contact" value={editFormData.contact} onChange={handleEditChange} />
                </Form.Group>
              </div>
            </div>
            <div className="mb-3">
              <Form.Group>
                <Form.Label>Address</Form.Label>
                <Form.Control as="textarea" rows={2} name="address" value={editFormData.address} onChange={handleEditChange} />
              </Form.Group>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Upload Document Modal */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Upload Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleDocumentUpload}>
            <Form.Group className="mb-3">
              <Form.Label>Document Type</Form.Label>
              <Form.Select value={documentUpload.documentType} onChange={handleDocumentTypeChange} required>
                <option value="">Select Document Type</option>
                <option value="adharCard">Aadhar Card</option>
                <option value="panCard">PAN Card</option>
                <option value="salarySlip">Salary Slip</option>
                <option value="relievingLetter">Relieving Letter</option>
                <option value="offerLetter">Offer Letter</option>
                <option value="experienceLetter">Experience Letter</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Select File</Form.Label>
              <Form.Control type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocumentFileChange} required />
              <Form.Text className="text-muted">Accepted formats: PDF, JPG, JPEG, PNG (Max 5MB)</Form.Text>
            </Form.Group>
            {documentUpload.preview && (
              <div className="mb-3">
                <Form.Label>Preview</Form.Label>
                <div className="border p-3 rounded">
                  {documentUpload.file?.type === "application/pdf" ? (
                    <div className="text-center">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2V8H20" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="mt-2 mb-0">{documentUpload.file?.name}</p>
                    </div>
                  ) : (
                    <img src={documentUpload.preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "300px" }} />
                  )}
                </div>
              </div>
            )}
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => { setShowUploadModal(false); setDocumentUpload({ documentType: "", file: null, preview: null }); }}>Cancel</Button>
              <Button variant="primary" type="submit">Upload</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* View Document Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>View Document - {currentDocumentType}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDocument && (
            <div className="text-center">
              {selectedDocument.endsWith('.pdf') ? (
                <iframe src={selectedDocument} style={{ width: "100%", height: "600px" }} title="Document Viewer" />
              ) : (
                <img src={selectedDocument} alt={currentDocumentType} style={{ maxWidth: "100%", maxHeight: "600px" }} />
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
  <Button variant="secondary" onClick={() => setShowViewModal(false)}>
    Close
  </Button>
  <Button 
    variant="primary" 
    onClick={async () => {
      try {
        const response = await fetch(selectedDocument);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // This sets the filename for the download
        link.setAttribute('download', `${currentDocumentType.replace(/\s+/g, '_')}_${displayData.firstName}.png`); 
        
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Download failed:", error);
        // Fallback if fetch fails (e.g., Cross-Origin issues)
        window.open(selectedDocument, '_blank');
      }
    }}
  >
    Download
  </Button>
</Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserProfile;