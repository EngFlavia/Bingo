import { getAllBingoNumbers, getLastDraws, isDrawn } from "./bingo-core.js";

const state = {
  drawnNumbers: [],
  updatedAt: 0
};

const root = document.querySelector(".app-shell");
const numberArea = document.querySelector("#number-area");
const lastDraws = document.querySelector("#last-draws");
const drawCount = document.querySelector("#draw-count");
const drawButton = document.querySelector("#draw-button");
const resetButton = document.querySelector("#reset-button");
const controls = document.querySelector("#controls");
const displayLink = document.querySelector("#display-link");
const castButton = document.querySelector("#cast-button");
const reconnectButton = document.querySelector("#reconnect-button");
const stopCastButton = document.querySelector("#stop-cast-button");
const castStatus = document.querySelector("#cast-status");

const url = new URL(window.location.href);
const isDisplayView = url.searchParams.get("view") === "display";
const presentationUrl = `${window.location.origin}/?view=display`;
const presentationSupported = "PresentationRequest" in window;
let presentationRequest = null;
let presentationConnection = null;
let presentationAvailability = null;
let lastPresentationId = window.localStorage.getItem("bingoPresentationId");

function applyViewMode() {
  root.dataset.view = isDisplayView ? "display" : "controller";
  document.title = isDisplayView ? "Bingo - Tela da TV" : "App Bingo";

  if (isDisplayView) {
    controls.remove();
  }

  if (displayLink) {
    displayLink.href = presentationUrl;
  }
}

function setCastStatus(message, stateName = "idle") {
  if (!castStatus) {
    return;
  }

  castStatus.textContent = message;
  castStatus.dataset.state = stateName;
  castStatus.classList.toggle("hidden", message.length === 0);
}

function setCastControls({ connected = false, reconnectable = Boolean(lastPresentationId) } = {}) {
  if (!castButton || !reconnectButton || !stopCastButton) {
    return;
  }

  castButton.classList.toggle("is-active", connected);
  castButton.disabled = connected || !presentationSupported;
  stopCastButton.classList.toggle("hidden", !connected);
  reconnectButton.classList.toggle("hidden", connected || !reconnectable);
}

function updateAvailabilityStatus() {
  if (isDisplayView || !castButton) {
    return;
  }

  if (!presentationSupported) {
    setCastStatus(
      "Este navegador nao oferece cast direto. Use Chrome/Edge com uma TV compatível ou abra a Tela da TV manualmente.",
      "unavailable"
    );
    setCastControls({ connected: false, reconnectable: false });
    return;
  }

  if (presentationConnection) {
    setCastStatus("Transmitindo para a TV. O aparelho continua como controle do sorteio.", "connected");
    setCastControls({ connected: true });
    return;
  }

  const hasAvailableDisplay = presentationAvailability?.value;

  if (hasAvailableDisplay === false) {
    setCastStatus("Nenhum dispositivo compatível foi localizado na mesma rede Wi-Fi.", "unavailable");
  } else {
    setCastStatus("", "ready");
  }

  setCastControls();
}

function clearPresentationConnection() {
  presentationConnection = null;
  updateAvailabilityStatus();
}

function bindPresentationConnection(connection) {
  presentationConnection = connection;
  lastPresentationId = connection.id;
  window.localStorage.setItem("bingoPresentationId", connection.id);

  connection.addEventListener("connect", updateAvailabilityStatus);
  connection.addEventListener("close", clearPresentationConnection);
  connection.addEventListener("terminate", () => {
    window.localStorage.removeItem("bingoPresentationId");
    lastPresentationId = null;
    clearPresentationConnection();
  });

  updateAvailabilityStatus();
}

async function startPresentation() {
  if (!presentationRequest) {
    updateAvailabilityStatus();
    return;
  }

  setCastStatus("Procurando TVs e dispositivos compatíveis...", "pending");

  try {
    const connection = await presentationRequest.start();
    bindPresentationConnection(connection);
  } catch (error) {
    const message = error.name === "NotFoundError"
      ? "Nenhum dispositivo compatível foi localizado na mesma rede Wi-Fi."
      : "Nao foi possível iniciar a transmissão. Verifique a conexão e tente novamente.";
    setCastStatus(message, "unavailable");
    setCastControls();
  }
}

async function reconnectPresentation() {
  if (!presentationRequest || !lastPresentationId) {
    updateAvailabilityStatus();
    return;
  }

  setCastStatus("Tentando reconectar com a TV...", "pending");

  try {
    const connection = await presentationRequest.reconnect(lastPresentationId);
    bindPresentationConnection(connection);
  } catch {
    window.localStorage.removeItem("bingoPresentationId");
    lastPresentationId = null;
    setCastStatus("Nao foi possível reconectar. Inicie uma nova transmissão.", "unavailable");
    setCastControls({ reconnectable: false });
  }
}

