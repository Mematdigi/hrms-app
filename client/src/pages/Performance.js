import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { performanceAPI } from '../services/api';

function Performance() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
  const [editReview, setEditReview] = useState(null); // holds review being edited
  const [editMessage, setEditMessage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    reviewPeriodStart: '',
    reviewPeriodEnd: '',
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
      const response = await performanceAPI.getReviews();
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
    const reviewPeriod = formData.reviewPeriodStart && formData.reviewPeriodEnd
      ? `${formData.reviewPeriodStart} to ${formData.reviewPeriodEnd}`
      : formData.reviewPeriodStart || '';
    try {
      await performanceAPI.create({
        ...formData,
        reviewPeriod,
        reviewer_id: user?.id,
        rating: parseInt(formData.rating),
      });
      resetForm();
      setShowForm(false);
      fetchReviews();
    } catch (error) {
      console.error('Error creating review:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      reviewPeriodStart: '',
      reviewPeriodEnd: '',
      rating: 3,
      strengths: '',
      areasForImprovement: '',
      goals: '',
      comments: '',
    });
  };

  const openEditModal = (review) => {
    setEditReview(review);
    setEditMessage('');
    setShowEditModal(true);
  };

  const handleEditMessageSubmit = async (e) => {
    e.preventDefault();
    try {
      await performanceAPI.update(editReview._id, { message: editMessage });
      setShowEditModal(false);
      setEditReview(null);
      setEditMessage('');
      fetchReviews();
    } catch (error) {
      console.error('Error updating review:', error);
    }
  };

  const ratingLabel = (r) => ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][r] || '';
  const ratingColor = (r) => ['', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'][r] || '#999';

  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  if (loading) return (
    <div className="perf-loading">
      <div className="perf-spinner" />
      <span>Loading Reviews...</span>
    </div>
  );

  return (
    <div className="performance-container">

      {/* ── Header ── */}
      <div className="performance-header">
        <div className="header-left">
          <h1>Performance Reviews</h1>
          <p className="header-sub">{reviews.length} review{reviews.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
          </div>
          {canManage && (
            <button onClick={() => setShowForm(true)} className="create-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Create Review
            </button>
          )}
        </div>
      </div>

      {/* ── Create Review Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card-header">
              <div>
                <h2>Create Performance Review</h2>
                <p>Fill in the details to submit a new review</p>
              </div>
              <button className="modal-close" onClick={() => { setShowForm(false); resetForm(); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">

              {/* Employee ID */}
              <div className="form-group">
                <label>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Employee ID
                </label>
                <input type="text" name="employee_id" value={formData.employee_id} onChange={handleChange} placeholder="Enter employee ID" required />
              </div>

              {/* Review Period with Calendar */}
              <div className="form-group form-group--full">
                <label>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Review Period
                </label>
                <div className="date-range-row">
                  <div className="date-input-wrap">
                    <span className="date-label">From</span>
                    <input type="date" name="reviewPeriodStart" value={formData.reviewPeriodStart} onChange={handleChange} required />
                  </div>
                  <div className="date-range-arrow">→</div>
                  <div className="date-input-wrap">
                    <span className="date-label">To</span>
                    <input type="date" name="reviewPeriodEnd" value={formData.reviewPeriodEnd} onChange={handleChange} required />
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="form-group form-group--full">
                <label>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Rating
                </label>
                <div className="rating-selector">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      type="button"
                      key={r}
                      className={`rating-pill ${parseInt(formData.rating) === r ? 'selected' : ''}`}
                      style={parseInt(formData.rating) === r ? { background: ratingColor(r), borderColor: ratingColor(r) } : {}}
                      onClick={() => setFormData({ ...formData, rating: r })}
                    >
                      {'⭐'.repeat(r)} <span>{ratingLabel(r)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Strengths */}
              <div className="form-group">
                <label>Strengths</label>
                <textarea name="strengths" value={formData.strengths} onChange={handleChange} placeholder="Key strengths observed..." rows={3} />
              </div>

              {/* Areas for Improvement */}
              <div className="form-group">
                <label>Areas for Improvement</label>
                <textarea name="areasForImprovement" value={formData.areasForImprovement} onChange={handleChange} placeholder="Areas to focus on..." rows={3} />
              </div>

              {/* Goals */}
              <div className="form-group">
                <label>Goals</label>
                <textarea name="goals" value={formData.goals} onChange={handleChange} placeholder="Set goals for next period..." rows={3} />
              </div>

              {/* Comments */}
              <div className="form-group">
                <label>Comments</label>
                <textarea name="comments" value={formData.comments} onChange={handleChange} placeholder="Additional comments..." rows={3} />
              </div>

              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn-submit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Submit Review
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Edit Message Modal ── */}
      {showEditModal && editReview && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-card modal-card--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card-header">
              <div>
                <h2>Edit Review Message</h2>
                <p>{editReview.fullName} — {editReview.reviewPeriod}</p>
              </div>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Review snapshot */}
            <div className="edit-snapshot">
              <span className="snap-badge" style={{ background: ratingColor(editReview.rating) }}>{'⭐'.repeat(editReview.rating)} {ratingLabel(editReview.rating)}</span>
              <span className="snap-status">{editReview.status}</span>
            </div>

            <form onSubmit={handleEditMessageSubmit} className="modal-form">
              <div className="form-group form-group--full">
                <label>Message / Feedback</label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="Write your feedback or message for this review..."
                  rows={5}
                  required
                />
              </div>
              <div className="modal-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {reviews.length === 0 && !loading && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <h3>No reviews yet</h3>
          <p>Create the first performance review to get started.</p>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && reviews.length > 0 && (
        <div className="reviews-table">
          {/* <pre>{JSON.stringify(reviews, null, 2)}</pre> */}
          <table>
            <thead>
              <tr>
                <th>Emp Id</th>
                <th>Employee</th>
                <th>Review Period</th>
                <th>Rating</th>
                {/* <th>Status</th> */}
                <th>Submitted Date</th>
                {/* {canManage && <th>Actions</th>} */}
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review._id}>
                  <td className='h5'>
                    {review.employeeId}
                    </td>
                  <td>
                    <div className="emp-cell">
                      <div className="emp-avatar">{(review.fullName || 'U')[0].toUpperCase()}</div>
                      {review.fullName}
                    </div>
                  </td>
                  <td>{review.reviewPeriod}</td>
                  <td>
                    <span className="rating-tag" style={{ background: ratingColor(review.rating) + '22', color: ratingColor(review.rating), borderColor: ratingColor(review.rating) + '55' }}>
                      {'⭐'.repeat(review.rating)} {ratingLabel(review.rating)}
                    </span>
                  </td>
                  {/* <td><span className={`status-badge status--${review.status?.toLowerCase()}`}>{review.status}</span></td> */}
                  <td>{review.createdAt ? review.createdAt.substring(0,10).split('-').reverse().join('-') : '—'}</td>
                  {/* {canManage && (
                    // <td>
                    //   <button className="edit-msg-btn" onClick={() => openEditModal(review)}>
                    //     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    //     Message
                    //   </button>
                    // </td>
                  )} */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {viewMode === 'card' && reviews.length > 0 && (
        <div className="reviews-cards">
          {reviews.map((review) => (
            <div className="review-card" key={review._id}>
              <div className="review-card-top" style={{ background: `linear-gradient(135deg, ${ratingColor(review.rating)}22, ${ratingColor(review.rating)}08)`, borderTop: `3px solid ${ratingColor(review.rating)}` }}>
                <div className="rc-avatar">{(review.fullName || 'U')[0].toUpperCase()}</div>
                <div className="rc-info">
                  <h3>{review.fullName}</h3>
                  <p>{review.reviewPeriod}</p>
                </div>
                <span className="rating-tag" style={{ background: ratingColor(review.rating) + '22', color: ratingColor(review.rating), borderColor: ratingColor(review.rating) + '55' }}>
                  {'⭐'.repeat(review.rating)}<br /><small>{ratingLabel(review.rating)}</small>
                </span>
              </div>

              <div className="review-card-body mt-3">
                {review.strengths && (
                  <div className="rc-section">
                    <span className="rc-section-label">💪 Strengths</span>
                    <p>{review.strengths}</p>
                  </div>
                )}
                {review.areasForImprovement && (
                  <div className="rc-section">
                    <span className="rc-section-label">📈 Improvements</span>
                    <p>{review.areasForImprovement}</p>
                  </div>
                )}
                {review.goals && (
                  <div className="rc-section">
                    <span className="rc-section-label">🎯 Goals</span>
                    <p>{review.goals}</p>
                  </div>
                )}
                {review.comments && (
                  <div className="rc-section">
                    <span className="rc-section-label">💬 Comments</span>
                    <p>{review.comments}</p>
                  </div>
                )}
              </div>

              {/* <div className="review-card-footer">
                <span className={`status-badge status--${review.status?.toLowerCase()}`}>{review.status}</span>
                <span className="rc-date">{review.submittedDate ? new Date(review.submittedDate).toLocaleDateString() : '—'}</span>
                {canManage && (
                  <button className="edit-msg-btn" onClick={() => openEditModal(review)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    Message
                  </button>
                )}
              </div> */}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default Performance;