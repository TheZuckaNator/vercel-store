import { useState, useEffect } from 'react'
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

  // Check network on page load - prompt to switch to StudioChain
  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum && userAddress) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        if (chainId !== '0x268') { // 616 in hex
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x268' }]
            })
          } catch (switchError) {
            // Chain not added, add it
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x268',
                    chainName: 'StudioChain Testnet',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: ['https://studio-chain.rpc.caldera.xyz/http'],
                    blockExplorerUrls: ['https://studio-chain.explorer.caldera.xyz']
                  }]
                })
              } catch (addError) {
                console.error('Failed to add StudioChain:', addError)
              }
            } else {
              console.log('Please switch to StudioChain network')
            }
          }
        }
      }
    }
    checkNetwork()
  }, [userAddress])

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
  const otherListings = listings.filter(l => l.seller?.toLowerCase() !== userAddress?.toLowerCase())

  // Get all token IDs user owns
  const ownedTokens = Object.entries(balances).filter(([_, bal]) => bal > 0)

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
          Marketplace
        </button>
        <button 
          className={subTab === 'inventory' ? 'active' : ''} 
          onClick={() => setSubTab('inventory')}
        >
          My Inventory
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
            {otherListings.length === 0 ? (
              <p className="no-items">No listings from other users</p>
            ) : (
              <div className="listings-grid">
                {otherListings.map(listing => {
                  const meta = TOKEN_METADATA[listing.tokenId] || { name: `Token #${listing.tokenId}` }
                  
                  return (
                    <div key={listing.id} className="listing-card">
                      <h4>{meta.name}</h4>
                      <p>Amount: {listing.amount}</p>
                      <p>Price: {listing.price} ETH each</p>
                      <p className="deadline">{formatDeadline(listing.deadline)}</p>
                      <p className="seller">Seller: {listing.seller?.slice(0, 6)}...{listing.seller?.slice(-4)}</p>
                      {userAddress && (
                        <button onClick={() => onBuySecondary(listing)}>Buy</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'inventory' && (
        <div className="inventory-section">
          {!userAddress ? (
            <p className="no-items">Connect wallet to view inventory</p>
          ) : (
            <>
              {/* User's NFTs */}
              <div className="my-nfts">
                <h3>My NFTs</h3>
                {ownedTokens.length === 0 ? (
                  <p className="no-items">You don't own any NFTs yet</p>
                ) : (
                  <div className="items-grid">
                    {ownedTokens.map(([tokenId, balance]) => {
                      const meta = TOKEN_METADATA[tokenId] || { name: `Token #${tokenId}`, description: '', image: '' }
                      return (
                        <div key={tokenId} className="item-card">
                          {meta.image && <img src={meta.image} alt={meta.name} className="item-image" />}
                          <div className="item-info">
                            <h4>{meta.name}</h4>
                            <p className="item-desc">{meta.description}</p>
                            <p className="item-balance">Owned: {balance}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Create Listing Form */}
              <div className="create-listing">
                <h3>List for Sale</h3>
                <form onSubmit={handleCreateListing}>
                  <div className="form-row">
                    <select
                      value={listingForm.tokenId}
                      onChange={(e) => setListingForm(prev => ({ ...prev, tokenId: e.target.value }))}
                      required
                    >
                      <option value="">Select NFT</option>
                      {ownedTokens.map(([tokenId, balance]) => {
                        const meta = TOKEN_METADATA[tokenId] || { name: `Token #${tokenId}` }
                        return (
                          <option key={tokenId} value={tokenId}>
                            {meta.name} (Own: {balance})
                          </option>
                        )
                      })}
                    </select>
                    <input
                      type="number"
                      placeholder="Amount"
                      min="1"
                      max={balances[listingForm.tokenId] || 1}
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
                  </div>
                </form>
              </div>

              {/* My Active Listings */}
              {myListings.length > 0 && (
                <div className="my-listings-section">
                  <h3>My Active Listings</h3>
                  <table className="listings-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Amount</th>
                        <th>Price</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myListings.map(listing => {
                        const meta = TOKEN_METADATA[listing.tokenId] || { name: `Token #${listing.tokenId}` }
                        return (
                          <tr key={listing.id}>
                            <td>{meta.name}</td>
                            <td>{listing.amount}</td>
                            <td>{listing.price} ETH</td>
                            <td>{formatDeadline(listing.deadline)}</td>
                            <td>
                              <div className="listing-actions">
                                <button className="edit-btn" onClick={() => openEditModal(listing)}>Edit</button>
                                <button className="cancel-btn" onClick={() => onCancelListing(listing)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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