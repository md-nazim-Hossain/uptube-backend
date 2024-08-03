export const sendApiResponse = ({ res, statusCode, data, message, meta }) => {
  return res.status(statusCode).json({
    success: statusCode < 400,
    data,
    message: message || "Success",
    meta: meta || {},
  });
};
