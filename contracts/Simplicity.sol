// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

// Simplicity is an L2 rollup:
//   It exists in this contract + sgeth
//   It uses ETH voting in SimplicityState to resolve the blockhash

// We charge gas fees on L2 transactions, and they will only be submitted to L1 if they are profitable to pay for the calldata.
// We could also charge 0.3% (same as uniswap) for withdrawals

interface SimplicityState {
  function getTrustedState(uint blockNumber) external view returns (bytes32);
}

contract Simplicity {
  SimplicityState public state;

  address owner;
  constructor() { owner = msg.sender; }
  modifier onlyOwner() { require(msg.sender == owner); _; }

  // moderation
  function renounceOwnership() external onlyOwner { owner = address(0); }
  function updateStateContract(SimplicityState newState) external onlyOwner { state = newState; }

  // This is a bunch of transactions on L2 (RLP encoded, array if ABI decode is hard)
  // WHile anyone can call this, only the designated "bundler" will get the tx fees (coinbase)
  // The designated bundler is tracked with a special contract on L2?
  // For others, the fees go the system (default coinbase)
  // This can be added later and launch with free for all / out of band payouts
  function transact(bytes[] calldata data) external { }

  // cross domain message L1 -> L2, can be payable
  // will show up as from the 0xBA5ED address with the value 
  // this should allow trusted communication from L1 -> L2
  // to communicate from contracts, you prove inclusion in the L1 state (hash accessible from predeploy) on L2
  function message(bytes calldata data) external payable { }

  // **** Those are the main two entrypoints to interact with L2 *****
  // If we didn't need withdrawals, we'd be done.
  // But sadly, we do need withdrawals. Therefore, we need to track the state.
  // To withdraw on L2, just send to the 0 address on L2 and proof inclusion of your tx to the L1 contract after state is final
  function withdraw(uint blockNumber, bytes32 withdrawHash, uint amount, bytes memory proof) external {
    // will revert if the state isn't trusted (yet), 7 days to finalize
    bytes32 blockHash = state.getTrustedState(blockNumber);
    // TODO: check proof of burn
    // TODO: transfer funds to burner
    // See BridgeSale.sol for work on this
  }
}

