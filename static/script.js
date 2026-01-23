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
const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");

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
    return wins.some(p => p.every(i => board[i] === player));
}

function getWinningPattern(player) {
    return wins.find(p => p.every(i => board[i] === player));
}

function isDraw() {
    return !board.includes(" ");
}

/***********************
 * AI HELPERS
 ***********************/
function getEmptyCells() {
    return board.map((v,i)=>v===" "?i:null).filter(v=>v!==null);
}

function aiEasy() {
    const e = getEmptyCells();
    return e[Math.floor(Math.random()*e.length)];
}

function aiMedium() {
    for (let i of getEmptyCells()) {
        board[i]="O"; if(checkWinner("O")){board[i]=" ";return i;}
        board[i]=" ";
    }
    for (let i of getEmptyCells()) {
        board[i]="X"; if(checkWinner("X")){board[i]=" ";return i;}
        board[i]=" ";
    }
    return aiEasy();
}

function aiHard() {
    let best=-Infinity, move;
    for (let i of getEmptyCells()) {
        board[i]="O";
        let score=minimax(0,false);
        board[i]=" ";
        if(score>best){best=score;move=i;}
    }
    return move;
}

function minimax(d,isMax){
    if(checkWinner("O"))return 10-d;
    if(checkWinner("X"))return d-10;
    if(isDraw())return 0;

    if(isMax){
        let b=-Infinity;
        for(let i of getEmptyCells()){
            board[i]="O";b=Math.max(b,minimax(d+1,false));board[i]=" ";
        }
        return b;
    } else {
        let b=Infinity;
        for(let i of getEmptyCells()){
            board[i]="X";b=Math.min(b,minimax(d+1,true));board[i]=" ";
        }
        return b;
    }
}

/***********************
 * RENDER BOARD + WIN ANIMATION
 ***********************/
function renderBoard(winPattern=null) {
    boardDiv.innerHTML="";
    board.forEach((v,i)=>{
        const c=document.createElement("div");
        c.className="cell";
        if(v==="X")c.classList.add("x");
        if(v==="O")c.classList.add("o");
        if(winPattern && winPattern.includes(i)){
            c.style.boxShadow="0 0 20px #00ffe7";
            c.style.transform="scale(1.1)";
        }
        c.innerText=v;
        c.onclick=()=>handleMove(i);
        boardDiv.appendChild(c);
    });
}

/***********************
 * POPUP
 ***********************/
function showPopup(text, winnerSymbol) {
    let displayText = text;

    if (winnerSymbol === "X" || winnerSymbol === "O") {
        const name = getPlayerName(winnerSymbol);
        displayText = `🏆 ${name} (${winnerSymbol}) Wins!`;
    }

    if (winnerSymbol === "draw") {
        displayText = "🤝 Match Draw!";
    }

    popupText.innerText = displayText;
    popup.style.display = "flex";
    winSound.play();
    gameActive = false;

    if (winnerSymbol && scores[winnerSymbol] !== undefined) {
        scores[winnerSymbol]++;
        updateScoreboard();
    }
}



/***********************
 * MULTIPLAYER + CHAT
 ***********************/
function createRoom(){
    roomCode=Math.random().toString(36).substr(2,6).toUpperCase();
    playerSymbol="X";
    multiplayer=true;

    db.ref("rooms/"+roomCode).set({
        board:Array(9).fill(" "),
        turn:"X"
    });

    alert("Room Code: "+roomCode);
    listenRoom();
    listenChat();
}

function joinRoom(){
    const c=document.getElementById("roomCode").value.trim();
    if(!c)return alert("Enter room code");
    roomCode=c;
    playerSymbol="O";
    multiplayer=true;
    listenRoom();
    listenChat();
}
function getPlayerName(symbol) {
    if (symbol === "X") {
        return document.getElementById("playerX")?.value || "Player X";
    }
    if (symbol === "O") {
        return document.getElementById("playerO")?.value || "Player O";
    }
    return "";
}

function getPlayerName(symbol) {
    if (symbol === "X") {
        return document.getElementById("playerX")?.value || "Player X";
    }
    if (symbol === "O") {
        return document.getElementById("playerO")?.value || "Player O";
    }
    return "";
}


function listenRoom(){
    db.ref("rooms/" + roomCode).on("value", snap => {
        const d = snap.val();
        if (!d) return;

        board = d.board;
        currentPlayer = d.turn;

        const winX = getWinningPattern("X");
        const winO = getWinningPattern("O");

    if (winX) {
        const nameX = getPlayerName("X");
        renderBoard(winX);
        showPopup(`🏆 ${nameX} (X) Wins!`, "X");
        return;
    }

    if (winO) {
        const nameO = getPlayerName("O");
        renderBoard(winO);
        showPopup(`🏆 ${nameO} (O) Wins!`, "O");
        return;
    }

    if (isDraw()) {
        showPopup("🤝 Match Draw!", "draw");
        return;
    }


        gameActive = true;
        renderBoard();
        statusText.innerText = `Turn: ${currentPlayer}`;
    });
}

/***********************
 * CHAT
 ***********************/
function sendMessage(){
    if(!multiplayer||!chatInput.value)return;
    db.ref("chats/"+roomCode).push({
        sender:playerSymbol,
        text:chatInput.value,
        time:Date.now()
    });
    chatInput.value="";
    
}
chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        sendMessage();
    }
});


function listenChat(){
    db.ref("chats/"+roomCode).limitToLast(50).on("child_added",snap=>{
        const m=snap.val();
        const d=document.createElement("div");
        d.innerHTML=`<b>${m.sender}:</b> ${m.text}`;
        messagesDiv.appendChild(d);
        messagesDiv.scrollTop=messagesDiv.scrollHeight;
    });
}

/***********************
 * HANDLE MOVE
 ***********************/
function handleMove(i){
    if(board[i]!==" "||!gameActive)return;

    if(multiplayer){
        if(currentPlayer!==playerSymbol)return;
        clickSound.play();
        board[i]=playerSymbol;
        db.ref("rooms/"+roomCode).update({
            board:board,
            turn:playerSymbol==="X"?"O":"X"
        });
        return;
    }

    clickSound.play();
    board[i]=currentPlayer;
    renderBoard();

    if(checkWinner(currentPlayer))
        return showPopup(`${currentPlayer} Wins!`,currentPlayer);
    if(isDraw())
        return showPopup("Draw!","draw");

    if(modeSelect.value==="ai"){
        gameActive=false;
        setTimeout(()=>{
            let m=diffSelect.value==="easy"?aiEasy():
                  diffSelect.value==="medium"?aiMedium():aiHard();
            board[m]="O";
            renderBoard();
            gameActive=true;
            if(checkWinner("O"))showPopup("AI Wins!","O");
            else if(isDraw())showPopup("Draw!","draw");
        },400);
    } else {
        currentPlayer=currentPlayer==="X"?"O":"X";
        statusText.innerText=`Turn: ${currentPlayer}`;
    }
}

/***********************
 * RESTART
 ***********************/
function restartGame(){
    board=Array(9).fill(" ");
    gameActive=true;
    popup.style.display="none";
    statusText.innerText="Turn: X";

    if(multiplayer&&roomCode){
        db.ref("rooms/"+roomCode).set({
            board:board,
            turn:"X"
        });
    }
    renderBoard();
}

/***********************
 * INIT
 ***********************/
updateScoreboard();
renderBoard();
