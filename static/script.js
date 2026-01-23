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
    gameActive = true;

    db.ref("rooms/" + roomCode).set({
        board: Array(9).fill(" "),
        turn: "X"
    });

    alert("Room Code: " + roomCode);
    listenRoom();
}

function joinRoom() {
    const input = document.getElementById("roomCode").value.trim();
    if (!input) {
        alert("Enter room code");
        return;
    }

    roomCode = input;
    playerSymbol = "O";
    multiplayer = true;
    gameActive = true;

    listenRoom();
}

function listenRoom() {
    db.ref("rooms/" + roomCode).on("value", snapshot => {
        const data = snapshot.val();
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

    /* 🌐 MULTIPLAYER MODE */
    if (multiplayer) {
        if (currentPlayer !== playerSymbol) return;

        clickSound.play();
        board[index] = playerSymbol;

        const nextTurn = playerSymbol === "X" ? "O" : "X";

        db.ref("rooms/" + roomCode).update({
            board: board,
            turn: nextTurn
        });
        return;
    }

    /* 👤 LOCAL / AI MODE */
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

    if (modeSelect.value === "two") {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusText.innerText = `Turn: ${currentPlayer}`;
    } else {
        statusText.innerText = "AI Thinking...";
        gameActive = false;

        fetch("/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                board: board,
                difficulty: diffSelect.value
            })
        })
        .then(r => r.json())
        .then(data => {
            board = data.board;
            renderBoard();
            gameActive = true;
            statusText.innerText = "Turn: X";

            if (checkWinner("O")) showPopup("AI Wins!", "O");
            else if (isDraw()) showPopup("Draw!", "draw");
        });
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
