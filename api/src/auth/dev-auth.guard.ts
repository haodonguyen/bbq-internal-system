// ---------------------------------------------------------------------------
// DEV ONLY — this guard trusts a client-supplied `X-User-Id` header, which means
// anyone can impersonate any user, including Head Office. It must be replaced
// with real JWT/session verification before this reaches a public host.
//
// Contract for the replacement: populate `req.user` with an `AuthUser`
// ({ id, name, email, role, venueId }). Nothing downstream of this file cares
// how that object was obtained — scoping, permissions and notifications all
// read `req.user` and are unaffected.
// ---------------------------------------------------------------------------
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser } from './auth.types';

export const DEV_USER_HEADER = 'x-user-id';

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.headers[DEV_USER_HEADER];

    if (typeof userId !== 'string' || userId.length === 0) {
      throw new UnauthorizedException(
        `Missing ${DEV_USER_HEADER} header. Pick a user in the switcher, or see GET /api/dev/users.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, venueId: true },
    });

    if (!user) throw new UnauthorizedException('Unknown user');

    request.user = user satisfies AuthUser;
    return true;
  }
}
