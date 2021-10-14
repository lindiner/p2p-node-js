const crypto = require('crypto')
const Swarm = require('discovery-swarm')
const defaults = require('dat-swarm-defaults')
const getPort = require('get-port')
const readline = require('readline')

/**
 * Aqui vamos salvar nossas conexões de ponto TCP 
 * usando o id do par como chave: {peer_id: TCP_Connection}
 */
const peers = {}
// Contador para conexões, usado para identificar conexões
let connSeq = 0

// Um hash aleatório para identificar seu par
const myId = crypto.randomBytes(32)
console.log('Your identity: ' + myId.toString('hex'))

// referência à interface redline
let rl
/**
 * Função para chamar console.log com segurança com interface readline ativa
 */
function log () {
  if (rl) {
    rl.clearLine()    
    rl.close()
    rl = undefined
  }
  for (let i = 0, len = arguments.length; i < len; i++) {
    console.log(arguments[i])
  }
  askUser()
}

/*
* Função para obter a entrada de texto do usuário e enviá-lo para outros
*/
const askUser = async () => {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('Send message: ', message => {
    // Broadcast to peers
    for (let id in peers) {
      peers[id].conn.write(message)
    }
    rl.close()
    rl = undefined
    askUser()
  });
}

/** 
 * Servidor DNS e DHT padrão
 * Estes servidores são usados ​​para descoberta de pares e estabelecimento de conexão
 */
const config = defaults({
  // peer-id
  id: myId,
})

/**
 * a biblioteca discovery-swarm estabelece uma conexão TCP p2p e usa
 * Biblioteca discovery-channel para descoberta de pares
 */
const sw = Swarm(config)


;(async () => {

  //  Escolha uma porta aleatória não utilizada para ouvir conexões de pares TCP
  const port = await getPort()

  sw.listen(port)
  console.log('Listening to port: ' + port)

  /**
   * O canal ao qual estamos nos conectando.
   */
  sw.join('our-fun-channel')

  sw.on('connection', (conn, info) => {
    // Connection id
    const seq = connSeq

    const peerId = info.id.toString('hex')
    log(`Connected #${seq} to peer: ${peerId}`)

    // Manter a conexão TCP ativa 
    if (info.initiator) {
      try {
        conn.setKeepAlive(true, 600)
      } catch (exception) {
        log('exception', exception)
      }
    }

    conn.on('data', data => {
      //Mensagens de entrada
      log(
        'Received Message from peer ' + peerId,
        '----> ' + data.toString()
      )
    })

    conn.on('close', () => {
      // Desconexão de pares
      log(`Connection ${seq} closed, peer id: ${peerId}`)
      //Se a conexão de fechamento for a última conexão com o par, remove o par
      if (peers[peerId].seq === seq) {
        delete peers[peerId]
      }
    })

    // Salve a conexão
    if (!peers[peerId]) {
      peers[peerId] = {}
    }
    peers[peerId].conn = conn
    peers[peerId].seq = seq
    connSeq++

  })

  // Read user message from command line
  askUser()  

})()