let roomCode=null, playerSymbol=null, multiplayer=false;
let myName="";
let playerNames={X:"",O:""};
let board=Array(9).fill(" ");
let currentPlayer="X";
let gameActive=true;

let roomRef=null, namesRef=null, chatRef=null;

const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

const boardDiv=document.getElementById("board");
const statusText=document.getElementById("status");
const scoreDiv=document.getElementById("scoreboard");
const messagesDiv=document.getElementById("messages");
const chatInput=document.getElementById("chatInput");
const roomStatus=document.getElementById("roomStatus");
const popup=document.getElementById("popup");
const popupText=document.getElementById("popupText");
const winSound=document.getElementById("winSound");

function updateScoreboard(){
  scoreDiv.innerText=`${playerNames.X||"X"} | ${playerNames.O||"O"}`;
}

function renderBoard(){
  boardDiv.innerHTML="";
  board.forEach((v,i)=>{
    const c=document.createElement("div");
    c.className="cell "+(v==="X"?"x":v==="O"?"o":"");
    c.innerText=v;
    c.onclick=()=>handleMove(i);
    boardDiv.appendChild(c);
  });
}

function showPopup(winner){
  popupText.innerText=winner==="draw"?"🤝 Draw":`🏆 ${playerNames[winner]} Wins!`;
  popup.style.display="flex";
  winSound.play();
  gameActive=false;
}

function saveMyName(){
  myName=document.getElementById("myName").value.trim();
  if(!myName)return;
  document.getElementById("nameModal").style.display="none";
  db.ref(`rooms/${roomCode}/names/${playerSymbol}`).set(myName);
}

function createRoom(){
  roomCode = Math.random().toString(36).substr(2,6).toUpperCase();
  playerSymbol = "X";
  multiplayer = true;

  roomRef  = db.ref("rooms/" + roomCode);
  namesRef = db.ref(`rooms/${roomCode}/names`);
  chatRef  = db.ref("chats/" + roomCode);

  // ✅ IMPORTANT: gameOver added
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

function restartGame(){
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


function joinRoom(){
  roomCode=document.getElementById("roomCode").value.trim();
  if(!roomCode)return;
  playerSymbol="O"; multiplayer=true;
  roomRef=db.ref("rooms/"+roomCode);
  namesRef=db.ref(`rooms/${roomCode}/names`);
  chatRef=db.ref("chats/"+roomCode);

  roomStatus.style.display="block";
  roomStatus.innerText=`🟢 In Room ${roomCode} (You are O)`;
  document.getElementById("exitRoomBtn").style.display="inline-block";
  document.getElementById("nameModal").style.display="flex";

  listenRoom(); listenNames(); listenChat();
}

function exitRoom(){
  if(roomRef)roomRef.off();
  if(namesRef)namesRef.off();
  if(chatRef)chatRef.off();

  db.ref(`rooms/${roomCode}/names/${playerSymbol}`).remove();

  roomCode=null; playerSymbol=null; multiplayer=false;
  roomStatus.style.display="none";
  document.getElementById("exitRoomBtn").style.display="none";
  messagesDiv.innerHTML="";
  popup.style.display="none";

  board=Array(9).fill(" ");
  renderBoard();
}

function listenNames(){
  namesRef.on("value",s=>{
    playerNames=s.val()||{};
    document.getElementById("playerX").value=playerNames.X||"Player X";
    document.getElementById("playerO").value=playerNames.O||"Player O";
  });
}

function listenRoom(){
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





function checkWinner(player) {
  return wins.some(p => p.every(i => board[i] === player));
}

function getWinningPattern(player) {
  return wins.find(p => p.every(i => board[i] === player));
}

function isDraw() {
  return !board.includes(" ");
}


function handleMove(i){
  if(board[i]!==" "||!gameActive)return;
  if(multiplayer && currentPlayer!==playerSymbol)return;
  board[i]=playerSymbol||currentPlayer;
  roomRef.update({board,turn:currentPlayer==="X"?"O":"X"});
}

function sendMessage(){
  if(!chatInput.value)return;
  chatRef.push({sender:myName,text:chatInput.value});
  chatInput.value="";
}

function listenChat(){
  chatRef.limitToLast(50).on("child_added",s=>{
    const m=s.val();
    messagesDiv.innerHTML+=`<div><b>${m.sender}:</b> ${m.text}</div>`;
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
  });
}

renderBoard();
