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
    try {
      if (!roomId || typeof roomId !== 'string') {
        throw new Error('Invalid room ID');
      }

      if (!rooms[roomId]) {
        rooms[roomId] = { players: [], board: Array(5).fill().map(() => Array(5).fill('')), currentPlayer: 'A' };
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
    } catch (error) {
      console.error('Error in joinRoom:', error);
      socket.emit('error', 'An error occurred while joining the room');
    }
  });

  // Handle player moves
  socket.on('makeMove', (roomId, row, col) => {
    try {
      if (!roomId || typeof roomId !== 'string' || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= 5 || col < 0 || col >= 5) {
        throw new Error('Invalid move parameters');
      }

      const room = rooms[roomId];
      if (room && room.players.includes(socket.id)) {
        const playerIndex = room.players.indexOf(socket.id);
        const playerSymbol = playerIndex === 0 ? 'A' : 'S';

        if (room.board[row][col] === '' && room.currentPlayer === playerSymbol) {
          room.board[row][col] = playerSymbol;
          room.currentPlayer = room.currentPlayer === 'A' ? 'S' : 'A';

          // Check for win or draw
          const winner = checkWin(room.board, 'A') ? 'A' : checkWin(room.board, 'S') ? 'S' : null;
          const isDraw = checkDraw(room.board);

          io.to(roomId).emit('moveMade', { board: room.board, currentPlayer: room.currentPlayer, winner, isDraw });

          if (winner || isDraw) {
            // Game over, clean up the room
            delete rooms[roomId];
          }
        } else {
          socket.emit('invalidMove');
        }
      }
    } catch (error) {
      console.error('Error in makeMove:', error);
      socket.emit('error', 'An error occurred while making the move');
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
        if (room.players.length === 0) {
          delete rooms[roomId]; // Clean up empty rooms
        }
      }
    }
  });
});

// Check for a win (unchanged)
function checkWin(board, player) {
  for (let i = 0; i < 5; i++) {
    if (board[i].every(cell => cell === player)) return true; // Rows
    if (board.every(row => row[i] === player)) return true; // Columns
  }
  if (board.every((row, index) => row[index] === player)) return true; // Diagonal 1
  if (board.every((row, index) => row[4 - index] === player)) return true; // Diagonal 2
  return false;
}

// Check for a draw (unchanged)
function checkDraw(board) {
  return board.every(row => row.every(cell => cell !== ''));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
