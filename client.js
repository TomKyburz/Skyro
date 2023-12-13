async function chat () {
  const code = prompt('Access code:')
  if (!code) window.location.reload()
  const res = await fetch(`/validate-token/${code}`)

  const main = window.document.body.querySelector('main')
  const form = window.document.body.querySelector('form')
  const input = window.document.body.querySelector('input')

  if (res.status === 200) {
    const sessionUrl = `${
      window.location.protocol === 'http:' ? 'ws' : 'wss'
    }://${window.location.hostname}${
      window.location.port ? `:${window.location.port}` : ''
    }/session`
    const client = new WebSocket(sessionUrl)
    client.onmessage = function onMessage (event) {
      const { type, name, data } = JSON.parse(event.data)
      const div = window.document.createElement('div')
      div.classList += 'receive';
      const pfp = window.document.createElement('img')
      const p = window.document.createElement('p')
      const user = window.document.createElement('p')
      const br = window.document.createElement('br')
      const brr = window.document.createElement('br')
      pfp.src = `/profiles/${name}.png`
      user.textContent = name
      user.id += name
      p.id += `l${name}`
      user.classList += 'tname';
      p.classList += 'text';
      p.textContent = `${data || type}`
      main.appendChild(div)
      div.appendChild(pfp)
      div.appendChild(user)
      div.appendChild(br)
      div.appendChild(brr)
      div.appendChild(p)
      main.scrollTop = main.scrollHeight;
    }
    form.onsubmit = e => {
      e.preventDefault()
      client.send(`${input.value}`)
      const div = window.document.createElement('div')
      div.classList += 'sent'
      const p = window.document.createElement('p')
      p.textContent = `${input.value}`
      p.classList += 'text';
      main.appendChild(div)
      div.appendChild(p)
      main.scrollTop = main.scrollHeight;

      input.value = ''
    }
  } else {
    window.location.reload()
  }
}

chat().catch(console.error)
