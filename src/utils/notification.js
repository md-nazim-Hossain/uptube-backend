export const createNotification = (notification) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(notification);
    }, 500);
  });
};
