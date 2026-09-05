import httpStatus from "http-status";
import envConfig from "../config/env";
import { redisClient } from "../config/redis";
import { AppError } from "../utils/AppError";

export const getBkashIdToken = async () => {
  try {
    const idTokenKey = "bkashAuth:IdToken";
    const refreshTokenKey = "bkashAuth:refreshToken";
    let idToken = await redisClient.get(idTokenKey);
    const idTokenExpire = await redisClient.ttl(idTokenKey);
    let refreshToken = await redisClient.get(refreshTokenKey);
    const refreshTOkenExpire = await redisClient.ttl(refreshTokenKey);

    if (refreshToken && idTokenExpire <= 600 && refreshTOkenExpire > 600) {
      const response = await fetch(
        `${envConfig.bkash_url}/tokenized/checkout/token/grant`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Accept: "application/json",
            username: envConfig.bkash_user,
            password: envConfig.bkash_pass,
          },
          body: JSON.stringify({
            app_key: envConfig.bkash_app_key,
            app_secret: envConfig.bkash_app_secret,
            refresh_token: refreshToken,
          }),
        },
      );
      const newToken: any = await response.json();
      idToken = newToken.id_token;
      await redisClient.set(idTokenKey, newToken.id_token, {
        expiration: {
          type: "EX",
          value: 60 * 60,
        },
      });
    }

    const response = await fetch(
      `${envConfig.bkash_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
          username: envConfig.bkash_user,
          password: envConfig.bkash_pass,
        },
        body: JSON.stringify({
          app_key: envConfig.bkash_app_key,
          app_secret: envConfig.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Bkash Access Token Failed",
      );
    }
    const result: any = await response.json();
    idToken = result.id_token;
    refreshToken = result.refresh_token;

    await redisClient.set(idTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 60 * 60,
      },
    });

    await redisClient.set(refreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28,
      },
    });

    return idToken;
  } catch (error) {
    console.log(error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get bKash ID Token",
    );
  }
};
