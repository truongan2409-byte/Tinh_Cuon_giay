(() => {
  "use strict";

  const STORAGE_KEY = "may_tinh_giay_pwa_v1";
  const D_LOI = 100; // Đường kính lõi cố định (mm)
  const MAX_HISTORY = 50;

  function tinhHsdkTuDinhLuong(dinhLuong, loaiGiay) {
    let hsdkTuDong;
    if (loaiGiay === "GIẤY XEO") {
      const g1 = 125;
      const hsdk1 = 1.326;
      const g2 = 185;
      const hsdk2 = 1.298;
      hsdkTuDong = hsdk1 + ((dinhLuong - g1) * (hsdk2 - hsdk1)) / (g2 - g1);
    } else {
      const gGoc = 170;
      const hsdkGoc = 1.208;
      const heSoDoc = (1.298 - 1.326) / (185 - 125);
      hsdkTuDong = (hsdkGoc + (dinhLuong - gGoc) * heSoDoc) * 1.008;
    }

    if (hsdkTuDong > 1.45) hsdkTuDong = 1.45;
    else if (hsdkTuDong < 1.1) hsdkTuDong = 1.1;

    return Number(hsdkTuDong.toFixed(4));
  }

  function tinhDuongKinhTuDinhLuong(soMet, dinhLuong, hsdk) {
    const doDayMm = (dinhLuong * hsdk) / 1000;
    const doDayM = doDayMm / 1000;
    const dLoiM = D_LOI / 1000;
    if (doDayM <= 0) return D_LOI / 10;

    const dBinhPhuong = (4 * soMet * doDayM) / Math.PI + dLoiM * dLoiM;
    return Math.sqrt(dBinhPhuong) * 100;
  }

  function tinhSoMetTuDuongKinh(duongKinhCm, dinhLuong, hsdk) {
    const doDayMm = (dinhLuong * hsdk) / 1000;
    const doDayM = doDayMm / 1000;
    const dLoiM = D_LOI / 1000;
    const dCuonM = duongKinhCm / 100;
    if (doDayM <= 0 || dCuonM <= dLoiM) return 0;

    return ((dCuonM * dCuonM - dLoiM * dLoiM) * Math.PI) / (4 * doDayM);
  }

  function parseNumber(raw) {
    const cleaned = String(raw ?? "").trim().replace(/,/g, ".");
    if (!cleaned) return Number.NaN;
    const val = Number(cleaned);
    return Number.isFinite(val) ? val : Number.NaN;
  }

  function formatNumber(val, decimals) {
    return val.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatNow() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${mi}`;
  }

  function loadState() {
    const defaults = {
      kho: "1550",
      dinhLuong: "170",
      weight: "1600",
      met: "",
      loaiGiay: "GIẤY XEO",
      hsdk: String(tinhHsdkTuDinhLuong(170, "GIẤY XEO")),
      dk: "",
      history: [],
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        kho: typeof parsed.kho === "string" ? parsed.kho : defaults.kho,
        dinhLuong: typeof parsed.dinhLuong === "string" ? parsed.dinhLuong : defaults.dinhLuong,
        weight: typeof parsed.weight === "string" ? parsed.weight : defaults.weight,
        met: typeof parsed.met === "string" ? parsed.met : defaults.met,
        loaiGiay: parsed.loaiGiay === "GIẤY MÀU" ? "GIẤY MÀU" : "GIẤY XEO",
        hsdk: typeof parsed.hsdk === "string" ? parsed.hsdk : defaults.hsdk,
        dk: typeof parsed.dk === "string" ? parsed.dk : "",
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    } catch {
      return defaults;
    }
  }

  const state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }

  const el = {
    inpKho: document.getElementById("inpKho"),
    inpDinhLuong: document.getElementById("inpDinhLuong"),
    inpWeight: document.getElementById("inpWeight"),
    inpMet: document.getElementById("inpMet"),
    selLoaiGiay: document.getElementById("selLoaiGiay"),
    inpHsdk: document.getElementById("inpHsdk"),
    inpDk: document.getElementById("inpDk"),

    btnTinhMet: document.getElementById("btnTinhMet"),
    btnTinhKg: document.getElementById("btnTinhKg"),
    btnTinhTuDk: document.getElementById("btnTinhTuDk"),
    btnReset: document.getElementById("btnReset"),

    resultBox: document.getElementById("resultBox"),
    lblKetQua: document.getElementById("lblKetQua"),
    lblStatus: document.getElementById("lblStatus"),

    btnHistory: document.getElementById("btnHistory"),
    historyModal: document.getElementById("historyModal"),
    historyList: document.getElementById("historyList"),
    btnCopyHistory: document.getElementById("btnCopyHistory"),
    btnClearHistory: document.getElementById("btnClearHistory"),
    btnCloseHistory: document.getElementById("btnCloseHistory"),

    toast: document.getElementById("toast"),
  };

  let toastTimer = null;
  function showToast(msg, bg = "#1e293b") {
    el.toast.textContent = msg;
    el.toast.style.background = bg;
    el.toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2000);
  }

  function setResult(text, modeClass) {
    el.resultBox.className = `result-box ${modeClass}`;
    el.lblKetQua.textContent = text;
  }

  function syncInputsToState() {
    state.kho = el.inpKho.value;
    state.dinhLuong = el.inpDinhLuong.value;
    state.weight = el.inpWeight.value;
    state.met = el.inpMet.value;
    state.loaiGiay = el.selLoaiGiay.value;
    state.hsdk = el.inpHsdk.value;
    state.dk = el.inpDk.value;
    saveState();
  }

  function updateHistoryBadge() {
    el.btnHistory.textContent = `Lịch sử (${state.history.length})`;
  }

  function addHistory(entry) {
    state.history.unshift(entry);
    if (state.history.length > MAX_HISTORY) {
      state.history.length = MAX_HISTORY;
    }
    updateHistoryBadge();
    saveState();
  }

  function capNhatHsdkTuDong() {
    const dinhLuong = parseNumber(el.inpDinhLuong.value);
    if (!Number.isNaN(dinhLuong) && dinhLuong > 0) {
      const hsdkMoi = tinhHsdkTuDinhLuong(dinhLuong, el.selLoaiGiay.value);
      el.inpHsdk.value = String(hsdkMoi);
    }
    syncInputsToState();
  }

  function tinhSoMet() {
    const khoGiay = parseNumber(el.inpKho.value);
    const dinhLuong = parseNumber(el.inpDinhLuong.value);
    const trongLuong = parseNumber(el.inpWeight.value);
    const hsdk = parseNumber(el.inpHsdk.value);

    if (
      Number.isNaN(khoGiay) ||
      Number.isNaN(dinhLuong) ||
      Number.isNaN(trongLuong) ||
      Number.isNaN(hsdk)
    ) {
      setResult("Vui lòng nhập đúng định dạng số!", "error");
      showToast("Vui lòng nhập đúng định dạng số!", "#b91c1c");
      return;
    }

    if (khoGiay <= 0 || dinhLuong <= 0 || trongLuong <= 0 || hsdk <= 0) {
      setResult("Các giá trị phải lớn hơn 0!", "error");
      showToast("Các giá trị phải lớn hơn 0!", "#b91c1c");
      return;
    }

    const soMet = (trongLuong * 1000000) / (dinhLuong * khoGiay);
    const dkCuonCm = tinhDuongKinhTuDinhLuong(soMet, dinhLuong, hsdk);

    el.inpMet.value = soMet.toFixed(2);
    el.inpDk.value = dkCuonCm.toFixed(2);

    const summary = `L = ${formatNumber(soMet, 1)} m | Ø = ${formatNumber(dkCuonCm, 2)} cm`;
    setResult(`Kết quả: ${summary}`, "met");
    syncInputsToState();

    addHistory({
      summary,
      meta: `${el.selLoaiGiay.value} • Khổ ${khoGiay}mm • ĐL ${dinhLuong} • W ${trongLuong}kg • HSĐK ${hsdk}`,
      createdAt: formatNow(),
    });
  }

  function tinhTrongLuong() {
    const khoGiay = parseNumber(el.inpKho.value);
    const dinhLuong = parseNumber(el.inpDinhLuong.value);
    const soMet = parseNumber(el.inpMet.value);
    const hsdk = parseNumber(el.inpHsdk.value);

    if (
      Number.isNaN(khoGiay) ||
      Number.isNaN(dinhLuong) ||
      Number.isNaN(soMet) ||
      Number.isNaN(hsdk)
    ) {
      setResult("Vui lòng nhập đúng định dạng số!", "error");
      showToast("Vui lòng nhập đúng định dạng số!", "#b91c1c");
      return;
    }

    if (khoGiay <= 0 || dinhLuong <= 0 || soMet <= 0 || hsdk <= 0) {
      setResult("Các giá trị phải lớn hơn 0!", "error");
      showToast("Các giá trị phải lớn hơn 0!", "#b91c1c");
      return;
    }

    const trongLuong = (dinhLuong * khoGiay * soMet) / 1000000;
    const dkCuonCm = tinhDuongKinhTuDinhLuong(soMet, dinhLuong, hsdk);

    el.inpWeight.value = trongLuong.toFixed(2);
    el.inpDk.value = dkCuonCm.toFixed(2);

    const summary = `W = ${formatNumber(trongLuong, 1)} kg | Ø = ${formatNumber(dkCuonCm, 2)} cm`;
    setResult(`Kết quả: ${summary}`, "weight");
    syncInputsToState();

    addHistory({
      summary,
      meta: `${el.selLoaiGiay.value} • Khổ ${khoGiay}mm • ĐL ${dinhLuong} • L ${soMet}m • HSĐK ${hsdk}`,
      createdAt: formatNow(),
    });
  }

  function tinhTuDuongKinh() {
    const khoGiay = parseNumber(el.inpKho.value);
    const dinhLuong = parseNumber(el.inpDinhLuong.value);
    const duongKinhCm = parseNumber(el.inpDk.value);
    const hsdk = parseNumber(el.inpHsdk.value);

    if (
      Number.isNaN(khoGiay) ||
      Number.isNaN(dinhLuong) ||
      Number.isNaN(duongKinhCm) ||
      Number.isNaN(hsdk)
    ) {
      setResult("Vui lòng nhập đúng định dạng số!", "error");
      showToast("Vui lòng nhập đúng định dạng số!", "#b91c1c");
      return;
    }

    if (khoGiay <= 0 || dinhLuong <= 0 || duongKinhCm <= 0 || hsdk <= 0) {
      setResult("Các giá trị phải lớn hơn 0!", "error");
      showToast("Các giá trị phải lớn hơn 0!", "#b91c1c");
      return;
    }

    const dLoiCm = D_LOI / 10;
    if (duongKinhCm <= dLoiCm) {
      const msg = `Đường kính cuộn phải lớn hơn lõi (${dLoiCm} cm)!`;
      setResult(msg, "error");
      showToast(msg, "#b91c1c");
      return;
    }

    const soMet = tinhSoMetTuDuongKinh(duongKinhCm, dinhLuong, hsdk);
    const trongLuong = (dinhLuong * khoGiay * soMet) / 1000000;

    el.inpMet.value = soMet.toFixed(2);
    el.inpWeight.value = trongLuong.toFixed(2);

    const summary = `W = ${formatNumber(trongLuong, 1)} kg | L = ${formatNumber(soMet, 1)} m`;
    setResult(`Kết quả: ${summary}`, "dk");
    syncInputsToState();

    addHistory({
      summary,
      meta: `${el.selLoaiGiay.value} • Khổ ${khoGiay}mm • ĐL ${dinhLuong} • Ø ${duongKinhCm}cm • HSĐK ${hsdk}`,
      createdAt: formatNow(),
    });
  }

  function resetDuLieu() {
    el.inpKho.value = "";
    el.inpDinhLuong.value = "";
    el.inpWeight.value = "";
    el.inpMet.value = "";
    el.selLoaiGiay.value = "GIẤY XEO";
    el.inpHsdk.value = "1.3048";
    el.inpDk.value = "";
    setResult("Vui lòng nhập dữ liệu để tính toán", "idle");
    syncInputsToState();
  }

  function renderHistory() {
    el.historyList.innerHTML = "";
    if (state.history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Chưa có phép tính nào được lưu.";
      el.historyList.appendChild(empty);
      return;
    }

    state.history.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "history-item";

      const info = document.createElement("div");
      const summary = document.createElement("div");
      summary.className = "history-summary";
      summary.textContent = item.summary || "-";

      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.textContent = `${item.meta || ""} (${item.createdAt || ""})`;
      info.append(summary, meta);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-action danger";
      delBtn.textContent = "Xóa";
      delBtn.addEventListener("click", () => {
        state.history.splice(idx, 1);
        saveState();
        updateHistoryBadge();
        renderHistory();
      });

      card.append(info, delBtn);
      el.historyList.appendChild(card);
    });
  }

  function updateNetworkStatus() {
    if (navigator.onLine) {
      el.lblStatus.textContent = "Online";
      el.lblStatus.classList.remove("offline");
    } else {
      el.lblStatus.textContent = "Offline";
      el.lblStatus.classList.add("offline");
    }
  }

  // Restore initial UI state
  el.inpKho.value = state.kho;
  el.inpDinhLuong.value = state.dinhLuong;
  el.inpWeight.value = state.weight;
  el.inpMet.value = state.met;
  el.selLoaiGiay.value = state.loaiGiay;
  el.inpHsdk.value = state.hsdk;
  el.inpDk.value = state.dk;
  updateHistoryBadge();
  updateNetworkStatus();

  // Bind input events
  el.inpDinhLuong.addEventListener("input", capNhatHsdkTuDong);
  el.selLoaiGiay.addEventListener("change", capNhatHsdkTuDong);
  [el.inpKho, el.inpWeight, el.inpMet, el.inpHsdk, el.inpDk].forEach((input) => {
    input.addEventListener("input", syncInputsToState);
  });

  el.btnTinhMet.addEventListener("click", tinhSoMet);
  el.btnTinhKg.addEventListener("click", tinhTrongLuong);
  el.btnTinhTuDk.addEventListener("click", tinhTuDuongKinh);
  el.btnReset.addEventListener("click", resetDuLieu);

  el.btnHistory.addEventListener("click", () => {
    renderHistory();
    el.historyModal.classList.remove("hidden");
  });

  el.btnCloseHistory.addEventListener("click", () => {
    el.historyModal.classList.add("hidden");
  });

  el.historyModal.addEventListener("click", (e) => {
    if (e.target === el.historyModal) el.historyModal.classList.add("hidden");
  });

  el.btnCopyHistory.addEventListener("click", async () => {
    if (state.history.length === 0) {
      showToast("Lịch sử đang trống");
      return;
    }
    const text = state.history
      .map((i) => `${i.summary} — ${i.meta} (${i.createdAt})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Đã sao chép lịch sử", "#0b5ed7");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Đã sao chép lịch sử", "#0b5ed7");
    }
  });

  el.btnClearHistory.addEventListener("click", () => {
    if (state.history.length === 0) return;
    state.history = [];
    saveState();
    updateHistoryBadge();
    renderHistory();
    showToast("Đã xóa toàn bộ lịch sử");
  });

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Ignore registration errors
      });
    });
  }
})();
