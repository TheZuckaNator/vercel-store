import { useState } from 'react'
import { TIER_CONFIG, getTokenName, getTokenImage } from '../utils/constants'
import './Inventory.css'

function Inventory({ tiers, balances, userAddress, onCreateListing, onUpdateListing, myListings, onCancelListing }) {
  const [modal, setModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState(1)
  const [days, setDays] = useState(7)
  
  // Edit form state
  const [editPrice, setEditPrice] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDays, setEditDays] = useState('')
  
  if (!userAddress) {
    return (
      <div className="inventory">
        <div className="empty-state">
          <div className="empty-icon">🎒</div>
          <p>Connect wallet to view inventory</p>
        </div>
      </div>
    )
  }
  
  const ownedTokens = []
  for (const tier of tiers) {
    for (let i = 0; i < tier.tokenIds.length; i++) {
      const tokenId = tier.tokenIds[i]
      const balance = balances[tokenId] || 0
      if (balance > 0) {
        ownedTokens.push({ tokenId, balance, tierName: tier.name })
      }
    }
  }
  
  const openModal = (token) => {
    setModal(token)
    setPrice('')
    setAmount(1)
    setDays(7)
  }
  
  const openEditModal = (listing) => {
    setEditModal(listing)
    setEditPrice(listing.price)
    setEditAmount(listing.amount.toString())
    // Calculate remaining days from deadline
    const remainingSeconds = listing.deadline - Math.floor(Date.now() / 1000)
    const remainingDays = Math.max(1, Math.ceil(remainingSeconds / 86400))
    setEditDays(remainingDays.toString())
  }
  
  const handleList = () => {
    if (!price || parseFloat(price) <= 0) return
    const deadline = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60)
    onCreateListing(modal.tokenId, amount, parseFloat(price), deadline)
    setModal(null)
  }
  
  const handleUpdate = () => {
    if (!editModal) return
    
    const updates = {}
    
    // Check what changed
    if (editPrice !== editModal.price) {
      updates.price = editPrice
      updates.priceWei = (parseFloat(editPrice) * 1e18).toString()
    }
    
    if (parseInt(editAmount) !== editModal.amount) {
      updates.amount = parseInt(editAmount)
    }
    
    // Extend deadline
    const newDeadline = Math.floor(Date.now() / 1000) + (parseInt(editDays) * 86400)
    if (newDeadline > editModal.deadline) {
      updates.deadline = newDeadline
    }
    
    if (Object.keys(updates).length > 0) {
      onUpdateListing(editModal.id, updates)
    }
    
    setEditModal(null)
  }
  
  const formatDeadline = (timestamp) => {
    const now = Math.floor(Date.now() / 1000)
    const remaining = timestamp - now
    
    if (remaining <= 0) return 'Expired'
    if (remaining < 3600) return `${Math.floor(remaining / 60)}m left`
    if (remaining < 86400) return `${Math.floor(remaining / 3600)}h left`
    return `${Math.floor(remaining / 86400)}d left`
  }
  
  return (
    <div className="inventory">
      <h1>My Inventory</h1>
      
      {ownedTokens.length === 0 && myListings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>No items yet</p>
        </div>
      ) : (
        <>
          {ownedTokens.length > 0 && (
            <section className="inv-section">
              <h2>Owned ({ownedTokens.length})</h2>
              <div className="inv-grid">
                {ownedTokens.map(token => (
                  <div key={token.tokenId} className="inv-card">
                    <div className="inv-image">
                      <img src={getTokenImage(token.tokenId)} alt="" />
                      <span className="tier-badge" style={{ background: TIER_CONFIG[token.tierName]?.color }}>{token.tierName}</span>
                      <span className="balance-badge">x{token.balance}</span>
                    </div>
                    <div className="inv-details">
                      <h3>{getTokenName(token.tokenId)}</h3>
                      <button className="list-btn" onClick={() => openModal(token)}>List for Sale</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {myListings.length > 0 && (
            <section className="inv-section">
              <h2>Your Listings ({myListings.length})</h2>
              <div className="listings-table">
                {myListings.map(listing => (
                  <div key={listing.id} className="table-row">
                    <img src={getTokenImage(listing.tokenId)} alt="" />
                    <span className="listing-name">{getTokenName(listing.tokenId)}</span>
                    <span className="listing-amount">x{listing.amount}</span>
                    <span className="listing-price">{listing.price} KARRAT</span>
                    <span className="listing-deadline">{formatDeadline(listing.deadline)}</span>
                    <div className="listing-actions">
                      <button className="edit-btn" onClick={() => openEditModal(listing)}>Edit</button>
                      <button className="cancel-btn" onClick={() => onCancelListing(listing)}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      
      {/* Create Listing Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create Listing</h2>
            
            <div className="modal-item">
              <img src={getTokenImage(modal.tokenId)} alt="" />
              <div>
                <h3>{getTokenName(modal.tokenId)}</h3>
                <p>You own: {modal.balance}</p>
              </div>
            </div>
            
            <div className="form-group">
              <label>Amount</label>
              <input type="number" min="1" max={modal.balance} value={amount} onChange={e => setAmount(parseInt(e.target.value) || 1)} />
            </div>
            
            <div className="form-group">
              <label>Price per item (KARRAT)</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            
            <div className="form-group">
              <label>Duration</label>
              <select value={days} onChange={e => setDays(parseInt(e.target.value))}>
                <option value={1}>1 Day</option>
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="confirm-btn" onClick={handleList} disabled={!price}>Sign & List</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Listing Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Listing</h2>
            
            <div className="modal-item">
              <img src={getTokenImage(editModal.tokenId)} alt="" />
              <div>
                <h3>{getTokenName(editModal.tokenId)}</h3>
                <p className="current-info">Current: {editModal.amount}x @ {editModal.price} KARRAT</p>
              </div>
            </div>
            
            <div className="form-group">
              <label>New Price (KARRAT)</label>
              <input 
                type="number" 
                step="0.01" 
                value={editPrice} 
                onChange={e => setEditPrice(e.target.value)} 
                placeholder={editModal.price}
              />
              <span className="form-hint">Leave unchanged to keep current price</span>
            </div>
            
            <div className="form-group">
              <label>New Amount</label>
              <input 
                type="number" 
                min="1" 
                max={editModal.amount}
                value={editAmount} 
                onChange={e => setEditAmount(e.target.value)} 
              />
              <span className="form-hint">Can only reduce amount (max: {editModal.amount})</span>
            </div>
            
            <div className="form-group">
              <label>Extend Duration</label>
              <select value={editDays} onChange={e => setEditDays(e.target.value)}>
                <option value="1">1 Day from now</option>
                <option value="7">7 Days from now</option>
                <option value="14">14 Days from now</option>
                <option value="30">30 Days from now</option>
              </select>
              <span className="form-hint">Current: {formatDeadline(editModal.deadline)}</span>
            </div>
            
            <div className="edit-summary">
              <h4>Changes:</h4>
              <ul>
                {editPrice !== editModal.price && <li>Price: {editModal.price} → {editPrice} KARRAT</li>}
                {parseInt(editAmount) !== editModal.amount && <li>Amount: {editModal.amount} → {editAmount}</li>}
                {parseInt(editDays) > 0 && <li>Deadline extended to {editDays} days from now</li>}
              </ul>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="confirm-btn" onClick={handleUpdate}>Update Listing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
