import Inventory from '../components/Inventory'

function InventoryPage({ tiers, balances, userAddress, onCreateListing, onUpdateListing, myListings, onCancelListing }) {
  return (
    <Inventory 
      tiers={tiers}
      balances={balances}
      userAddress={userAddress}
      onCreateListing={onCreateListing}
      onUpdateListing={onUpdateListing}
      myListings={myListings}
      onCancelListing={onCancelListing}
    />
  )
}

export default InventoryPage
