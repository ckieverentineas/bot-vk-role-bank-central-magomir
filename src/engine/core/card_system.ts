import Jimp = require("jimp");
import { randomInt } from "crypto";
import { vk } from "../..";
import prisma from "../events/module/prisma_client";
import { User } from "@prisma/client";
import { Logger } from "./helper";
import * as path from "path";
import * as fs from 'fs';
import * as https from 'https';

export class CardSystem {
  // Главная функция: получить карточку пользователя
  static async getUserCard(user: User): Promise<string> {
    try {
      // 1. Получаем ЕДИНСТВЕННЫЙ шаблон альянса
      const template = await prisma.cardTemplate.findFirst({
        where: { alliance_id: user.id_alliance || 0 }
      });

      // 2. Проверяем существующую карточку
      const existingCard = await prisma.userCard.findUnique({
        where: { user_id: user.id }
      });

      // 3. Если есть шаблон И карточка НЕ соответствует ему - удаляем старую
      if (existingCard && template) {
        const userTemplate = existingCard.template_id ? 
          await prisma.cardTemplate.findUnique({
            where: { id: existingCard.template_id }
          }) : null;
        
        // Если у карточки нет шаблона ИЛИ шаблон не совпадает с текущим
        if (!userTemplate || userTemplate.id !== template.id) {
          console.log(`[CARD] Template mismatch or missing, deleting card for user ${user.id}`);
          await prisma.userCard.delete({
            where: { user_id: user.id }
          }).catch(() => {});
        }
      }

      // 4. Если карточки нет или она была удалена - создаем новую
      const currentCard = await prisma.userCard.findUnique({
        where: { user_id: user.id }
      });

      if (!currentCard) {
        console.log(`[CARD] Creating new card for user ${user.id}`);
        return await this.createUserCard(user, template);
      }

      console.log(`[CARD] Using existing card for user ${user.id}`);
      return currentCard.attachment;

    } catch (error) {
      console.error('[CARD] Error:', error);
      return '';
    }
  }

  static async createUserCard(user: User, template?: any): Promise<string> {
    try {
      // 1. Если шаблон не передан - получаем единственный для альянса
      if (!template) {
        template = await prisma.cardTemplate.findFirst({
          where: { alliance_id: user.id_alliance || 0 }
        });
      }

      // 2. Генерируем карточку
      const attachment = await this.generateCard(user, template);
      
      if (!attachment) {
        throw new Error('Failed to generate card');
      }

      // 3. Подготавливаем данные для создания
      const createData: any = {
        user: {
          connect: { id: user.id }
        },
        attachment: attachment,
        created_at: new Date()
      };

      // Если есть шаблон - добавляем связь
      if (template?.id) {
        createData.template = {
          connect: { id: template.id }
        };
      }

      // 4. Сохраняем в БД
      await prisma.userCard.create({
        data: createData
      });

      console.log(`[CARD] Card saved successfully for user ${user.id}`);
      return attachment;

    } catch (error) {
      console.error('[CARD] Create error:', error);
      return await this.generateCard(user, null);
    }
  }

