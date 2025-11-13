import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { performanceAPI } from '../services/api';
import '../styles/Performance.css';

function Performance() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    reviewPeriod: '',
    rating: 3,
    strengths: '',
    areasForImprovement: '',
    goals: '',
    comments: '',
  });
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await performanceAPI.getReviews({
        employeeId: user?.id,
      });
      setReviews(response.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
      await performanceAPI.create({
        ...formData,
        reviewer_id: user?.id,
        rating: parseInt(formData.rating),
      });
      setFormData({
        employee_id: '',
        reviewPeriod: '',
        rating: 3,
        strengths: '',
        areasForImprovement: '',
        goals: '',
        comments: '',
      });
      setShowForm(false);
      fetchReviews();
    } catch (error) {
      console.error('Error creating review:', error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="performance-container">
      <div className="performance-header">
        <h1>Performance Reviews</h1>
        {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') && (
          <button onClick={() => setShowForm(!showForm)} className="create-btn">
            {showForm ? 'Cancel' : 'Create Review'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="performance-form">
          <div className="form-group">
            <label>Employee ID</label>
            <input
              type="text"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Review Period</label>
            <input
              type="text"
              name="reviewPeriod"
              placeholder="e.g., Q1 2024"
              value={formData.reviewPeriod}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Rating (1-5)</label>
            <select name="rating" value={formData.rating} onChange={handleChange}>
              <option value="1">1 - Poor</option>
              <option value="2">2 - Below Average</option>
              <option value="3">3 - Average</option>
              <option value="4">4 - Good</option>
              <option value="5">5 - Excellent</option>
            </select>
          </div>
          <div className="form-group">
            <label>Strengths</label>
            <textarea
              name="strengths"
              value={formData.strengths}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Areas for Improvement</label>
            <textarea
              name="areasForImprovement"
              value={formData.areasForImprovement}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Goals</label>
            <textarea
              name="goals"
              value={formData.goals}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Comments</label>
            <textarea
              name="comments"
              value={formData.comments}
              onChange={handleChange}
            />
          </div>
          <button type="submit">Create Review</button>
        </form>
      )}

      <div className="reviews-table">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Review Period</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Submitted Date</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review._id}>
                <td>{review.employee?.firstName} {review.employee?.lastName}</td>
                <td>{review.reviewPeriod}</td>
                <td>{'⭐'.repeat(review.rating)}</td>
                <td>{review.status}</td>
                <td>{review.submittedDate ? new Date(review.submittedDate).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Performance;
