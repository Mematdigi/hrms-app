import React from "react";
import 'bootstrap/dist/css/bootstrap.min.css';

let Notfound = () => {
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-lg border-0" style={{ maxWidth: "650px" }}>
        <div className="card-body text-center p-4">
          <h1 className="display-6 text-danger fw-bold">404</h1>
          <h4 className="text-dark mb-3">Page Not Found</h4>
          <p className=" text-danger">
            The page you’re looking for doesn’t exist !  
            Please check the URL.
          </p>

          <a href="/" className="btn btn-danger mt-3">
            Go Back Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default Notfound;
