export const log = {
  info(message: string, fields: Record<string, string | number> = {}) {
    console.log(JSON.stringify({ level: "info", message, ...fields }));
  },
};
