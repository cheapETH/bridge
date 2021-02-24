var Web3 = require('web3');
var w3 = new Web3("https://mainnet.cheapeth.org/rpc");

let sleep = require('util').promisify(setTimeout);
var rlp = require('rlp');

const MAX_BLOCK_CHUNK = 10;
const bridgeAddress = "0x76523BB738Ff66d3B83Dde2cA56A930dd20994eF";

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
      await sleep(5000);
      continue;
    }

    var hdr = await Bridge.getHeader(ep);
    console.log(hdr);
    var blockNumber = hdr['blockNumber'].toNumber();
    const latestBlock = await w3.eth.getBlock('latest');
    const blocksBehind = latestBlock['number'] - blockNumber;
    console.log("we are at", blockNumber, "which is", blocksBehind, "blocks behind", latestBlock['number']);

    // not behind?
    if (blocksBehind == 0) {
      await sleep(5000);
      continue;
    }
    seen[ep] = true;

    var hdrs = [];
    for (var i = 0; i < Math.min(MAX_BLOCK_CHUNK, blocksBehind); i++) {
      const submitBlockNumber = blockNumber+i+1;
      const new_block = await w3.eth.getBlock(submitBlockNumber);
      hdrs.push(getBlockRlp(new_block));
    }
    const ret = await Bridge.submitHeaders(hdrs);
    console.log("submitted", hdrs.length, "block headers with tx hash", ret['hash']);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

