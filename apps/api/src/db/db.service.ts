import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@windhelm/db";

@Injectable()
export class DbService {
  constructor(@Inject("PRISMA") public readonly prisma: PrismaClient) {}
}
