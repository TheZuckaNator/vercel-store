import Marketplace from '../components/Marketplace'

function MarketplacePage({ listings, userAddress, onBuy, onCancel }) {
  return (
    <Marketplace 
      listings={listings} 
      userAddress={userAddress} 
      onBuy={onBuy} 
      onCancel={onCancel} 
    />
  )
}

export default MarketplacePage
