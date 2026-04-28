import { buildMonitorStartupReportMessages } from "../src/engine/core/monitor_startup_report";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const messages = buildMonitorStartupReportMessages(
  [
    {
      allianceId: 7,
      allianceName: "Первая ролевая",
      monitorId: 42,
      monitorName: "Главная группа",
      groupId: 237164749,
      topicCount: 0,
      status: "started"
    },
    {
      allianceId: 7,
      allianceName: "Первая ролевая",
      monitorId: 43,
      monitorName: "Обсуждения",
      groupId: 236954859,
      topicCount: 12,
      status: "started"
    },
    {
      allianceId: 8,
      allianceName: "Вторая ролевая",
      monitorId: 99,
      monitorName: "Уже работал",
      groupId: 170217414,
      topicCount: 2,
      status: "already_running"
    }
  ],
  420
);

assert(messages.length >= 2, "Report must be grouped by alliance");
assert(
  messages.some((message) => message.includes("Первая ролевая") && message.includes("№42") && message.includes("№43")),
  "First alliance report must include its monitors"
);
assert(
  messages.some((message) => message.includes("Вторая ролевая") && message.includes("уже был запущен")),
  "Already running monitor status must be visible"
);
assert(
  messages.every((message) => message.length <= 420),
  "Report messages must respect provided VK message length"
);
