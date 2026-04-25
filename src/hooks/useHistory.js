import { useCallback, useEffect, useState } from 'react'
import { KEYS, loadJSON, saveJSON } from '../utils/storage'

const MAX = 50

export function useHistory() {
  const [items, setItems] = useState(() => loadJSON(KEYS.history, []))

  useEffect(() => {
    saveJSON(KEYS.history, items)
  }, [items])

  const push = useCallback((entry) => {
    setItems((prev) => {
      const next = [
        {
          id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
          ...entry,
        },
        ...prev,
      ]
      return next.slice(0, MAX)
    })
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, push, clear, setItems }
}
