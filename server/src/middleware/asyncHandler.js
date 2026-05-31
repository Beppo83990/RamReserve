// Wraps an async route handler so rejected promises reach Express's error
// handler instead of becoming unhandled rejections.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
