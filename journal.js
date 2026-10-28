"use strict";

(() => {
  const STORAGE_KEY = "alp-trading-journal-v2";
  const $ = id => document.getElementById(id);

  const form = $("tradeForm");
  const formPanel = $("tradeFormPanel");
  const tableBody = $("tradeTableBody");

  let trades = loadTrades();
  let toastTimer;

  function loadTrades() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value)
        ? value.filter(t =>
            t && typeof t === "object" &&
            typeof t.id === "string" &&
            ["NAS100", "GER40"].includes(t.instrument) &&
            ["Win", "Loss", "Pending", "Break-even"].includes(t.outcome)
          )
        : [];
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      return true;
    } catch {
      notify("Unable to save. Export your records or check browser storage.");
      return false;
    }
  }

  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2
    });
  }

  function signedR(value) {
    const n = Number(value);
    return `${n > 0 ? "+" : ""}${formatNumber(n)}R`;
  }

  function today() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function showForm(trade = null) {
    form.reset();

    $("tradeId").value = trade?.id || "";
    $("tradeDate").value = trade?.date || today();
    $("instrument").value = trade?.instrument || "NAS100";
    $("direction").value = trade?.direction || "Buy";
    $("outcome").value = trade?.outcome || "Pending";
    $("risk").value = trade?.risk ?? "";
    $("resultR").value = trade?.resultR ?? "";
    $("entry").value = trade?.entry ?? "";
    $("stopLoss").value = trade?.stopLoss ?? "";
    $("takeProfit").value = trade?.takeProfit ?? "";
    $("setup").value = trade?.setup || "BOS + Pullback";
    $("notes").value = trade?.notes || "";

    $("formTitle").textContent = trade ? "Edit Trade" : "Record a Trade";
    $("saveTradeButton").textContent = trade ? "Update Trade" : "Save Trade";

    formPanel.classList.add("open");
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    formPanel.classList.remove("open");
    form.reset();
    $("tradeId").value = "";
  }

  function getFormData() {
    const outcome = $("outcome").value;
    const resultText = $("resultR").value.trim();
    let resultR = resultText === "" ? null : Number(resultText);

    if (resultR === null) {
      if (outcome === "Win") resultR = 1;
      if (outcome === "Loss") resultR = -1;
      if (outcome === "Break-even") resultR = 0;
    }

    return {
      id: $("tradeId").value ||
        (Date.now().toString(36) + Math.random().toString(36).slice(2, 9)),
      date: $("tradeDate").value,
      instrument: $("instrument").value,
      direction: $("direction").value,
      outcome,
      risk: Number($("risk").value),
      resultR,
      entry: $("entry").value.trim(),
      stopLoss: $("stopLoss").value.trim(),
      takeProfit: $("takeProfit").value.trim(),
      setup: $("setup").value,
      notes: $("notes").value.trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function validTrade(t) {
    if (!t.date) return "Select the trade date.";
    if (!["NAS100", "GER40"].includes(t.instrument)) {
      return "Select NAS100 or GER40.";
    }
    if (!Number.isFinite(t.risk) || t.risk <= 0) {
      return "Risk must be greater than zero.";
    }
    if (t.resultR !== null && !Number.isFinite(t.resultR)) {
      return "Enter a valid result in R.";
    }
    if (t.outcome === "Win" && t.resultR !== null && t.resultR <= 0) {
      return "A win must have a positive result in R.";
    }
    if (t.outcome === "Loss" && t.resultR !== null && t.resultR >= 0) {
      return "A loss must have a negative result in R.";
    }
    if (t.outcome === "Break-even" &&
        t.resultR !== null && t.resultR !== 0) {
      return "Break-even must have a 0R result.";
    }
    return "";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const trade = getFormData();
    const error = validTrade(trade);

    if (error) {
      notify(error);
      return;
    }

    const index = trades.findIndex(t => t.id === trade.id);
    const previous = trades.slice();

    if (index >= 0) trades[index] = trade;
    else trades.push(trade);

    if (!persist()) {
      trades = previous;
      return;
    }

    render();
    closeForm();
    notify(index >= 0 ? "Trade updated." : "Trade saved.");
  });

  function outcomeClass(outcome) {
    if (outcome === "Win") return "win";
    if (outcome === "Loss") return "loss";
    if (outcome === "Break-even") return "break-even";
    return "pending";
  }

  function render() {
    const query = $("searchInput").value.trim().toLowerCase();
    const instrument = $("instrumentFilter").value;
    const outcome = $("outcomeFilter").value;

    const visible = trades
      .filter(t => instrument === "All" || t.instrument === instrument)
      .filter(t => outcome === "All" || t.outcome === outcome)
      .filter(t => [
        t.instrument, t.setup, t.notes, t.direction
      ].some(v => String(v || "").toLowerCase().includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!visible.length) {
      tableBody.innerHTML = `
        <tr><td colspan="7" class="empty-state">${
          trades.length
            ? "No trades match these filters."
            : "No trades recorded yet. Select Record Trade to begin."
        }</td></tr>`;
    } else {
      tableBody.innerHTML = visible.map(t => `
        <tr>
          <td>${escapeHTML(t.date)}</td>
          <td>${escapeHTML(t.instrument)}</td>
          <td>${escapeHTML(t.direction)}</td>
          <td>${formatNumber(t.risk)}</td>
          <td><span class="badge ${outcomeClass(t.outcome)}">${
            escapeHTML(t.outcome)
          }</span></td>
          <td>${
            t.resultR === null || t.resultR === undefined
              ? "—"
              : escapeHTML(signedR(t.resultR))
          }</td>
          <td>
            <div class="row-actions">
              <button class="action-button" data-action="edit"
                data-id="${escapeHTML(t.id)}">Edit</button>
              <button class="action-button delete" data-action="delete"
                data-id="${escapeHTML(t.id)}">Delete</button>
            </div>
          </td>
        </tr>`).join("");
    }

    updateStats();
  }

  function updateStats() {
    const decided = trades.filter(t =>
      ["Win", "Loss", "Break-even"].includes(t.outcome)
    );

    const wins = trades.filter(t => t.outcome === "Win").length;
    const losses = trades.filter(t => t.outcome === "Loss").length;
    const rate = decided.length ? wins / decided.length * 100 : 0;

    const netR = decided.reduce((sum, t) =>
      sum + (Number.isFinite(Number(t.resultR)) ? Number(t.resultR) : 0), 0);

    $("totalTrades").textContent = trades.length;
    $("winRate").textContent = `${rate.toFixed(1)}%`;
    $("winLoss").textContent = `${wins} / ${losses}`;
    $("netResult").textContent = signedR(netR);

    $("netResult").style.color =
      netR > 0 ? "var(--green)" :
      netR < 0 ? "var(--red)" : "var(--text)";
  }

  tableBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const trade = trades.find(t => t.id === button.dataset.id);
    if (!trade) return;

    if (button.dataset.action === "edit") {
      showForm(trade);
    }

    if (button.dataset.action === "delete") {
      if (!confirm(`Delete the ${trade.instrument} trade dated ${trade.date}?`)) {
        return;
      }

      const previous = trades.slice();
      trades = trades.filter(t => t.id !== trade.id);

      if (!persist()) {
        trades = previous;
        return;
      }

      render();
      notify("Trade deleted.");
    }
  });

  $("newTradeButton").addEventListener("click", () => showForm());

  $("navNewTrade").addEventListener("click", event => {
    event.preventDefault();
    closeMenu();
    showForm();
  });

  $("closeFormButton").addEventListener("click", closeForm);
  $("cancelButton").addEventListener("click", closeForm);
  $("searchInput").addEventListener("input", render);
  $("instrumentFilter").addEventListener("change", render);
  $("outcomeFilter").addEventListener("change", render);

  function closeMenu() {
    $("sidebar").classList.remove("open");
    $("overlay").classList.remove("visible");
    $("menuButton").setAttribute("aria-expanded", "false");
  }

  $("menuButton").addEventListener("click", () => {
    const opened = $("sidebar").classList.toggle("open");
    $("overlay").classList.toggle("visible", opened);
    $("menuButton").setAttribute("aria-expanded", String(opened));
  });

  $("overlay").addEventListener("click", closeMenu);

  $("exportButton").addEventListener("click", () => {
    if (!trades.length) {
      notify("No records to export yet.");
      return;
    }

    const columns = [
      "date", "instrument", "direction", "risk", "outcome",
      "resultR", "entry", "stopLoss", "takeProfit", "setup", "notes"
    ];

    const cell = value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.join(","),
      ...trades.map(t => columns.map(key => cell(t[key])).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "alp-trading-journal.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    notify("CSV backup downloaded.");
  });

  render();
})();
