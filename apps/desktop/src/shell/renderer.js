// A first, plain page that proves the window can talk to the app. The real board replaces it in Phase 5.
const list = (id, items) => {
  const ul = document.getElementById(id);
  ul.replaceChildren(
    ...items.map((text) => Object.assign(document.createElement("li"), { textContent: text })),
  );
};

const refresh = async () => {
  const workflows = await window.adadex.request({ kind: "workflows.list" });
  const jobs = await window.adadex.request({ kind: "jobs.list" });
  list(
    "workflows",
    workflows.ok ? workflows.data.map((w) => `${w.name} (${w.origin})`) : workflows.errors,
  );
  list("jobs", jobs.ok ? jobs.data.map((j) => `${j.id}: ${j.stage}`) : jobs.errors);
  document.getElementById("status").textContent = "Connected";
};

window.adadex.onEvent((event) => {
  const li = document.createElement("li");
  li.textContent = `${event.type}: ${event.actionId ?? ""}`;
  document.getElementById("events").prepend(li);
});

refresh();
