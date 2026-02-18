export class StockfishBridge {
  private worker: Worker
  private pending = new Map<string, { resolve: (value: string) => void }>()
  private messageId = 0

  constructor() {
    const wasmSupported =
      typeof WebAssembly === 'object' &&
      WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00))
    const workerPath = wasmSupported ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js'
    this.worker = new Worker(workerPath)
    this.worker.onmessage = this.handleMessage.bind(this)
  }

  private handleMessage(e: MessageEvent) {
    const line = e.data as string
    if (line.startsWith('bestmove ')) {
      const parts = line.split(' ')
      const move = parts[1]
      if (move && move !== '(none)') {
        const first = Array.from(this.pending.entries())[0]
        if (first) {
          const [key, entry] = first
          entry.resolve(move)
          this.pending.delete(key)
        }
      }
    }
  }

  async init(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = (e: MessageEvent) => {
        const line = e.data as string
        if (line === 'uciok') {
          this.worker.removeEventListener('message', checkReady)
          resolve()
        }
      }
      this.worker.addEventListener('message', checkReady)
      this.worker.postMessage('uci')
      setTimeout(() => {
        if (this.worker) {
          this.worker.removeEventListener('message', checkReady)
          resolve()
        }
      }, 2000)
    })
  }

  async getMove(fen: string, depth = 15): Promise<string> {
    const id = `move-${this.messageId++}`
    return new Promise((resolve) => {
      this.pending.set(id, { resolve })
      this.worker.postMessage(`position fen ${fen}`)
      this.worker.postMessage(`go depth ${depth}`)
    })
  }

  async setElo(elo: number): Promise<void> {
    this.worker.postMessage('setoption name UCI_LimitStrength value true')
    this.worker.postMessage(`setoption name UCI_Elo value ${elo}`)
  }

  async disableEloLimit(): Promise<void> {
    this.worker.postMessage('setoption name UCI_LimitStrength value false')
  }

  terminate(): void {
    this.worker.postMessage('quit')
    this.worker.terminate()
  }
}
