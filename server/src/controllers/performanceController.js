const PerformanceReview = require('../models/PerformanceReview');

exports.createReview = async (req, res) => {
  try {
    const { employee_id, reviewer_id, reviewPeriod, rating, strengths, areasForImprovement, goals, comments } = req.body;
    
    const review = new PerformanceReview({
      employee_id: employee_id,
      reviewer_id: reviewer_id,
      reviewPeriod,
      rating,
      strengths,
      areasForImprovement,
      goals,
      comments,
      status: 'draft'
    });

    await review.save();
    res.status(201).json({ message: 'Performance review created', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { employee_id, status } = req.query;
    const query = {};

    if (employee_id) query.employee_id = employee_id;
    if (status) query.status = status;

    const reviews = await PerformanceReview.find(query)
      .populate('employee_id', 'firstName lastName')
      .populate('reviewer_id', 'firstName lastName');
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, strengths, areasForImprovement, goals, comments } = req.body;
    
    const review = await PerformanceReview.findByIdAndUpdate(
      reviewId,
      { rating, strengths, areasForImprovement, goals, comments },
      { new: true }
    );

    res.json({ message: 'Performance review updated', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { reviewId } = req.body;
    
    const review = await PerformanceReview.findByIdAndUpdate(
      reviewId,
      { status: 'submitted', submittedDate: new Date() },
      { new: true }
    );

    res.json({ message: 'Performance review submitted', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
