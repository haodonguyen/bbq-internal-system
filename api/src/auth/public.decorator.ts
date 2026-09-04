import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips the auth guard. Only the dev user list uses this. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