  static async generateCard(user: User, template: any): Promise<string> {
      try {
          let background: Jimp;
          
          if (template?.image_path && fs.existsSync(template.image_path)) {
              try {
                  background = await Jimp.read(template.image_path);
                  console.log(`[CARD] Successfully loaded template from file for user ${user.id}`);
              } catch (e) {
                  console.error('[CARD] Failed to load template image from file:', e);
                  background = await this.getDefaultBackground();
              }
          } else {
              background = await this.getDefaultBackground();
          }

          background.resize(1687, 1077);

          const font = await Jimp.loadFont('./src/art/font/impact_medium/impact.fnt');
          const fontBig = await Jimp.loadFont('./src/art/font/impact_big/impact.fnt');

          const cardNumber = (`${user.idvk * Math.pow(10, 16 - String(user.idvk).length) + user.id}`)
              .slice(-16)
              .replace(/\d{4}(?=.)/g, '$& ')
              .replace(/ /g, `${' '.repeat(7)}`);
          
          const cardNumberX = 100;
          const cardNumberY = 650;
          
          // Рисуем номер карточки и получаем его ширину
          const cardNumberWidth = Jimp.measureText(fontBig, cardNumber);
          
          const nameX = 100;
          const nameY = 900;
          
          const dateText = user.crdate.toLocaleDateString('de-DE', { 
              year: "numeric", 
              month: "2-digit", 
              day: "2-digit" 
          });
          
          // Вычисляем ширину текста даты
          const dateWidth = Jimp.measureText(font, dateText);
          
          // Вычисляем X позицию для даты так, чтобы правый край даты совпадал с правым краем номера карточки
          // Правый край номера карточки: cardNumberX + cardNumberWidth
          // Правый край даты должен быть в той же позиции: dateX + dateWidth = cardNumberX + cardNumberWidth
          const dateX = cardNumberX + cardNumberWidth - dateWidth;
          const dateY = 900;

          background
              .print(fontBig, cardNumberX, cardNumberY, cardNumber)
              .print(font, nameX, nameY, user.name, 1200)
              .print(font, dateX, dateY, dateText);

          const buffer = await background.getBufferAsync(Jimp.MIME_JPEG);
          
          if (!vk) {
              throw new Error('VK client not initialized');
          }

          const uploadedPhoto = await vk.upload.messagePhoto({
              source: { value: buffer }
          });

          if (!uploadedPhoto || !uploadedPhoto.ownerId || !uploadedPhoto.id) {
              throw new Error('Failed to upload photo to VK');
          }

          return `photo${uploadedPhoto.ownerId}_${uploadedPhoto.id}`;

      } catch (error) {
          console.error('[CARD] Generate error:', error);
          return '';
      }
  }

  // Дефолтный фон (из существующих файлов)
  static async getDefaultBackground(): Promise<Jimp> {
    const dir = './src/art/template/card';
    
    try {
      const files = await fs.promises.readdir(dir);
      if (files.length === 0) {
        throw new Error('No template files found');
      }
      const file = files[randomInt(0, files.length)];
      return await Jimp.read(path.join(dir, file));
    } catch (error) {
      console.error('[CARD] Default background error:', error);
      // Создаем пустое изображение если файлов нет
      return new Jimp(1687, 1077, 0xFFFFFFFF);
    }
  }

  // ====================== ФОНЫ ГЛАВНОГО МЕНЮ ======================

  static async getMenuBackground(user: User): Promise<string> {
      try {
          if (user.id_alliance && user.id_alliance > 0) {
              // Ищем фон альянса
              const allianceBackground = await prisma.allianceBackground.findFirst({
                  where: { alliance_id: user.id_alliance }
              });

              if (allianceBackground?.attachment) {
                  console.log(`[MENU_BG] Using alliance background for alliance ${user.id_alliance}, user ${user.id}`);
                  return allianceBackground.attachment;
              } else {
                  console.log(`[MENU_BG] No background found for alliance ${user.id_alliance}, using default`);
              }
          } else {
              console.log(`[MENU_BG] User ${user.id} has no alliance, using default background`);
          }

          // Используем дефолтный фон
          return await this.getDefaultMenuBackground();
          
      } catch (error) {
          console.error('[MENU_BG] Error:', error);
          return await this.getDefaultMenuBackground();
      }
  }

  // Получить дефолтный фон меню
  private static async getDefaultMenuBackground(): Promise<string> {
    try {
      return 'photo-225517872_457259284';
    } catch (error) {
      console.error('[MENU_BG] Default background error:', error);
      return 'photo-225517872_457259284';
    }
  }

