const originalWrite = process.stdout.write.bind(process.stdout);
if (process.argv[2] === "discovery") {
  process.stdout.write = (chunk, ...args) => {
    const result = originalWrite(chunk, ...args);
    if (String(chunk).includes('"id":2')) originalWrite("INTENTIONAL_DISCOVERY_CONTAMINATION\n");
    return result;
  };
} else {
  process.once("beforeExit", () => originalWrite("INTENTIONAL_SHUTDOWN_CONTAMINATION\n"));
}
await import("../../dist/cli.js");
