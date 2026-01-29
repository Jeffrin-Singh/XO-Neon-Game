/**********************************************************
 * GLOBAL STATE
 **********************************************************/
let roomCode = null;
let playerSymbol = null;     // "X" or "O" (online only)
let multiplayer = false;

let myName = "";
let playerNames = { X: "", O: "" };

let board = Array(9).fill(" ");
let currentPlayer = "X";
let gameActive = true;

// Firebase refs
let roomRef = null;
let namesRef = null;
let chatRef  = null;

/**********************************************************
 * CONSTANTS
 **********************************************************/
const wins = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

/**********************************************************
 * DOM ELEMENTS
 **********************************************************/
const boardDiv   = document.getElementById("board");
const statusText = document.getElementById("status");
const scoreDiv   = document.getElementById("scoreboard");
const messagesDiv= document.getElementById("messages");
const chatInput  = document.getElementById("chatInput");
const roomStatus = document.getElementById("roomStatus");

const popup      = document.getElementById("popup");
const popupText  = document.getElementById("popupText");
const playAgainBtn = document.getElementById("playAgainBtn");
const winSound   = document.getElementById("winSound");

/**********************************************************
 * SCOREBOARD
 **********************************************************/
function updateScoreboard() {
  scoreDiv.innerText =
    `${playerNames.X || "Player X"} vs ${playerNames.O || "Player O"}`;
}

/**********************************************************
 * BOARD RENDER
 **********************************************************/
function renderBoard(winPattern = null) {
  boardDiv.innerHTML = "";

  board.forEach((v, i) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    if (v === "X") cell.classList.add("x");
    if (v === "O") cell.classList.add("o");

    if (winPattern && winPattern.includes(i)) {
      cell.style.boxShadow = "0 0 20px #00ffe7";
      cell.style.transform = "scale(1.1)";
    }

    cell.innerText = v;
    cell.onclick = () => handleMove(i);
    boardDiv.appendChild(cell);
  });
}

/**********************************************************
 * GAME HELPERS
 **********************************************************/
function checkWinner(p) {
  return wins.some(w => w.every(i => board[i] === p));
}

function getWinningPattern(p) {
  return wins.find(w => w.every(i => board[i] === p));
}

function isDraw() {
  return !board.includes(" ");
}

function getPlayerName(symbol) {
  return playerNames[symbol] || `Player ${symbol}`;
}

/**********************************************************
 * POPUP
 **********************************************************/
function showPopup(result) {
  gameActive = false;

  popupText.innerText =
    result === "draw"
      ? "🤝 Match Draw!"
      : `🏆 ${getPlayerName(result)} (${result}) Wins!`;

  popup.style.display = "flex";
  winSound?.play();
}

/**********************************************************
 * NAME HANDLING
 **********************************************************/
function saveMyName() {
  const input = document.getElementById("myName").value.trim();
  if (!input) return alert("Enter your name");

  myName = input;
  document.getElementById("nameModal").style.display = "none";

  if (multiplayer && namesRef && playerSymbol) {
    namesRef.child(playerSymbol).set(myName);
  }
}

/**********************************************************
 * ONLINE MULTIPLAYER
 **********************************************************/
function createRoom() {
  roomCode = Math.random().toString(36).substr(2,6).toUpperCase();
  playerSymbol = "X";
  multiplayer = true;

  roomRef  = db.ref(`rooms/${roomCode}`);
  namesRef = db.ref(`rooms/${roomCode}/names`);
  chatRef  = db.ref(`chats/${roomCode}`);

  roomRef.set({
    board: Array(9).fill(" "),
    turn: "X",
    names: {},
    gameOver: false
  });

  roomStatus.style.display = "block";
  roomStatus.innerText = `🟢 In Room ${roomCode} (You are X)`;
  document.getElementById("exitRoomBtn").style.display = "inline-block";
  document.getElementById("nameModal").style.display = "flex";

  listenRoom();
  listenNames();
  listenChat();
}

