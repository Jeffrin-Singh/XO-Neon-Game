from flask import Flask, render_template, request, jsonify
import math
import random

app = Flask(__name__)

WIN_COMBOS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
]

def check_winner(board, player):
    return any(all(board[i] == player for i in combo) for combo in WIN_COMBOS)

def is_draw(board):
    return " " not in board

def minimax(board, is_max):
    if check_winner(board, "O"): return 1
    if check_winner(board, "X"): return -1
    if is_draw(board): return 0

    if is_max:
        best = -math.inf
        for i in range(9):
            if board[i] == " ":
                board[i] = "O"
                best = max(best, minimax(board, False))
                board[i] = " "
        return best
    else:
        best = math.inf
        for i in range(9):
            if board[i] == " ":
                board[i] = "X"
                best = min(best, minimax(board, True))
                board[i] = " "
        return best

def bot_move(board):
    best_score = -math.inf
    move = -1
    for i in range(9):
        if board[i] == " ":
            board[i] = "O"
            score = minimax(board, False)
            board[i] = " "
            if score > best_score:
                best_score = score
                move = i
    return move

def medium_move(board):
    # 1. Win if possible
    for i in range(9):
        if board[i] == " ":
            board[i] = "O"
            if check_winner(board, "O"):
                board[i] = " "
                return i
            board[i] = " "
    # 2. Block X if possible
    for i in range(9):
        if board[i] == " ":
            board[i] = "X"
            if check_winner(board, "X"):
                board[i] = " "
                return i
            board[i] = " "
    # 3. Random
    empty = [i for i, v in enumerate(board) if v == " "]
    return random.choice(empty) if empty else -1

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/move", methods=["POST"])
def move():
    data = request.json
    board = data["board"]
    difficulty = data.get("difficulty", "hard")

    empty = [i for i, v in enumerate(board) if v == " "]
    if not empty:
        return jsonify(board=board)

    if difficulty == "easy":
        board[random.choice(empty)] = "O"
    elif difficulty == "medium":
        m = medium_move(board)
        if m != -1: board[m] = "O"
    else:
        m = bot_move(board)
        if m != -1: board[m] = "O"
    
    return jsonify(board=board)

if __name__ == "__main__":
    app.run(debug=True)