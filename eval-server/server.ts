import express from 'express';
import path from 'path';

const app = express();
const PORT = 3001;

// Serve static fixtures
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`[EvalServer] Running on http://localhost:${PORT}`);
});
