const blockMobile = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';

  const isMobile = /android|iphone|ipad|ipod|blackberry|windows phone|mobile/i.test(userAgent);

  if (isMobile) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Please use a laptop or desktop to access this application.'
    });
  }

  next();
};

module.exports = { blockMobile };