  // Установить фон главного меню для альянса
  static async setMenuBackgroundForAlliance(
    allianceId: number, 
    context: any,
    name: string = "Фон главного меню"
  ): Promise<boolean> {
    try {
      const attachments = context.attachments || [];
      
      // Ищем фото в сообщении
      for (const attachment of attachments) {
        if (attachment.type === 'photo') {
          // Получаем самую большую версию фото
          const sizes = attachment.photo?.sizes || attachment.sizes;
          if (!sizes || sizes.length === 0) continue;
          
          const largestSize = sizes[sizes.length - 1];
          const url = largestSize.url;
          
          if (!url) continue;
          
          // Загружаем в ВК
          if (!vk) {
            throw new Error('VK client not initialized');
          }
          
          // Создаем временный файл для загрузки
          const tempDir = path.join(process.cwd(), 'temp');
          await this.ensureDirectoryExists(tempDir);
          
          const tempPath = path.join(tempDir, `menu_bg_${allianceId}_${Date.now()}.jpg`);
          
          // Скачиваем фото
          await this.downloadImage(url, tempPath);
          
          // Загружаем в ВК
          const uploadedPhoto = await vk.upload.messagePhoto({
            source: { value: tempPath }
          });
          
          // Удаляем временный файл
          fs.unlinkSync(tempPath);
          
          if (!uploadedPhoto) {
            console.error('[MENU_BG] Failed to upload photo to VK');
            return false;
          }
          
          const photoAttachment = `photo${uploadedPhoto.ownerId}_${uploadedPhoto.id}`;
          
          // Проверяем, есть ли уже фон для этого альянса
          const existingBackground = await prisma.allianceBackground.findFirst({
            where: { alliance_id: allianceId }
          });
          
          // Обновляем или создаем фон
          if (existingBackground) {
            await prisma.allianceBackground.update({
              where: { id: existingBackground.id },
              data: {
                name: name,
                attachment: photoAttachment,
                created_at: new Date()
              }
            });
            
            console.log(`[MENU_BG] Updated menu background for alliance ${allianceId}`);
          } else {
            await prisma.allianceBackground.create({
              data: {
                alliance_id: allianceId,
                name: name,
                attachment: photoAttachment
              }
            });
            
            console.log(`[MENU_BG] Created new menu background for alliance ${allianceId}`);
          }
          
          await Logger(`Set menu background for alliance ${allianceId}: ${name}`);
          return true;
        }
      }
      
      console.error('[MENU_BG] No photo found in message');
      return false;

    } catch (error) {
      console.error('[MENU_BG] Set background error:', error);
      return false;
    }
  }

  // Удалить фон главного меню альянса
  static async deleteMenuBackgroundForAlliance(allianceId: number): Promise<boolean> {
    try {
      const background = await prisma.allianceBackground.findFirst({
        where: { alliance_id: allianceId }
      });

      if (!background) {
        console.log(`[MENU_BG] No menu background found for alliance ${allianceId}`);
        return false;
      }

      await prisma.allianceBackground.delete({
        where: { id: background.id }
      });

      await Logger(`Deleted menu background for alliance ${allianceId}`);
      return true;

    } catch (error) {
      console.error('[MENU_BG] Delete background error:', error);
      return false;
    }
  }

  // Получить текущий фон меню альянса
  static async getAllianceMenuBackground(allianceId: number): Promise<any> {
    return await prisma.allianceBackground.findFirst({
      where: { alliance_id: allianceId }
    });
  }

  // ====================== ОБЩИЕ ФУНКЦИИ ======================

