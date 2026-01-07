import { useState } from 'react'
import { TOKEN_METADATA } from '../utils/constants'
import './StudioChainPage.css'

function StudioChainPage({ 
  tiers, 
  listings,
  balances,
  onBuyPrimary, 
  onBuySecondary,
  onCreateListing,
  onUpdateListing,
  onCancelListing,
  userAddress 
}) {
  const [subTab, setSubTab] = useState('primary')
  const [quantities, setQuantities] = useState({})
  const [listingForm, setListingForm] = useState({ tokenId: '', amount: '', price: '', days: '7' })
  const [editModal, setEditModal] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDays, setEditDays] = useState('')

  const handleQuantityChange = (tokenId, value) => {
    setQuantities(prev => ({ ...prev, [tokenId]: Math.max(0, parseInt(value) || 0) }))
  }

  const handleBuyPrimary = (tierName, tokenId, price) => {
    const qty = quantities[tokenId] || 0
    if (qty <= 0) return
    onBuyPrimary(tierName, [tokenId], [qty], price)
  }

  const handleCreateListing = (e) => {
    e.preventDefault()
    const deadline = Math.floor(Date.now() / 1000) + (parseInt(listingForm.days) * 86400)
    onCreateListing(
      parseInt(listingForm.tokenId),
      parseInt(listingForm.amount),
      listingForm.price,
      deadline
    )
    setListingForm({ tokenId: '', amount: '', price: '', days: '7' })
  }

  const openEditModal = (listing) => {
    setEditModal(listing)
    setEditPrice(listing.price)
    setEditAmount(listing.amount.toString())
    const remainingSeconds = listing.deadline - Math.floor(Date.now() / 1000)
    const remainingDays = Math.max(1, Math.ceil(remainingSeconds / 86400))
    setEditDays(remainingDays.toString())
  }

  const handleUpdate = () => {
    if (!editModal || !onUpdateListing) return
    
    const updates = {}
    
    if (editPrice !== editModal.price) {
      updates.price = editPrice
      updates.priceWei = (parseFloat(editPrice) * 1e18).toString()
    }
    
    if (parseInt(editAmount) !== editModal.amount) {
      updates.amount = parseInt(editAmount)
    }
    
    const newDeadline = Math.floor(Date.now() / 1000) + (parseInt(editDays) * 86400)
    if (newDeadline > editModal.deadline) {
      updates.deadline = newDeadline
    }
    
    if (Object.keys(updates).length > 0) {
      onUpdateListing(editModal.id, updates)
    }
    
    setEditModal(null)
  }

  const formatETH = (wei) => {
    const eth = parseFloat(wei) / 1e18
    return eth.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }

  const formatDeadline = (timestamp) => {
    const now = Math.floor(Date.now() / 1000)
    const remaining = timestamp - now
    
    if (remaining <= 0) return 'Expired'
    if (remaining < 3600) return `${Math.floor(remaining / 60)}m left`
    if (remaining < 86400) return `${Math.floor(remaining / 3600)}h left`
    return `${Math.floor(remaining / 86400)}d left`
  }

  const myListings = listings.filter(l => l.seller?.toLowerCase() === userAddress?.toLowerCase())

  return (
    <div className="studiochain-page">
      <h2>🎮 StudioChain</h2>
      <p className="subtitle">Native ETH payments on StudioChain network</p>

      <div className="sub-tabs">
        <button 
          className={subTab === 'primary' ? 'active' : ''} 
          onClick={() => setSubTab('primary')}
        >
          Primary Sale
        </button>
        <button 
          className={subTab === 'secondary' ? 'active' : ''} 
          onClick={() => setSubTab('secondary')}
        >
          Secondary Market
        </button>
      </div>

      {subTab === 'primary' && (
        <div className="primary-section">
          {tiers.length === 0 ? (
            <p className="no-items">Loading items... Make sure contracts are deployed.</p>
          ) : (
            tiers.map(tier => (
              <div key={tier.name} className="tier-section">
                <h3>{tier.name}</h3>
                <div className="items-grid">
                  {tier.tokenIds.map((tokenId, idx) => {
                    const meta = TOKEN_METADATA[tokenId] || { name: `Token #${tokenId}`, description: '', image: '' }
                    const remaining = tier.maxSupplies[idx] - tier.currentSupplies[idx]
                    const price = tier.prices[idx]
                    
                    return (
                      <div key={tokenId} className="item-card">
                        {meta.image && <img src={meta.image} alt={meta.name} className="item-image" />}
                        <div className="item-info">
                          <h4>{meta.name}</h4>
                          <p className="item-desc">{meta.description}</p>
                          <p className="item-price">{formatETH(price)} ETH</p>
                          <p className="item-remaining">{remaining} / {tier.maxSupplies[idx]} left</p>
                        </div>
                        {userAddress ? (
                          <div className="item-actions">
                            <input
                              type="number"
                              min="0"
                              max={tier.maxAmountsPerUser[idx]}
                              value={quantities[tokenId] || ''}
                              onChange={(e) => handleQuantityChange(tokenId, e.target.value)}
                              placeholder="Qty"
                            />
                            <button 
                              onClick={() => handleBuyPrimary(tier.name, tokenId, price)}
                              disabled={!quantities[tokenId] || remaining <= 0}
                            >
                              Buy
                            </button>
                          </div>
                        ) : (
                          <p className="connect-prompt">Connect wallet</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'secondary' && (
        <div className="secondary-section">
          <div className="marketplace-listings">
            <h3>Listed for Sale</h3>
            {listings.length === 0 ? (
              <p className="no-items">No listings yet</p>
            ) : (
              <div className="listings-grid">
                {listings.map(listing => {
                  const meta = TOKEN_METADATA[listing.tokenId] || { name: `Token #${listing.tokenId}` }
                  const isOwn = listing.seller?.toLowerCase() === userAddress?.toLowerCase()
                  
                  return (
                    <div key={listing.id} className="listing-card">
                      <h4>{meta.name}</h4>
                      <p>Amount: {listing.amount}</p>
                      <p>Price: {listing.price} ETH each</p>
                      <p className="deadline">{formatDeadline(listing.deadline)}</p>
                      <p className="seller">Seller: {listing.seller?.slice(0, 6)}...{listing.seller?.slice(-4)}</p>
                      {userAddress && (
                        isOwn ? (
                          <div className="listing-actions">
                            <button className="edit-btn" onClick={() => openEditModal(listing)}>Edit</button>
                            <button className="cancel-btn" onClick={() => onCancelListing(listing)}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => onBuySecondary(listing)}>Buy</button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {userAddress && (
            <div className="create-listing">
              <h3>Create Listing</h3>
              <p className="your-nfts">Your NFTs:</p>
              <div className="balance-list">
                {Object.entries(balances).map(([tokenId, bal]) => {
                  if (bal <= 0) return null
                  const meta = TOKEN_METADATA[tokenId] || { name: `Token #${tokenId}` }
                  return (
                    <span key={tokenId} className="balance-item">
                      {meta.name}: {bal}
                    </span>
                  )
                })}
              </div>
              <form onSubmit={handleCreateListing}>
                <input
                  type="number"
                  placeholder="Token ID"
                  value={listingForm.tokenId}
                  onChange={(e) => setListingForm(prev => ({ ...prev, tokenId: e.target.value }))}
                  required
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={listingForm.amount}
                  onChange={(e) => setListingForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Price (ETH)"
                  value={listingForm.price}
                  onChange={(e) => setListingForm(prev => ({ ...prev, price: e.target.value }))}
                  required
                />
                <select
                  value={listingForm.days}
                  onChange={(e) => setListingForm(prev => ({ ...prev, days: e.target.value }))}
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
                <button type="submit">List for Sale</button>
              </form>

              {myListings.length > 0 && (
                <div className="my-listings">
                  <h4>Your Listings</h4>
                  {myListings.map(listing => {
                    const meta = TOKEN_METADATA[listing.tokenId] || { name: `Token #${listing.tokenId}` }
                    return (
                      <div key={listing.id} className="my-listing-item">
                        <span>{meta.name} x{listing.amount} @ {listing.price} ETH</span>
                        <span className="deadline-small">{formatDeadline(listing.deadline)}</span>
                        <div className="my-listing-actions">
                          <button className="edit-btn" onClick={() => openEditModal(listing)}>Edit</button>
                          <button className="cancel-btn" onClick={() => onCancelListing(listing)}>Cancel</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Listing</h2>
            
            <div className="modal-item">
              <div>
                <h3>{TOKEN_METADATA[editModal.tokenId]?.name || `Token #${editModal.tokenId}`}</h3>
                <p className="current-info">Current: {editModal.amount}x @ {editModal.price} ETH</p>
              </div>
            </div>
            
            <div className="form-group">
              <label>New Price (ETH)</label>
              <input 
                type="number" 
                step="0.001" 
                value={editPrice} 
                onChange={e => setEditPrice(e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label>New Amount (max: {editModal.amount})</label>
              <input 
                type="number" 
                min="1" 
                max={editModal.amount}
                value={editAmount} 
                onChange={e => setEditAmount(e.target.value)} 
              />
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
                {editPrice !== editModal.price && <li>Price: {editModal.price} → {editPrice} ETH</li>}
                {parseInt(editAmount) !== editModal.amount && <li>Amount: {editModal.amount} → {editAmount}</li>}
                {parseInt(editDays) > 0 && <li>Deadline extended to {editDays} days from now</li>}
              </ul>
            </div>
            
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={handleUpdate}>Update Listing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudioChainPage
