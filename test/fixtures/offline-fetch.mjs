globalThis.fetch = async () => {
  throw new Error("Offline tests forbid real fetch calls. Inject a provider fixture.");
};
