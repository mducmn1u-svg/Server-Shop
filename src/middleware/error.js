function notFound(req, res) { res.status(404).json({ ok: false, error: 'Not found' }); }
function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ZodError' ? 400 : 500);
  if (status >= 500) console.error(err.message || err);
  if (err.name === 'ZodError') return res.status(400).json({ ok: false, error: 'Dữ liệu không hợp lệ', details: err.errors });
  res.status(status).json({ ok: false, error: err.message || 'Server error' });
}
module.exports = { notFound, errorHandler };
