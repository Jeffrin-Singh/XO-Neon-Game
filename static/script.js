/**********************************************************
 * GLOBAL STATE
 **********************************************************/
let roomCode = null;
let playerSymbol = null; // X or O (online)
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
 * DOM ELEMENTS (SAFE)
 **********************************************************/
const $ = id => document.getElementById(id);

const boardDiv   = $("board");
const statusText = $("status");
const scoreDiv   = $("scoreboard");
const messagesDiv= $("messages");
const chatInput  = $("chatInput");
const roomStatus = $("roomStatus");

const popup      = $("popup");
const popupText  = $("popupText");
const playAgainBtn = $("playAgainBtn");
const winSound   = $("winSound");

const myProfile       = $("myProfile");
const myProfileName   = $("myProfileName");
const myProfileStatus = $("myProfileStatus");

/**********************************************************
 * SCOREBOARD
 **********************************************************/
function updateScoreboard() {
  const x = playerNames.X || "Waiting...";
  const o = playerNames.O || "Waiting...";
  scoreDiv.innerText = `${x}  vs  ${o}`;
}

/**********************************************************
 * BOARD RENDER
 **********************************************************/
function renderBoard(winPattern = null) {
  boardDiv.innerHTML = "";

  board.forEach((v, i) => {
    const c = document.createElement("div");
    c.className = "cell";
    if (v === "X") c.classList.add("x");
    if (v === "O") c.classList.add("o");

    if (winPattern && winPattern.includes(i)) {
      c.style.boxShadow = "0 0 20px #00ffe7";
      c.style.transform = "scale(1.1)";
    }

    c.textContent = v;
    c.onclick = () => handleMove(i);
    boardDiv.appendChild(c);
  });
}

/**********************************************************
 * GAME HELPERS
 **********************************************************/
const checkWinner = p => wins.some(w => w.every(i => board[i] === p));
const getWinningPattern = p => wins.find(w => w.every(i => board[i] === p));
const isDraw = () => !board.includes(" ");
const getPlayerName = s => playerNames[s] || `Player ${s}`;

/**********************************************************
 * POPUP
 **********************************************************/
function showPopup(result) {
  gameActive = false;

  popupText.textContent =
    result === "draw"
      ? "🤝 Match Draw!"
      : `🏆 ${getPlayerName(result)} Wins!`;

  popup.style.display = "flex";
  winSound?.play();
}

/**********************************************************
 * NAME HANDLING (SINGLE SOURCE)
 **********************************************************/
function saveMyName() {
  const input = $("myName")?.value.trim();
  if (!input) return alert("Enter your name");

  myName = input;
  $("nameModal").style.display = "none";

  if (myProfile) {
    myProfile.style.display = "block";
    myProfileName.textContent = `👤 ${myName}`;
    myProfileStatus.textContent = multiplayer ? "🟢 Online" : "🟡 Local";
  }

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
  roomStatus.textContent = `🟢 In Room ${roomCode} (You are X)`;
  $("exitRoomBtn").style.display = "inline-block";
  $("nameModal").style.display = "flex";

  listenRoom();
  listenNames();
  listenChat();
}

function joinRoom() {
  const code = $("roomCode").value.trim();
  if (!code) return alert("Enter room code");

  roomCode = code;
  playerSymbol = "O";
  multiplayer = true;

  roomRef  = db.ref(`rooms/${roomCode}`);
  namesRef = db.ref(`rooms/${roomCode}/names`);
  chatRef  = db.ref(`chats/${roomCode}`);

  roomStatus.style.display = "block";
  roomStatus.textContent = `🟢 In Room ${roomCode} (You are O)`;
  $("exitRoomBtn").style.display = "inline-block";
  $("nameModal").style.display = "flex";

  listenRoom();
  listenNames();
  listenChat();
}

function exitRoom() {
  if (!multiplayer) return;

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
  $("exitRoomBtn").style.display = "none";
  statusText.textContent = "Local Game";

  if (myProfileStatus) myProfileStatus.textContent = "🔴 Offline";

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

    for (const p of ["X","O"]) {
      const win = getWinningPattern(p);
      if (win) {
        roomRef.update({ gameOver:true });
        renderBoard(win);
        showPopup(p);
        return;
      }
    }

    if (isDraw()) {
      roomRef.update({ gameOver:true });
      showPopup("draw");
      return;
    }

    gameActive = true;
    renderBoard();
    statusText.textContent = `Turn: ${currentPlayer}`;
  });
}

/**********************************************************
 * CHAT
 **********************************************************/
function sendMessage() {
  if (!chatRef || !chatInput.value.trim()) return;
  chatRef.push({ sender: myName || playerSymbol, text: chatInput.value });
  chatInput.value = "";
}

function listenChat() {
  chatRef.on("child_added", snap => {
    const m = snap.val();
    messagesDiv.innerHTML += `<div><b>${m.sender}:</b> ${m.text}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/**********************************************************
 * MOVE HANDLER (NO AI)
 **********************************************************/
function handleMove(i) {
  if (!gameActive || board[i] !== " ") return;

  if (multiplayer) {
    if (currentPlayer !== playerSymbol) return;
    board[i] = playerSymbol;
    roomRef.update({
      board,
      turn: playerSymbol === "X" ? "O" : "X"
    });
    return;
  }

  board[i] = currentPlayer;
  renderBoard();

  if (checkWinner(currentPlayer)) return showPopup(currentPlayer);
  if (isDraw()) return showPopup("draw");

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  statusText.textContent = `Turn: ${currentPlayer}`;
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
