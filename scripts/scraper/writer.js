// scripts/scraper/writer.js
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../public/data')

function writeJson(filename, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const filepath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
  const kb = Math.round(fs.statSync(filepath).size / 1024)
  console.log(`[writer] Wrote ${filename} (${kb}KB)`)
}

module.exports = { writeJson }
