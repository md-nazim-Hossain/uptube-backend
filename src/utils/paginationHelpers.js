export const paginationHelpers = (req, totalDocument) => {
  const page = parseInt(req?.query?.pageParam || req?.query?.page) || 1;
  const limit = parseInt(req?.query?.limit) || 20;
  const skip = (page - 1) * limit;
  const type = req?.query?.type || "video";
  const sortBy = req?.query?.sortBy || "createdAt";
  const sortOrder = req?.query?.order || "desc";
  const queryId = req?.query?.id || req?.query?._id || null;
  const meta = {
    previousId: page > 1 ? page - 1 : null,
    nextId: skip < totalDocument ? page + 1 : null,
    currentId: page,
    total: totalDocument,
  };
  return { page, limit, skip, type, sortBy, sortOrder, meta, queryId };
};
