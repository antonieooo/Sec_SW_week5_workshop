const express = require("express");
const app = express();

app.use(express.json());

const API_KEY = "secret123";

// In-memory book store
const books = {
  "1": { id: "1", title: "1984", author: "George Orwell" },
  "2": { id: "2", title: "Dune", author: "Frank Herbert" }
};

// Global API key middleware, with per-path override for /status
function apiKeyMiddleware(req, res, next) {
  // Public endpoint override (matches security: [] on /status)
  if (req.path === "/status") {
    return next();
  }

  const key = req.header("X-API-Key");

  if (!key) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing X-API-Key header"
    });
  }

  if (key !== API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key"
    });
  }

  next();
}

app.use(apiKeyMiddleware);

// GET /status  (public)
app.get("/status", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// GET /books  (secured, returns array of Book)
app.get("/books", (req, res) => {
  res.status(200).json(Object.values(books));
});

// GET /books/{id}  (secured, returns single Book or 404)
app.get("/books/:id", (req, res) => {
  const book = books[req.params.id];

  if (!book) {
    return res.status(404).json({
      error: "NotFound",
      message: "Book not found"
    });
  }

  res.status(200).json(book);
});

// Fallback for unknown routes (helps match OpenAPI 404 behaviour)
app.use((req, res) => {
  res.status(404).json({
    error: "NotFound",
    message: "Route not found"
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`HelloBooks API running on http://localhost:${PORT}`);
});
