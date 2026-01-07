import { useState } from 'react'
import { TIER_CONFIG, getTokenName, getTokenImage, getTokenDescription, getTokenRarity } from '../utils/constants'
import { formatKarrat } from '../utils/storage'
import './PrimaryStore.css'

function PrimaryStore({ tiers, onBuy, userAddress }) {
  const [filter, setFilter] = useState('all')
  const [quantities, setQuantities] = useState({})
  
  const filteredTiers = filter === 'all' ? tiers : tiers.filter(t => t.name === filter)
  
  const updateQty = (tokenId, delta, max) => {
    setQuantities(prev => ({
      ...prev,
      [tokenId]: Math.max(1, Math.min((prev[tokenId] || 1) + delta, max))
    }))
  }
  
  const handleBuy = (tierName, tokenId) => {
    const qty = quantities[tokenId] || 1
    onBuy(tierName, [tokenId], [qty])
  }
  
  return (
    <div className="primary-store">
      <div className="store-header">
        <div>
          <h1>Primary Sale</h1>
          <p>Purchase items directly with KARRAT tokens</p>
        </div>
        
        <div className="tier-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          {tiers.map(tier => (
            <button 
              key={tier.name}
              className={filter === tier.name ? 'active' : ''}
              onClick={() => setFilter(tier.name)}
            >
              {TIER_CONFIG[tier.name]?.icon} {tier.name}
            </button>
          ))}
        </div>
      </div>
      
      {filteredTiers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>No items available</p>
        </div>
      ) : (
        <div className="items-grid">
          {filteredTiers.map(tier => (
            tier.tokenIds.map((tokenId, idx) => {
              const isSoldOut = tier.currentSupplies[idx] >= tier.maxSupplies[idx]
              const qty = quantities[tokenId] || 1
              const rarity = getTokenRarity(tokenId)
              
              return (
                <div key={tokenId} className={`item-card rarity-${rarity.toLowerCase()}`}>
                  <div className="item-image">
                    <img src={getTokenImage(tokenId)} alt={getTokenName(tokenId)} />
                    <span className="tier-badge" style={{ background: TIER_CONFIG[tier.name]?.color }}>{tier.name}</span>
                    <span className={`rarity-badge ${rarity.toLowerCase()}`}>{rarity}</span>
                  </div>
                  
                  <div className="item-details">
                    <h3>{getTokenName(tokenId)}</h3>
                    <p className="item-desc">{getTokenDescription(tokenId)}</p>
                    
                    <div className="item-stats">
                      <div className="stat">
                        <span className="label">Supply</span>
                        <span className="value">{tier.currentSupplies[idx]}/{tier.maxSupplies[idx]}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Max</span>
                        <span className="value">{tier.maxAmountsPerUser[idx]}/user</span>
                      </div>
                    </div>
                    
                    <div className="price-row">
                      <span className="price">{formatKarrat(tier.prices[idx])} KARRAT</span>
                    </div>
                    
                    {!isSoldOut && (
                      <div className="qty-row">
                        <button onClick={() => updateQty(tokenId, -1, tier.maxAmountsPerUser[idx])}>-</button>
                        <span>{qty}</span>
                        <button onClick={() => updateQty(tokenId, 1, tier.maxAmountsPerUser[idx])}>+</button>
                      </div>
                    )}
                    
                    <button 
                      className={`buy-btn ${isSoldOut ? 'sold-out' : ''}`}
                      onClick={() => handleBuy(tier.name, tokenId)}
                      disabled={!userAddress || isSoldOut}
                    >
                      {isSoldOut ? 'Sold Out' : !userAddress ? 'Connect Wallet' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              )
            })
          ))}
        </div>
      )}
    </div>
  )
}

export default PrimaryStore