function stopPresentation() {
  if (!presentationConnection) {
    clearPresentationConnection();
    return;
  }

  presentationConnection.terminate();
  window.localStorage.removeItem("bingoPresentationId");
  lastPresentationId = null;
  clearPresentationConnection();
}

async function setupCast() {
  if (isDisplayView || !castButton) {
    return;
  }

  castButton.addEventListener("click", startPresentation);
  reconnectButton.addEventListener("click", reconnectPresentation);
  stopCastButton.addEventListener("click", stopPresentation);

  if (!presentationSupported) {
    updateAvailabilityStatus();
    return;
  }

  presentationRequest = new PresentationRequest([presentationUrl]);
  navigator.presentation.defaultRequest = presentationRequest;

  try {
    presentationAvailability = await presentationRequest.getAvailability();
    presentationAvailability.addEventListener("change", updateAvailabilityStatus);
  } catch {
    presentationAvailability = null;
  }

  updateAvailabilityStatus();
}

function createBingoHeader() {
  const header = document.createElement("div");
  header.className = "bingo-header";
  header.setAttribute("aria-hidden", "true");

  for (const letter of ["B", "I", "N", "G", "O"]) {
    const item = document.createElement("span");
    item.textContent = letter;
    header.append(item);
  }

  return header;
}

function createNumberGrid(numbers) {
  const grid = document.createElement("div");
  grid.className = "number-grid";

  for (const number of numbers) {
    const item = document.createElement("div");
    item.className = "number-cell";
    item.dataset.number = String(number);
    item.textContent = String(number).padStart(2, "0");
    item.setAttribute("aria-label", `Numero ${number} ainda nao sorteado`);
    grid.append(item);
  }

  return grid;
}

function renderGrid() {
  const allNumbers = getAllBingoNumbers();
  const blocks = isDisplayView
    ? [allNumbers.slice(0, 35), allNumbers.slice(35)]
    : [allNumbers];
  const fragment = document.createDocumentFragment();

  for (const blockNumbers of blocks) {
    const block = document.createElement("div");
    block.className = "number-block";
    block.append(createBingoHeader(), createNumberGrid(blockNumbers));
    fragment.append(block);
  }

  numberArea.replaceChildren(fragment);
}

function renderLastDraws() {
  const latest = state.drawnNumbers.at(-1);
  const numbers = getLastDraws(state);
  const placeholders = Array.from({ length: 3 - numbers.length }, () => null);
  const visibleNumbers = [...placeholders, ...numbers];

  lastDraws.replaceChildren(
    ...visibleNumbers.map((number) => {
      const item = document.createElement("li");
      item.className = "last-draw";

      if (number === null) {
        item.classList.add("empty");
        item.textContent = "--";
        item.setAttribute("aria-label", "Aguardando sorteio");
        return item;
      }

      item.textContent = String(number).padStart(2, "0");
      item.setAttribute("aria-label", `Numero sorteado ${number}`);

      if (number === latest) {
        item.classList.add("latest");
      }

      return item;
    })
  );
}

function renderState(nextState) {
  state.drawnNumbers = nextState.drawnNumbers;
  state.updatedAt = nextState.updatedAt;

  const latest = state.drawnNumbers.at(-1);

  for (const cell of numberArea.querySelectorAll(".number-cell")) {
    const number = Number(cell.dataset.number);
    const drawn = isDrawn(state, number);
    const latestDraw = number === latest;

    cell.classList.toggle("drawn", drawn);
    cell.classList.toggle("latest-in-grid", latestDraw);
    cell.setAttribute(
      "aria-label",
      drawn ? `Numero ${number} ja sorteado` : `Numero ${number} ainda nao sorteado`
    );
  }

  drawCount.textContent = `${state.drawnNumbers.length} de 75 sorteados`;
  drawButton.disabled = state.drawnNumbers.length >= 75;
  renderLastDraws();
}

async function postAction(path) {
  drawButton.disabled = true;
  resetButton.disabled = true;

  try {
    const response = await fetch(path, { method: "POST" });

    if (!response.ok) {
      throw new Error(`Falha na acao ${path}`);
    }

    renderState(await response.json());
  } finally {
    resetButton.disabled = false;
    drawButton.disabled = state.drawnNumbers.length >= 75;
  }
}

async function loadInitialState() {
  const response = await fetch("/api/state");

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar o sorteio.");
  }

  renderState(await response.json());
}

function connectEvents() {
  const source = new EventSource("/events");

  source.addEventListener("state", (event) => {
    renderState(JSON.parse(event.data));
  });

  source.addEventListener("error", () => {
    source.close();
    setTimeout(connectEvents, 1500);
  });
}

drawButton.addEventListener("click", () => postAction("/api/draw"));
resetButton.addEventListener("click", () => postAction("/api/reset"));

applyViewMode();
renderGrid();
setupCast();
await loadInitialState();
connectEvents();