  // УСТАНОВИТЬ фон для альянса (только 1 фон!)
  static async setTemplateForAlliance(
    allianceId: number, 
    context: any,
    name: string = "Фон карточки"
  ): Promise<boolean> {
    try {
      const attachments = context.attachments || [];
      
      // Ищем фото в сообщении
      for (const attachment of attachments) {
        if (attachment.type === 'photo') {
          const sizes = attachment.photo?.sizes || attachment.sizes;
          if (!sizes || sizes.length === 0) continue;
          
          const largestSize = sizes[sizes.length - 1];
          const url = largestSize.url;
          
          if (!url) continue;
          
          const templatesDir = path.join(process.cwd(), 'data', 'templates');
          await this.ensureDirectoryExists(templatesDir);
          
          const filename = `alliance_${allianceId}.jpg`;
          const filePath = path.join(templatesDir, filename);
          
          await this.downloadImage(url, filePath);
          
          if (!vk) {
            throw new Error('VK client not initialized');
          }
          
          const uploadedPhoto = await vk.upload.messagePhoto({
            source: { value: filePath }
          });
          
          if (!uploadedPhoto) {
            console.error('[CARD] Failed to upload photo to VK');
            return false;
          }
          
          const photoAttachment = `photo${uploadedPhoto.ownerId}_${uploadedPhoto.id}`;
          
          const existingTemplate = await prisma.cardTemplate.findFirst({
            where: { alliance_id: allianceId }
          });
          
          if (existingTemplate) {
            if (existingTemplate.image_path && fs.existsSync(existingTemplate.image_path)) {
              fs.unlinkSync(existingTemplate.image_path);
            }
            
            await prisma.cardTemplate.update({
              where: { id: existingTemplate.id },
              data: {
                name: name,
                image_url: photoAttachment,
                image_path: filePath,
                created_at: new Date()
              }
            });
          } else {
            await prisma.cardTemplate.create({
              data: {
                alliance_id: allianceId,
                name: name,
                image_url: photoAttachment,
                image_path: filePath
              }
            });
          }
          
          const users = await prisma.user.findMany({
            where: { id_alliance: allianceId },
            select: { id: true }
          });

          const userIds = users.map(u => u.id);
          
          if (userIds.length > 0) {
            await prisma.userCard.deleteMany({
              where: { user_id: { in: userIds } }
            });
          }

          await Logger(`Set card template for alliance ${allianceId}: ${name}`);
          return true;
        }
      }
      
      console.error('[CARD] No photo found in message');
      return false;

    } catch (error) {
      console.error('[CARD] Set template error:', error);
      return false;
    }
  }

  // УДАЛИТЬ фон альянса
  static async deleteAllianceTemplate(allianceId: number): Promise<boolean> {
    try {
      const template = await prisma.cardTemplate.findFirst({
        where: { alliance_id: allianceId }
      });

      if (!template) {
        console.log(`[CARD] No template found for alliance ${allianceId}`);
        return false;
      }

      if (template.image_path && fs.existsSync(template.image_path)) {
        try {
          fs.unlinkSync(template.image_path);
        } catch (e) {
          console.error(`[CARD] Error deleting template file:`, e);
        }
      }

      await prisma.cardTemplate.delete({
        where: { id: template.id }
      });

      const users = await prisma.user.findMany({
        where: { id_alliance: allianceId },
        select: { id: true }
      });

      const userIds = users.map(u => u.id);
      
      if (userIds.length > 0) {
        await prisma.userCard.deleteMany({
          where: { user_id: { in: userIds } }
        });
      }

      await Logger(`Deleted card template for alliance ${allianceId}`);
      return true;

    } catch (error) {
      console.error('[CARD] Delete template error:', error);
      return false;
    }
  }

  // Получить текущий шаблон альянса
  static async getAllianceTemplate(allianceId: number): Promise<any> {
    return await prisma.cardTemplate.findFirst({
      where: { alliance_id: allianceId }
    });
  }

  // ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================
  
  private static async downloadImage(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      
      https.get(url, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
      }).on('error', (error: any) => {
        fs.unlinkSync(filePath);
        reject(error);
      });
    });
  }
  
  private static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.stat(dirPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.promises.mkdir(dirPath, { recursive: true });
      } else {
        throw err;
      }
    }
  }
}