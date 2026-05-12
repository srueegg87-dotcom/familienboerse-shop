import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext()
const STORAGE_KEY = 'fb-shop-cart-v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch { return [] }
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // Unikate Second-Hand-Items: jedes Item maximal 1× im Cart.
  const add = (item) => {
    setItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev
      return [...prev, item]
    })
    setOpen(true)
  }
  const remove = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const clear = () => setItems([])
  const has = (id) => items.some(i => i.id === id)

  const count = items.length
  const subtotal = items.reduce((s, i) => s + Number(i.price || 0), 0)

  return (
    <CartContext.Provider value={{ items, add, remove, clear, has, count, subtotal, open, setOpen }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
