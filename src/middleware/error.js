function notFound(req, res) { res.status(404).json({ ok: false, error: 'Not found' }); }
function errorHandler(err, req, res, next) {
  console.error(err);
  if (err && err.name === 'ZodError') return res.status(400).json({ ok: false, error: 'Invalid input', details: err.errors });
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Server error' });
}
module.exports = { notFound, errorHandler };
