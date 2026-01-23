/***********************
 * GLOBAL STATE
 ***********************/
let roomCode = null;
let playerSymbol = null;
let multiplayer = false;

let scores = JSON.parse(localStorage.getItem("xoScores")) || {
    X: 0,
    O: 0,
    draw: 0
};

let board = Array(9).fill(" ");
let currentPlayer = "X";
let gameActive = true;

/***********************
 * DOM ELEMENTS
 ***********************/
const boardDiv = document.getElementById("board");
const statusText = document.getElementById("status");
const scoreDiv = document.getElementById("scoreboard");

const modeSelect = document.getElementById("mode");
const diffSelect = document.getElementById("difficulty");

const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");

const clickSound = document.getElementById("clickSound");
const winSound = document.getElementById("winSound");

/***********************
 * CONSTANTS
 ***********************/
const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

/***********************
 * SCOREBOARD
 ***********************/
function updateScoreboard() {
    scoreDiv.innerText =
        `X: ${scores.X} | O: ${scores.O} | Draws: ${scores.draw}`;
    localStorage.setItem("xoScores", JSON.stringify(scores));
}

/***********************
 * GAME HELPERS
 ***********************/
function checkWinner(player) {
    return wins.some(c => c.every(i => board[i] === player));
}

function isDraw() {
    return !board.includes(" ");
}

/***********************
 * AI HELPERS
 ***********************/
function getEmptyCells() {
    return board
        .map((v, i) => v === " " ? i : null)
        .filter(v => v !== null);
}

// EASY – random
function aiEasy() {
    const empty = getEmptyCells();
    return empty[Math.floor(Math.random() * empty.length)];
}

// MEDIUM – win or block
function aiMedium() {
    for (let i of getEmptyCells()) {
        board[i] = "O";
        if (checkWinner("O")) {
            board[i] = " ";
            return i;
        }
        board[i] = " ";
    }

    for (let i of getEmptyCells()) {
        board[i] = "X";
        if (checkWinner("X")) {
            board[i] = " ";
            return i;
        }
        board[i] = " ";
    }

    return aiEasy();
}

// HARD – minimax
function aiHard() {
    let bestScore = -Infinity;
    let move;

    for (let i of getEmptyCells()) {
        board[i] = "O";
        let score = minimax(0, false);
        board[i] = " ";
        if (score > bestScore) {
            bestScore = score;
            move = i;
        }
    }
    return move;
}

function minimax(depth, isMax) {
    if (checkWinner("O")) return 10 - depth;
    if (checkWinner("X")) return depth - 10;
    if (isDraw()) return 0;

    if (isMax) {
        let best = -Infinity;
        for (let i of getEmptyCells()) {
            board[i] = "O";
            best = Math.max(best, minimax(depth + 1, false));
            board[i] = " ";
        }
        return best;
    } else {
        let best = Infinity;
        for (let i of getEmptyCells()) {
            board[i] = "X";
            best = Math.min(best, minimax(depth + 1, true));
            board[i] = " ";
        }
        return best;
    }
}

/***********************
 * RENDER BOARD
 ***********************/
function renderBoard() {
    boardDiv.innerHTML = "";
    board.forEach((value, index) => {
        const cell = document.createElement("div");
        cell.className = "cell";

        if (value === "X") cell.classList.add("x");
        if (value === "O") cell.classList.add("o");

        cell.innerText = value;
        cell.onclick = () => handleMove(index);
        boardDiv.appendChild(cell);
    });
}

/***********************
 * POPUP
 ***********************/
function showPopup(text, winnerKey) {
    popupText.innerText = text;
    popup.style.display = "flex";
    winSound.play();
    gameActive = false;

    if (winnerKey) {
        scores[winnerKey]++;
        updateScoreboard();
    }
}

/***********************
 * MULTIPLAYER (FIREBASE)
 ***********************/
function createRoom() {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    playerSymbol = "X";
    multiplayer = true;

    db.ref("rooms/" + roomCode).set({
        board: Array(9).fill(" "),
        turn: "X"
    });

    alert("Room Code: " + roomCode);
    listenRoom();
}

function joinRoom() {
    const input = document.getElementById("roomCode").value.trim();
    if (!input) return alert("Enter room code");

    roomCode = input;
    playerSymbol = "O";
    multiplayer = true;

    listenRoom();
}

function listenRoom() {
    db.ref("rooms/" + roomCode).on("value", snap => {
        const data = snap.val();
        if (!data) return;

        board = data.board;
        currentPlayer = data.turn;
        gameActive = true;

        renderBoard();
        statusText.innerText = `Turn: ${currentPlayer}`;
    });
}

/***********************
 * HANDLE MOVE
 ***********************/
function handleMove(index) {
    if (board[index] !== " " || !gameActive) return;

    /* 🌐 MULTIPLAYER */
    if (multiplayer) {
        if (currentPlayer !== playerSymbol) return;

        clickSound.play();
        board[index] = playerSymbol;

        const next = playerSymbol === "X" ? "O" : "X";

        db.ref("rooms/" + roomCode).update({
            board: board,
            turn: next
        });
        return;
    }

    /* 👤 LOCAL PLAYER */
    clickSound.play();
    board[index] = currentPlayer;
    renderBoard();

    if (checkWinner(currentPlayer)) {
        showPopup(`${currentPlayer} Wins!`, currentPlayer);
        return;
    }

    if (isDraw()) {
        showPopup("Draw!", "draw");
        return;
    }

    /* 🤖 AI MODE */
    if (modeSelect.value === "ai") {
        statusText.innerText = "AI Thinking...";
        gameActive = false;

        setTimeout(() => {
            let move;
            if (diffSelect.value === "easy") move = aiEasy();
            else if (diffSelect.value === "medium") move = aiMedium();
            else move = aiHard();

            board[move] = "O";
            renderBoard();
            gameActive = true;
            statusText.innerText = "Turn: X";

            if (checkWinner("O")) showPopup("AI Wins!", "O");
            else if (isDraw()) showPopup("Draw!", "draw");
        }, 400);
    } else {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusText.innerText = `Turn: ${currentPlayer}`;
    }
}

/***********************
 * RESTART GAME
 ***********************/
function restartGame() {
    board = Array(9).fill(" ");
    currentPlayer = "X";
    gameActive = true;
    popup.style.display = "none";
    statusText.innerText = "Turn: X";

    if (multiplayer && roomCode) {
        db.ref("rooms/" + roomCode).set({
            board: board,
            turn: "X"
        });
    }

    renderBoard();
}

/***********************
 * INIT
 ***********************/
updateScoreboard();
renderBoard();
