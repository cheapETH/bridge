const Web3 = require('web3');

const config = {
  deveth: {
    url: 'https://rpc.deveth.org/',
    bombDelayFromParent: 900000000,
    poa: false,
  },
  binance: {
    url: 'https://bsc-dataseed.binance.org/',
    poa: true,
  },
  mainnet: {
    url: 'https://mainnet.cheapeth.org/rpc',
    bombDelayFromParent: 9000000,
    poa: false,
  },
};

const targetNetwork = process.env['NETWORK'];
const network = Object.keys(config).includes(targetNetwork)
  ? targetNetwork
  : 'mainnet';
const { url, bombDelayFromParent, poa } = config[network];
const w3 = new Web3(url);

console.log('Deploying bridge to', network);

const { sleep, ...lib } = require('./lib');

const MAX_BLOCK_CHUNK = 10;

const bridgeAddress = process.env['BRIDGE'];
if (bridgeAddress) {
  console.log('Using bridge at address', bridgeAddress);
} else {
  console.log('Bridge address not given will deploy new bridge');
}
async function getBridge() {
  const genesis_block = await w3.eth.getBlock('latest');
  const contractName = poa ? 'BridgeBinance' : 'Bridge';
  const blockRpl = lib.getBlockRlp(genesis_block);

  const factoryArgs = [blockRpl];
  if (!poa) {
    factoryArgs.push(bombDelayFromParent);
  }

  const BridgeFactory = await ethers.getContractFactory(contractName);
  const Bridge = await BridgeFactory.deploy(...factoryArgs);

  console.log('Deployed Bridge address:', Bridge.address);
  return Bridge;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Running from the address:', deployer.address);

  const balance = await deployer.getBalance();
  console.log('Account balance:', balance.toString());

  const Bridge =
    bridgeAddress == null
      ? await getBridge()
      : await ethers.getContractAt('Bridge', bridgeAddress);

  const seen = {};
  while (true) {
    const longestCommitedChainHash = await Bridge.getLongestChainEndpoint();
    console.log('longestCommitedChainHash:', longestCommitedChainHash);
    if (seen[longestCommitedChainHash]) {
      await sleep(5000);
      continue;
    }

    const hdr = await Bridge.getHeader(longestCommitedChainHash);
    let blockNumber = hdr['blockNumber'].toNumber();

    const latestBlock = await w3.eth.getBlock('latest');
    const latestBlockNumber = latestBlock['number'];
    const blocksBehind = latestBlockNumber - blockNumber;
    console.log(
      'we are at',
      blockNumber,
      'which is',
      blocksBehind,
      'blocks behind',
      latestBlockNumber
    );

    // not behind?
    if (blocksBehind == 0) {
      await sleep(5000);
      continue;
    }

    // new headers to submit
    const hdrs = [];

    // might rewind a bit for chain reorg
    while (true) {
      const supposedCurrentBlock = await w3.eth.getBlock(blockNumber);
      const isHeaderStored = await Bridge.isHeaderStored(
        supposedCurrentBlock['hash']
      );
      if (isHeaderStored) {
        break;
      }
      blockNumber -= 1;
      console.log('rewinding...');
    }

    console.log('syncing from block', blockNumber);
    while (hdrs.length < MAX_BLOCK_CHUNK && blockNumber != latestBlockNumber) {
      blockNumber += 1;
      const new_block = await w3.eth.getBlock(blockNumber);
      hdrs.push(lib.getBlockRlp(new_block));
    }

    const ret = await Bridge.submitHeaders(hdrs);
    console.log(
      'submitted',
      hdrs.length,
      `block headers with tx hash ${ret['hash']}`
    );

    // we can wait for the transaction now
    seen[longestCommitedChainHash] = true;
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error)
  .then(() => process.exit(1));
