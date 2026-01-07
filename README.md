# MPH NFT Marketplace

ERC-1155 NFT marketplace with tiered game inventory, EIP-712 signature-based listings, and multi-chain support.

## Features

- **React Router DOM** for client-side routing
- **CRUD operations** via localStorage for listings management
- **Multi-chain support**: Main chain (KARRAT) + StudioChain (native ETH)
- **EIP-712 signatures** for gasless off-chain listings
- **Tiered NFT system** with configurable pricing and limits

## Architecture

### React Router DOM

The app uses `react-router-dom` v6 for navigation:

```
/                  → Primary Store (KARRAT payments)
/studiochain       → StudioChain (ETH payments, primary + secondary)
/marketplace       → Secondary Marketplace (KARRAT)
/inventory         → Your NFTs & listings
/admin             → Admin panel (admin only)
```

**Key files:**
- `src/main.jsx` - BrowserRouter wrapper
- `src/App.jsx` - Routes configuration
- `src/components/Navbar.jsx` - NavLink navigation

### CRUD Operations (localStorage)

Listings are stored client-side in localStorage. The `src/utils/storage.js` provides full CRUD:

```javascript
// Main chain (KARRAT) listings
getListings()                    // READ - Get all listings
getListingById(id)               // READ - Get single listing
getListingsBySeller(address)     // READ - Get listings by seller
addListing(listing)              // CREATE - Add new listing
updateListing(id, updates)       // UPDATE - Edit price, amount, or deadline
removeListing(id)                // DELETE - Remove listing

// StudioChain (ETH) listings
getStudioChainListings()
addStudioChainListing(listing)
updateStudioChainListing(id, updates)
removeStudioChainListing(id)
```

**CRUD in Action:**

| Operation | Where | Description |
|-----------|-------|-------------|
| CREATE | Inventory → "List for Sale" | Sign EIP-712, save to localStorage |
| READ | Marketplace, Inventory | Load listings from localStorage |
| UPDATE | Inventory → "Edit" button | Edit price, amount, extend deadline |
| DELETE | Inventory → "Cancel" button | Remove from localStorage + invalidate nonce |

**Data structure:**
```json
{
  "id": 1704567890123,
  "seller": "0xf39F...",
  "nftContract": "0x8A79...",
  "tokenId": 1,
  "amount": 1,
  "price": "10",
  "priceWei": "10000000000000000000",
  "nonce": 0,
  "deadline": 1735689600,
  "signature": "0x...",
  "createdAt": 1704567890123
}
```

### Dual Chain Support

| Feature | Main Chain | StudioChain |
|---------|------------|-------------|
| Payment | KARRAT (ERC-20) | Native ETH |
| NFT Contract | TieredGameInventory1155 | TieredGameInventoryStudioChain1155 |
| Marketplace | MPHGameMarketplace1155 | MPHGameMarketplaceNative |
| Primary Sale | `/` route | `/studiochain` → Primary tab |
| Secondary Sale | `/marketplace` route | `/studiochain` → Secondary tab |

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Terminal 1: Start Hardhat node
npm run node

# Terminal 2: Deploy contracts
npm run deploy -- --network localhost

# Terminal 3: Start frontend
npm run dev
```

Open http://localhost:5173

### Deploy to Sepolia

1. Create `.env`:
```env
PRIVATE_KEY=your_private_key
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

2. Deploy:
```bash
npm run deploy -- --network sepolia
```

3. Copy contract addresses from output to `.env`

### Deploy to Vercel

1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables:
```
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_ADMIN_ADDRESS=0x...
VITE_NFT_CONTRACT=0x...
VITE_MARKETPLACE_CONTRACT=0x...
VITE_KARRAT_CONTRACT=0x...
VITE_TRACKING_CONTRACT=0x...
VITE_VERIFIER_CONTRACT=0x...

# Optional: StudioChain
VITE_STUDIOCHAIN_NFT_CONTRACT=0x...
VITE_STUDIOCHAIN_MARKETPLACE_CONTRACT=0x...
VITE_STUDIOCHAIN_RPC_URL=https://...
```

4. Deploy

## Project Structure

```
src/
├── main.jsx                 # BrowserRouter setup
├── App.jsx                  # Routes & state management
├── App.css
├── index.css
├── components/
│   ├── Header.jsx           # Wallet connection
│   ├── Navbar.jsx           # React Router NavLinks
│   ├── PrimaryStore.jsx     # Primary sale UI
│   ├── Marketplace.jsx      # Secondary market UI
│   ├── Inventory.jsx        # User NFTs & listings
│   ├── AdminPanel.jsx       # Admin functions
│   ├── Toast.jsx            # Notifications
│   └── TxModal.jsx          # Transaction status
├── pages/
│   ├── PrimaryStorePage.jsx
│   ├── StudioChainPage.jsx  # Primary + Secondary tabs
│   ├── MarketplacePage.jsx
│   ├── InventoryPage.jsx
│   └── AdminPage.jsx
└── utils/
    ├── constants.js         # ABIs, types, metadata
    └── storage.js           # CRUD operations
```

## Contracts

| Contract | Description | Payment |
|----------|-------------|---------|
| TieredGameInventory1155 | ERC-1155 with tiered metadata | KARRAT |
| MPHGameMarketplace1155 | EIP-712 signature marketplace | KARRAT |
| TieredGameInventoryStudioChain1155 | ERC-1155 for StudioChain | Native ETH |
| MPHGameMarketplaceNative | EIP-712 signature marketplace | Native ETH |
| MPHAssetTracking | Contract registry | N/A |
| Verifier | Address allowlist | N/A |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run node` | Start local Hardhat node |
| `npm run compile` | Compile Solidity contracts |
| `npm run deploy` | Deploy contracts |
| `npm run server` | Start JSON server (optional) |

## How It Works

### Creating a Listing

1. User signs EIP-712 typed data (gasless)
2. Signature + listing data stored in localStorage
3. Listing appears in marketplace
4. No on-chain transaction until purchase

### Buying from Listing

1. Buyer approves token spending (KARRAT) or sends ETH
2. Marketplace contract verifies signature
3. NFT transferred to buyer
4. Payment sent to seller (minus fee)
5. Listing removed from localStorage

### Canceling a Listing

1. Seller calls `delistToken()` on marketplace
2. Increments nonce, invalidating old signatures
3. Listing removed from localStorage

## Environment Variables

```env
# Required
VITE_RPC_URL=                    # Blockchain RPC URL
VITE_ADMIN_ADDRESS=              # Admin wallet address
VITE_NFT_CONTRACT=               # TieredGameInventory1155 address
VITE_MARKETPLACE_CONTRACT=       # MPHGameMarketplace1155 address
VITE_KARRAT_CONTRACT=            # KARRAT token address
VITE_TRACKING_CONTRACT=          # MPHAssetTracking address
VITE_VERIFIER_CONTRACT=          # Verifier address

# Deployment only
PRIVATE_KEY=                     # Deployer private key

# Optional: StudioChain
VITE_STUDIOCHAIN_NFT_CONTRACT=
VITE_STUDIOCHAIN_MARKETPLACE_CONTRACT=
VITE_STUDIOCHAIN_RPC_URL=
```

## Troubleshooting

### MetaMask shows wrong data
Settings → Advanced → Clear activity tab data

### Contracts not loading
1. Check Hardhat node is running
2. Redeploy contracts
3. Clear Vite cache: `rm -rf node_modules/.vite`

### 404 on page refresh (Vercel)
Ensure `vercel.json` has the rewrite rule:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

## License

MIT
