// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

contract SimpleL2 {
  uint256 constant withdrawDelay = 24 hours;
  uint256 constant bondAmount = 10 ether;
  uint256 constant challengeAmount = 10 ether;

  enum BondState{NONE, GOOD, FRAUD}

  mapping (address => mapping (uint => bytes32)) private L2State;
  mapping (address => BondState) private bonded;

  struct Withdrawal {
    uint256 time;
    uint256 amount;
    address bonder;
  }

  mapping (bytes32 => Withdrawal) private withdrawals;
  mapping (bytes32 => bool) private withdrawalClaimed;

  // This is a transaction/deposit on L2
  // The nonce of this call is the block number on L2
  // TODO: attest to L1 transactions in the fraud proof, need blockhash oracle
  function transact(bytes calldata data) external payable { }

  // this starts a withdraw
  function withdraw(address bonder, uint blockNumber, bytes32 withdrawHash, uint amount, bytes memory proof) external {
    require(bonded[bonder] == BondState.GOOD);
    bytes32 blockHash = L2State[bonder][blockNumber];
    assert(blockHash != 0);

    // TODO: prove the withdrawal SSTORE is in the state with the proof

    withdrawals[withdrawHash] = Withdrawal({
      time: block.timestamp,
      amount: amount,
      bonder: bonder
    });
  }

  function claim(bytes32 withdrawHash) external {
    require(!withdrawalClaimed[withdrawHash]);
    withdrawalClaimed[withdrawHash] = true;

    Withdrawal memory wt = withdrawals[withdrawHash];

    // bonder still bonded (and not 0)
    require(bonded[wt.bonder] == BondState.GOOD);

    // 24 hours after the withdraw started
    require((wt.time + withdrawDelay) < block.timestamp);

    // do the withdraw!
    (bool success, ) = payable(msg.sender).call{value:wt.amount}("");
    require(success);
  }

  // anyone can attest, but only bonded addresses can be used for withdrawal
  function attest(uint blockNumber, bytes32 blockHash) external {
    // can't change your mind
    require(L2State[msg.sender][blockNumber] == 0);
    L2State[msg.sender][blockNumber] = blockHash;
  }

  function fraud(address bonder, uint blockNumber, bytes memory proof) external payable {
    require(msg.value == challengeAmount);
    require(bonded[bonder] == BondState.GOOD);
    bytes32 wrongBlockhash = L2State[bonder][blockNumber];
    require(wrongBlockhash != 0);

    // TODO: show the proof proves fraud
    // Will be interactive game, fraud claimer will have to stake something
    // log(n) steps
    require(false);

    // slash the bond
    bonded[bonder] = BondState.FRAUD;
    (bool success, ) = payable(msg.sender).call{value:bondAmount}("");
    require(success);
  }

  // *** handle bonding ***

  function bond() external payable {
    require(bonded[msg.sender] == BondState.NONE);
    require(msg.value == bondAmount);
    bonded[msg.sender] = BondState.GOOD;
  }

  function unbond() external payable {
    require(bonded[msg.sender] == BondState.GOOD);
    bonded[msg.sender] = BondState.NONE;
    // TODO: time delay here?
    (bool success, ) = payable(msg.sender).call{value:bondAmount}("");
    require(success);
  }
}
