import { redisClient } from "../db/redisClient.js";

const get = async (key) => {
  if (!redisClient.isOpen) await redisClient.connect();
  return JSON.parse(await redisClient.get(key));
};

const setEx = async (key, data, time) => {
  if (!redisClient.isOpen) await redisClient.connect();
  const validateTime = time ?? 60 * 60 * 5;
  return await redisClient.setEx(key, validateTime, JSON.stringify(data));
};
const set = async (key, data) => {
  if (!redisClient.isOpen) await redisClient.connect();
  return await redisClient.set(key, JSON.stringify(data));
};

const del = async (key) => {
  return await redisClient.DEL(key);
};

export const redis = {
  get,
  setEx,
  set,
  del,
};
