#!/usr/bin/env python3
from web3 import Web3

w3 = Web3(Web3.HTTPProvider("https://node.cheapeth.org/rpc"))
assert w3.isConnected()

# https://ethereum.stackexchange.com/questions/67055/block-header-hash-verification
# https://ethereum.stackexchange.com/questions/5833/why-do-we-need-both-nonce-and-mixhash-values-in-a-block

#print(w3.eth.getWork())

FORKBLOCK = 11818960

"""
for i in range(FORKBLOCK, 11905170, 100):
  block = w3.eth.get_block(i)
  print(i, block['difficulty'])
"""

block = w3.eth.get_block(11905170)
#block = w3.eth.get_block(FORKBLOCK-100)
for k,v in block.items():
  print(k,v)

from eth_utils import keccak
import rlp
from rlp.sedes import (
    BigEndianInt,
    big_endian_int,
    Binary,
    binary,
)
from eth_utils import big_endian_to_int

address = Binary.fixed_length(20, allow_empty=True)
hash32 = Binary.fixed_length(32)
int256 = BigEndianInt(256)
trie_root = Binary.fixed_length(32, allow_empty=True)

class BlockHeader(rlp.Serializable):
    fields = [
        ('parent_hash', hash32),
        ('uncles_hash', hash32),
        ('coinbase', address),
        ('state_root', trie_root),
        ('transaction_root', trie_root),
        ('receipt_root', trie_root),
        ('bloom', int256),
        ('difficulty', big_endian_int),
        ('block_number', big_endian_int),
        ('gas_limit', big_endian_int),
        ('gas_used', big_endian_int),
        ('timestamp', big_endian_int),
        ('extra_data', binary),
        ('mix_hash', binary),
        ('nonce', Binary(8, allow_empty=True))
    ]

    def hash(self) -> bytes:
        return keccak(rlp.encode(self))


from eth_utils import to_bytes, to_hex

header = BlockHeader(
    parent_hash=block['parentHash'],
    uncles_hash=block['sha3Uncles'],
    coinbase=to_bytes(int(block['miner'], 16)),
    state_root=block['stateRoot'],
    transaction_root=block['transactionsRoot'],
    receipt_root=block['receiptsRoot'],
    bloom=big_endian_to_int(block['logsBloom']),
    difficulty=block['difficulty'],
    block_number=block['number'],
    gas_limit=block['gasLimit'],
    gas_used=block['gasUsed'],
    timestamp=block['timestamp'],
    extra_data=block['extraData'],
    mix_hash=block['mixHash'],
    nonce=block['nonce']
)

print(block['hash'])
print(header.hash())


exit(0)

import sha3
import rlp
import pyethash

#block['parentHash'], block['miner']

mkcache = pyethash.mkcache_bytes
hashimoto_light = lambda s, c, h, n: pyethash.hashimoto_light(s, c, h, big_endian_to_int(n))

cache_seeds = [b'\x00' * 32]
EPOCH_LENGTH = pyethash.EPOCH_LENGTH

cache = mkcache(block['number'])
out = hashimoto_light(block['number'], cache, block['mixHash'], block['nonce'])
print(block['mixHash'])
print(out)

exit(0)


# mixHash, nonce

print("\nNEW BLOCK")
block = w3.eth.get_block(11905171)
for k,v in block.items():
  print(k,v)

#print(block['hash'])
#print(proof)

