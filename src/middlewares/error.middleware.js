function errorHandler(err, req, res, next) {
  console.log(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors,
  });
}
export default errorHandler;
