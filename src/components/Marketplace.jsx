import { getTokenName, getTokenImage, getTokenRarity } from '../utils/constants'
import { formatAddress } from '../utils/storage'
import './Marketplace.css'

function Marketplace({ listings, userAddress, onBuy, onCancel }) {
  const activeListings = listings.filter(l => !l.deadline || l.deadline > Math.floor(Date.now() / 1000))
  
  const isOwnListing = (listing) => userAddress && listing.seller?.toLowerCase() === userAddress.toLowerCase()
  
  return (
    <div className="marketplace">
      <div className="mp-header">
        <div>
          <h1>Marketplace</h1>
          <p>Buy items from other players (2.5% fee)</p>
        </div>
        <div className="mp-stat">
          <span className="value">{activeListings.length}</span>
          <span className="label">Listings</span>
        </div>
      </div>
      
      {activeListings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏪</div>
          <p>No items listed</p>
        </div>
      ) : (
        <div className="listings-grid">
          {activeListings.map(listing => {
            const rarity = getTokenRarity(listing.tokenId)
            return (
              <div key={listing.id} className={`listing-card rarity-${rarity.toLowerCase()}`}>
                <div className="listing-image">
                  <img src={getTokenImage(listing.tokenId)} alt="" />
                  <span className={`rarity-badge ${rarity.toLowerCase()}`}>{rarity}</span>
                </div>
                
                <div className="listing-details">
                  <h3>{getTokenName(listing.tokenId)}</h3>
                  <p className="seller">Seller: {isOwnListing(listing) ? 'You' : formatAddress(listing.seller)}</p>
                  
                  <div className="listing-info">
                    <div className="info-item">
                      <span className="label">Amount</span>
                      <span className="value">{listing.amount}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Price</span>
                      <span className="value price">{listing.price} KARRAT</span>
                    </div>
                  </div>
                  
                  {isOwnListing(listing) ? (
                    <button className="cancel-btn" onClick={() => onCancel(listing)}>Cancel</button>
                  ) : (
                    <button className="buy-btn" onClick={() => onBuy(listing)} disabled={!userAddress}>
                      {userAddress ? 'Buy Now' : 'Connect Wallet'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Marketplace
