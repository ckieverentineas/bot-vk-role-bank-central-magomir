import { Limiter } from "@prisma/client";
import prisma from "../prisma_client";

export async function Date_Compare_Resetor(limiter: Limiter) {
    const inputDate = new Date(limiter.update)
    const currentDate = new Date();
    if (inputDate.getFullYear() !== currentDate.getFullYear() ||
        inputDate.getMonth() !== currentDate.getMonth() ||
        inputDate.getDate() !== currentDate.getDate()) {
        // Обнуляем счетчик
        return await prisma.limiter.update({ where: { id: limiter.id }, data: { likes: 0, comment: 0, update: currentDate } })
    }
    return limiter
}