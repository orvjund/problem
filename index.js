const path = require('path')
const fs = require('fs')

const express = require('express')
const Mustache = require('mustache')
const fileUpload = require('express-fileupload')

const app = express()

const { PORT = 8989 } = require('./config.json')

const htmlPath = path.join(__dirname, 'html')
const badPath = path.join(__dirname, 'bads')
let Htmls = {}
let Bads = {}

// Reload templates
app.use((_, __, next) => {
  Htmls = {
    INDEX: fs.readFileSync(path.join(htmlPath, 'index.html'), 'utf8'),
    VIDEO: fs.readFileSync(path.join(htmlPath, 'video.html'), 'utf8'),
    UPLOAD: fs.readFileSync(path.join(htmlPath, 'upload.html'), 'utf8'),
  }
  Bads = {
    VIDEOS: fs.readdirSync(badPath),
  }
  next()
})

const uploadOpts = {
  safeFileNames: true,
  useTempFiles : true,
  preserveExtension: 4,
  tempFileDir : path.join(__dirname, 'tmp'),
}
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
app.get('/upload', (_, res) => {
  const html = Mustache.render(Htmls.UPLOAD, {})
  res.send(html)
})
app.post('/upload', (req, res) => {
  if (req.files && req.files.file && req.files.file.size) {
    const { file } = req.files
    const filePath = path.join(__dirname, 'test', file.name)

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

app.listen(PORT, _ => {
  console.info(`Server is running at PORT - ${PORT}...!`)
})
