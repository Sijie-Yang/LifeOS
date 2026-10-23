/** 服务器启动时：开推送循环（每分钟检查计时到点、会议、早晚提醒，推到 ntfy） */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPushLoop } = await import("./lib/push-tick");
    startPushLoop();
    // 07:00 截止日期邮件 / 20:00 关账邮件，不需要单独的 LaunchAgent
    const { startEmailSchedule } = await import("./lib/email-schedule");
    startEmailSchedule();
  }
}
