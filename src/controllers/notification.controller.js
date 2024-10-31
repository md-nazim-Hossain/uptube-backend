const createNotification = catchAsync(async (req, res) => {
  const { content, videoId, commentId, type } = req.body;
  if (!content || !videoId || !type) throw new Error("Content, videoId and type is required");
});
