import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      socket?: { remoteAddress?: string };
    }>();

    const expected = process.env.ADMIN_KEY;
    if (!expected) throw new ForbiddenException("Admin not configured");

    const provided = request.headers["x-admin-key"];
    if (!provided || provided !== expected) throw new ForbiddenException("Forbidden");

    const allowedIpsRaw = (process.env.ADMIN_ALLOWED_IPS ?? "").trim();
    if (allowedIpsRaw.length > 0) {
      const allowed = allowedIpsRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      const ip = (request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || request.socket?.remoteAddress || "";
      if (!allowed.includes(ip)) throw new ForbiddenException("Forbidden");
    }

    return true;
  }
}
