import PrimaryStore from '../components/PrimaryStore'

function PrimaryStorePage({ tiers, onBuy, userAddress }) {
  return <PrimaryStore tiers={tiers} onBuy={onBuy} userAddress={userAddress} />
}

export default PrimaryStorePage
