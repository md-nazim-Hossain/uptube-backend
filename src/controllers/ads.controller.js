import { Ads } from "../models/ads.model";

const createAd = catchAsync(async (req, res) => {
  const { title, redirectUrl, brandLogo, brandName, ...rest } = req.body;
  if (!(title || redirectUrl || brandLogo || brandName)) {
    throw new ApiError(StatusCode.BAD_REQUEST, "All fields are required");
  }

  const brandLogoLocalPath = req.files.brandLogo?.path;
  const thumbnailFileLocalPath = req.files.thumbnail?.path;
  const videoFileLocalPath = req.files.videoFile?.path;

  if (!thumbnailFileLocalPath && !videoFileLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Thumbnail or video file are required");
  }

  if (!brandLogoLocalPath) {
    throw new ApiError(StatusCode.BAD_REQUEST, "Brand logo is required");
  }

  thumbnail = await uploadOnCloudinary(thumbnailFilesLocalPath);
  videoFile = await uploadOnCloudinary(videoFileLocalPath);
  brandLogo = await uploadOnCloudinary(brandLogoLocalPath);

  if (!thumbnail && !videoFile) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading files to cloudinary");
  }

  if (!brandLogo) {
    throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error uploading brand logo to cloudinary");
  }

  const ads = await Ads.create({
    title,
    redirectUrl,
    brandLogo: brandLogo?.url,
    brandName,
    thumbnail: thumbnail?.url || null,
    videoFile: videoFile?.url || null,
    duration: videoFile?.duration || 0,
    owner: new mongoose.Types.ObjectId(req.user._id),
    ...rest,
  });
  if (!ads) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error creating new ad");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: ads,
    message: "Ad created successfully",
  });
});

const getAllMyAds = catchAsync(async (req, res) => {
  const totalContent = await Ads.countDocuments({
    owner: new mongoose.Types.ObjectId(req.user._id),
  });
  const { limit, meta, skip, sort, sortBy } = paginationHelpers(req, totalContent);

  const ads = await Ads.find({ owner: new mongoose.Types.ObjectId(req.user._id) })
    .sort({
      [sort]: [sortBy],
    })
    .skip(skip)
    .limit(limit)
    .lean();

  if (!ads) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error getting ads");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: ads,
    meta,
    message: "Ads fetched successfully",
  });
});

const updateAd = catchAsync(async (req, res) => {
  const { id } = req.params;
  await Ads.findOneAndUpdate({ _id: id, owner: new mongoose.Types.ObjectId(req.user._id) }, req.body);
  if (!ads) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error updating ad");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "Ad updated successfully",
  });
});

const deleteAd = catchAsync(async (req, res) => {
  const { id } = req.params;
  await Ads.findOneAndDelete({ _id: id, owner: new mongoose.Types.ObjectId(req.user._id) });
  if (!ads) throw new ApiError(StatusCode.INTERNAL_SERVER_ERROR, "Error deleting ad");
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    message: "Ad deleted successfully",
  });
});

export const adsController = {
  createAd,
  getAllMyAds,
  updateAd,
  deleteAd,
};
