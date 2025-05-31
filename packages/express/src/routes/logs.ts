import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';

import logger from '../logger.js';
import process from 'process';

const router = express.Router();

// Rate limiting middleware for logs routes
const logsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many log requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all routes in this router
router.use(logsRateLimit);

// Get list of available log files
router.get('/', (_req: Request, res: Response) => {
  void (async () => {
  // [ ] add an auth mechanism. Below fcn is based on
  //     the CouchDB auth mechanism, forwarded from the web-app (not direct-access of server).
  //
  // const auth = await requestIsAdminAuthenticated(req);
  // if (!auth) {
  //   res.status(401).json({ error: 'Unauthorized' });
  //   return;
  // }

  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logsDir);

    // Create HTML content
    const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Log Files</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 20px;
                }
                h1 {
                  color: #333;
                }
                .log-list {
                  list-style: none;
                  padding: 0;
                }
                .log-list li {
                  margin: 10px 0;
                }
                .log-list a {
                  color: #0066cc;
                  text-decoration: none;
                  padding: 5px;
                }
                .log-list a:hover {
                  text-decoration: underline;
                }
              </style>
            </head>
            <body>
              <h1>Available Log Files</h1>
              <ul class="log-list">
                ${files
                  .map(
                    (file) => `
                  <li>
                    <a href="/logs/${file}">${file}</a>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </body>
          </html>
        `;

    res.type('html').send(html);
  } catch (error) {
    logger.error('Error reading logs directory:', error);
    res.status(500).json({ error: 'Failed to retrieve log files' });
  }
  })();
});

router.get('/:filename', (req: Request, res: Response) => {
  void (async () => {
  try {
    const filename = req.params.filename;
    // Sanitize filename to prevent directory traversal
    if (filename.includes('..') || !filename.match(/^[a-zA-Z0-9-_.]+$/)) {
      res.status(400).send('<h1>Error</h1><p>Invalid filename</p>');
      return;
    }

    const logPath = path.join(process.cwd(), 'logs', filename);
    const content = (await fs.readFile(logPath, 'utf-8')).toString();

    // Parse log lines
    const lines = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return line;
        }
      });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Log Viewer - ${filename}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .nav-links {
              margin-bottom: 20px;
            }
            .nav-links a {
              color: #0066cc;
              text-decoration: none;
              margin-right: 15px;
            }
            .nav-links a:hover {
              text-decoration: underline;
            }
            .filters {
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 4px;
            }
            .filters input, .filters select {
              margin: 5px;
              padding: 5px;
            }
            .log-entry {
              padding: 8px;
              border-bottom: 1px solid #eee;
              font-family: monospace;
              white-space: pre-wrap;
            }
            .log-entry:nth-child(odd) {
              background-color: #f9f9f9;
            }
            .error { color: #d32f2f; }
            .warn { color: #ff9800; }
            .info { color: #2196f3; }
            .debug { color: #4caf50; }
          </style>
          <script>
            function filterLogs() {
              const search = document.getElementById('search').value.toLowerCase();
              const level = document.getElementById('level').value;
              const entries = document.getElementsByClassName('log-entry');

              Array.from(entries).forEach(entry => {
                const text = entry.textContent.toLowerCase();
                const matchesSearch = !search || text.includes(search);
                const matchesLevel = !level || text.includes('"level":"' + level + '"');
                entry.style.display = (matchesSearch && matchesLevel) ? 'block' : 'none';
              });
            }
          </script>
        </head>
        <body>
          <div class="header">
            <h1>Log Viewer - ${filename}</h1>
            <div class="nav-links">
              <a href="/logs">← Back to Log List</a>
              <a href="/logs/${filename}/raw">View Raw Log →</a>
            </div>
          </div>

          <div class="filters">
            <input
              type="text"
              id="search"
              placeholder="Search logs..."
              oninput="filterLogs()"
            >
            <select id="level" onchange="filterLogs()">
              <option value="">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div class="log-content">
            ${lines
              .map((line) => {
                let levelClass = '';
                if (typeof line === 'object' && line.level) {
                  levelClass = line.level.toLowerCase();
                }
                return `<div class="log-entry ${levelClass}">
                ${
                  typeof line === 'object'
                    ? JSON.stringify(line, null, 2)
                    : line
                }
              </div>`;
              })
              .join('')}
          </div>
        </body>
      </html>
    `;

    res.type('html').send(html);
  } catch (error) {
    logger.error(`Error reading log file ${req.params.filename}:`, error);
    res.status(500).send('<h1>Error</h1><p>Failed to retrieve log file</p>');
  }
  })();
});

// Get contents of specific log file
router.get('/:filename/raw', (req: Request, res: Response) => {
  void (async () => {
  // const auth = await requestIsAdminAuthenticated(req);
  // if (!auth) {
  //   res.status(401).json({ error: 'Unauthorized' });
  //   return;
  // }

  try {
    const filename = req.params.filename;
    // Sanitize filename to prevent directory traversal
    if (filename.includes('..') || !filename.match(/^[a-zA-Z0-9-_.]+$/)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const logPath = path.join(process.cwd(), 'logs', filename);
    const content = (await fs.readFile(logPath, 'utf-8')).toString();

    // If the client requests JSON format
    if (req.headers.accept === 'application/json') {
      const lines = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return line;
          }
        });
      res.json(lines);
    } else {
      // Return plain text by default
      res.type('text/plain').send(content);
    }
  } catch (error) {
    logger.error(`Error reading log file ${req.params.filename}:`, error);
    res.status(500).json({ error: 'Failed to retrieve log file' });
  }
  })();
});

export default router;
