import logger from "../utils/logger.js";

function errorHandler(err, req, res, next) {
  logger.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors,
  });
}
export default errorHandler;
