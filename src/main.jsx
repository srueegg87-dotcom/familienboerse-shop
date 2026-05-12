import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import ItemDetail from './ItemDetail.jsx'
import CheckoutPage from './CheckoutPage.jsx'
import OrderConfirmPage from './OrderConfirmPage.jsx'
import { CartProvider } from './CartContext.jsx'
import CartDrawer from './CartDrawer.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <CartProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/artikel/:id" element={<ItemDetail />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/bestellung/:id" element={<OrderConfirmPage />} />
      </Routes>
      <CartDrawer />
    </CartProvider>
  </BrowserRouter>
)
