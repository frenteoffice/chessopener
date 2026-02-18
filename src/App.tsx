import { GameView } from './components/GameView'
import { OpeningSelector } from './components/OpeningSelector'
import { useGameStore } from './store/gameStore'

function App() {
  const view = useGameStore((s) => s.view)
  const setView = useGameStore((s) => s.setView)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">OpeningIQ</h1>
          <p className="text-sm text-slate-400">Chess Opening Trainer</p>
        </div>
        {view === 'game' && (
          <button
            onClick={() => setView('selector')}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Change Opening
          </button>
        )}
      </header>
      <main>
        {view === 'selector' ? <OpeningSelector /> : <GameView />}
      </main>
    </div>
  )
}

export default App
