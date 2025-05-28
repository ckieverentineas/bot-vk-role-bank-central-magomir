import { randomInt } from "crypto";
import Jimp = require("jimp")
import { vk } from "../..";
import { promises as fs } from 'fs';
import prisma from "../events/module/prisma_client";

export async function Image_Text_Add_Card(context: any, x: number, y: number, text: any) {
    const check = await prisma.user.findFirst({ where: { idvk: context.peerId } })
    //if (check?.id_role == 2) { return }
    const dir = `./src/art/template/card`
    const file_name: any = await readDir(dir)
    const lenna = await Jimp.read(`${dir}/${file_name[randomInt(0, file_name.length)]}`)
    const font = await Jimp.loadFont('./src/art/font/impact_medium/impact.fnt')
    const font_big = await Jimp.loadFont('./src/art/font/impact_big/impact.fnt') 
    const res = await lenna.resize(1687, 1077).print(font_big, x, y, (`${text.idvk * Math.pow(10, 16-String(text.idvk).length)+text.id}`).slice(-16).replace(/\d{4}(?=.)/g, '$& ').replace(/ /g, `${' '.repeat(7)}`))
    .print(font, x, y+200, text.name, 1200)
    .print(font, lenna.getWidth()-370, y+200, text.crdate.toLocaleDateString('de-DE', { year: "numeric", month: "2-digit", day: "2-digit" }) )
    const attachment = await vk.upload.messagePhoto({
        source: {
            value: await res.getBufferAsync(Jimp.MIME_JPEG)
        }
    });
    return attachment
    
}

async function readDir(path: string) {
    try { const files = await fs.readdir(path); return files } catch (err) { console.error(err); }
}
    
