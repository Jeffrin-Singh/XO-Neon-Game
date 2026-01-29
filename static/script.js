/**********************************************************
 * GLOBAL STATE
 **********************************************************/
let roomCode = null;
let playerSymbol = null;      // "X" or "O" (multiplayer only)
let multiplayer = false;

let myName = "";
let playerNames = { X: "", O: "" };

let board = Array(9).fill(" ");
let currentPlayer = "X";
let gameActive = true;

// Firebase refs (multiplayer only)
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
const winSound   = document.getElementById("winSound");
const playAgainBtn = document.getElementById("playAgainBtn");

/**********************************************************
 * SCOREBOARD
 **********************************************************/
function updateScoreboard() {
  scoreDiv.innerText =
    `${playerNames.X || "Player X"} vs ${playerNames.O || "Player O"}`;
}

/**********************************************************
 * RENDER BOARD
 **********************************************************/
function renderBoard(winPattern = null) {
  boardDiv.innerHTML = "";

  board.forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    if (value === "X") cell.classList.add("x");
    if (value === "O") cell.classList.add("o");

    if (winPattern && winPattern.includes(index)) {
      cell.style.boxShadow = "0 0 20px #00ffe7";
      cell.style.transform = "scale(1.1)";
    }

    cell.innerText = value;
    cell.onclick = () => handleMove(index);

    boardDiv.appendChild(cell);
  });
}

/**********************************************************
 * GAME HELPERS
 **********************************************************/
function checkWinner(player) {
  return wins.some(p => p.every(i => board[i] === player));
}

function getWinningPattern(player) {
  return wins.find(p => p.every(i => board[i] === player));
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

  if (multiplayer && roomRef && playerSymbol) {
    namesRef.child(playerSymbol).set(myName);
  }
}

/**********************************************************
 * MULTIPLAYER – CREATE / JOIN / EXIT
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
  if (!multiplayer || !roomCode) return;

  roomRef?.off();
  namesRef?.off();
  chatRef?.off();

  if (playerSymbol) {
    namesRef.child(playerSymbol).remove();
  }

  multiplayer = false;
  roomCode = null;
  playerSymbol = null;
  playerNames = { X:"", O:"" };

  board = Array(9).fill(" ");
  currentPlayer = "X";
  gameActive = true;

  messagesDiv.innerHTML = "";
  popup.style.display = "none";
  roomStatus.style.display = "none";
  document.getElementById("exitRoomBtn").style.display = "none";
  statusText.innerText = "Not in a room";

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

    if (d.gameOver) {
      renderBoard();
      return;
    }

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
  if (!chatRef) return;

  chatRef.limitToLast(50).on("child_added", snap => {
    const m = snap.val();
    messagesDiv.innerHTML += `<div><b>${m.sender}:</b> ${m.text}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/**********************************************************
 * GAME MOVE HANDLER
 **********************************************************/
function handleMove(index) {
  if (!gameActive || board[index] !== " ") return;

  if (multiplayer) {
    if (currentPlayer !== playerSymbol) return;

    board[index] = playerSymbol;
    roomRef.update({
      board,
      turn: playerSymbol === "X" ? "O" : "X"
    });
    return;
  }

  board[index] = currentPlayer;
  renderBoard();

  if (checkWinner(currentPlayer)) return showPopup(currentPlayer);
  if (isDraw()) return showPopup("draw");

  currentPlayer = currentPlayer === "X" ? "O" : "X";
}

/**********************************************************
 * PLAY AGAIN
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

playAgainBtn?.addEventListener("click", restartGame);
playAgainBtn?.addEventListener("touchstart", e => {
  e.preventDefault();
  restartGame();
}, { passive:false });

/**********************************************************
 * INIT
 **********************************************************/
renderBoard();
updateScoreboard();
