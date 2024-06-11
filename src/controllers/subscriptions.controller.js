import { Subscription } from "../models/subscriptions.model.js";
import { sendApiResponse } from "../utils/ApiResponse.js";
import { catchAsync } from "../utils/catchAsync.js";

const getAllSubscriptions = catchAsync(async (req, res) => {
  const subscriptions = await Subscription.find();
  return sendApiResponse({
    res,
    statusCode: StatusCode.OK,
    data: subscriptions,
    message: "Subscriptions found successfully",
  });
});
export const subscriptionsController = {
  getAllSubscriptions,
};
