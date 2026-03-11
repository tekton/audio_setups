/**
 * Port types page: create and manage port types (name, type slug, color).
 * Used by device types when defining ports. Default "Audio" is hardcoded and always available.
 */

const DEFAULT_PORT_TYPE = window.DEFAULT_PORT_TYPE || { id: "default_audio", name: "Audio", type: "audio", color: "#6b9b6b" };
const API_BASE = "http://localhost:7001";
const LOCAL_KEY = "audio_gear_port_types";

function getLocalPortTypes() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalPortTypes(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

async function getApiPortTypes() {
  try {
    const res = await fetch(`${API_BASE}/port-types`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function loadMergedPortTypes() {
  const local = getLocalPortTypes();
  const api = await getApiPortTypes();
  const byId = new Map();
  [DEFAULT_PORT_TYPE, ...api].forEach((t) => byId.set(t.id, t));
  local.forEach((t) => {
    if (t.id !== DEFAULT_PORT_TYPE.id) byId.set(t.id, t);
  });
  return Array.from(byId.values());
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

let editingId = null;

function renderList(types) {
  const ul = document.getElementById("port-type-list");
  ul.innerHTML = "";
  types.forEach((t) => {
    const li = document.createElement("li");
    const isDefault = t.id === DEFAULT_PORT_TYPE.id;
    li.innerHTML = `
      <span class="type-info">
        <span class="port-type-swatch" style="background:${escapeHtml(t.color)}"></span>
        <strong>${escapeHtml(t.name)}</strong> <code>${escapeHtml(t.type)}</code>
        ${isDefault ? ' <em>(default)</em>' : ""}
      </span>
      <span class="type-actions">
        ${isDefault ? "" : `<button type="button" data-edit="${escapeHtml(t.id)}">Edit</button><button type="button" data-delete="${escapeHtml(t.id)}">Delete</button>`}
      </span>
    `;
    if (!isDefault) {
      li.querySelector("[data-edit]").addEventListener("click", () => fillForm(t));
      li.querySelector("[data-delete]").addEventListener("click", () => deletePortType(t.id));
    }
    ul.appendChild(li);
  });
}

function fillForm(t) {
  editingId = t.id;
  document.getElementById("form-title").textContent = "Edit port type";
  document.getElementById("port-type-id").value = t.id || "";
  document.getElementById("port-type-name").value = t.name || "";
  document.getElementById("port-type-name").disabled = t.id === DEFAULT_PORT_TYPE.id;
  document.getElementById("port-type-slug").value = t.type || "";
  document.getElementById("port-type-slug").disabled = t.id === DEFAULT_PORT_TYPE.id;
  document.getElementById("port-type-color").value = t.color || "#808080";
  document.getElementById("port-type-color-picker").value = t.color || "#808080";
}

function clearForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Add port type";
  document.getElementById("port-type-id").value = "";
  document.getElementById("port-type-name").value = "";
  document.getElementById("port-type-name").disabled = false;
  document.getElementById("port-type-slug").value = "";
  document.getElementById("port-type-slug").disabled = false;
  document.getElementById("port-type-color").value = "#6b9b6b";
  document.getElementById("port-type-color-picker").value = "#6b9b6b";
}

function getFormData() {
  return {
    id: document.getElementById("port-type-id").value.trim() || undefined,
    name: document.getElementById("port-type-name").value.trim(),
    type: document.getElementById("port-type-slug").value.trim().toLowerCase() || "audio",
    color: document.getElementById("port-type-color").value.trim() || "#808080",
  };
}

function saveLocal() {
  const data = getFormData();
  if (!data.name || !data.type) {
    alert("Name and type are required.");
    return;
  }
  let list = getLocalPortTypes();
  const payload = { ...data, id: data.id || `pt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` };
  const idx = list.findIndex((t) => t.id === payload.id || (t.type === payload.type && t.id !== DEFAULT_PORT_TYPE.id));
  if (idx >= 0) list[idx] = payload;
  else list.push(payload);
  setLocalPortTypes(list);
  alert("Saved locally.");
  clearForm();
  loadMergedPortTypes().then(renderList);
}

async function saveServer() {
  const data = getFormData();
  if (!data.name || !data.type) {
    alert("Name and type are required.");
    return;
  }
  const payload = { ...data, id: data.id || undefined };
  try {
    const url = payload.id ? `${API_BASE}/port-types/${payload.id}` : `${API_BASE}/port-types`;
    const method = payload.id ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    alert("Saved to server.");
    clearForm();
    loadMergedPortTypes().then(renderList);
  } catch (e) {
    alert("Save to server failed: " + e.message);
  }
}

function exportJson() {
  loadMergedPortTypes().then((types) => {
    const list = types.filter((t) => t.id !== DEFAULT_PORT_TYPE.id);
    const json = JSON.stringify(list.map((t) => ({ id: t.id, name: t.name, type: t.type, color: t.color })), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audio-gear-port-types.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : [data];
      const local = getLocalPortTypes();
      const byId = new Map(local.map((t) => [t.id, t]));
      list.forEach((t) => {
        if (t.id === DEFAULT_PORT_TYPE.id) return;
        const id = t.id || `pt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        byId.set(id, { id, name: t.name || id, type: (t.type || "audio").toLowerCase(), color: t.color || "#808080" });
      });
      setLocalPortTypes(Array.from(byId.values()));
      alert("Imported.");
      loadMergedPortTypes().then(renderList);
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}

async function deletePortType(id) {
  if (id === DEFAULT_PORT_TYPE.id) return;
  if (!confirm("Delete this port type?")) return;
  const local = getLocalPortTypes().filter((t) => t.id !== id);
  setLocalPortTypes(local);
  try {
    await fetch(`${API_BASE}/port-types/${id}`, { method: "DELETE" });
  } catch (_) {}
  if (editingId === id) clearForm();
  loadMergedPortTypes().then(renderList);
}

document.getElementById("port-type-form").addEventListener("submit", (e) => {
  e.preventDefault();
  saveLocal();
});

document.getElementById("port-type-color").addEventListener("input", (e) => {
  document.getElementById("port-type-color").value = e.target.value || "#808080";
});

document.getElementById("port-type-color-picker").addEventListener("input", (e) => {
  document.getElementById("port-type-color").value = e.target.value;
});

document.getElementById("btn-save-local").addEventListener("click", () => saveLocal());
document.getElementById("btn-save-server").addEventListener("click", () => saveServer());
document.getElementById("btn-export-json").addEventListener("click", () => exportJson());
document.getElementById("btn-clear-form").addEventListener("click", () => clearForm());

document.getElementById("import-file").addEventListener("change", (evt) => {
  const file = evt.target.files?.[0];
  if (file) importJson(file);
  evt.target.value = "";
});

loadMergedPortTypes().then(renderList);
