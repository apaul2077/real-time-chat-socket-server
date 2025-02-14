require('dotenv').config(); // Loads variables from .env

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const JWT_SECRET = process.env.JWT_SECRET;

// In-memory mapping: username -> socket.id
const userSockets = {};

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token required"));
  }
  try {
    // Verify token using the JWT secret from the env file
    const decoded = jwt.verify(token, JWT_SECRET);
    // Expect the JWT payload to include the username
    socket.username = decoded.username || socket.handshake.auth.username;
    if (!socket.username) {
      return next(new Error("Authentication error: Username missing"));
    }
    next();
  } catch (error) {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`User ${socket.username} connected`);
  // Store the mapping using username
  userSockets[socket.username] = socket.id;

  // Private message event using usernames
  socket.on("private-message", ({ sender, recipient, message }) => {
    console.log(`Message from ${sender} to ${recipient}: ${message}`);
    const recipientSocketId = userSockets[recipient];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private-message", { sender, message });
    } else {
      console.log(`User ${recipient} is not online`);
    }
  });

  // Message the server event.
  socket.on("message-server", ({ message }) => {
    console.log(`Received message to server from ${socket.username}: ${message}`);
    socket.emit("server-reply", { message: `Server received: ${message}` });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.username} disconnected`);
    delete userSockets[socket.username];
  });
});

server.listen(8080, () => {
  console.log("Socket.IO server running on http://localhost:8080");
});
