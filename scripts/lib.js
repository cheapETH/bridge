var Web3 = require('web3');
var rlp = require('rlp');

function getBlockParts(block) {
  var toHex = function(x) { return (x==0) ? "0x" : Web3.utils.toHex(x) };
  return [
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
  ];
}

// TODO: make this a library with the test
function getBlockRlp(block) {
  return rlp.encode(getBlockParts(block));
}

module.exports = { getBlockParts, getBlockRlp };

