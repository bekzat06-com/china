import { PrismaClient } from "@prisma/client";

// Один экземпляр клиента на всё приложение (в dev-режиме переживает горячую перезагрузку).
// Prisma использует параметризованные запросы — это защищает от SQL-инъекций.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
