import { chat_id } from "../../../.."
import { Confirm_User_Success, Logger, Send_Message } from "../../../core/helper"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"

export async function Alliance_Year_End_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `хотите закончить Учебный/Рейтинговый год в [${alliance.name}]?\n ⚠ Все рейтинговые валюты факультетов и ролевиков будут обнулены!`)
    await context.send(`${rank_check.text}`)
    if (!rank_check.status) { return await context.send(`⚠ Вы отменили конец учебного года, Дамблдор в Восторге, десять очков Гриффиндору!`) }
    const ans: { count_person: number, count_facult: number } = { count_person: 0, count_facult: 0 }
    await context.send(`🚀 Запускается процесс окончания учебного семестра, ожидайте завершаюшего сообщения!`)
    for (const coin of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance! } })) {
        if (coin.point == false) { continue }
        for (const userok of await prisma.user.findMany({ where: { id_alliance: user.id_alliance } })) {
            const bal_usr = await prisma.balanceCoin.findFirst({ where: { id_coin: coin.id, id_user: userok.id }})
            if (!bal_usr || bal_usr.amount == 0) { continue }
            const bal_usr_ch = await prisma.balanceCoin.update({ where: { id: bal_usr.id }, data: { amount: 0 } })
            await Logger(`End year for 🌐 [@${alliance.idvk}(${alliance.name}-${alliance.id})] and coin ${coin.smile}${coin.name}-${coin.id} doing zero for user ${userok.id_account}-${userok.id}-${userok.idvk} by admin ${user.id_account}-${user.id}-${user.idvk}`)
            if ( bal_usr_ch) { ans.count_person++ }
        }
        for (const facult of await prisma.allianceFacult.findMany({ where: { id_alliance: user.id_alliance ?? -1 } })) {
            const bal_fac = await prisma.balanceFacult.findFirst({ where: { id_coin: coin.id, id_facult: facult.id }})
            if (!bal_fac || bal_fac.amount == 0) { continue }
            const bal_fac_ch = await prisma.balanceFacult.update({ where: { id: bal_fac.id }, data: { amount: 0 } })
            if ( bal_fac_ch) { ans.count_facult++ }
        }
        await Send_Message(chat_id,`🌐 [@${alliance.idvk}(${alliance.name})] > конец учебного года, обнулено рейтинговых валют в количестве для открытых счетов ролевиков ${ans.count_person}, для открытых счетов факультетов ${ans.count_facult}, инициатор @id${user.idvk}(${user.name})`)
    }
    await context.send(`✅ Успешно завершен процесс окончания учебного семестра!`)
}