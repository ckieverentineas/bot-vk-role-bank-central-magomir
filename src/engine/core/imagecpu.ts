import { randomInt } from "crypto";
import Jimp = require("jimp")
import { UploadAllowedSource } from "vk-io";
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
export async function Image_Random(context: any, dir_name: any) {
    const check = await prisma.user.findFirst({ where: { idvk: context.peerId } })
    //if (check?.id_role == 2) { return }
    const dir = `./src/art/template/${dir_name}`
    const file_name: any = await readDir(dir)
    const lenna = await Jimp.read(`${dir}/${file_name[randomInt(0, file_name.length)]}`)
    const res = lenna.quality(0)
    const attachment = await vk.upload.messagePhoto({
        source: {
            value: await res.getBufferAsync(Jimp.MIME_JPEG)
        }
    });
    return attachment
}
export async function Image_Composer() {
    const image0 = await Jimp.read('./src/art/composer/0.jpg')
    const image1 = await Jimp.read('./src/art/composer/1.png');
    const image2 = await Jimp.read('./src/art/composer/2.png');
    const image3 = await Jimp.read('./src/art/composer/3.png');
    image0.composite(image1.resize(500,600), 100, 100, { mode: Jimp.BLEND_ADD, opacitySource: 1, opacityDest: 0.2})
    .composite(image2.resize(500,300), 200, 200, { mode: Jimp.BLEND_MULTIPLY, opacitySource: 1, opacityDest: 0.2})
    .composite(image3.resize(500,300), 500, 350, { mode: Jimp.BLEND_OVERLAY, opacitySource: 1, opacityDest: 0.2}).write('./src/art/temp/test.jpg')
}

export async function Image_Composer2() {
    const font = await Jimp.loadFont('./src/art/font/harlow_white/harlow.fnt')
    const image0 = await Jimp.read('./src/art/composer2/0.jpg')
    const image1 = await Jimp.read('./src/art/composer2/1.jpg');
    const image2 = await Jimp.read('./src/art/composer2/2.jpg');
    const image3 = await Jimp.read('./src/art/composer2/3.jpg');
    image0.composite(await Image_Border(image2, 300, 300), 300, 400)
    .composite(await Image_Border(image3, 300, 300), image0.getWidth()-image3.getWidth()-300, 400, )
    .print(font, 750, 500, "VS").quality(0).dither565() 
    .print(font, 300, 100, "Битва Века, кто сьест больше?").quality(0).dither565() 
    .write('./src/art/temp/test2.jpg')
}
async function readDir(path: string) {
    try { const files = await fs.readdir(path); return files } catch (err) { console.error(err); }
}
    
