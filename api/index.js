require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.use('/api/auth/google', require('./routes/google'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/research', require('./routes/research'));
app.use('/api/users', require('./routes/users'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/authors', require('./routes/authors'));
app.use('/api/backups', require('./routes/backups'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;