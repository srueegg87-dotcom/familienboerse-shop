import { useCart } from './CartContext'
import { useNavigate } from 'react-router-dom'

export default function CartDrawer() {
  const { items, remove, open, setOpen, subtotal, count } = useCart()
  const navigate = useNavigate()
  const goCheckout = () => { setOpen(false); navigate('/checkout') }

  return (
    <>
      {open && <div className="cart-overlay" onClick={() => setOpen(false)} />}
      <aside className={`cart-drawer ${open ? 'open' : ''}`}>
        <div className="cart-head">
          <h3>Warenkorb {count > 0 && <span className="cart-count">({count})</span>}</h3>
          <button className="cart-close" onClick={() => setOpen(false)} aria-label="Schliessen">×</button>
        </div>

        {count === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">🛍️</div>
            <p>Dein Warenkorb ist noch leer.</p>
            <button className="btn-primary" onClick={() => setOpen(false)}>Weiter stöbern</button>
          </div>
        ) : (
          <>
            <div className="cart-list">
              {items.map(item => (
                <div key={item.id} className="cart-item">
                  {item.photo ? <img src={item.photo} alt="" className="cart-item-img" /> : <div className="cart-item-img cart-item-img-placeholder">·</div>}
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-meta">{item.category}{item.size ? ` · ${item.size}` : ''}</div>
                    <div className="cart-item-price">CHF {Number(item.price).toFixed(2)}</div>
                  </div>
                  <button className="cart-item-remove" onClick={() => remove(item.id)} aria-label="Entfernen">×</button>
                </div>
              ))}
            </div>
            <div className="cart-foot">
              <div className="cart-subtotal">
                <span>Zwischensumme</span>
                <strong>CHF {subtotal.toFixed(2)}</strong>
              </div>
              <p className="cart-hint">Versandkosten und ggf. Rabatte im nächsten Schritt.</p>
              <button className="btn-checkout" onClick={goCheckout}>
                Zur Kasse →
              </button>
              <button className="btn-link" onClick={() => setOpen(false)}>
                Weiter stöbern
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
