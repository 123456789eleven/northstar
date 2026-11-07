// The one small win moment for a finished task: the tick plus a running count. Plain, no praise.
export const doneMessage = (title: string, doneToday: number): string => `Done: "${title}". ${doneToday} done today.`
