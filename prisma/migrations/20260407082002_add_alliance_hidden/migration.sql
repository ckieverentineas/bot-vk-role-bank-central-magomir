-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alliance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "id_chat" INTEGER NOT NULL DEFAULT 0,
    "id_chat_monitor" INTEGER NOT NULL DEFAULT 0,
    "id_chat_shop" INTEGER NOT NULL DEFAULT 0,
    "id_chat_topic" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Alliance" ("id", "id_chat", "id_chat_monitor", "id_chat_shop", "id_chat_topic", "idvk", "name") SELECT "id", "id_chat", "id_chat_monitor", "id_chat_shop", "id_chat_topic", "idvk", "name" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
