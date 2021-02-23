#!/usr/bin/env python3
from web3 import Web3
from eth_typing import Hash32

w3 = Web3(Web3.HTTPProvider("https://node.cheapeth.org/rpc"))
assert w3.isConnected()

# https://ethereum.stackexchange.com/questions/67055/block-header-hash-verification
# https://ethereum.stackexchange.com/questions/5833/why-do-we-need-both-nonce-and-mixhash-values-in-a-block
# https://github.com/ethereum/py-evm/blob/aac86ec335d48c9d8c79a0c86b32a13e43e76c0c/eth/consensus/pow.py#L43

#print(w3.eth.getWork())

FORKBLOCK = 11818960

"""
for i in range(FORKBLOCK, 11905170, 100):
  block = w3.eth.get_block(i)
  print(i, block['difficulty'])
"""

#block = w3.eth.get_block(11905170)
block = w3.eth.get_block(FORKBLOCK-100)
for k,v in block.items():
  print(k,v)

from hashlib import sha3_512, sha3_256
from eth_utils import keccak, encode_hex, decode_hex
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

class MiningHeader(rlp.Serializable):
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
    ]

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

    @property
    def hash(self) -> Hash32:
        return keccak(rlp.encode(self))

    @property
    def mining_hash(self) -> Hash32:
        return keccak(rlp.encode(self[:-2], MiningHeader))

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

from hexdump import hexdump
hexdump(block['parentHash'])
print("")
hexdump(rlp.encode(header))
import binascii
print(binascii.hexlify(rlp.encode(header)))
print("")
hexdump(rlp.encode(header[:-2]))

#exit(0)


print("BLOCK HASH MATCH?")
print(block['hash'])
print(header.hash)
mining_hash = header.mining_hash
print("***********", mining_hash)


def zpad(s, length):
    return s + b'\x00' * max(0, length - len(s))

WORD_BYTES = 4

def encode_int(s):
    a = "%x" % s
    return b'' if s == 0 else decode_hex('0' * (len(a) % 2) + a)[::-1]

def serialize_hash(h):
    return b''.join([zpad(encode_int(x), 4) for x in h])

def decode_int(s):
    return int(encode_hex(s[::-1]), 16) if s else 0

def deserialize_hash(h):
    return [decode_int(h[i:i+WORD_BYTES]) for i in range(0, len(h), WORD_BYTES)]

import sha3
def hash_words(h, sz, x):
  if isinstance(x, list):
    x = serialize_hash(x)
  y = h(x)
  return deserialize_hash(y)

"""
def sha3_512(x):
  return hash_words(lambda v: sha3.sha3_512(v).digest(), 64, x)

def sha3_256(x):
  return hash_words(lambda v: sha3.sha3_256(v).digest(), 32, x)
"""

sha3_512 = lambda v: sha3.keccak_512(v).digest()
sha3_256 = lambda v: sha3.keccak_256(v).digest()

print(len(mining_hash + block['nonce']))
hexdump(mining_hash + block['nonce'][::-1])
s = sha3_512(mining_hash + block['nonce'][::-1])
hexdump(s)
print(len(s))
print(s, block['mixHash'], block['nonce'])
#print(deserialize_hash(block['mixHash']))
print(len(s + block['mixHash']))
hh = sha3_256(s + block['mixHash'])

#hh = keccak(keccak(mining_hash+block['nonce']+block['mixHash']))
print(block['difficulty'])
print("have:  ", big_endian_to_int(hh))
print("needed:", 2**256 // block['difficulty'])
print("smaller?")
print(encode_hex(hh))

exit(0)
#print(serialize_hash(hh))
print("***********")

#exit(0)
from collections import OrderedDict
from pyethash import EPOCH_LENGTH, mkcache_bytes, hashimoto_light

cache_by_epoch: 'OrderedDict[int, bytearray]' = OrderedDict()
CACHE_MAX_ITEMS = 10

def get_cache(block_number: int) -> bytes:
    epoch_index = block_number // EPOCH_LENGTH

    # doing explicit caching, because functools.lru_cache is 70% slower in the tests

    # Get the cache if already generated, marking it as recently used
    if epoch_index in cache_by_epoch:
        c = cache_by_epoch.pop(epoch_index)  # pop and append at end
        cache_by_epoch[epoch_index] = c
        return c

    # Generate the cache if it was not already in memory
    # Simulate requesting mkcache by block number: multiply index by epoch length
    c = mkcache_bytes(epoch_index * EPOCH_LENGTH)
    cache_by_epoch[epoch_index] = c

    # Limit memory usage for cache
    if len(cache_by_epoch) > CACHE_MAX_ITEMS:
        cache_by_epoch.popitem(last=False)  # remove last recently accessed

    return c

import sha3
import rlp
from eth_utils import ValidationError, encode_hex
from ethash import hashimoto_light as hashimoto_light_python

def check_pow(block_number: int,
              mining_hash: Hash32,
              mix_hash: Hash32,
              nonce: bytes,
              difficulty: int) -> None:
    print(len(mining_hash), len(mix_hash), len(nonce))
    cache = get_cache(block_number)
    print("got cache")
    mining_output = hashimoto_light_python(
        block_number, cache, mining_hash, big_endian_to_int(nonce))
    result = big_endian_to_int(mining_output[b'result'])
    print("real:  ", result)
    print("needed:", 2**256 // difficulty)
    if mining_output[b'mix digest'] != mix_hash:
        raise ValidationError(
            f"mix hash mismatch; expected: {encode_hex(mining_output[b'mix digest'])} "
            f"!= actual: {encode_hex(mix_hash)}. "
            f"Mix hash calculated from block #{block_number}, "
            f"mine hash {encode_hex(mining_hash)}, nonce {encode_hex(nonce)}"
            f", difficulty {difficulty}, cache hash {encode_hex(keccak(cache))}"
        )
    return result

assert header.block_number == block['number']
#assert mining_hash == header.mining_hash
#assert header.mix_hash == block['mixHash']
#assert header.nonce == block['nonce']
ret = check_pow(block['number'], mining_hash, block['mixHash'], block['nonce'], block['difficulty'])

#ret = check_pow(header.block_number, header.mining_hash, header.mix_hash, header.nonce, header.difficulty)

#print(ret)

exit(0)


# mixHash, nonce

print("\nNEW BLOCK")
block = w3.eth.get_block(11905171)
for k,v in block.items():
  print(k,v)

#print(block['hash'])
#print(proof)