function joinRoom() {
  const code = document.getElementById("roomCode").value.trim();
  if (!code) return alert("Enter room code");

  roomCode = code;
  playerSymbol = "O";
  multiplayer = true;

  roomRef  = db.ref(`rooms/${roomCode}`);
  namesRef = db.ref(`rooms/${roomCode}/names`);
  chatRef  = db.ref(`chats/${roomCode}`);

  roomStatus.style.display = "block";
  roomStatus.innerText = `🟢 In Room ${roomCode} (You are O)`;
  document.getElementById("exitRoomBtn").style.display = "inline-block";
  document.getElementById("nameModal").style.display = "flex";

  listenRoom();
  listenNames();
  listenChat();
}

function exitRoom() {
  if (!multiplayer) return;

  roomRef?.off();
  namesRef?.off();
  chatRef?.off();

  namesRef?.child(playerSymbol)?.remove();

  multiplayer = false;
  roomCode = null;
  playerSymbol = null;
  playerNames = { X:"", O:"" };

  board = Array(9).fill(" ");
  currentPlayer = "X";
  gameActive = true;

  popup.style.display = "none";
  roomStatus.style.display = "none";
  document.getElementById("exitRoomBtn").style.display = "none";
  messagesDiv.innerHTML = "";
  statusText.innerText = "Local Game";

  renderBoard();
  updateScoreboard();
}

/**********************************************************
 * FIREBASE LISTENERS
 **********************************************************/
function listenNames() {
  namesRef.on("value", snap => {
    playerNames = snap.val() || {};
    updateScoreboard();
  });
}

function listenRoom() {
  roomRef.on("value", snap => {
    const d = snap.val();
    if (!d) return;

    board = d.board;
    currentPlayer = d.turn;

    if (d.gameOver) return renderBoard();

    const winX = getWinningPattern("X");
    const winO = getWinningPattern("O");

    if (winX) {
      roomRef.update({ gameOver: true });
      renderBoard(winX);
      showPopup("X");
      return;
    }

    if (winO) {
      roomRef.update({ gameOver: true });
      renderBoard(winO);
      showPopup("O");
      return;
    }

    if (isDraw()) {
      roomRef.update({ gameOver: true });
      showPopup("draw");
      return;
    }

    gameActive = true;
    renderBoard();
    statusText.innerText = `Turn: ${currentPlayer}`;
  });
}

/**********************************************************
 * CHAT
 **********************************************************/
function sendMessage() {
  if (!chatRef || !chatInput.value.trim()) return;

  chatRef.push({
    sender: myName || playerSymbol,
    text: chatInput.value,
    time: Date.now()
  });

  chatInput.value = "";
}

function listenChat() {
  chatRef.limitToLast(50).on("child_added", snap => {
    const m = snap.val();
    messagesDiv.innerHTML += `<div><b>${m.sender}:</b> ${m.text}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/**********************************************************
 * MOVE HANDLER (NO AI)
 **********************************************************/
function handleMove(index) {
  if (!gameActive || board[index] !== " ") return;

  // Online
  if (multiplayer) {
    if (currentPlayer !== playerSymbol) return;

    board[index] = playerSymbol;
    roomRef.update({
      board,
      turn: playerSymbol === "X" ? "O" : "X"
    });
    return;
  }

  // Local 2-player
  board[index] = currentPlayer;
  renderBoard();

  if (checkWinner(currentPlayer)) return showPopup(currentPlayer);
  if (isDraw()) return showPopup("draw");

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  statusText.innerText = `Turn: ${currentPlayer}`;
}

/**********************************************************
 * PLAY AGAIN (MOBILE SAFE)
 **********************************************************/
function restartGame() {
  popup.style.display = "none";
  gameActive = true;
  currentPlayer = "X";

  if (multiplayer && roomRef) {
    roomRef.update({
      board: Array(9).fill(" "),
      turn: "X",
      gameOver: false
    });
  } else {
    board = Array(9).fill(" ");
    renderBoard();
  }
}

if (playAgainBtn) {
  const handler = e => {
    e.preventDefault();
    e.stopPropagation();
    restartGame();
  };
  playAgainBtn.addEventListener("click", handler);
  playAgainBtn.addEventListener("touchstart", handler, { passive:false });
}

/**********************************************************
 * INIT
 **********************************************************/
renderBoard();
updateScoreboard();
