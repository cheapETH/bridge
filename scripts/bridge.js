var Web3 = require('web3');
var w3 = new Web3("https://mainnet.cheapeth.org/rpc");

var rlp = require('rlp');

var bridgeAddress = "0x5A7F7095e582D7082F0EBCf7172e510A6B5c5D7E";
console.log("Using bridge at address", bridgeAddress);

// TODO: make this a library with the test
function getBlockRlp(block) {
  var toHex = function(x) { return (x==0) ? "0x" : w3.utils.toHex(x) };
  return rlp.encode([
    block['parentHash'],
    block['sha3Uncles'],
    block['miner'],
    block['stateRoot'],
    block['transactionsRoot'],
    block['receiptsRoot'],
    block['logsBloom'],
    toHex(block['difficulty']),
    toHex(block['number']),
    toHex(block['gasLimit']),
    toHex(block['gasUsed']),
    toHex(block['timestamp']),
    block['extraData'],
    block['mixHash'],
    block['nonce']
  ]);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Running from the address:",
    deployer.address
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

	const Bridge = await ethers.getContractAt("Bridge", bridgeAddress);

  var seen = {};

  while (1) {
    var ep = await Bridge.getLongestChainEndpoint();
    console.log(ep);

    if (seen[ep]) {
      //sleep(2000);
      continue;
    }

    seen[ep] = true;

    var hdr = await Bridge.getHeader(ep);
    console.log(hdr);

    var blockNumber = hdr['blockNumber'];

    const new_block = await w3.eth.getBlock(blockNumber.add(1));
    //console.log(new_block);
    const ret = await Bridge.submitHeader(getBlockRlp(new_block));
    console.log("submitted", new_block['blockNumber'], "on", blockNumber);

  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

