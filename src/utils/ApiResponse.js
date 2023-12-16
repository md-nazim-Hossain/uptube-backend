export const sendApiResponse = ({ res, statusCode, data, message }) => {
  return res.status(statusCode).json({
    success: statusCode < 400,
    data,
    errors: null,
    message: message || "Success",
  });
};
