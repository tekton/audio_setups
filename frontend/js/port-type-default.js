/**
 * Hardcoded default port type. Used when no custom port types exist.
 * Must stay in sync with backend port_type_store.DEFAULT_PORT_TYPE.
 */
const DEFAULT_PORT_TYPE = Object.freeze({
  id: "default_audio",
  name: "Audio",
  type: "audio",
  color: "#6b9b6b",
});
if (typeof window !== "undefined") window.DEFAULT_PORT_TYPE = DEFAULT_PORT_TYPE;
