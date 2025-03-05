const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {}; // Store game rooms

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Create or join a room
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], board: Array(5).fill().map(() => Array(5).fill(''), currentPlayer: 'A' };
    }

    if (rooms[roomId].players.length < 2) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);

      // Notify players
      io.to(roomId).emit('roomJoined', rooms[roomId]);

      if (rooms[roomId].players.length === 2) {
        io.to(roomId).emit('gameStart', rooms[roomId]);
      }
    } else {
      socket.emit('roomFull');
    }
  });

  // Handle player moves
  socket.on('makeMove', (roomId, row, col) => {
    const room = rooms[roomId];
    if (room && room.players.includes(socket.id)) { // Fixed syntax error here
      if (room.board[row][col] === '' && room.currentPlayer === (room.players[0] === socket.id ? 'A' : 'S')) {
        room.board[row][col] = room.currentPlayer;
        room.currentPlayer = room.currentPlayer === 'A' ? 'S' : 'A';

        // Check for win or draw
        const winner = checkWin(room.board, 'A') ? 'A' : checkWin(room.board, 'S') ? 'S' : null;
        const isDraw = checkDraw(room.board);

        io.to(roomId).emit('moveMade', { board: room.board, currentPlayer: room.currentPlayer, winner, isDraw });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter((player) => player !== socket.id);
        io.to(roomId).emit('playerLeft');
      }
    }
  });
});

// Check for a win
function checkWin(board, player) {
  for (let i = 0; i < 5; i++) {
    if (board[i].every(cell => cell === player)) return true; // Rows
    if (board.every(row => row[i] === player)) return true; // Columns
  }
  if (board.every((row, index) => row[index] === player)) return true; // Diagonal 1
  if (board.every((row, index) => row[4 - index] === player)) return true; // Diagonal 2
  return false;
}

// Check for a draw
function checkDraw(board) {
  return board.every(row => row.every(cell => cell !== ''));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
