/**
 * DEV ONLY — the cookie holding the impersonated user id. Lives in its own module
 * because middleware runs on the edge runtime and cannot import `next/headers`.
 */
export const USER_COOKIE = 'bbq_dev_user';
