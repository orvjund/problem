
const btnSubmit = document.querySelector('#btn-submit')
const inputFile = document.querySelector('#input-file')

btnSubmit.addEventListener('click', async e => {
  if (inputFile.files.length < 2) return

  try {
    e.preventDefault()
    btnSubmit.disabled = true
    const files = [...inputFile.files]

    for (const [i, file] of files.entries()) {
      const formData = new FormData()
      formData.append('file', file)

      await fetch('/upload', {
        method: 'POST',
        body: formData,
      })

      const toastContainer = document.createElement('div')
      toastContainer.innerHTML = `
        <div class="snackbar show ok">
          Upload ${i + 1}/${files.length} successfully
        </div>`

      const toast = toastContainer.querySelector('.snackbar')
      document.querySelector('body').appendChild(toast)
    }

    inputFile.value = null;
  } catch (error) {
    const toastContainer = document.createElement('div')
    toastContainer.innerHTML = `
      <div class="snackbar show error">
        Upload failed
      </div>`

    const toast = toastContainer.querySelector('.snackbar')
    document.querySelector('body').appendChild(toast)
  }

  btnSubmit.disabled = false
})