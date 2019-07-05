const path = require('path')
const http = require('http')
const fs = require('fs')

const express = require('express')
const Mustache = require('mustache')
const fileUpload = require('express-fileupload')
const archiver = require('archiver')
const socketIO = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketIO(server)

const { PORT = 8989 } = require('./config.json')
const ServerStatus = {
  isBackingUp: false,
}
const htmlPath = path.join(__dirname, 'html')
const badPath = path.join(__dirname, 'bads')
const tmpPath = path.join(__dirname, 'tmp')
const backupPath = path.join(__dirname, 'backup.zip')

fs.existsSync(badPath) || fs.mkdirSync(badPath)
fs.existsSync(tmpPath) || fs.mkdirSync(tmpPath)

let Htmls = {}
let Bads = {}

// Reload templates
app.use((_, __, next) => {
  Htmls = {
    INDEX: fs.readFileSync(path.join(htmlPath, 'index.html'), 'utf8'),
    VIDEO: fs.readFileSync(path.join(htmlPath, 'video.html'), 'utf8'),
    UPLOAD: fs.readFileSync(path.join(htmlPath, 'upload.html'), 'utf8'),
    BACKUP: fs.readFileSync(path.join(htmlPath, 'backup.html'), 'utf8'),
  }

  Bads = {
    VIDEOS: fs.readdirSync(badPath),
  }

  next()
})
const uploadOpts = {
  safeFileNames: true,
  useTempFiles: true,
  preserveExtension: 4,
  tempFileDir: tmpPath,
}
app.use('*', (req, res, next) => {
  if (ServerStatus.isBackingUp && req.method !== 'GET') {
    return res.redirect('/')
  }

  next()
})
app.use(fileUpload(uploadOpts))
app.get('/view/:videoName', (req, res) => {
  const { videoName } = req.params

  const html = Mustache.render(Htmls.VIDEO, { videoName })
  res.send(html)
})
app.get('/video/:videoName', (req, res) => {
  const { videoName } = req.params

  res.sendFile(path.join(__dirname, 'bads', videoName))
})
app.get('/upload.js', (_, res) => res.sendFile(path.join(htmlPath, 'upload.js')))
app.get('/upload', (_, res) => {
  const html = Mustache.render(Htmls.UPLOAD, {})
  res.send(html)
})
app.get('/back-up/:password?', async (req, res) => {
  const password = req.params.password || req.query.password
  if (password !== 'Snail!') {
    return res.send(Mustache.render(Htmls.BACKUP, {}))
  }

  res.send(Mustache.render(Htmls.BACKUP, { output: 'Starting...!\n', password }))

  io.on('connection', (socket) => {
    console.log('An user started backing up...!')
    ServerStatus.isBackingUp = true

    try {
      const backup = fs.createWriteStream(backupPath)
      const archive = archiver('zip', { zlib: { level: 0 } })

      backup.on('close', () => {
        socket.emit('done', archive.pointer())

        console.info('Done backing up')
        console.info(`${archive.pointer()} bytes`)
      })

      archive.on('entry', (entry) => {
        const sizeInMb = entry.stats.size / 1024 / 1024
        io.emit('file-added', `${entry.name} - ${sizeInMb.toFixed(2)} MB`)

        console.info(`Backed up: ${entry.name}`)
      })

      archive.on('error', (err) => {
        socket.emit('fail', err.message)
        console.error(err)
        throw err;
      })

      archive.pipe(backup)
      archive.directory(badPath, false)
      archive.finalize()
    } catch (error) {
      console.error(error)
      ServerStatus.isBackingUp = false
      if (fs.existsSync(path.join(tmpPath, 'backup.zip'))) {
        fs.unlinkSync(path.join(tmpPath, 'backup.zip'))
      }
    }
  })
})
app.get('/back-up-download/:password?', (req, res) => {
  const password = req.params.password || req.query.password
  if (password !== 'Snail!') {
    return res.send(Mustache.render(Htmls.BACKUP, {}))
  }

  if (fs.existsSync(backupPath)) {
    return res.sendFile(backupPath, err => {
      console.error(err)
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath)
      }
    })
  }

  return res.send(Mustache.render(Htmls.BACKUP, { password }))
})
app.post('/upload', (req, res) => {
  if (ServerStatus.isBackingUp) return res.redirect('/')

  if (req.files && req.files.file && req.files.file.size) {
    const { file } = req.files
    const filePath = path.join(__dirname, 'bads', file.name)

    file.mv(filePath, error => {
      if (error) {
        fs.unlink(file.tempFilePath, err => err && console.error(err))

        const errorHtml = Mustache.render(Htmls.UPLOAD, { error: true })
        return res.send(errorHtml)
      }

      const okHtml = Mustache.render(Htmls.UPLOAD, { ok: true })
      return res.send(okHtml)
    })
  } else {
    const errorHtml = Mustache.render(Htmls.UPLOAD, { error: true })
    return res.send(errorHtml)
  }
})
app.get('*', (_, res) => {
  const html = Mustache.render(Htmls.INDEX, {
    files: Bads.VIDEOS,
  })
  res.send(html)
})
server.listen(PORT, _ => {
  console.info(`Server is running at PORT - ${PORT}...!`)
})
