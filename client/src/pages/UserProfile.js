import React, { useState } from "react";
// import "./_UserProfile.scss";

const UserProfile = () => {
  const [activeTab, setActiveTab] = useState("personal");
  const [profileImage, setProfileImage] = useState("https://via.placeholder.com/120");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

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
                <label htmlFor="avatar-upload">
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
            <h1 className="profile-name">John Doe</h1>
            <p className="profile-designation">Senior Software Engineer</p>
            <div className="profile-meta">
              <span className="meta-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 4V8L10.5 9.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                EMP-2024-001
              </span>
              <span className="meta-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 4.66667H14M2 4.66667V12.6667C2 13.0203 2.14048 13.3594 2.39052 13.6095C2.64057 13.8595 2.97971 14 3.33333 14H12.6667C13.0203 14 13.3594 13.8595 13.6095 13.6095C13.8595 13.3594 14 13.0203 14 12.6667V4.66667M2 4.66667L4 2H12L14 4.66667"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Engineering
              </span>
              <span className="meta-badge">Full-time</span>
            </div>
          </div>

          <button className="edit-profile-btn">
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
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3.33337 3.33334H16.6667C17.5834 3.33334 18.3334 4.08334 18.3334 5.00001V15C18.3334 15.9167 17.5834 16.6667 16.6667 16.6667H3.33337C2.41671 16.6667 1.66671 15.9167 1.66671 15V5.00001C1.66671 4.08334 2.41671 3.33334 3.33337 3.33334Z"
                          stroke="#6B7280"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M18.3334 5L10 10.8333L1.66671 5"
                          stroke="#6B7280"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Email</span>
                      <span className="info-value">john.doe@company.com</span>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-icon">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M18.3334 14.1V16.6C18.3343 16.8321 18.2867 17.0618 18.1937 17.2744C18.1008 17.4871 17.9644 17.678 17.7934 17.8349C17.6224 17.9918 17.4206 18.1112 17.2006 18.1856C16.9806 18.26 16.7472 18.2876 16.5167 18.2667C13.9523 17.988 11.4892 17.1118 9.32508 16.7084C7.31164 15.8288 5.52209 14.5158 4.08342 12.8667C2.43334 11.2285 1.17283 9.24202 0.391749 7.05002C0.083415 5.78876 -0.0347894 4.48214 0.0100772 3.17502C0.0111656 2.94296 0.0598436 2.71363 0.152568 2.50084C0.245293 2.28805 0.380688 2.09621 0.550424 1.93559C0.72016 1.77497 0.920347 1.64876 1.13916 1.56416C1.35797 1.47956 1.59149 1.43827 1.82508 1.44169H4.32508C4.70934 1.43784 5.08222 1.5691 5.37846 1.81452C5.67469 2.05993 5.87537 2.40398 5.94175 2.78336C6.06428 3.54235 6.27158 4.28463 6.55841 5.00002C6.66569 5.27475 6.69158 5.57363 6.6333 5.86214C6.57502 6.15065 6.43474 6.41632 6.22508 6.62502L5.11675 7.73336C6.2881 9.80693 8.02366 11.5425 10.0975 12.7134L11.2059 11.605C11.4146 11.3953 11.6802 11.2551 11.9687 11.1968C12.2572 11.1385 12.5561 11.1644 12.8309 11.2717C13.5463 11.5585 14.2885 11.7658 15.0475 11.8884C15.4316 11.9555 15.7796 12.1591 16.0259 12.4604C16.2723 12.7617 16.402 13.1403 16.3934 13.5275V14.1Z"
                          stroke="#6B7280"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Phone</span>
                      <span className="info-value">+91 98765 43210</span>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-icon">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17.5 8.33334C17.5 14.1667 10 19.1667 10 19.1667C10 19.1667 2.5 14.1667 2.5 8.33334C2.5 6.34421 3.29018 4.4366 4.6967 3.03007C6.10322 1.62355 8.01088 0.833344 10 0.833344C11.9891 0.833344 13.8968 1.62355 15.3033 3.03007C16.7098 4.4366 17.5 6.34421 17.5 8.33334Z"
                          stroke="#6B7280"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 10.8333C11.3807 10.8333 12.5 9.71407 12.5 8.33334C12.5 6.95262 11.3807 5.83334 10 5.83334C8.61929 5.83334 7.5 6.95262 7.5 8.33334C7.5 9.71407 8.61929 10.8333 10 10.8333Z"
                          stroke="#6B7280"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="info-text">
                      <span className="info-label">Address</span>
                      <span className="info-value">
                        123 Main Street, Bangalore, Karnataka - 560001
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
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
                      d="M10.0001 18.3333C14.6025 18.3333 18.3334 14.6024 18.3334 10C18.3334 5.39763 14.6025 1.66667 10.0001 1.66667C5.39771 1.66667 1.66675 5.39763 1.66675 10C1.66675 14.6024 5.39771 18.3333 10.0001 18.3333Z"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 6.66667V10"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 13.3333H10.0083"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h3>Emergency Contact</h3>
                </div>
                <div className="card-content emergency-content">
                  <div className="emergency-row">
                    <span className="emergency-label">Name : </span>
                    <span className="emergency-value m-2">Sarah Doe</span>
                  </div>
                  <div className="emergency-row">
                    <span className="emergency-label">Relation : </span>
                    <span className="emergency-value m-2">Spouse</span>
                  </div>
                  <div className="emergency-row">
                    <span className="emergency-label">Phone : </span>
                    <span className="emergency-value m-2">+91 98765 43211</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Work Details Tab */}
        {activeTab === "work" && (
          <div className="tab-content">
            <div className="info-card full-width">
              <div className="card-header">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16.6667 5.83333H3.33333C2.41286 5.83333 1.66667 6.57953 1.66667 7.5V15.8333C1.66667 16.7538 2.41286 17.5 3.33333 17.5H16.6667C17.5871 17.5 18.3333 16.7538 18.3333 15.8333V7.5C18.3333 6.57953 17.5871 5.83333 16.6667 5.83333Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.3333 17.5V4.16667C13.3333 3.72464 13.1577 3.30072 12.8452 2.98816C12.5326 2.67559 12.1087 2.5 11.6667 2.5H8.33333C7.89131 2.5 7.46738 2.67559 7.15482 2.98816C6.84226 3.30072 6.66667 3.72464 6.66667 4.16667V17.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3>Employment Details</h3>
              </div>
              <div className="work-details-grid">
                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 3.33334H3.33333C2.41286 3.33334 1.66667 4.07954 1.66667 5.00001V16.6667C1.66667 17.5872 2.41286 18.3333 3.33333 18.3333H16.6667C17.5871 18.3333 18.3333 17.5872 18.3333 16.6667V5.00001C18.3333 4.07954 17.5871 3.33334 16.6667 3.33334Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.3333 1.66666V5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.66667 1.66666V5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M1.66667 8.33334H18.3333"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Employee ID</span>
                    <span className="work-value">EMP-2024-001</span>
                  </div>
                </div>

                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 5.83333H3.33333C2.41286 5.83333 1.66667 6.57953 1.66667 7.5V15.8333C1.66667 16.7538 2.41286 17.5 3.33333 17.5H16.6667C17.5871 17.5 18.3333 16.7538 18.3333 15.8333V7.5C18.3333 6.57953 17.5871 5.83333 16.6667 5.83333Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.3333 17.5V4.16667C13.3333 3.72464 13.1577 3.30072 12.8452 2.98816C12.5326 2.67559 12.1087 2.5 11.6667 2.5H8.33333C7.89131 2.5 7.46738 2.67559 7.15482 2.98816C6.84226 3.30072 6.66667 3.72464 6.66667 4.16667V17.5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Department</span>
                    <span className="work-value">Engineering</span>
                  </div>
                </div>

                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 5.83333H3.33333C2.41286 5.83333 1.66667 6.57953 1.66667 7.5V15.8333C1.66667 16.7538 2.41286 17.5 3.33333 17.5H16.6667C17.5871 17.5 18.3333 16.7538 18.3333 15.8333V7.5C18.3333 6.57953 17.5871 5.83333 16.6667 5.83333Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.3333 17.5V4.16667C13.3333 3.72464 13.1577 3.30072 12.8452 2.98816C12.5326 2.67559 12.1087 2.5 11.6667 2.5H8.33333C7.89131 2.5 7.46738 2.67559 7.15482 2.98816C6.84226 3.30072 6.66667 3.72464 6.66667 4.16667V17.5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Designation</span>
                    <span className="work-value">Senior Software Engineer</span>
                  </div>
                </div>

                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 3.33334H3.33333C2.41286 3.33334 1.66667 4.07954 1.66667 5.00001V16.6667C1.66667 17.5872 2.41286 18.3333 3.33333 18.3333H16.6667C17.5871 18.3333 18.3333 17.5872 18.3333 16.6667V5.00001C18.3333 4.07954 17.5871 3.33334 16.6667 3.33334Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.3333 1.66666V5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.66667 1.66666V5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M1.66667 8.33334H18.3333"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Joining Date</span>
                    <span className="work-value">February 1, 2024</span>
                  </div>
                </div>

                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 17.5V15.8333C16.6667 14.9493 16.3155 14.1014 15.6904 13.4763C15.0653 12.8512 14.2174 12.5 13.3333 12.5H6.66667C5.78261 12.5 4.93477 12.8512 4.30964 13.4763C3.68452 14.1014 3.33333 14.9493 3.33333 15.8333V17.5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 9.16667C11.8409 9.16667 13.3333 7.67428 13.3333 5.83333C13.3333 3.99238 11.8409 2.5 10 2.5C8.15905 2.5 6.66667 3.99238 6.66667 5.83333C6.66667 7.67428 8.15905 9.16667 10 9.16667Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Employment Type</span>
                    <span className="work-value">Full-time</span>
                  </div>
                </div>

                <div className="work-detail-item">
                  <div className="work-detail-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6667 17.5V15.8333C16.6667 14.9493 16.3155 14.1014 15.6904 13.4763C15.0653 12.8512 14.2174 12.5 13.3333 12.5H6.66667C5.78261 12.5 4.93477 12.8512 4.30964 13.4763C3.68452 14.1014 3.33333 14.9493 3.33333 15.8333V17.5"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 9.16667C11.8409 9.16667 13.3333 7.67428 13.3333 5.83333C13.3333 3.99238 11.8409 2.5 10 2.5C8.15905 2.5 6.66667 3.99238 6.66667 5.83333C6.66667 7.67428 8.15905 9.16667 10 9.16667Z"
                        stroke="#6B7280"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="work-label">Reporting To</span>
                    <span className="work-value">Jane Smith</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="tab-content">
            <div className="documents-header">
              <div className="documents-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.6667 1.66666H5.00004C4.55801 1.66666 4.13409 1.84225 3.82153 2.15481C3.50897 2.46737 3.33337 2.8913 3.33337 3.33332V16.6667C3.33337 17.1087 3.50897 17.5326 3.82153 17.8452C4.13409 18.1577 4.55801 18.3333 5.00004 18.3333H15C15.4421 18.3333 15.866 18.1577 16.1786 17.8452C16.4911 17.5326 16.6667 17.1087 16.6667 16.6667V6.66666L11.6667 1.66666Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11.6667 1.66666V6.66666H16.6667"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3>Uploaded Documents</h3>
              </div>
              <button className="upload-btn">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15.75 11.25V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V11.25"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12.75 6L9 2.25L5.25 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 2.25V11.25"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Upload Document
              </button>
            </div>

            <div className="documents-grid">
              <div className="document-card">
                <div className="document-icon verified">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2V8H20"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Aadhar Card</h4>
                  <span className="document-status verified">Verified</span>
                </div>
              </div>

              <div className="document-card">
                <div className="document-icon verified">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2V8H20"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">PAN Card</h4>
                  <span className="document-status verified">Verified</span>
                </div>
              </div>

              <div className="document-card">
                <div className="document-icon pending">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2V8H20"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Passport</h4>
                  <span className="document-status pending">Pending</span>
                </div>
              </div>

              <div className="document-card">
                <div className="document-icon verified">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2V8H20"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="document-info">
                  <h4 className="document-name">Degree Certificate</h4>
                  <span className="document-status verified">Verified</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;