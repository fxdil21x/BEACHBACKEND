export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(res, message, statusCode = 500, code = null) {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(statusCode).json(body);
}
