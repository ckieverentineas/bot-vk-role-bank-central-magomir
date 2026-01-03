// Создаем файл src/engine/events/module/alliance/terminology_helper.ts
import prisma from "../prisma_client";

export async function getTerminology(allianceId: number, key: keyof {
    singular: string;
    plural: string;
    genitive: string;
    dative: string;
    accusative: string;
    instrumental: string;
    prepositional: string;
    plural_genitive: string;
}): Promise<string> {
    const terminology = await prisma.allianceTerminology.findFirst({ 
        where: { id_alliance: allianceId } 
    });
    
    if (!terminology) {
        // Возвращаем значения по умолчанию
        const defaults = {
            singular: "факультет",
            plural: "факультеты",
            genitive: "факультета",
            dative: "факультету",
            accusative: "факультет",
            instrumental: "факультетом",
            prepositional: "факультете",
            plural_genitive: "факультетов"
        };
        return defaults[key];
    }
    
    return terminology[key];
}