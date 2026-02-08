import { CardSystem } from "./card_system";

// Теперь эта функция просто использует систему карточек
export async function Image_Text_Add_Card(context: any, x: number, y: number, userData: any) {
  const attachment = await CardSystem.getUserCard(userData);
  
  if (!attachment) {
    console.error('[IMAGE CPU] Failed to get card');
    return null;
  }
  
  return attachment;
}