async function Image_Border (image: any, x: number, y: number) {
    const dir = `./src/art/template/border`
    const file_name: any = await readDir(dir)
    const image_border = await Jimp.read(`./src/art/template/border/${file_name[randomInt(0, file_name.length)]}`)
    image_border.resize(x, y).composite(image.resize(x-20, y-20), 10, 10).quality(100)
    return image_border
}
export async function Image_Interface(data: any, context: any) {
    const check = await prisma.user.findFirst({ where: { idvk: context.peerId } })
    //if (check?.id_role == 2) { return }
    const font = await Jimp.loadFont('./src/art/font/impact_big/impact.fnt')
    const dir = `./src/art/template/fon`
    const file_name: any = await readDir(dir)
    const image_interface = await Jimp.read(`${dir}/${file_name[randomInt(0, file_name.length)]}`)

    let need_px = 0
    let need_max_width = 0

    for (const i in data) {
        const mesure = await Jimp.read(`./src/art/template/item/${data[i].name}.jpg`)
        need_px += mesure.getHeight()
        if (mesure.getWidth() > need_max_width) { need_max_width = mesure.getWidth() }
        need_px += Jimp.measureTextHeight(font, `${data[i].name} - ${data[i].price}`, need_max_width)
        need_px += Jimp.measureTextHeight(font, `${data[i].name} - ${data[i].price}`, need_max_width)
    }
    image_interface.resize(need_max_width, need_px).quality(100)
    let height_now = 0
    for (const i in data) {
        const image_temp = await Jimp.read(`./src/art/template/item/${data[i].name}.jpg`)
        image_interface.print(font, 0, height_now, {text: `${data[i].name} - ${data[i].price}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER}, image_temp.getWidth(), image_temp.getHeight())
        height_now += Jimp.measureTextHeight(font, `${data[i].name} - ${data[i].price}`, need_max_width)
        image_interface.composite(await Image_Border(image_temp, image_temp.getWidth()*0.9, image_temp.getHeight()), image_interface.getWidth()*0.05, height_now)
        height_now += image_temp.getHeight()
        height_now += Jimp.measureTextHeight(font, `${data[i].name} - ${data[i].price}`, need_max_width)
    }
    image_interface.dither565().quality(0)
    const attachment = await vk.upload.messagePhoto({
        source: {
            value: await image_interface.getBufferAsync(Jimp.MIME_JPEG)
        }
    });
    return attachment
}

export async function Image_Interface_Inventory(data: any, context: any) {
    const checkas = await prisma.user.findFirst({ where: { idvk: context.peerId } })
    //if (checkas?.id_role == 2) { return }
    const font = await Jimp.loadFont('./src/art/font/impact_medium/impact.fnt')
    const dir = `./src/art/template/inventory`
    const file_name: any = await readDir(dir)
    const image_interface = await Jimp.read(`${dir}/${file_name[randomInt(0, file_name.length)]}`)

    let need_width = 0
    let need_height = 0
    let mod = 0
    if (data && data[0] != undefined) {
        const mesure = await Jimp.read(`./src/art/template/item/${data[0].name}.jpg`)
        const check = await Image_Border(mesure, mesure.getWidth()/5.2, mesure.getHeight()/5.2)
        const configure = data.length/3
        if (configure <= 1) {
            mod = 1.1
            need_height = check.getHeight()
            need_width = (check.getWidth()+check.getWidth()*0.1)*data.length*1.3 
        } else {
            mod = Math.floor(configure+1)*0.8
            need_height = check.getHeight() * Math.floor(configure+1)
            need_width = (check.getWidth()+check.getWidth()*0.1)*3*1.3
        }
        image_interface.resize(need_width, need_height*mod).quality(100)
        let width_now = image_interface.getWidth()*0.05
        let height_now = image_interface.getHeight()*0.05
        let counter2 = 0
        for (const i in data) {
            const image_temp = await Jimp.read(`./src/art/template/item/${data[i].name}.jpg`)
            if (counter2 < 2) {
                image_interface.composite(await Image_Border(image_temp, image_temp.getWidth()/5.2, image_temp.getHeight()/5.2), width_now, height_now)
                image_interface.print(font, width_now, height_now+image_temp.getHeight()/5.2, {text: `${data[i].text}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER}, image_temp.getWidth()*1.5, image_temp.getHeight()/5)
                width_now += image_temp.getWidth()+image_interface.getWidth()*0.1
                counter2++
            } else {
                image_interface.composite(await Image_Border(image_temp, image_temp.getWidth()/5.2, image_temp.getHeight()/5.2), width_now, height_now)
                image_interface.print(font, width_now, height_now+image_temp.getHeight()/5, {text: `${data[i].text}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER}, image_temp.getWidth()*1.5, image_temp.getHeight()/5)
                width_now = image_interface.getWidth()*0.05
                height_now += image_temp.getHeight()*2
                counter2 = 0
            }
        }
        image_interface.dither565().quality(0)
    }
    const attachment = await vk.upload.messagePhoto({
        source: {
            value: await image_interface.getBufferAsync(Jimp.MIME_JPEG)
        }
    });
    return attachment
}