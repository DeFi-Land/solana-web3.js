import _defineProperty from '@babel/runtime/helpers/defineProperty';
import * as nacl from 'tweetnacl';
import nacl__default from 'tweetnacl';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import bs58 from 'bs58';
import { sha256 } from 'crypto-hash';
import { serialize, deserialize, deserializeUnchecked } from 'borsh';
import * as BufferLayout from '@solana/buffer-layout';
import fetch from 'node-fetch';
import { coerce, instance, string, tuple, literal, unknown, union, type, optional, any, number, array, nullable, create, boolean, record, assert as assert$1 } from 'superstruct';
import { Client } from 'rpc-websockets';
import RpcClient from 'jayson/lib/client/browser';
import http from 'http';
import https from 'https';
import secp256k1 from 'secp256k1';
import { keccak_256 } from 'js-sha3';

const toBuffer = arr => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};

class Struct {
  constructor(properties) {
    Object.assign(this, properties);
  }

  encode() {
    return Buffer.from(serialize(SOLANA_SCHEMA, this));
  }

  static decode(data) {
    return deserialize(SOLANA_SCHEMA, this, data);
  }

  static decodeUnchecked(data) {
    return deserializeUnchecked(SOLANA_SCHEMA, this, data);
  }

} // Class representing a Rust-compatible enum, since enums are only strings or
// numbers in pure JS

class Enum extends Struct {
  constructor(properties) {
    super(properties);

    _defineProperty(this, "enum", '');

    if (Object.keys(properties).length !== 1) {
      throw new Error('Enum can only take single value');
    }

    Object.keys(properties).map(key => {
      this.enum = key;
    });
  }

}
const SOLANA_SCHEMA = new Map();

/**
 * Maximum length of derived pubkey seed
 */

const MAX_SEED_LENGTH = 32;

function isPublicKeyData(value) {
  return value._bn !== undefined;
}
/**
 * A public key
 */


class PublicKey extends Struct {
  /** @internal */

  /**
   * Create a new PublicKey object
   * @param value ed25519 public key as buffer or base-58 encoded string
   */
  constructor(value) {
    super({});

    _defineProperty(this, "_bn", void 0);

    if (isPublicKeyData(value)) {
      this._bn = value._bn;
    } else {
      if (typeof value === 'string') {
        // assume base 58 encoding by default
        const decoded = bs58.decode(value);

        if (decoded.length != 32) {
          throw new Error(`Invalid public key input`);
        }

        this._bn = new BN(decoded);
      } else {
        this._bn = new BN(value);
      }

      if (this._bn.byteLength() > 32) {
        throw new Error(`Invalid public key input`);
      }
    }
  }
  /**
   * Default public key value. (All zeros)
   */


  /**
   * Checks if two publicKeys are equal
   */
  equals(publicKey) {
    return this._bn.eq(publicKey._bn);
  }
  /**
   * Return the base-58 representation of the public key
   */


  toBase58() {
    return bs58.encode(this.toBytes());
  }
  /**
   * Return the byte array representation of the public key
   */


  toBytes() {
    return this.toBuffer();
  }
  /**
   * Return the Buffer representation of the public key
   */


  toBuffer() {
    const b = this._bn.toArrayLike(Buffer);

    if (b.length === 32) {
      return b;
    }

    const zeroPad = Buffer.alloc(32);
    b.copy(zeroPad, 32 - b.length);
    return zeroPad;
  }
  /**
   * Return the base-58 representation of the public key
   */


  toString() {
    return this.toBase58();
  }
  /**
   * Derive a public key from another key, a seed, and a program ID.
   * The program ID will also serve as the owner of the public key, giving
   * it permission to write data to the account.
   */


  static async createWithSeed(fromPublicKey, seed, programId) {
    const buffer = Buffer.concat([fromPublicKey.toBuffer(), Buffer.from(seed), programId.toBuffer()]);
    const hash = await sha256(new Uint8Array(buffer));
    return new PublicKey(Buffer.from(hash, 'hex'));
  }
  /**
   * Derive a program address from seeds and a program ID.
   */


  static async createProgramAddress(seeds, programId) {
    let buffer = Buffer.alloc(0);
    seeds.forEach(function (seed) {
      if (seed.length > MAX_SEED_LENGTH) {
        throw new TypeError(`Max seed length exceeded`);
      }

      buffer = Buffer.concat([buffer, toBuffer(seed)]);
    });
    buffer = Buffer.concat([buffer, programId.toBuffer(), Buffer.from('ProgramDerivedAddress')]);
    let hash = await sha256(new Uint8Array(buffer));
    let publicKeyBytes = new BN(hash, 16).toArray(undefined, 32);

    if (is_on_curve(publicKeyBytes)) {
      throw new Error(`Invalid seeds, address must fall off the curve`);
    }

    return new PublicKey(publicKeyBytes);
  }
  /**
   * Find a valid program address
   *
   * Valid program addresses must fall off the ed25519 curve.  This function
   * iterates a nonce until it finds one that when combined with the seeds
   * results in a valid program address.
   */


  static async findProgramAddress(seeds, programId) {
    let nonce = 255;
    let address;

    while (nonce != 0) {
      try {
        const seedsWithNonce = seeds.concat(Buffer.from([nonce]));
        address = await this.createProgramAddress(seedsWithNonce, programId);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }

        nonce--;
        continue;
      }

      return [address, nonce];
    }

    throw new Error(`Unable to find a viable program address nonce`);
  }
  /**
   * Check that a pubkey is on the ed25519 curve.
   */


  static isOnCurve(pubkey) {
    return is_on_curve(pubkey) == 1;
  }

}

_defineProperty(PublicKey, "default", new PublicKey('11111111111111111111111111111111'));

SOLANA_SCHEMA.set(PublicKey, {
  kind: 'struct',
  fields: [['_bn', 'u256']]
}); // @ts-ignore

let naclLowLevel = nacl__default.lowlevel; // Check that a pubkey is on the curve.
// This function and its dependents were sourced from:
// https://github.com/dchest/tweetnacl-js/blob/f1ec050ceae0861f34280e62498b1d3ed9c350c6/nacl.js#L792

function is_on_curve(p) {
  var r = [naclLowLevel.gf(), naclLowLevel.gf(), naclLowLevel.gf(), naclLowLevel.gf()];
  var t = naclLowLevel.gf(),
      chk = naclLowLevel.gf(),
      num = naclLowLevel.gf(),
      den = naclLowLevel.gf(),
      den2 = naclLowLevel.gf(),
      den4 = naclLowLevel.gf(),
      den6 = naclLowLevel.gf();
  naclLowLevel.set25519(r[2], gf1);
  naclLowLevel.unpack25519(r[1], p);
  naclLowLevel.S(num, r[1]);
  naclLowLevel.M(den, num, naclLowLevel.D);
  naclLowLevel.Z(num, num, r[2]);
  naclLowLevel.A(den, r[2], den);
  naclLowLevel.S(den2, den);
  naclLowLevel.S(den4, den2);
  naclLowLevel.M(den6, den4, den2);
  naclLowLevel.M(t, den6, num);
  naclLowLevel.M(t, t, den);
  naclLowLevel.pow2523(t, t);
  naclLowLevel.M(t, t, num);
  naclLowLevel.M(t, t, den);
  naclLowLevel.M(t, t, den);
  naclLowLevel.M(r[0], t, den);
  naclLowLevel.S(chk, r[0]);
  naclLowLevel.M(chk, chk, den);
  if (neq25519(chk, num)) naclLowLevel.M(r[0], r[0], I);
  naclLowLevel.S(chk, r[0]);
  naclLowLevel.M(chk, chk, den);
  if (neq25519(chk, num)) return 0;
  return 1;
}

let gf1 = naclLowLevel.gf([1]);
let I = naclLowLevel.gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

function neq25519(a, b) {
  var c = new Uint8Array(32),
      d = new Uint8Array(32);
  naclLowLevel.pack25519(c, a);
  naclLowLevel.pack25519(d, b);
  return naclLowLevel.crypto_verify_32(c, 0, d, 0);
}

/**
 * An account key pair (public and secret keys).
 *
 * @deprecated since v1.10.0, please use {@link Keypair} instead.
 */

class Account {
  /** @internal */

  /**
   * Create a new Account object
   *
   * If the secretKey parameter is not provided a new key pair is randomly
   * created for the account
   *
   * @param secretKey Secret key for the account
   */
  constructor(secretKey) {
    _defineProperty(this, "_keypair", void 0);

    if (secretKey) {
      this._keypair = nacl.sign.keyPair.fromSecretKey(toBuffer(secretKey));
    } else {
      this._keypair = nacl.sign.keyPair();
    }
  }
  /**
   * The public key for this account
   */


  get publicKey() {
    return new PublicKey(this._keypair.publicKey);
  }
  /**
   * The **unencrypted** secret key for this account
   */


  get secretKey() {
    return toBuffer(this._keypair.secretKey);
  }

}

const BPF_LOADER_DEPRECATED_PROGRAM_ID = new PublicKey('BPFLoader1111111111111111111111111111111111');

/**
 * Layout for a public key
 */

const publicKey = (property = 'publicKey') => {
  return BufferLayout.blob(32, property);
};
/**
 * Layout for a Rust String type
 */

const rustString = (property = 'string') => {
  const rsl = BufferLayout.struct([BufferLayout.u32('length'), BufferLayout.u32('lengthPadding'), BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars')], property);

  const _decode = rsl.decode.bind(rsl);

  const _encode = rsl.encode.bind(rsl);

  rsl.decode = (buffer, offset) => {
    const data = _decode(buffer, offset);

    return data['chars'].toString('utf8');
  };

  rsl.encode = (str, buffer, offset) => {
    const data = {
      chars: Buffer.from(str, 'utf8')
    };
    return _encode(data, buffer, offset);
  };

  rsl.alloc = str => {
    return BufferLayout.u32().span + BufferLayout.u32().span + Buffer.from(str, 'utf8').length;
  };

  return rsl;
};
/**
 * Layout for an Authorized object
 */

const authorized = (property = 'authorized') => {
  return BufferLayout.struct([publicKey('staker'), publicKey('withdrawer')], property);
};
/**
 * Layout for a Lockup object
 */

const lockup = (property = 'lockup') => {
  return BufferLayout.struct([BufferLayout.ns64('unixTimestamp'), BufferLayout.ns64('epoch'), publicKey('custodian')], property);
};
function getAlloc(type, fields) {
  let alloc = 0;
  type.layout.fields.forEach(item => {
    if (item.span >= 0) {
      alloc += item.span;
    } else if (typeof item.alloc === 'function') {
      alloc += item.alloc(fields[item.property]);
    }
  });
  return alloc;
}

function decodeLength(bytes) {
  let len = 0;
  let size = 0;

  for (;;) {
    let elem = bytes.shift();
    len |= (elem & 0x7f) << size * 7;
    size += 1;

    if ((elem & 0x80) === 0) {
      break;
    }
  }

  return len;
}
function encodeLength(bytes, len) {
  let rem_len = len;

  for (;;) {
    let elem = rem_len & 0x7f;
    rem_len >>= 7;

    if (rem_len == 0) {
      bytes.push(elem);
      break;
    } else {
      elem |= 0x80;
      bytes.push(elem);
    }
  }
}

/**
 * The message header, identifying signed and read-only account
 */

const PUBKEY_LENGTH = 32;
/**
 * List of instructions to be processed atomically
 */

class Message {
  constructor(args) {
    _defineProperty(this, "header", void 0);

    _defineProperty(this, "accountKeys", void 0);

    _defineProperty(this, "recentBlockhash", void 0);

    _defineProperty(this, "instructions", void 0);

    this.header = args.header;
    this.accountKeys = args.accountKeys.map(account => new PublicKey(account));
    this.recentBlockhash = args.recentBlockhash;
    this.instructions = args.instructions;
  }

  isAccountWritable(index) {
    return index < this.header.numRequiredSignatures - this.header.numReadonlySignedAccounts || index >= this.header.numRequiredSignatures && index < this.accountKeys.length - this.header.numReadonlyUnsignedAccounts;
  }

  serialize() {
    const numKeys = this.accountKeys.length;
    let keyCount = [];
    encodeLength(keyCount, numKeys);
    const instructions = this.instructions.map(instruction => {
      const {
        accounts,
        programIdIndex
      } = instruction;
      const data = bs58.decode(instruction.data);
      let keyIndicesCount = [];
      encodeLength(keyIndicesCount, accounts.length);
      let dataCount = [];
      encodeLength(dataCount, data.length);
      return {
        programIdIndex,
        keyIndicesCount: Buffer.from(keyIndicesCount),
        keyIndices: Buffer.from(accounts),
        dataLength: Buffer.from(dataCount),
        data
      };
    });
    let instructionCount = [];
    encodeLength(instructionCount, instructions.length);
    let instructionBuffer = Buffer.alloc(PACKET_DATA_SIZE);
    Buffer.from(instructionCount).copy(instructionBuffer);
    let instructionBufferLength = instructionCount.length;
    instructions.forEach(instruction => {
      const instructionLayout = BufferLayout.struct([BufferLayout.u8('programIdIndex'), BufferLayout.blob(instruction.keyIndicesCount.length, 'keyIndicesCount'), BufferLayout.seq(BufferLayout.u8('keyIndex'), instruction.keyIndices.length, 'keyIndices'), BufferLayout.blob(instruction.dataLength.length, 'dataLength'), BufferLayout.seq(BufferLayout.u8('userdatum'), instruction.data.length, 'data')]);
      const length = instructionLayout.encode(instruction, instructionBuffer, instructionBufferLength);
      instructionBufferLength += length;
    });
    instructionBuffer = instructionBuffer.slice(0, instructionBufferLength);
    const signDataLayout = BufferLayout.struct([BufferLayout.blob(1, 'numRequiredSignatures'), BufferLayout.blob(1, 'numReadonlySignedAccounts'), BufferLayout.blob(1, 'numReadonlyUnsignedAccounts'), BufferLayout.blob(keyCount.length, 'keyCount'), BufferLayout.seq(publicKey('key'), numKeys, 'keys'), publicKey('recentBlockhash')]);
    const transaction = {
      numRequiredSignatures: Buffer.from([this.header.numRequiredSignatures]),
      numReadonlySignedAccounts: Buffer.from([this.header.numReadonlySignedAccounts]),
      numReadonlyUnsignedAccounts: Buffer.from([this.header.numReadonlyUnsignedAccounts]),
      keyCount: Buffer.from(keyCount),
      keys: this.accountKeys.map(key => toBuffer(key.toBytes())),
      recentBlockhash: bs58.decode(this.recentBlockhash)
    };
    let signData = Buffer.alloc(2048);
    const length = signDataLayout.encode(transaction, signData);
    instructionBuffer.copy(signData, length);
    return signData.slice(0, length + instructionBuffer.length);
  }
  /**
   * Decode a compiled message into a Message object.
   */


  static from(buffer) {
    // Slice up wire data
    let byteArray = [...buffer];
    const numRequiredSignatures = byteArray.shift();
    const numReadonlySignedAccounts = byteArray.shift();
    const numReadonlyUnsignedAccounts = byteArray.shift();
    const accountCount = decodeLength(byteArray);
    let accountKeys = [];

    for (let i = 0; i < accountCount; i++) {
      const account = byteArray.slice(0, PUBKEY_LENGTH);
      byteArray = byteArray.slice(PUBKEY_LENGTH);
      accountKeys.push(bs58.encode(Buffer.from(account)));
    }

    const recentBlockhash = byteArray.slice(0, PUBKEY_LENGTH);
    byteArray = byteArray.slice(PUBKEY_LENGTH);
    const instructionCount = decodeLength(byteArray);
    let instructions = [];

    for (let i = 0; i < instructionCount; i++) {
      const programIdIndex = byteArray.shift();
      const accountCount = decodeLength(byteArray);
      const accounts = byteArray.slice(0, accountCount);
      byteArray = byteArray.slice(accountCount);
      const dataLength = decodeLength(byteArray);
      const dataSlice = byteArray.slice(0, dataLength);
      const data = bs58.encode(Buffer.from(dataSlice));
      byteArray = byteArray.slice(dataLength);
      instructions.push({
        programIdIndex,
        accounts,
        data
      });
    }

    const messageArgs = {
      header: {
        numRequiredSignatures,
        numReadonlySignedAccounts,
        numReadonlyUnsignedAccounts
      },
      recentBlockhash: bs58.encode(Buffer.from(recentBlockhash)),
      accountKeys,
      instructions
    };
    return new Message(messageArgs);
  }

}

function assert (condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Default (empty) signature
 *
 * Signatures are 64 bytes in length
 */
const DEFAULT_SIGNATURE = Buffer.alloc(64).fill(0);
/**
 * Maximum over-the-wire size of a Transaction
 *
 * 1280 is IPv6 minimum MTU
 * 40 bytes is the size of the IPv6 header
 * 8 bytes is the size of the fragment header
 */

const PACKET_DATA_SIZE = 1280 - 40 - 8;
const SIGNATURE_LENGTH = 64;
/**
 * Account metadata used to define instructions
 */

/**
 * Transaction Instruction class
 */
class TransactionInstruction {
  /**
   * Public keys to include in this transaction
   * Boolean represents whether this pubkey needs to sign the transaction
   */

  /**
   * Program Id to execute
   */

  /**
   * Program input
   */
  constructor(opts) {
    _defineProperty(this, "keys", void 0);

    _defineProperty(this, "programId", void 0);

    _defineProperty(this, "data", Buffer.alloc(0));

    this.programId = opts.programId;
    this.keys = opts.keys;

    if (opts.data) {
      this.data = opts.data;
    }
  }

}
/**
 * Pair of signature and corresponding public key
 */

/**
 * Transaction class
 */
class Transaction {
  /**
   * Signatures for the transaction.  Typically created by invoking the
   * `sign()` method
   */

  /**
   * The first (payer) Transaction signature
   */
  get signature() {
    if (this.signatures.length > 0) {
      return this.signatures[0].signature;
    }

    return null;
  }
  /**
   * The transaction fee payer
   */


  /**
   * Construct an empty Transaction
   */
  constructor(opts) {
    _defineProperty(this, "signatures", []);

    _defineProperty(this, "feePayer", void 0);

    _defineProperty(this, "instructions", []);

    _defineProperty(this, "recentBlockhash", void 0);

    _defineProperty(this, "nonceInfo", void 0);

    opts && Object.assign(this, opts);
  }
  /**
   * Add one or more instructions to this Transaction
   */


  add(...items) {
    if (items.length === 0) {
      throw new Error('No instructions');
    }

    items.forEach(item => {
      if ('instructions' in item) {
        this.instructions = this.instructions.concat(item.instructions);
      } else if ('data' in item && 'programId' in item && 'keys' in item) {
        this.instructions.push(item);
      } else {
        this.instructions.push(new TransactionInstruction(item));
      }
    });
    return this;
  }
  /**
   * Compile transaction data
   */


  compileMessage() {
    const {
      nonceInfo
    } = this;

    if (nonceInfo && this.instructions[0] != nonceInfo.nonceInstruction) {
      this.recentBlockhash = nonceInfo.nonce;
      this.instructions.unshift(nonceInfo.nonceInstruction);
    }

    const {
      recentBlockhash
    } = this;

    if (!recentBlockhash) {
      throw new Error('Transaction recentBlockhash required');
    }

    if (this.instructions.length < 1) {
      console.warn('No instructions provided');
    }

    let feePayer;

    if (this.feePayer) {
      feePayer = this.feePayer;
    } else if (this.signatures.length > 0 && this.signatures[0].publicKey) {
      // Use implicit fee payer
      feePayer = this.signatures[0].publicKey;
    } else {
      throw new Error('Transaction fee payer required');
    }

    for (let i = 0; i < this.instructions.length; i++) {
      if (this.instructions[i].programId === undefined) {
        throw new Error(`Transaction instruction index ${i} has undefined program id`);
      }
    }

    const programIds = [];
    const accountMetas = [];
    this.instructions.forEach(instruction => {
      instruction.keys.forEach(accountMeta => {
        accountMetas.push({ ...accountMeta
        });
      });
      const programId = instruction.programId.toString();

      if (!programIds.includes(programId)) {
        programIds.push(programId);
      }
    }); // Append programID account metas

    programIds.forEach(programId => {
      accountMetas.push({
        pubkey: new PublicKey(programId),
        isSigner: false,
        isWritable: false
      });
    }); // Sort. Prioritizing first by signer, then by writable

    accountMetas.sort(function (x, y) {
      const checkSigner = x.isSigner === y.isSigner ? 0 : x.isSigner ? -1 : 1;
      const checkWritable = x.isWritable === y.isWritable ? 0 : x.isWritable ? -1 : 1;
      return checkSigner || checkWritable;
    }); // Cull duplicate account metas

    const uniqueMetas = [];
    accountMetas.forEach(accountMeta => {
      const pubkeyString = accountMeta.pubkey.toString();
      const uniqueIndex = uniqueMetas.findIndex(x => {
        return x.pubkey.toString() === pubkeyString;
      });

      if (uniqueIndex > -1) {
        uniqueMetas[uniqueIndex].isWritable = uniqueMetas[uniqueIndex].isWritable || accountMeta.isWritable;
      } else {
        uniqueMetas.push(accountMeta);
      }
    }); // Move fee payer to the front

    const feePayerIndex = uniqueMetas.findIndex(x => {
      return x.pubkey.equals(feePayer);
    });

    if (feePayerIndex > -1) {
      const [payerMeta] = uniqueMetas.splice(feePayerIndex, 1);
      payerMeta.isSigner = true;
      payerMeta.isWritable = true;
      uniqueMetas.unshift(payerMeta);
    } else {
      uniqueMetas.unshift({
        pubkey: feePayer,
        isSigner: true,
        isWritable: true
      });
    } // Disallow unknown signers


    for (const signature of this.signatures) {
      const uniqueIndex = uniqueMetas.findIndex(x => {
        return x.pubkey.equals(signature.publicKey);
      });

      if (uniqueIndex > -1) {
        if (!uniqueMetas[uniqueIndex].isSigner) {
          uniqueMetas[uniqueIndex].isSigner = true;
          console.warn('Transaction references a signature that is unnecessary, ' + 'only the fee payer and instruction signer accounts should sign a transaction. ' + 'This behavior is deprecated and will throw an error in the next major version release.');
        }
      } else {
        throw new Error(`unknown signer: ${signature.publicKey.toString()}`);
      }
    }

    let numRequiredSignatures = 0;
    let numReadonlySignedAccounts = 0;
    let numReadonlyUnsignedAccounts = 0; // Split out signing from non-signing keys and count header values

    const signedKeys = [];
    const unsignedKeys = [];
    uniqueMetas.forEach(({
      pubkey,
      isSigner,
      isWritable
    }) => {
      if (isSigner) {
        signedKeys.push(pubkey.toString());
        numRequiredSignatures += 1;

        if (!isWritable) {
          numReadonlySignedAccounts += 1;
        }
      } else {
        unsignedKeys.push(pubkey.toString());

        if (!isWritable) {
          numReadonlyUnsignedAccounts += 1;
        }
      }
    });
    const accountKeys = signedKeys.concat(unsignedKeys);
    const instructions = this.instructions.map(instruction => {
      const {
        data,
        programId
      } = instruction;
      return {
        programIdIndex: accountKeys.indexOf(programId.toString()),
        accounts: instruction.keys.map(meta => accountKeys.indexOf(meta.pubkey.toString())),
        data: bs58.encode(data)
      };
    });
    instructions.forEach(instruction => {
      assert(instruction.programIdIndex >= 0);
      instruction.accounts.forEach(keyIndex => assert(keyIndex >= 0));
    });
    return new Message({
      header: {
        numRequiredSignatures,
        numReadonlySignedAccounts,
        numReadonlyUnsignedAccounts
      },
      accountKeys,
      recentBlockhash,
      instructions
    });
  }
  /**
   * @internal
   */


  _compile() {
    const message = this.compileMessage();
    const signedKeys = message.accountKeys.slice(0, message.header.numRequiredSignatures);

    if (this.signatures.length === signedKeys.length) {
      const valid = this.signatures.every((pair, index) => {
        return signedKeys[index].equals(pair.publicKey);
      });
      if (valid) return message;
    }

    this.signatures = signedKeys.map(publicKey => ({
      signature: null,
      publicKey
    }));
    return message;
  }
  /**
   * Get a buffer of the Transaction data that need to be covered by signatures
   */


  serializeMessage() {
    return this._compile().serialize();
  }
  /**
   * Specify the public keys which will be used to sign the Transaction.
   * The first signer will be used as the transaction fee payer account.
   *
   * Signatures can be added with either `partialSign` or `addSignature`
   *
   * @deprecated Deprecated since v0.84.0. Only the fee payer needs to be
   * specified and it can be set in the Transaction constructor or with the
   * `feePayer` property.
   */


  setSigners(...signers) {
    if (signers.length === 0) {
      throw new Error('No signers');
    }

    const seen = new Set();
    this.signatures = signers.filter(publicKey => {
      const key = publicKey.toString();

      if (seen.has(key)) {
        return false;
      } else {
        seen.add(key);
        return true;
      }
    }).map(publicKey => ({
      signature: null,
      publicKey
    }));
  }
  /**
   * Sign the Transaction with the specified signers. Multiple signatures may
   * be applied to a Transaction. The first signature is considered "primary"
   * and is used identify and confirm transactions.
   *
   * If the Transaction `feePayer` is not set, the first signer will be used
   * as the transaction fee payer account.
   *
   * Transaction fields should not be modified after the first call to `sign`,
   * as doing so may invalidate the signature and cause the Transaction to be
   * rejected.
   *
   * The Transaction must be assigned a valid `recentBlockhash` before invoking this method
   */


  sign(...signers) {
    if (signers.length === 0) {
      throw new Error('No signers');
    } // Dedupe signers


    const seen = new Set();
    const uniqueSigners = [];

    for (const signer of signers) {
      const key = signer.publicKey.toString();

      if (seen.has(key)) {
        continue;
      } else {
        seen.add(key);
        uniqueSigners.push(signer);
      }
    }

    this.signatures = uniqueSigners.map(signer => ({
      signature: null,
      publicKey: signer.publicKey
    }));

    const message = this._compile();

    this._partialSign(message, ...uniqueSigners);

    this._verifySignatures(message.serialize(), true);
  }
  /**
   * Partially sign a transaction with the specified accounts. All accounts must
   * correspond to either the fee payer or a signer account in the transaction
   * instructions.
   *
   * All the caveats from the `sign` method apply to `partialSign`
   */


  partialSign(...signers) {
    if (signers.length === 0) {
      throw new Error('No signers');
    } // Dedupe signers


    const seen = new Set();
    const uniqueSigners = [];

    for (const signer of signers) {
      const key = signer.publicKey.toString();

      if (seen.has(key)) {
        continue;
      } else {
        seen.add(key);
        uniqueSigners.push(signer);
      }
    }

    const message = this._compile();

    this._partialSign(message, ...uniqueSigners);
  }
  /**
   * @internal
   */


  _partialSign(message, ...signers) {
    const signData = message.serialize();
    signers.forEach(signer => {
      const signature = nacl__default.sign.detached(signData, signer.secretKey);

      this._addSignature(signer.publicKey, toBuffer(signature));
    });
  }
  /**
   * Add an externally created signature to a transaction. The public key
   * must correspond to either the fee payer or a signer account in the transaction
   * instructions.
   */


  addSignature(pubkey, signature) {
    this._compile(); // Ensure signatures array is populated


    this._addSignature(pubkey, signature);
  }
  /**
   * @internal
   */


  _addSignature(pubkey, signature) {
    assert(signature.length === 64);
    const index = this.signatures.findIndex(sigpair => pubkey.equals(sigpair.publicKey));

    if (index < 0) {
      throw new Error(`unknown signer: ${pubkey.toString()}`);
    }

    this.signatures[index].signature = Buffer.from(signature);
  }
  /**
   * Verify signatures of a complete, signed Transaction
   */


  verifySignatures() {
    return this._verifySignatures(this.serializeMessage(), true);
  }
  /**
   * @internal
   */


  _verifySignatures(signData, requireAllSignatures) {
    for (const {
      signature,
      publicKey
    } of this.signatures) {
      if (signature === null) {
        if (requireAllSignatures) {
          return false;
        }
      } else {
        if (!nacl__default.sign.detached.verify(signData, signature, publicKey.toBuffer())) {
          return false;
        }
      }
    }

    return true;
  }
  /**
   * Serialize the Transaction in the wire format.
   */


  serialize(config) {
    const {
      requireAllSignatures,
      verifySignatures
    } = Object.assign({
      requireAllSignatures: true,
      verifySignatures: true
    }, config);
    const signData = this.serializeMessage();

    if (verifySignatures && !this._verifySignatures(signData, requireAllSignatures)) {
      throw new Error('Signature verification failed');
    }

    return this._serialize(signData);
  }
  /**
   * @internal
   */


  _serialize(signData) {
    const {
      signatures
    } = this;
    const signatureCount = [];
    encodeLength(signatureCount, signatures.length);
    const transactionLength = signatureCount.length + signatures.length * 64 + signData.length;
    const wireTransaction = Buffer.alloc(transactionLength);
    assert(signatures.length < 256);
    Buffer.from(signatureCount).copy(wireTransaction, 0);
    signatures.forEach(({
      signature
    }, index) => {
      if (signature !== null) {
        assert(signature.length === 64, `signature has invalid length`);
        Buffer.from(signature).copy(wireTransaction, signatureCount.length + index * 64);
      }
    });
    signData.copy(wireTransaction, signatureCount.length + signatures.length * 64);
    assert(wireTransaction.length <= PACKET_DATA_SIZE, `Transaction too large: ${wireTransaction.length} > ${PACKET_DATA_SIZE}`);
    return wireTransaction;
  }
  /**
   * Deprecated method
   * @internal
   */


  get keys() {
    assert(this.instructions.length === 1);
    return this.instructions[0].keys.map(keyObj => keyObj.pubkey);
  }
  /**
   * Deprecated method
   * @internal
   */


  get programId() {
    assert(this.instructions.length === 1);
    return this.instructions[0].programId;
  }
  /**
   * Deprecated method
   * @internal
   */


  get data() {
    assert(this.instructions.length === 1);
    return this.instructions[0].data;
  }
  /**
   * Parse a wire transaction into a Transaction object.
   */


  static from(buffer) {
    // Slice up wire data
    let byteArray = [...buffer];
    const signatureCount = decodeLength(byteArray);
    let signatures = [];

    for (let i = 0; i < signatureCount; i++) {
      const signature = byteArray.slice(0, SIGNATURE_LENGTH);
      byteArray = byteArray.slice(SIGNATURE_LENGTH);
      signatures.push(bs58.encode(Buffer.from(signature)));
    }

    return Transaction.populate(Message.from(byteArray), signatures);
  }
  /**
   * Populate Transaction object from message and signatures
   */


  static populate(message, signatures) {
    const transaction = new Transaction();
    transaction.recentBlockhash = message.recentBlockhash;

    if (message.header.numRequiredSignatures > 0) {
      transaction.feePayer = message.accountKeys[0];
    }

    signatures.forEach((signature, index) => {
      const sigPubkeyPair = {
        signature: signature == bs58.encode(DEFAULT_SIGNATURE) ? null : bs58.decode(signature),
        publicKey: message.accountKeys[index]
      };
      transaction.signatures.push(sigPubkeyPair);
    });
    message.instructions.forEach(instruction => {
      const keys = instruction.accounts.map(account => {
        const pubkey = message.accountKeys[account];
        return {
          pubkey,
          isSigner: transaction.signatures.some(keyObj => keyObj.publicKey.toString() === pubkey.toString()),
          isWritable: message.isAccountWritable(account)
        };
      });
      transaction.instructions.push(new TransactionInstruction({
        keys,
        programId: message.accountKeys[instruction.programIdIndex],
        data: bs58.decode(instruction.data)
      }));
    });
    return transaction;
  }

}

const SYSVAR_CLOCK_PUBKEY = new PublicKey('SysvarC1ock11111111111111111111111111111111');
const SYSVAR_RECENT_BLOCKHASHES_PUBKEY = new PublicKey('SysvarRecentB1ockHashes11111111111111111111');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
const SYSVAR_REWARDS_PUBKEY = new PublicKey('SysvarRewards111111111111111111111111111111');
const SYSVAR_STAKE_HISTORY_PUBKEY = new PublicKey('SysvarStakeHistory1111111111111111111111111');
const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey('Sysvar1nstructions1111111111111111111111111');

/**
 * Sign, send and confirm a transaction.
 *
 * If `commitment` option is not specified, defaults to 'max' commitment.
 *
 * @param {Connection} connection
 * @param {Transaction} transaction
 * @param {Array<Signer>} signers
 * @param {ConfirmOptions} [options]
 * @returns {Promise<TransactionSignature>}
 */
async function sendAndConfirmTransaction(connection, transaction, signers, options) {
  const sendOptions = options && {
    skipPreflight: options.skipPreflight,
    preflightCommitment: options.preflightCommitment || options.commitment
  };
  const signature = await connection.sendTransaction(transaction, signers, sendOptions);
  const status = (await connection.confirmTransaction(signature, options && options.commitment)).value;

  if (status.err) {
    throw new Error(`Transaction ${signature} failed (${JSON.stringify(status)})`);
  }

  return signature;
}

// zzz
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @internal
 */

/**
 * Populate a buffer of instruction data using an InstructionType
 * @internal
 */
function encodeData(type, fields) {
  const allocLength = type.layout.span >= 0 ? type.layout.span : getAlloc(type, fields);
  const data = Buffer.alloc(allocLength);
  const layoutFields = Object.assign({
    instruction: type.index
  }, fields);
  type.layout.encode(layoutFields, data);
  return data;
}
/**
 * Decode instruction data buffer using an InstructionType
 * @internal
 */

function decodeData(type, buffer) {
  let data;

  try {
    data = type.layout.decode(buffer);
  } catch (err) {
    throw new Error('invalid instruction; ' + err);
  }

  if (data.instruction !== type.index) {
    throw new Error(`invalid instruction; instruction index mismatch ${data.instruction} != ${type.index}`);
  }

  return data;
}

/**
 * https://github.com/solana-labs/solana/blob/90bedd7e067b5b8f3ddbb45da00a4e9cabb22c62/sdk/src/fee_calculator.rs#L7-L11
 *
 * @internal
 */

const FeeCalculatorLayout = BufferLayout.nu64('lamportsPerSignature');
/**
 * Calculator for transaction fees.
 */

/**
 * See https://github.com/solana-labs/solana/blob/0ea2843ec9cdc517572b8e62c959f41b55cf4453/sdk/src/nonce_state.rs#L29-L32
 *
 * @internal
 */

const NonceAccountLayout = BufferLayout.struct([BufferLayout.u32('version'), BufferLayout.u32('state'), publicKey('authorizedPubkey'), publicKey('nonce'), BufferLayout.struct([FeeCalculatorLayout], 'feeCalculator')]);
const NONCE_ACCOUNT_LENGTH = NonceAccountLayout.span;

/**
 * NonceAccount class
 */
class NonceAccount {
  /**
   * @internal
   */
  constructor(args) {
    _defineProperty(this, "authorizedPubkey", void 0);

    _defineProperty(this, "nonce", void 0);

    _defineProperty(this, "feeCalculator", void 0);

    this.authorizedPubkey = args.authorizedPubkey;
    this.nonce = args.nonce;
    this.feeCalculator = args.feeCalculator;
  }
  /**
   * Deserialize NonceAccount from the account data.
   *
   * @param buffer account data
   * @return NonceAccount
   */


  static fromAccountData(buffer) {
    const nonceAccount = NonceAccountLayout.decode(toBuffer(buffer), 0);
    return new NonceAccount({
      authorizedPubkey: new PublicKey(nonceAccount.authorizedPubkey),
      nonce: new PublicKey(nonceAccount.nonce).toString(),
      feeCalculator: nonceAccount.feeCalculator
    });
  }

}

/**
 * Create account system transaction params
 */

/**
 * System Instruction class
 */
class SystemInstruction {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Decode a system instruction and retrieve the instruction type.
   */


  static decodeInstructionType(instruction) {
    this.checkProgramId(instruction.programId);
    const instructionTypeLayout = BufferLayout.u32('instruction');
    const typeIndex = instructionTypeLayout.decode(instruction.data);
    let type;

    for (const [ixType, layout] of Object.entries(SYSTEM_INSTRUCTION_LAYOUTS)) {
      if (layout.index == typeIndex) {
        type = ixType;
        break;
      }
    }

    if (!type) {
      throw new Error('Instruction type incorrect; not a SystemInstruction');
    }

    return type;
  }
  /**
   * Decode a create account system instruction and retrieve the instruction params.
   */


  static decodeCreateAccount(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      lamports,
      space,
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Create, instruction.data);
    return {
      fromPubkey: instruction.keys[0].pubkey,
      newAccountPubkey: instruction.keys[1].pubkey,
      lamports,
      space,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode a transfer system instruction and retrieve the instruction params.
   */


  static decodeTransfer(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      lamports
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Transfer, instruction.data);
    return {
      fromPubkey: instruction.keys[0].pubkey,
      toPubkey: instruction.keys[1].pubkey,
      lamports
    };
  }
  /**
   * Decode a transfer with seed system instruction and retrieve the instruction params.
   */


  static decodeTransferWithSeed(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    const {
      lamports,
      seed,
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.TransferWithSeed, instruction.data);
    return {
      fromPubkey: instruction.keys[0].pubkey,
      basePubkey: instruction.keys[1].pubkey,
      toPubkey: instruction.keys[2].pubkey,
      lamports,
      seed,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode an allocate system instruction and retrieve the instruction params.
   */


  static decodeAllocate(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 1);
    const {
      space
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Allocate, instruction.data);
    return {
      accountPubkey: instruction.keys[0].pubkey,
      space
    };
  }
  /**
   * Decode an allocate with seed system instruction and retrieve the instruction params.
   */


  static decodeAllocateWithSeed(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 1);
    const {
      base,
      seed,
      space,
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AllocateWithSeed, instruction.data);
    return {
      accountPubkey: instruction.keys[0].pubkey,
      basePubkey: new PublicKey(base),
      seed,
      space,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode an assign system instruction and retrieve the instruction params.
   */


  static decodeAssign(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 1);
    const {
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Assign, instruction.data);
    return {
      accountPubkey: instruction.keys[0].pubkey,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode an assign with seed system instruction and retrieve the instruction params.
   */


  static decodeAssignWithSeed(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 1);
    const {
      base,
      seed,
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AssignWithSeed, instruction.data);
    return {
      accountPubkey: instruction.keys[0].pubkey,
      basePubkey: new PublicKey(base),
      seed,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode a create account with seed system instruction and retrieve the instruction params.
   */


  static decodeCreateWithSeed(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      base,
      seed,
      lamports,
      space,
      programId
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.CreateWithSeed, instruction.data);
    return {
      fromPubkey: instruction.keys[0].pubkey,
      newAccountPubkey: instruction.keys[1].pubkey,
      basePubkey: new PublicKey(base),
      seed,
      lamports,
      space,
      programId: new PublicKey(programId)
    };
  }
  /**
   * Decode a nonce initialize system instruction and retrieve the instruction params.
   */


  static decodeNonceInitialize(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    const {
      authorized
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.InitializeNonceAccount, instruction.data);
    return {
      noncePubkey: instruction.keys[0].pubkey,
      authorizedPubkey: new PublicKey(authorized)
    };
  }
  /**
   * Decode a nonce advance system instruction and retrieve the instruction params.
   */


  static decodeNonceAdvance(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AdvanceNonceAccount, instruction.data);
    return {
      noncePubkey: instruction.keys[0].pubkey,
      authorizedPubkey: instruction.keys[2].pubkey
    };
  }
  /**
   * Decode a nonce withdraw system instruction and retrieve the instruction params.
   */


  static decodeNonceWithdraw(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 5);
    const {
      lamports
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.WithdrawNonceAccount, instruction.data);
    return {
      noncePubkey: instruction.keys[0].pubkey,
      toPubkey: instruction.keys[1].pubkey,
      authorizedPubkey: instruction.keys[4].pubkey,
      lamports
    };
  }
  /**
   * Decode a nonce authorize system instruction and retrieve the instruction params.
   */


  static decodeNonceAuthorize(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      authorized
    } = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AuthorizeNonceAccount, instruction.data);
    return {
      noncePubkey: instruction.keys[0].pubkey,
      authorizedPubkey: instruction.keys[1].pubkey,
      newAuthorizedPubkey: new PublicKey(authorized)
    };
  }
  /**
   * @internal
   */


  static checkProgramId(programId) {
    if (!programId.equals(SystemProgram.programId)) {
      throw new Error('invalid instruction; programId is not SystemProgram');
    }
  }
  /**
   * @internal
   */


  static checkKeyLength(keys, expectedLength) {
    if (keys.length < expectedLength) {
      throw new Error(`invalid instruction; found ${keys.length} keys, expected at least ${expectedLength}`);
    }
  }

}
/**
 * An enumeration of valid SystemInstructionType's
 */

/**
 * An enumeration of valid system InstructionType's
 * @internal
 */
const SYSTEM_INSTRUCTION_LAYOUTS = Object.freeze({
  Create: {
    index: 0,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports'), BufferLayout.ns64('space'), publicKey('programId')])
  },
  Assign: {
    index: 1,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('programId')])
  },
  Transfer: {
    index: 2,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports')])
  },
  CreateWithSeed: {
    index: 3,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('base'), rustString('seed'), BufferLayout.ns64('lamports'), BufferLayout.ns64('space'), publicKey('programId')])
  },
  AdvanceNonceAccount: {
    index: 4,
    layout: BufferLayout.struct([BufferLayout.u32('instruction')])
  },
  WithdrawNonceAccount: {
    index: 5,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports')])
  },
  InitializeNonceAccount: {
    index: 6,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('authorized')])
  },
  AuthorizeNonceAccount: {
    index: 7,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('authorized')])
  },
  Allocate: {
    index: 8,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('space')])
  },
  AllocateWithSeed: {
    index: 9,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('base'), rustString('seed'), BufferLayout.ns64('space'), publicKey('programId')])
  },
  AssignWithSeed: {
    index: 10,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('base'), rustString('seed'), publicKey('programId')])
  },
  TransferWithSeed: {
    index: 11,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports'), rustString('seed'), publicKey('programId')])
  }
});
/**
 * Factory class for transactions to interact with the System program
 */

class SystemProgram {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Public key that identifies the System program
   */


  /**
   * Generate a transaction instruction that creates a new account
   */
  static createAccount(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.Create;
    const data = encodeData(type, {
      lamports: params.lamports,
      space: params.space,
      programId: toBuffer(params.programId.toBuffer())
    });
    return new TransactionInstruction({
      keys: [{
        pubkey: params.fromPubkey,
        isSigner: true,
        isWritable: true
      }, {
        pubkey: params.newAccountPubkey,
        isSigner: true,
        isWritable: true
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction instruction that transfers lamports from one account to another
   */


  static transfer(params) {
    let data;
    let keys;

    if ('basePubkey' in params) {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.TransferWithSeed;
      data = encodeData(type, {
        lamports: params.lamports,
        seed: params.seed,
        programId: toBuffer(params.programId.toBuffer())
      });
      keys = [{
        pubkey: params.fromPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.basePubkey,
        isSigner: true,
        isWritable: false
      }, {
        pubkey: params.toPubkey,
        isSigner: false,
        isWritable: true
      }];
    } else {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.Transfer;
      data = encodeData(type, {
        lamports: params.lamports
      });
      keys = [{
        pubkey: params.fromPubkey,
        isSigner: true,
        isWritable: true
      }, {
        pubkey: params.toPubkey,
        isSigner: false,
        isWritable: true
      }];
    }

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction instruction that assigns an account to a program
   */


  static assign(params) {
    let data;
    let keys;

    if ('basePubkey' in params) {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.AssignWithSeed;
      data = encodeData(type, {
        base: toBuffer(params.basePubkey.toBuffer()),
        seed: params.seed,
        programId: toBuffer(params.programId.toBuffer())
      });
      keys = [{
        pubkey: params.accountPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.basePubkey,
        isSigner: true,
        isWritable: false
      }];
    } else {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.Assign;
      data = encodeData(type, {
        programId: toBuffer(params.programId.toBuffer())
      });
      keys = [{
        pubkey: params.accountPubkey,
        isSigner: true,
        isWritable: true
      }];
    }

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction instruction that creates a new account at
   *   an address generated with `from`, a seed, and programId
   */


  static createAccountWithSeed(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.CreateWithSeed;
    const data = encodeData(type, {
      base: toBuffer(params.basePubkey.toBuffer()),
      seed: params.seed,
      lamports: params.lamports,
      space: params.space,
      programId: toBuffer(params.programId.toBuffer())
    });
    let keys = [{
      pubkey: params.fromPubkey,
      isSigner: true,
      isWritable: true
    }, {
      pubkey: params.newAccountPubkey,
      isSigner: false,
      isWritable: true
    }];

    if (params.basePubkey != params.fromPubkey) {
      keys.push({
        pubkey: params.basePubkey,
        isSigner: true,
        isWritable: false
      });
    }

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction that creates a new Nonce account
   */


  static createNonceAccount(params) {
    const transaction = new Transaction();

    if ('basePubkey' in params && 'seed' in params) {
      transaction.add(SystemProgram.createAccountWithSeed({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.noncePubkey,
        basePubkey: params.basePubkey,
        seed: params.seed,
        lamports: params.lamports,
        space: NONCE_ACCOUNT_LENGTH,
        programId: this.programId
      }));
    } else {
      transaction.add(SystemProgram.createAccount({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.noncePubkey,
        lamports: params.lamports,
        space: NONCE_ACCOUNT_LENGTH,
        programId: this.programId
      }));
    }

    const initParams = {
      noncePubkey: params.noncePubkey,
      authorizedPubkey: params.authorizedPubkey
    };
    transaction.add(this.nonceInitialize(initParams));
    return transaction;
  }
  /**
   * Generate an instruction to initialize a Nonce account
   */


  static nonceInitialize(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.InitializeNonceAccount;
    const data = encodeData(type, {
      authorized: toBuffer(params.authorizedPubkey.toBuffer())
    });
    const instructionData = {
      keys: [{
        pubkey: params.noncePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false
      }],
      programId: this.programId,
      data
    };
    return new TransactionInstruction(instructionData);
  }
  /**
   * Generate an instruction to advance the nonce in a Nonce account
   */


  static nonceAdvance(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.AdvanceNonceAccount;
    const data = encodeData(type);
    const instructionData = {
      keys: [{
        pubkey: params.noncePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: params.authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    };
    return new TransactionInstruction(instructionData);
  }
  /**
   * Generate a transaction instruction that withdraws lamports from a Nonce account
   */


  static nonceWithdraw(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.WithdrawNonceAccount;
    const data = encodeData(type, {
      lamports: params.lamports
    });
    return new TransactionInstruction({
      keys: [{
        pubkey: params.noncePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.toPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: params.authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction instruction that authorizes a new PublicKey as the authority
   * on a Nonce account.
   */


  static nonceAuthorize(params) {
    const type = SYSTEM_INSTRUCTION_LAYOUTS.AuthorizeNonceAccount;
    const data = encodeData(type, {
      authorized: toBuffer(params.newAuthorizedPubkey.toBuffer())
    });
    return new TransactionInstruction({
      keys: [{
        pubkey: params.noncePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a transaction instruction that allocates space in an account without funding
   */


  static allocate(params) {
    let data;
    let keys;

    if ('basePubkey' in params) {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.AllocateWithSeed;
      data = encodeData(type, {
        base: toBuffer(params.basePubkey.toBuffer()),
        seed: params.seed,
        space: params.space,
        programId: toBuffer(params.programId.toBuffer())
      });
      keys = [{
        pubkey: params.accountPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.basePubkey,
        isSigner: true,
        isWritable: false
      }];
    } else {
      const type = SYSTEM_INSTRUCTION_LAYOUTS.Allocate;
      data = encodeData(type, {
        space: params.space
      });
      keys = [{
        pubkey: params.accountPubkey,
        isSigner: true,
        isWritable: true
      }];
    }

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data
    });
  }

}

_defineProperty(SystemProgram, "programId", new PublicKey('11111111111111111111111111111111'));

// rest of the Transaction fields
//
// TODO: replace 300 with a proper constant for the size of the other
// Transaction fields

const CHUNK_SIZE = PACKET_DATA_SIZE - 300;
/**
 * Program loader interface
 */

class Loader {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Amount of program data placed in each load Transaction
   */


  /**
   * Minimum number of signatures required to load a program not including
   * retries
   *
   * Can be used to calculate transaction fees
   */
  static getMinNumSignatures(dataLength) {
    return 2 * (Math.ceil(dataLength / Loader.chunkSize) + 1 + // Add one for Create transaction
    1) // Add one for Finalize transaction
    ;
  }
  /**
   * Loads a generic program
   *
   * @param connection The connection to use
   * @param payer System account that pays to load the program
   * @param program Account to load the program into
   * @param programId Public key that identifies the loader
   * @param data Program octets
   * @return true if program was loaded successfully, false if program was already loaded
   */


  static async load(connection, payer, program, programId, data) {
    {
      const balanceNeeded = await connection.getMinimumBalanceForRentExemption(data.length); // Fetch program account info to check if it has already been created

      const programInfo = await connection.getAccountInfo(program.publicKey, 'confirmed');
      let transaction = null;

      if (programInfo !== null) {
        if (programInfo.executable) {
          console.error('Program load failed, account is already executable');
          return false;
        }

        if (programInfo.data.length !== data.length) {
          transaction = transaction || new Transaction();
          transaction.add(SystemProgram.allocate({
            accountPubkey: program.publicKey,
            space: data.length
          }));
        }

        if (!programInfo.owner.equals(programId)) {
          transaction = transaction || new Transaction();
          transaction.add(SystemProgram.assign({
            accountPubkey: program.publicKey,
            programId
          }));
        }

        if (programInfo.lamports < balanceNeeded) {
          transaction = transaction || new Transaction();
          transaction.add(SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: program.publicKey,
            lamports: balanceNeeded - programInfo.lamports
          }));
        }
      } else {
        transaction = new Transaction().add(SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: program.publicKey,
          lamports: balanceNeeded > 0 ? balanceNeeded : 1,
          space: data.length,
          programId
        }));
      } // If the account is already created correctly, skip this step
      // and proceed directly to loading instructions


      if (transaction !== null) {
        await sendAndConfirmTransaction(connection, transaction, [payer, program], {
          commitment: 'confirmed'
        });
      }
    }
    const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.u32('offset'), BufferLayout.u32('bytesLength'), BufferLayout.u32('bytesLengthPadding'), BufferLayout.seq(BufferLayout.u8('byte'), BufferLayout.offset(BufferLayout.u32(), -8), 'bytes')]);
    const chunkSize = Loader.chunkSize;
    let offset = 0;
    let array = data;
    let transactions = [];

    while (array.length > 0) {
      const bytes = array.slice(0, chunkSize);
      const data = Buffer.alloc(chunkSize + 16);
      dataLayout.encode({
        instruction: 0,
        // Load instruction
        offset,
        bytes
      }, data);
      const transaction = new Transaction().add({
        keys: [{
          pubkey: program.publicKey,
          isSigner: true,
          isWritable: true
        }],
        programId,
        data
      });
      transactions.push(sendAndConfirmTransaction(connection, transaction, [payer, program], {
        commitment: 'confirmed'
      })); // Delay between sends in an attempt to reduce rate limit errors

      if (connection._rpcEndpoint.includes('solana.com')) {
        const REQUESTS_PER_SECOND = 4;
        await sleep(1000 / REQUESTS_PER_SECOND);
      }

      offset += chunkSize;
      array = array.slice(chunkSize);
    }

    await Promise.all(transactions); // Finalize the account loaded with program data for execution

    {
      const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);
      const data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 1 // Finalize instruction

      }, data);
      const transaction = new Transaction().add({
        keys: [{
          pubkey: program.publicKey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }],
        programId,
        data
      });
      await sendAndConfirmTransaction(connection, transaction, [payer, program], {
        commitment: 'confirmed'
      });
    } // success

    return true;
  }

}

_defineProperty(Loader, "chunkSize", CHUNK_SIZE);

const BPF_LOADER_PROGRAM_ID = new PublicKey('BPFLoader2111111111111111111111111111111111');
/**
 * Factory class for transactions to interact with a program loader
 */

class BpfLoader {
  /**
   * Minimum number of signatures required to load a program not including
   * retries
   *
   * Can be used to calculate transaction fees
   */
  static getMinNumSignatures(dataLength) {
    return Loader.getMinNumSignatures(dataLength);
  }
  /**
   * Load a BPF program
   *
   * @param connection The connection to use
   * @param payer Account that will pay program loading fees
   * @param program Account to load the program into
   * @param elf The entire ELF containing the BPF program
   * @param loaderProgramId The program id of the BPF loader to use
   * @return true if program was loaded successfully, false if program was already loaded
   */


  static load(connection, payer, program, elf, loaderProgramId) {
    return Loader.load(connection, payer, program, loaderProgramId, elf);
  }

}

const DESTROY_TIMEOUT_MS = 3000;
class AgentManager {
  static _newAgent(useHttps) {
    const options = {
      keepAlive: true,
      maxSockets: 500
    };

    if (useHttps) {
      return new https.Agent(options);
    } else {
      return new http.Agent(options);
    }
  }

  constructor(useHttps) {
    _defineProperty(this, "_agent", void 0);

    _defineProperty(this, "_activeRequests", 0);

    _defineProperty(this, "_destroyTimeout", null);

    _defineProperty(this, "_useHttps", void 0);

    this._useHttps = useHttps === true;
    this._agent = AgentManager._newAgent(this._useHttps);
  }

  requestStart() {
    this._activeRequests++;

    if (this._destroyTimeout !== null) {
      clearTimeout(this._destroyTimeout);
      this._destroyTimeout = null;
    }

    return this._agent;
  }

  requestEnd() {
    this._activeRequests--;

    if (this._activeRequests === 0 && this._destroyTimeout === null) {
      this._destroyTimeout = setTimeout(() => {
        this._agent.destroy();

        this._agent = AgentManager._newAgent(this._useHttps);
      }, DESTROY_TIMEOUT_MS);
    }
  }

}

const MINIMUM_SLOT_PER_EPOCH = 32; // Returns the number of trailing zeros in the binary representation of self.

function trailingZeros(n) {
  let trailingZeros = 0;

  while (n > 1) {
    n /= 2;
    trailingZeros++;
  }

  return trailingZeros;
} // Returns the smallest power of two greater than or equal to n


function nextPowerOfTwo(n) {
  if (n === 0) return 1;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n |= n >> 32;
  return n + 1;
}
/**
 * Epoch schedule
 * (see https://docs.solana.com/terminology#epoch)
 * Can be retrieved with the {@link connection.getEpochSchedule} method
 */


class EpochSchedule {
  /** The maximum number of slots in each epoch */

  /** The number of slots before beginning of an epoch to calculate a leader schedule for that epoch */

  /** Indicates whether epochs start short and grow */

  /** The first epoch with `slotsPerEpoch` slots */

  /** The first slot of `firstNormalEpoch` */
  constructor(slotsPerEpoch, leaderScheduleSlotOffset, warmup, firstNormalEpoch, firstNormalSlot) {
    _defineProperty(this, "slotsPerEpoch", void 0);

    _defineProperty(this, "leaderScheduleSlotOffset", void 0);

    _defineProperty(this, "warmup", void 0);

    _defineProperty(this, "firstNormalEpoch", void 0);

    _defineProperty(this, "firstNormalSlot", void 0);

    this.slotsPerEpoch = slotsPerEpoch;
    this.leaderScheduleSlotOffset = leaderScheduleSlotOffset;
    this.warmup = warmup;
    this.firstNormalEpoch = firstNormalEpoch;
    this.firstNormalSlot = firstNormalSlot;
  }

  getEpoch(slot) {
    return this.getEpochAndSlotIndex(slot)[0];
  }

  getEpochAndSlotIndex(slot) {
    if (slot < this.firstNormalSlot) {
      const epoch = trailingZeros(nextPowerOfTwo(slot + MINIMUM_SLOT_PER_EPOCH + 1)) - trailingZeros(MINIMUM_SLOT_PER_EPOCH) - 1;
      const epochLen = this.getSlotsInEpoch(epoch);
      const slotIndex = slot - (epochLen - MINIMUM_SLOT_PER_EPOCH);
      return [epoch, slotIndex];
    } else {
      const normalSlotIndex = slot - this.firstNormalSlot;
      const normalEpochIndex = Math.floor(normalSlotIndex / this.slotsPerEpoch);
      const epoch = this.firstNormalEpoch + normalEpochIndex;
      const slotIndex = normalSlotIndex % this.slotsPerEpoch;
      return [epoch, slotIndex];
    }
  }

  getFirstSlotInEpoch(epoch) {
    if (epoch <= this.firstNormalEpoch) {
      return (Math.pow(2, epoch) - 1) * MINIMUM_SLOT_PER_EPOCH;
    } else {
      return (epoch - this.firstNormalEpoch) * this.slotsPerEpoch + this.firstNormalSlot;
    }
  }

  getLastSlotInEpoch(epoch) {
    return this.getFirstSlotInEpoch(epoch) + this.getSlotsInEpoch(epoch) - 1;
  }

  getSlotsInEpoch(epoch) {
    if (epoch < this.firstNormalEpoch) {
      return Math.pow(2, epoch + trailingZeros(MINIMUM_SLOT_PER_EPOCH));
    } else {
      return this.slotsPerEpoch;
    }
  }

}

class SendTransactionError extends Error {
  constructor(message, logs) {
    super(message);

    _defineProperty(this, "logs", void 0);

    this.logs = logs;
  }

}

// TODO: These constants should be removed in favor of reading them out of a
// Syscall account

/**
 * @internal
 */
const NUM_TICKS_PER_SECOND = 160;
/**
 * @internal
 */

const DEFAULT_TICKS_PER_SLOT = 64;
/**
 * @internal
 */

const NUM_SLOTS_PER_SECOND = NUM_TICKS_PER_SECOND / DEFAULT_TICKS_PER_SLOT;
/**
 * @internal
 */

const MS_PER_SLOT = 1000 / NUM_SLOTS_PER_SECOND;

function promiseTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).then(result => {
    clearTimeout(timeoutId);
    return result;
  });
}

function makeWebsocketUrl(endpoint) {
  let url = new URL(endpoint);
  const useHttps = url.protocol === 'https:';
  url.protocol = useHttps ? 'wss:' : 'ws:';
  url.host = ''; // Only shift the port by +1 as a convention for ws(s) only if given endpoint
  // is explictly specifying the endpoint port (HTTP-based RPC), assuming
  // we're directly trying to connect to solana-validator's ws listening port.
  // When the endpoint omits the port, we're connecting to the protocol
  // default ports: http(80) or https(443) and it's assumed we're behind a reverse
  // proxy which manages WebSocket upgrade and backend port redirection.

  if (url.port !== '') {
    url.port = String(Number(url.port) + 1);
  }

  return url.toString();
}

const PublicKeyFromString = coerce(instance(PublicKey), string(), value => new PublicKey(value));
const RawAccountDataResult = tuple([string(), literal('base64')]);
const BufferFromRawAccountData = coerce(instance(Buffer), RawAccountDataResult, value => Buffer.from(value[0], 'base64'));
/**
 * Attempt to use a recent blockhash for up to 30 seconds
 * @internal
 */

const BLOCKHASH_CACHE_TIMEOUT_MS = 30 * 1000;

/**
 * @internal
 */
function createRpcResult(result) {
  return union([type({
    jsonrpc: literal('2.0'),
    id: string(),
    result
  }), type({
    jsonrpc: literal('2.0'),
    id: string(),
    error: type({
      code: unknown(),
      message: string(),
      data: optional(any())
    })
  })]);
}

const UnknownRpcResult = createRpcResult(unknown());
/**
 * @internal
 */

function jsonRpcResult(schema) {
  return coerce(createRpcResult(schema), UnknownRpcResult, value => {
    if ('error' in value) {
      return value;
    } else {
      return { ...value,
        result: create(value.result, schema)
      };
    }
  });
}
/**
 * @internal
 */


function jsonRpcResultAndContext(value) {
  return jsonRpcResult(type({
    context: type({
      slot: number()
    }),
    value
  }));
}
/**
 * @internal
 */


function notificationResultAndContext(value) {
  return type({
    context: type({
      slot: number()
    }),
    value
  });
}
/**
 * The level of commitment desired when querying state
 * <pre>
 *   'processed': Query the most recent block which has reached 1 confirmation by the connected node
 *   'confirmed': Query the most recent block which has reached 1 confirmation by the cluster
 *   'finalized': Query the most recent block which has been finalized by the cluster
 * </pre>
 */


const GetInflationGovernorResult = type({
  foundation: number(),
  foundationTerm: number(),
  initial: number(),
  taper: number(),
  terminal: number()
});
/**
 * The inflation reward for an epoch
 */

/**
 * Expected JSON RPC response for the "getInflationReward" message
 */
const GetInflationRewardResult = jsonRpcResult(array(nullable(type({
  epoch: number(),
  effectiveSlot: number(),
  amount: number(),
  postBalance: number()
}))));
/**
 * Information about the current epoch
 */

const GetEpochInfoResult = type({
  epoch: number(),
  slotIndex: number(),
  slotsInEpoch: number(),
  absoluteSlot: number(),
  blockHeight: optional(number()),
  transactionCount: optional(number())
});
const GetEpochScheduleResult = type({
  slotsPerEpoch: number(),
  leaderScheduleSlotOffset: number(),
  warmup: boolean(),
  firstNormalEpoch: number(),
  firstNormalSlot: number()
});
/**
 * Leader schedule
 * (see https://docs.solana.com/terminology#leader-schedule)
 */

const GetLeaderScheduleResult = record(string(), array(number()));
/**
 * Transaction error or null
 */

const TransactionErrorResult = nullable(union([type({}), string()]));
/**
 * Signature status for a transaction
 */

const SignatureStatusResult = type({
  err: TransactionErrorResult
});
/**
 * Transaction signature received notification
 */

const SignatureReceivedResult = literal('receivedSignature');
/**
 * Version info for a node
 */

const VersionResult = type({
  'solana-core': string(),
  'feature-set': optional(number())
});
const SimulatedTransactionResponseStruct = jsonRpcResultAndContext(type({
  err: nullable(union([type({}), string()])),
  logs: nullable(array(string()))
}));

function createRpcClient(url, useHttps, httpHeaders, fetchMiddleware, disableRetryOnRateLimit) {
  let agentManager;

  {
    agentManager = new AgentManager(useHttps);
  }

  let fetchWithMiddleware;

  if (fetchMiddleware) {
    fetchWithMiddleware = (url, options) => {
      return new Promise((resolve, reject) => {
        fetchMiddleware(url, options, async (url, options) => {
          try {
            resolve(await fetch(url, options));
          } catch (error) {
            reject(error);
          }
        });
      });
    };
  }

  const clientBrowser = new RpcClient(async (request, callback) => {
    const agent = agentManager ? agentManager.requestStart() : undefined;
    const options = {
      method: 'POST',
      body: request,
      agent,
      headers: Object.assign({
        'Content-Type': 'application/json'
      }, httpHeaders || {})
    };

    try {
      let too_many_requests_retries = 5;
      let res;
      let waitTime = 500;

      for (;;) {
        if (fetchWithMiddleware) {
          res = await fetchWithMiddleware(url, options);
        } else {
          res = await fetch(url, options);
        }

        if (res.status !== 429
        /* Too many requests */
        ) {
          break;
        }

        if (disableRetryOnRateLimit === true) {
          break;
        }

        too_many_requests_retries -= 1;

        if (too_many_requests_retries === 0) {
          break;
        }

        console.log(`Server responded with ${res.status} ${res.statusText}.  Retrying after ${waitTime}ms delay...`);
        await sleep(waitTime);
        waitTime *= 2;
      }

      const text = await res.text();

      if (res.ok) {
        callback(null, text);
      } else {
        callback(new Error(`${res.status} ${res.statusText}: ${text}`));
      }
    } catch (err) {
      // @ts-ignore
      callback(err);
    } finally {
      agentManager && agentManager.requestEnd();
    }
  }, {});
  return clientBrowser;
}

function createRpcRequest(client) {
  return (method, args) => {
    return new Promise((resolve, reject) => {
      client.request(method, args, (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(response);
      });
    });
  };
}

function createRpcBatchRequest(client) {
  return requests => {
    return new Promise((resolve, reject) => {
      // Do nothing if requests is empty
      if (requests.length === 0) resolve([]);
      const batch = requests.map(params => {
        return client.request(params.methodName, params.args);
      });
      client.request(batch, (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(response);
      });
    });
  };
}
/**
 * Expected JSON RPC response for the "getInflationGovernor" message
 */


const GetInflationGovernorRpcResult = jsonRpcResult(GetInflationGovernorResult);
/**
 * Expected JSON RPC response for the "getEpochInfo" message
 */

const GetEpochInfoRpcResult = jsonRpcResult(GetEpochInfoResult);
/**
 * Expected JSON RPC response for the "getEpochSchedule" message
 */

const GetEpochScheduleRpcResult = jsonRpcResult(GetEpochScheduleResult);
/**
 * Expected JSON RPC response for the "getLeaderSchedule" message
 */

const GetLeaderScheduleRpcResult = jsonRpcResult(GetLeaderScheduleResult);
/**
 * Expected JSON RPC response for the "minimumLedgerSlot" and "getFirstAvailableBlock" messages
 */

const SlotRpcResult = jsonRpcResult(number());
/**
 * Supply
 */

/**
 * Expected JSON RPC response for the "getSupply" message
 */
const GetSupplyRpcResult = jsonRpcResultAndContext(type({
  total: number(),
  circulating: number(),
  nonCirculating: number(),
  nonCirculatingAccounts: array(PublicKeyFromString)
}));
/**
 * Token amount object which returns a token amount in different formats
 * for various client use cases.
 */

/**
 * Expected JSON RPC structure for token amounts
 */
const TokenAmountResult = type({
  amount: string(),
  uiAmount: nullable(number()),
  decimals: number(),
  uiAmountString: optional(string())
});
/**
 * Token address and balance.
 */

/**
 * Expected JSON RPC response for the "getTokenLargestAccounts" message
 */
const GetTokenLargestAccountsResult = jsonRpcResultAndContext(array(type({
  address: PublicKeyFromString,
  amount: string(),
  uiAmount: nullable(number()),
  decimals: number(),
  uiAmountString: optional(string())
})));
/**
 * Expected JSON RPC response for the "getTokenAccountsByOwner" message
 */

const GetTokenAccountsByOwner = jsonRpcResultAndContext(array(type({
  pubkey: PublicKeyFromString,
  account: type({
    executable: boolean(),
    owner: PublicKeyFromString,
    lamports: number(),
    data: BufferFromRawAccountData,
    rentEpoch: number()
  })
})));
const ParsedAccountDataResult = type({
  program: string(),
  parsed: unknown(),
  space: number()
});
/**
 * Expected JSON RPC response for the "getTokenAccountsByOwner" message with parsed data
 */

const GetParsedTokenAccountsByOwner = jsonRpcResultAndContext(array(type({
  pubkey: PublicKeyFromString,
  account: type({
    executable: boolean(),
    owner: PublicKeyFromString,
    lamports: number(),
    data: ParsedAccountDataResult,
    rentEpoch: number()
  })
})));
/**
 * Pair of an account address and its balance
 */

/**
 * Expected JSON RPC response for the "getLargestAccounts" message
 */
const GetLargestAccountsRpcResult = jsonRpcResultAndContext(array(type({
  lamports: number(),
  address: PublicKeyFromString
})));
/**
 * @internal
 */

const AccountInfoResult = type({
  executable: boolean(),
  owner: PublicKeyFromString,
  lamports: number(),
  data: BufferFromRawAccountData,
  rentEpoch: number()
});
/**
 * @internal
 */

const KeyedAccountInfoResult = type({
  pubkey: PublicKeyFromString,
  account: AccountInfoResult
});
const ParsedOrRawAccountData = coerce(union([instance(Buffer), ParsedAccountDataResult]), union([RawAccountDataResult, ParsedAccountDataResult]), value => {
  if (Array.isArray(value)) {
    return create(value, BufferFromRawAccountData);
  } else {
    return value;
  }
});
/**
 * @internal
 */

const ParsedAccountInfoResult = type({
  executable: boolean(),
  owner: PublicKeyFromString,
  lamports: number(),
  data: ParsedOrRawAccountData,
  rentEpoch: number()
});
const KeyedParsedAccountInfoResult = type({
  pubkey: PublicKeyFromString,
  account: ParsedAccountInfoResult
});
/**
 * @internal
 */

const StakeActivationResult = type({
  state: union([literal('active'), literal('inactive'), literal('activating'), literal('deactivating')]),
  active: number(),
  inactive: number()
});
/**
 * Expected JSON RPC response for the "getConfirmedSignaturesForAddress2" message
 */

const GetConfirmedSignaturesForAddress2RpcResult = jsonRpcResult(array(type({
  signature: string(),
  slot: number(),
  err: TransactionErrorResult,
  memo: nullable(string()),
  blockTime: optional(nullable(number()))
})));
/**
 * Expected JSON RPC response for the "getSignaturesForAddress" message
 */

const GetSignaturesForAddressRpcResult = jsonRpcResult(array(type({
  signature: string(),
  slot: number(),
  err: TransactionErrorResult,
  memo: nullable(string()),
  blockTime: optional(nullable(number()))
})));
/***
 * Expected JSON RPC response for the "accountNotification" message
 */

const AccountNotificationResult = type({
  subscription: number(),
  result: notificationResultAndContext(AccountInfoResult)
});
/**
 * @internal
 */

const ProgramAccountInfoResult = type({
  pubkey: PublicKeyFromString,
  account: AccountInfoResult
});
/***
 * Expected JSON RPC response for the "programNotification" message
 */

const ProgramAccountNotificationResult = type({
  subscription: number(),
  result: notificationResultAndContext(ProgramAccountInfoResult)
});
/**
 * @internal
 */

const SlotInfoResult = type({
  parent: number(),
  slot: number(),
  root: number()
});
/**
 * Expected JSON RPC response for the "slotNotification" message
 */

const SlotNotificationResult = type({
  subscription: number(),
  result: SlotInfoResult
});
/**
 * Slot updates which can be used for tracking the live progress of a cluster.
 * - `"firstShredReceived"`: connected node received the first shred of a block.
 * Indicates that a new block that is being produced.
 * - `"completed"`: connected node has received all shreds of a block. Indicates
 * a block was recently produced.
 * - `"optimisticConfirmation"`: block was optimistically confirmed by the
 * cluster. It is not guaranteed that an optimistic confirmation notification
 * will be sent for every finalized blocks.
 * - `"root"`: the connected node rooted this block.
 * - `"createdBank"`: the connected node has started validating this block.
 * - `"frozen"`: the connected node has validated this block.
 * - `"dead"`: the connected node failed to validate this block.
 */

/**
 * @internal
 */
const SlotUpdateResult = union([type({
  type: union([literal('firstShredReceived'), literal('completed'), literal('optimisticConfirmation'), literal('root')]),
  slot: number(),
  timestamp: number()
}), type({
  type: literal('createdBank'),
  parent: number(),
  slot: number(),
  timestamp: number()
}), type({
  type: literal('frozen'),
  slot: number(),
  timestamp: number(),
  stats: type({
    numTransactionEntries: number(),
    numSuccessfulTransactions: number(),
    numFailedTransactions: number(),
    maxTransactionsPerEntry: number()
  })
}), type({
  type: literal('dead'),
  slot: number(),
  timestamp: number(),
  err: string()
})]);
/**
 * Expected JSON RPC response for the "slotsUpdatesNotification" message
 */

const SlotUpdateNotificationResult = type({
  subscription: number(),
  result: SlotUpdateResult
});
/**
 * Expected JSON RPC response for the "signatureNotification" message
 */

const SignatureNotificationResult = type({
  subscription: number(),
  result: notificationResultAndContext(union([SignatureStatusResult, SignatureReceivedResult]))
});
/**
 * Expected JSON RPC response for the "rootNotification" message
 */

const RootNotificationResult = type({
  subscription: number(),
  result: number()
});
const ContactInfoResult = type({
  pubkey: string(),
  gossip: nullable(string()),
  tpu: nullable(string()),
  rpc: nullable(string()),
  version: nullable(string())
});
const VoteAccountInfoResult = type({
  votePubkey: string(),
  nodePubkey: string(),
  activatedStake: number(),
  epochVoteAccount: boolean(),
  epochCredits: array(tuple([number(), number(), number()])),
  commission: number(),
  lastVote: number(),
  rootSlot: nullable(number())
});
/**
 * Expected JSON RPC response for the "getVoteAccounts" message
 */

const GetVoteAccounts = jsonRpcResult(type({
  current: array(VoteAccountInfoResult),
  delinquent: array(VoteAccountInfoResult)
}));
const ConfirmationStatus = union([literal('processed'), literal('confirmed'), literal('finalized')]);
const SignatureStatusResponse = type({
  slot: number(),
  confirmations: nullable(number()),
  err: TransactionErrorResult,
  confirmationStatus: optional(ConfirmationStatus)
});
/**
 * Expected JSON RPC response for the "getSignatureStatuses" message
 */

const GetSignatureStatusesRpcResult = jsonRpcResultAndContext(array(nullable(SignatureStatusResponse)));
/**
 * Expected JSON RPC response for the "getMinimumBalanceForRentExemption" message
 */

const GetMinimumBalanceForRentExemptionRpcResult = jsonRpcResult(number());
const ConfirmedTransactionResult = type({
  signatures: array(string()),
  message: type({
    accountKeys: array(string()),
    header: type({
      numRequiredSignatures: number(),
      numReadonlySignedAccounts: number(),
      numReadonlyUnsignedAccounts: number()
    }),
    instructions: array(type({
      accounts: array(number()),
      data: string(),
      programIdIndex: number()
    })),
    recentBlockhash: string()
  })
});
const ParsedInstructionResult = type({
  parsed: unknown(),
  program: string(),
  programId: PublicKeyFromString
});
const RawInstructionResult = type({
  accounts: array(PublicKeyFromString),
  data: string(),
  programId: PublicKeyFromString
});
const InstructionResult = union([RawInstructionResult, ParsedInstructionResult]);
const UnknownInstructionResult = union([type({
  parsed: unknown(),
  program: string(),
  programId: string()
}), type({
  accounts: array(string()),
  data: string(),
  programId: string()
})]);
const ParsedOrRawInstruction = coerce(InstructionResult, UnknownInstructionResult, value => {
  if ('accounts' in value) {
    return create(value, RawInstructionResult);
  } else {
    return create(value, ParsedInstructionResult);
  }
});
/**
 * @internal
 */

const ParsedConfirmedTransactionResult = type({
  signatures: array(string()),
  message: type({
    accountKeys: array(type({
      pubkey: PublicKeyFromString,
      signer: boolean(),
      writable: boolean()
    })),
    instructions: array(ParsedOrRawInstruction),
    recentBlockhash: string()
  })
});
const TokenBalanceResult = type({
  accountIndex: number(),
  mint: string(),
  uiTokenAmount: TokenAmountResult
});
/**
 * @internal
 */

const ConfirmedTransactionMetaResult = type({
  err: TransactionErrorResult,
  fee: number(),
  innerInstructions: optional(nullable(array(type({
    index: number(),
    instructions: array(type({
      accounts: array(number()),
      data: string(),
      programIdIndex: number()
    }))
  })))),
  preBalances: array(number()),
  postBalances: array(number()),
  logMessages: optional(nullable(array(string()))),
  preTokenBalances: optional(nullable(array(TokenBalanceResult))),
  postTokenBalances: optional(nullable(array(TokenBalanceResult)))
});
/**
 * @internal
 */

const ParsedConfirmedTransactionMetaResult = type({
  err: TransactionErrorResult,
  fee: number(),
  innerInstructions: optional(nullable(array(type({
    index: number(),
    instructions: array(ParsedOrRawInstruction)
  })))),
  preBalances: array(number()),
  postBalances: array(number()),
  logMessages: optional(nullable(array(string()))),
  preTokenBalances: optional(nullable(array(TokenBalanceResult))),
  postTokenBalances: optional(nullable(array(TokenBalanceResult)))
});
/**
 * Expected JSON RPC response for the "getConfirmedBlock" message
 */

const GetConfirmedBlockRpcResult = jsonRpcResult(nullable(type({
  blockhash: string(),
  previousBlockhash: string(),
  parentSlot: number(),
  transactions: array(type({
    transaction: ConfirmedTransactionResult,
    meta: nullable(ConfirmedTransactionMetaResult)
  })),
  rewards: optional(array(type({
    pubkey: string(),
    lamports: number(),
    postBalance: nullable(number()),
    rewardType: nullable(string())
  }))),
  blockTime: nullable(number())
})));
/**
 * Expected JSON RPC response for the "getConfirmedBlockSignatures" message
 */

const GetConfirmedBlockSignaturesRpcResult = jsonRpcResult(nullable(type({
  blockhash: string(),
  previousBlockhash: string(),
  parentSlot: number(),
  signatures: array(string()),
  blockTime: nullable(number())
})));
/**
 * Expected JSON RPC response for the "getConfirmedTransaction" message
 */

const GetConfirmedTransactionRpcResult = jsonRpcResult(nullable(type({
  slot: number(),
  meta: ConfirmedTransactionMetaResult,
  blockTime: optional(nullable(number())),
  transaction: ConfirmedTransactionResult
})));
/**
 * Expected JSON RPC response for the "getConfirmedTransaction" message
 */

const GetParsedConfirmedTransactionRpcResult = jsonRpcResult(nullable(type({
  slot: number(),
  transaction: ParsedConfirmedTransactionResult,
  meta: nullable(ParsedConfirmedTransactionMetaResult),
  blockTime: optional(nullable(number()))
})));
/**
 * Expected JSON RPC response for the "getRecentBlockhash" message
 */

const GetRecentBlockhashAndContextRpcResult = jsonRpcResultAndContext(type({
  blockhash: string(),
  feeCalculator: type({
    lamportsPerSignature: number()
  })
}));
const PerfSampleResult = type({
  slot: number(),
  numTransactions: number(),
  numSlots: number(),
  samplePeriodSecs: number()
});
/*
 * Expected JSON RPC response for "getRecentPerformanceSamples" message
 */

const GetRecentPerformanceSamplesRpcResult = jsonRpcResult(array(PerfSampleResult));
/**
 * Expected JSON RPC response for the "getFeeCalculatorForBlockhash" message
 */

const GetFeeCalculatorRpcResult = jsonRpcResultAndContext(nullable(type({
  feeCalculator: type({
    lamportsPerSignature: number()
  })
})));
/**
 * Expected JSON RPC response for the "requestAirdrop" message
 */

const RequestAirdropRpcResult = jsonRpcResult(string());
/**
 * Expected JSON RPC response for the "sendTransaction" message
 */

const SendTransactionRpcResult = jsonRpcResult(string());
/**
 * Information about the latest slot being processed by a node
 */

/**
 * @internal
 */
const LogsResult = type({
  err: TransactionErrorResult,
  logs: array(string()),
  signature: string()
});
/**
 * Logs result.
 */

/**
 * Expected JSON RPC response for the "logsNotification" message.
 */
const LogsNotificationResult = type({
  result: notificationResultAndContext(LogsResult),
  subscription: number()
});
/**
 * Filter for log subscriptions.
 */

/**
 * A connection to a fullnode JSON RPC endpoint
 */
class Connection {
  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /** @internal */

  /**
   * Establish a JSON RPC connection
   *
   * @param endpoint URL to the fullnode JSON RPC endpoint
   * @param commitmentOrConfig optional default commitment level or optional ConnectionConfig configuration object
   */
  constructor(endpoint, commitmentOrConfig) {
    _defineProperty(this, "_commitment", void 0);

    _defineProperty(this, "_rpcEndpoint", void 0);

    _defineProperty(this, "_rpcWsEndpoint", void 0);

    _defineProperty(this, "_rpcClient", void 0);

    _defineProperty(this, "_rpcRequest", void 0);

    _defineProperty(this, "_rpcBatchRequest", void 0);

    _defineProperty(this, "_rpcWebSocket", void 0);

    _defineProperty(this, "_rpcWebSocketConnected", false);

    _defineProperty(this, "_rpcWebSocketHeartbeat", null);

    _defineProperty(this, "_rpcWebSocketIdleTimeout", null);

    _defineProperty(this, "_disableBlockhashCaching", false);

    _defineProperty(this, "_pollingBlockhash", false);

    _defineProperty(this, "_blockhashInfo", {
      recentBlockhash: null,
      lastFetch: 0,
      transactionSignatures: [],
      simulatedSignatures: []
    });

    _defineProperty(this, "_accountChangeSubscriptionCounter", 0);

    _defineProperty(this, "_accountChangeSubscriptions", {});

    _defineProperty(this, "_programAccountChangeSubscriptionCounter", 0);

    _defineProperty(this, "_programAccountChangeSubscriptions", {});

    _defineProperty(this, "_rootSubscriptionCounter", 0);

    _defineProperty(this, "_rootSubscriptions", {});

    _defineProperty(this, "_signatureSubscriptionCounter", 0);

    _defineProperty(this, "_signatureSubscriptions", {});

    _defineProperty(this, "_slotSubscriptionCounter", 0);

    _defineProperty(this, "_slotSubscriptions", {});

    _defineProperty(this, "_logsSubscriptionCounter", 0);

    _defineProperty(this, "_logsSubscriptions", {});

    _defineProperty(this, "_slotUpdateSubscriptionCounter", 0);

    _defineProperty(this, "_slotUpdateSubscriptions", {});

    let url = new URL(endpoint);
    const useHttps = url.protocol === 'https:';
    let wsEndpoint;
    let httpHeaders;
    let fetchMiddleware;
    let disableRetryOnRateLimit;

    if (commitmentOrConfig && typeof commitmentOrConfig === 'string') {
      this._commitment = commitmentOrConfig;
    } else if (commitmentOrConfig) {
      this._commitment = commitmentOrConfig.commitment;
      wsEndpoint = commitmentOrConfig.wsEndpoint;
      httpHeaders = commitmentOrConfig.httpHeaders;
      fetchMiddleware = commitmentOrConfig.fetchMiddleware;
      disableRetryOnRateLimit = commitmentOrConfig.disableRetryOnRateLimit;
    }

    this._rpcEndpoint = endpoint;
    this._rpcWsEndpoint = wsEndpoint || makeWebsocketUrl(endpoint);
    this._rpcClient = createRpcClient(url.toString(), useHttps, httpHeaders, fetchMiddleware, disableRetryOnRateLimit);
    this._rpcRequest = createRpcRequest(this._rpcClient);
    this._rpcBatchRequest = createRpcBatchRequest(this._rpcClient);
    this._rpcWebSocket = new Client(this._rpcWsEndpoint, {
      autoconnect: false,
      max_reconnects: Infinity
    });

    this._rpcWebSocket.on('open', this._wsOnOpen.bind(this));

    this._rpcWebSocket.on('error', this._wsOnError.bind(this));

    this._rpcWebSocket.on('close', this._wsOnClose.bind(this));

    this._rpcWebSocket.on('accountNotification', this._wsOnAccountNotification.bind(this));

    this._rpcWebSocket.on('programNotification', this._wsOnProgramAccountNotification.bind(this));

    this._rpcWebSocket.on('slotNotification', this._wsOnSlotNotification.bind(this));

    this._rpcWebSocket.on('slotsUpdatesNotification', this._wsOnSlotUpdatesNotification.bind(this));

    this._rpcWebSocket.on('signatureNotification', this._wsOnSignatureNotification.bind(this));

    this._rpcWebSocket.on('rootNotification', this._wsOnRootNotification.bind(this));

    this._rpcWebSocket.on('logsNotification', this._wsOnLogsNotification.bind(this));
  }
  /**
   * The default commitment used for requests
   */


  get commitment() {
    return this._commitment;
  }
  /**
   * Fetch the balance for the specified public key, return with context
   */


  async getBalanceAndContext(publicKey, commitment) {
    const args = this._buildArgs([publicKey.toBase58()], commitment);

    const unsafeRes = await this._rpcRequest('getBalance', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(number()));

    if ('error' in res) {
      throw new Error('failed to get balance for ' + publicKey.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the balance for the specified public key
   */


  async getBalance(publicKey, commitment) {
    return await this.getBalanceAndContext(publicKey, commitment).then(x => x.value).catch(e => {
      throw new Error('failed to get balance of account ' + publicKey.toBase58() + ': ' + e);
    });
  }
  /**
   * Fetch the estimated production time of a block
   */


  async getBlockTime(slot) {
    const unsafeRes = await this._rpcRequest('getBlockTime', [slot]);
    const res = create(unsafeRes, jsonRpcResult(nullable(number())));

    if ('error' in res) {
      throw new Error('failed to get block time for slot ' + slot + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the lowest slot that the node has information about in its ledger.
   * This value may increase over time if the node is configured to purge older ledger data
   */


  async getMinimumLedgerSlot() {
    const unsafeRes = await this._rpcRequest('minimumLedgerSlot', []);
    const res = create(unsafeRes, jsonRpcResult(number()));

    if ('error' in res) {
      throw new Error('failed to get minimum ledger slot: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the slot of the lowest confirmed block that has not been purged from the ledger
   */


  async getFirstAvailableBlock() {
    const unsafeRes = await this._rpcRequest('getFirstAvailableBlock', []);
    const res = create(unsafeRes, SlotRpcResult);

    if ('error' in res) {
      throw new Error('failed to get first available block: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch information about the current supply
   */


  async getSupply(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getSupply', args);
    const res = create(unsafeRes, GetSupplyRpcResult);

    if ('error' in res) {
      throw new Error('failed to get supply: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current supply of a token mint
   */


  async getTokenSupply(tokenMintAddress, commitment) {
    const args = this._buildArgs([tokenMintAddress.toBase58()], commitment);

    const unsafeRes = await this._rpcRequest('getTokenSupply', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(TokenAmountResult));

    if ('error' in res) {
      throw new Error('failed to get token supply: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current balance of a token account
   */


  async getTokenAccountBalance(tokenAddress, commitment) {
    const args = this._buildArgs([tokenAddress.toBase58()], commitment);

    const unsafeRes = await this._rpcRequest('getTokenAccountBalance', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(TokenAmountResult));

    if ('error' in res) {
      throw new Error('failed to get token account balance: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch all the token accounts owned by the specified account
   *
   * @return {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>>}
   */


  async getTokenAccountsByOwner(ownerAddress, filter, commitment) {
    let _args = [ownerAddress.toBase58()];

    if ('mint' in filter) {
      _args.push({
        mint: filter.mint.toBase58()
      });
    } else {
      _args.push({
        programId: filter.programId.toBase58()
      });
    }

    const args = this._buildArgs(_args, commitment, 'base64');

    const unsafeRes = await this._rpcRequest('getTokenAccountsByOwner', args);
    const res = create(unsafeRes, GetTokenAccountsByOwner);

    if ('error' in res) {
      throw new Error('failed to get token accounts owned by account ' + ownerAddress.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch parsed token accounts owned by the specified account
   *
   * @return {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey, account: AccountInfo<ParsedAccountData>}>>>}
   */


  async getParsedTokenAccountsByOwner(ownerAddress, filter, commitment) {
    let _args = [ownerAddress.toBase58()];

    if ('mint' in filter) {
      _args.push({
        mint: filter.mint.toBase58()
      });
    } else {
      _args.push({
        programId: filter.programId.toBase58()
      });
    }

    const args = this._buildArgs(_args, commitment, 'jsonParsed');

    const unsafeRes = await this._rpcRequest('getTokenAccountsByOwner', args);
    const res = create(unsafeRes, GetParsedTokenAccountsByOwner);

    if ('error' in res) {
      throw new Error('failed to get token accounts owned by account ' + ownerAddress.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the 20 largest accounts with their current balances
   */


  async getLargestAccounts(config) {
    const arg = { ...config,
      commitment: config && config.commitment || this.commitment
    };
    const args = arg.filter || arg.commitment ? [arg] : [];
    const unsafeRes = await this._rpcRequest('getLargestAccounts', args);
    const res = create(unsafeRes, GetLargestAccountsRpcResult);

    if ('error' in res) {
      throw new Error('failed to get largest accounts: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the 20 largest token accounts with their current balances
   * for a given mint.
   */


  async getTokenLargestAccounts(mintAddress, commitment) {
    const args = this._buildArgs([mintAddress.toBase58()], commitment);

    const unsafeRes = await this._rpcRequest('getTokenLargestAccounts', args);
    const res = create(unsafeRes, GetTokenLargestAccountsResult);

    if ('error' in res) {
      throw new Error('failed to get token largest accounts: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch all the account info for the specified public key, return with context
   */


  async getAccountInfoAndContext(publicKey, commitment) {
    const args = this._buildArgs([publicKey.toBase58()], commitment, 'base64');

    const unsafeRes = await this._rpcRequest('getAccountInfo', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(nullable(AccountInfoResult)));

    if ('error' in res) {
      throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch parsed account info for the specified public key
   */


  async getParsedAccountInfo(publicKey, commitment) {
    const args = this._buildArgs([publicKey.toBase58()], commitment, 'jsonParsed');

    const unsafeRes = await this._rpcRequest('getAccountInfo', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(nullable(ParsedAccountInfoResult)));

    if ('error' in res) {
      throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch all the account info for the specified public key
   */


  async getAccountInfo(publicKey, commitment) {
    try {
      const res = await this.getAccountInfoAndContext(publicKey, commitment);
      return res.value;
    } catch (e) {
      throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + e);
    }
  }
  /**
   * Fetch all the account info for multiple accounts specified by an array of public keys
   */


  async getMultipleAccountsInfo(publicKeys, commitment) {
    const keys = publicKeys.map(key => key.toBase58());

    const args = this._buildArgs([keys], commitment, 'base64');

    const unsafeRes = await this._rpcRequest('getMultipleAccounts', args);
    const res = create(unsafeRes, jsonRpcResultAndContext(array(nullable(AccountInfoResult))));

    if ('error' in res) {
      throw new Error('failed to get info for accounts ' + keys + ': ' + res.error.message);
    }

    return res.result.value;
  }
  /**
   * Returns epoch activation information for a stake account that has been delegated
   */


  async getStakeActivation(publicKey, commitment, epoch) {
    const args = this._buildArgs([publicKey.toBase58()], commitment, undefined, epoch !== undefined ? {
      epoch
    } : undefined);

    const unsafeRes = await this._rpcRequest('getStakeActivation', args);
    const res = create(unsafeRes, jsonRpcResult(StakeActivationResult));

    if ('error' in res) {
      throw new Error(`failed to get Stake Activation ${publicKey.toBase58()}: ${res.error.message}`);
    }

    return res.result;
  }
  /**
   * Fetch all the accounts owned by the specified program id
   *
   * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>}
   */


  async getProgramAccounts(programId, configOrCommitment) {
    const extra = {};
    let commitment;
    let encoding;

    if (configOrCommitment) {
      if (typeof configOrCommitment === 'string') {
        commitment = configOrCommitment;
      } else {
        commitment = configOrCommitment.commitment;
        encoding = configOrCommitment.encoding;

        if (configOrCommitment.dataSlice) {
          extra.dataSlice = configOrCommitment.dataSlice;
        }

        if (configOrCommitment.filters) {
          extra.filters = configOrCommitment.filters;
        }
      }
    }

    const args = this._buildArgs([programId.toBase58()], commitment, encoding || 'base64', extra);

    const unsafeRes = await this._rpcRequest('getProgramAccounts', args);
    const res = create(unsafeRes, jsonRpcResult(array(KeyedAccountInfoResult)));

    if ('error' in res) {
      throw new Error('failed to get accounts owned by program ' + programId.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch and parse all the accounts owned by the specified program id
   *
   * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer | ParsedAccountData>}>>}
   */


  async getParsedProgramAccounts(programId, configOrCommitment) {
    const extra = {};
    let commitment;

    if (configOrCommitment) {
      if (typeof configOrCommitment === 'string') {
        commitment = configOrCommitment;
      } else {
        commitment = configOrCommitment.commitment;

        if (configOrCommitment.filters) {
          extra.filters = configOrCommitment.filters;
        }
      }
    }

    const args = this._buildArgs([programId.toBase58()], commitment, 'jsonParsed', extra);

    const unsafeRes = await this._rpcRequest('getProgramAccounts', args);
    const res = create(unsafeRes, jsonRpcResult(array(KeyedParsedAccountInfoResult)));

    if ('error' in res) {
      throw new Error('failed to get accounts owned by program ' + programId.toBase58() + ': ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Confirm the transaction identified by the specified signature.
   */


  async confirmTransaction(signature, commitment) {
    let decodedSignature;

    try {
      decodedSignature = bs58.decode(signature);
    } catch (err) {
      throw new Error('signature must be base58 encoded: ' + signature);
    }

    assert(decodedSignature.length === 64, 'signature has invalid length');
    const start = Date.now();
    const subscriptionCommitment = commitment || this.commitment;
    let subscriptionId;
    let response = null;
    const confirmPromise = new Promise((resolve, reject) => {
      try {
        subscriptionId = this.onSignature(signature, (result, context) => {
          subscriptionId = undefined;
          response = {
            context,
            value: result
          };
          resolve(null);
        }, subscriptionCommitment);
      } catch (err) {
        reject(err);
      }
    });
    let timeoutMs = 60 * 1000;

    switch (subscriptionCommitment) {
      case 'processed':
      case 'recent':
      case 'single':
      case 'confirmed':
      case 'singleGossip':
        {
          timeoutMs = 30 * 1000;
          break;
        }
    }

    try {
      await promiseTimeout(confirmPromise, timeoutMs);
    } finally {
      if (subscriptionId) {
        this.removeSignatureListener(subscriptionId);
      }
    }

    if (response === null) {
      const duration = (Date.now() - start) / 1000;
      throw new Error(`Transaction was not confirmed in ${duration.toFixed(2)} seconds. It is unknown if it succeeded or failed. Check signature ${signature} using the Solana Explorer or CLI tools.`);
    }

    return response;
  }
  /**
   * Return the list of nodes that are currently participating in the cluster
   */


  async getClusterNodes() {
    const unsafeRes = await this._rpcRequest('getClusterNodes', []);
    const res = create(unsafeRes, jsonRpcResult(array(ContactInfoResult)));

    if ('error' in res) {
      throw new Error('failed to get cluster nodes: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Return the list of nodes that are currently participating in the cluster
   */


  async getVoteAccounts(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getVoteAccounts', args);
    const res = create(unsafeRes, GetVoteAccounts);

    if ('error' in res) {
      throw new Error('failed to get vote accounts: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current slot that the node is processing
   */


  async getSlot(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getSlot', args);
    const res = create(unsafeRes, jsonRpcResult(number()));

    if ('error' in res) {
      throw new Error('failed to get slot: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current slot leader of the cluster
   */


  async getSlotLeader(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getSlotLeader', args);
    const res = create(unsafeRes, jsonRpcResult(string()));

    if ('error' in res) {
      throw new Error('failed to get slot leader: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch `limit` number of slot leaders starting from `startSlot`
   *
   * @param startSlot fetch slot leaders starting from this slot
   * @param limit number of slot leaders to return
   */


  async getSlotLeaders(startSlot, limit) {
    const args = [startSlot, limit];
    const unsafeRes = await this._rpcRequest('getSlotLeaders', args);
    const res = create(unsafeRes, jsonRpcResult(array(PublicKeyFromString)));

    if ('error' in res) {
      throw new Error('failed to get slot leaders: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current status of a signature
   */


  async getSignatureStatus(signature, config) {
    const {
      context,
      value: values
    } = await this.getSignatureStatuses([signature], config);
    assert(values.length === 1);
    const value = values[0];
    return {
      context,
      value
    };
  }
  /**
   * Fetch the current statuses of a batch of signatures
   */


  async getSignatureStatuses(signatures, config) {
    const params = [signatures];

    if (config) {
      params.push(config);
    }

    const unsafeRes = await this._rpcRequest('getSignatureStatuses', params);
    const res = create(unsafeRes, GetSignatureStatusesRpcResult);

    if ('error' in res) {
      throw new Error('failed to get signature status: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current transaction count of the cluster
   */


  async getTransactionCount(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getTransactionCount', args);
    const res = create(unsafeRes, jsonRpcResult(number()));

    if ('error' in res) {
      throw new Error('failed to get transaction count: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the current total currency supply of the cluster in lamports
   *
   * @deprecated Deprecated since v1.2.8. Please use {@link getSupply} instead.
   */


  async getTotalSupply(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getSupply', args);
    const res = create(unsafeRes, GetSupplyRpcResult);

    if ('error' in res) {
      throw new Error('failed to get total supply: ' + res.error.message);
    }

    return res.result.value.total;
  }
  /**
   * Fetch the cluster InflationGovernor parameters
   */


  async getInflationGovernor(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getInflationGovernor', args);
    const res = create(unsafeRes, GetInflationGovernorRpcResult);

    if ('error' in res) {
      throw new Error('failed to get inflation: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the inflation reward for a list of addresses for an epoch
   */


  async getInflationReward(addresses, epoch, commitment) {
    const args = this._buildArgs([addresses.map(pubkey => pubkey.toBase58())], commitment, undefined, {
      epoch
    });

    const unsafeRes = await this._rpcRequest('getInflationReward', args);
    const res = create(unsafeRes, GetInflationRewardResult);

    if ('error' in res) {
      throw new Error('failed to get inflation reward: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the Epoch Info parameters
   */


  async getEpochInfo(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getEpochInfo', args);
    const res = create(unsafeRes, GetEpochInfoRpcResult);

    if ('error' in res) {
      throw new Error('failed to get epoch info: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the Epoch Schedule parameters
   */


  async getEpochSchedule() {
    const unsafeRes = await this._rpcRequest('getEpochSchedule', []);
    const res = create(unsafeRes, GetEpochScheduleRpcResult);

    if ('error' in res) {
      throw new Error('failed to get epoch schedule: ' + res.error.message);
    }

    const epochSchedule = res.result;
    return new EpochSchedule(epochSchedule.slotsPerEpoch, epochSchedule.leaderScheduleSlotOffset, epochSchedule.warmup, epochSchedule.firstNormalEpoch, epochSchedule.firstNormalSlot);
  }
  /**
   * Fetch the leader schedule for the current epoch
   * @return {Promise<RpcResponseAndContext<LeaderSchedule>>}
   */


  async getLeaderSchedule() {
    const unsafeRes = await this._rpcRequest('getLeaderSchedule', []);
    const res = create(unsafeRes, GetLeaderScheduleRpcResult);

    if ('error' in res) {
      throw new Error('failed to get leader schedule: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the minimum balance needed to exempt an account of `dataLength`
   * size from rent
   */


  async getMinimumBalanceForRentExemption(dataLength, commitment) {
    const args = this._buildArgs([dataLength], commitment);

    const unsafeRes = await this._rpcRequest('getMinimumBalanceForRentExemption', args);
    const res = create(unsafeRes, GetMinimumBalanceForRentExemptionRpcResult);

    if ('error' in res) {
      console.warn('Unable to fetch minimum balance for rent exemption');
      return 0;
    }

    return res.result;
  }
  /**
   * Fetch a recent blockhash from the cluster, return with context
   * @return {Promise<RpcResponseAndContext<{blockhash: Blockhash, feeCalculator: FeeCalculator}>>}
   */


  async getRecentBlockhashAndContext(commitment) {
    const args = this._buildArgs([], commitment);

    const unsafeRes = await this._rpcRequest('getRecentBlockhash', args);
    const res = create(unsafeRes, GetRecentBlockhashAndContextRpcResult);

    if ('error' in res) {
      throw new Error('failed to get recent blockhash: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch recent performance samples
   * @return {Promise<Array<PerfSample>>}
   */


  async getRecentPerformanceSamples(limit) {
    const args = this._buildArgs(limit ? [limit] : []);

    const unsafeRes = await this._rpcRequest('getRecentPerformanceSamples', args);
    const res = create(unsafeRes, GetRecentPerformanceSamplesRpcResult);

    if ('error' in res) {
      throw new Error('failed to get recent performance samples: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the fee calculator for a recent blockhash from the cluster, return with context
   */


  async getFeeCalculatorForBlockhash(blockhash, commitment) {
    const args = this._buildArgs([blockhash], commitment);

    const unsafeRes = await this._rpcRequest('getFeeCalculatorForBlockhash', args);
    const res = create(unsafeRes, GetFeeCalculatorRpcResult);

    if ('error' in res) {
      throw new Error('failed to get fee calculator: ' + res.error.message);
    }

    const {
      context,
      value
    } = res.result;
    return {
      context,
      value: value !== null ? value.feeCalculator : null
    };
  }
  /**
   * Fetch a recent blockhash from the cluster
   * @return {Promise<{blockhash: Blockhash, feeCalculator: FeeCalculator}>}
   */


  async getRecentBlockhash(commitment) {
    try {
      const res = await this.getRecentBlockhashAndContext(commitment);
      return res.value;
    } catch (e) {
      throw new Error('failed to get recent blockhash: ' + e);
    }
  }
  /**
   * Fetch the node version
   */


  async getVersion() {
    const unsafeRes = await this._rpcRequest('getVersion', []);
    const res = create(unsafeRes, jsonRpcResult(VersionResult));

    if ('error' in res) {
      throw new Error('failed to get version: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch a processed block from the cluster.
   */


  async getBlock(slot, opts) {
    const args = this._buildArgsAtLeastConfirmed([slot], opts && opts.commitment);

    const unsafeRes = await this._rpcRequest('getConfirmedBlock', args);
    const res = create(unsafeRes, GetConfirmedBlockRpcResult);

    if ('error' in res) {
      throw new Error('failed to get confirmed block: ' + res.error.message);
    }

    const result = res.result;
    if (!result) return result;
    return { ...result,
      transactions: result.transactions.map(({
        transaction,
        meta
      }) => {
        const message = new Message(transaction.message);
        return {
          meta,
          transaction: { ...transaction,
            message
          }
        };
      })
    };
  }
  /**
   * Fetch a processed transaction from the cluster.
   */


  async getTransaction(signature, opts) {
    const args = this._buildArgsAtLeastConfirmed([signature], opts && opts.commitment);

    const unsafeRes = await this._rpcRequest('getConfirmedTransaction', args);
    const res = create(unsafeRes, GetConfirmedTransactionRpcResult);

    if ('error' in res) {
      throw new Error('failed to get confirmed transaction: ' + res.error.message);
    }

    const result = res.result;
    if (!result) return result;
    return { ...result,
      transaction: { ...result.transaction,
        message: new Message(result.transaction.message)
      }
    };
  }
  /**
   * Fetch a list of Transactions and transaction statuses from the cluster
   * for a confirmed block.
   *
   * @deprecated Deprecated since v1.13.0. Please use {@link getBlock} instead.
   */


  async getConfirmedBlock(slot, commitment) {
    const result = await this.getBlock(slot, {
      commitment
    });

    if (!result) {
      throw new Error('Confirmed block ' + slot + ' not found');
    }

    return { ...result,
      transactions: result.transactions.map(({
        transaction,
        meta
      }) => {
        return {
          meta,
          transaction: Transaction.populate(transaction.message, transaction.signatures)
        };
      })
    };
  }
  /**
   * Fetch a list of Signatures from the cluster for a confirmed block, excluding rewards
   */


  async getConfirmedBlockSignatures(slot, commitment) {
    const args = this._buildArgsAtLeastConfirmed([slot], commitment, undefined, {
      transactionDetails: 'signatures',
      rewards: false
    });

    const unsafeRes = await this._rpcRequest('getConfirmedBlock', args);
    const res = create(unsafeRes, GetConfirmedBlockSignaturesRpcResult);

    if ('error' in res) {
      throw new Error('failed to get confirmed block: ' + res.error.message);
    }

    const result = res.result;

    if (!result) {
      throw new Error('Confirmed block ' + slot + ' not found');
    }

    return result;
  }
  /**
   * Fetch a transaction details for a confirmed transaction
   */


  async getConfirmedTransaction(signature, commitment) {
    const result = await this.getTransaction(signature, {
      commitment
    });
    if (!result) return result;
    const {
      message,
      signatures
    } = result.transaction;
    return { ...result,
      transaction: Transaction.populate(message, signatures)
    };
  }
  /**
   * Fetch parsed transaction details for a confirmed transaction
   */


  async getParsedConfirmedTransaction(signature, commitment) {
    const args = this._buildArgsAtLeastConfirmed([signature], commitment, 'jsonParsed');

    const unsafeRes = await this._rpcRequest('getConfirmedTransaction', args);
    const res = create(unsafeRes, GetParsedConfirmedTransactionRpcResult);

    if ('error' in res) {
      throw new Error('failed to get confirmed transaction: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch parsed transaction details for a batch of confirmed transactions
   */


  async getParsedConfirmedTransactions(signatures, commitment) {
    const batch = signatures.map(signature => {
      const args = this._buildArgsAtLeastConfirmed([signature], commitment, 'jsonParsed');

      return {
        methodName: 'getConfirmedTransaction',
        args
      };
    });
    const unsafeRes = await this._rpcBatchRequest(batch);
    const res = unsafeRes.map(unsafeRes => {
      const res = create(unsafeRes, GetParsedConfirmedTransactionRpcResult);

      if ('error' in res) {
        throw new Error('failed to get confirmed transactions: ' + res.error.message);
      }

      return res.result;
    });
    return res;
  }
  /**
   * Fetch a list of all the confirmed signatures for transactions involving an address
   * within a specified slot range. Max range allowed is 10,000 slots.
   *
   * @deprecated Deprecated since v1.3. Please use {@link getConfirmedSignaturesForAddress2} instead.
   *
   * @param address queried address
   * @param startSlot start slot, inclusive
   * @param endSlot end slot, inclusive
   */


  async getConfirmedSignaturesForAddress(address, startSlot, endSlot) {
    let options = {};
    let firstAvailableBlock = await this.getFirstAvailableBlock();

    while (!('until' in options)) {
      startSlot--;

      if (startSlot <= 0 || startSlot < firstAvailableBlock) {
        break;
      }

      try {
        const block = await this.getConfirmedBlockSignatures(startSlot, 'finalized');

        if (block.signatures.length > 0) {
          options.until = block.signatures[block.signatures.length - 1].toString();
        }
      } catch (err) {
        // @ts-ignore
        if (err.message.includes('skipped')) {
          continue;
        } else {
          throw err;
        }
      }
    }

    let highestConfirmedRoot = await this.getSlot('finalized');

    while (!('before' in options)) {
      endSlot++;

      if (endSlot > highestConfirmedRoot) {
        break;
      }

      try {
        const block = await this.getConfirmedBlockSignatures(endSlot);

        if (block.signatures.length > 0) {
          options.before = block.signatures[block.signatures.length - 1].toString();
        }
      } catch (err) {
        // @ts-ignore
        if (err.message.includes('skipped')) {
          continue;
        } else {
          throw err;
        }
      }
    }

    const confirmedSignatureInfo = await this.getConfirmedSignaturesForAddress2(address, options);
    return confirmedSignatureInfo.map(info => info.signature);
  }
  /**
   * Returns confirmed signatures for transactions involving an
   * address backwards in time from the provided signature or most recent confirmed block
   *
   *
   * @param address queried address
   * @param options
   */


  async getConfirmedSignaturesForAddress2(address, options, commitment) {
    const args = this._buildArgsAtLeastConfirmed([address.toBase58()], commitment, undefined, options);

    const unsafeRes = await this._rpcRequest('getConfirmedSignaturesForAddress2', args);
    const res = create(unsafeRes, GetConfirmedSignaturesForAddress2RpcResult);

    if ('error' in res) {
      throw new Error('failed to get confirmed signatures for address: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Returns confirmed signatures for transactions involving an
   * address backwards in time from the provided signature or most recent confirmed block
   *
   *
   * @param address queried address
   * @param options
   */


  async getSignaturesForAddress(address, options, commitment) {
    const args = this._buildArgsAtLeastConfirmed([address.toBase58()], commitment, undefined, options);

    const unsafeRes = await this._rpcRequest('getSignaturesForAddress', args);
    const res = create(unsafeRes, GetSignaturesForAddressRpcResult);

    if ('error' in res) {
      throw new Error('failed to get signatures for address: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * Fetch the contents of a Nonce account from the cluster, return with context
   */


  async getNonceAndContext(nonceAccount, commitment) {
    const {
      context,
      value: accountInfo
    } = await this.getAccountInfoAndContext(nonceAccount, commitment);
    let value = null;

    if (accountInfo !== null) {
      value = NonceAccount.fromAccountData(accountInfo.data);
    }

    return {
      context,
      value
    };
  }
  /**
   * Fetch the contents of a Nonce account from the cluster
   */


  async getNonce(nonceAccount, commitment) {
    return await this.getNonceAndContext(nonceAccount, commitment).then(x => x.value).catch(e => {
      throw new Error('failed to get nonce for account ' + nonceAccount.toBase58() + ': ' + e);
    });
  }
  /**
   * Request an allocation of lamports to the specified address
   *
   * ```typescript
   * import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
   *
   * (async () => {
   *   const connection = new Connection("https://api.testnet.solana.com", "confirmed");
   *   const myAddress = new PublicKey("2nr1bHFT86W9tGnyvmYW4vcHKsQB3sVQfnddasz4kExM");
   *   const signature = await connection.requestAirdrop(myAddress, LAMPORTS_PER_SOL);
   *   await connection.confirmTransaction(signature);
   * })();
   * ```
   */


  async requestAirdrop(to, lamports) {
    const unsafeRes = await this._rpcRequest('requestAirdrop', [to.toBase58(), lamports]);
    const res = create(unsafeRes, RequestAirdropRpcResult);

    if ('error' in res) {
      throw new Error('airdrop to ' + to.toBase58() + ' failed: ' + res.error.message);
    }

    return res.result;
  }
  /**
   * @internal
   */


  async _recentBlockhash(disableCache) {
    if (!disableCache) {
      // Wait for polling to finish
      while (this._pollingBlockhash) {
        await sleep(100);
      }

      const timeSinceFetch = Date.now() - this._blockhashInfo.lastFetch;

      const expired = timeSinceFetch >= BLOCKHASH_CACHE_TIMEOUT_MS;

      if (this._blockhashInfo.recentBlockhash !== null && !expired) {
        return this._blockhashInfo.recentBlockhash;
      }
    }

    return await this._pollNewBlockhash();
  }
  /**
   * @internal
   */


  async _pollNewBlockhash() {
    this._pollingBlockhash = true;

    try {
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        const {
          blockhash
        } = await this.getRecentBlockhash('finalized');

        if (this._blockhashInfo.recentBlockhash != blockhash) {
          this._blockhashInfo = {
            recentBlockhash: blockhash,
            lastFetch: Date.now(),
            transactionSignatures: [],
            simulatedSignatures: []
          };
          return blockhash;
        } // Sleep for approximately half a slot


        await sleep(MS_PER_SLOT / 2);
      }

      throw new Error(`Unable to obtain a new blockhash after ${Date.now() - startTime}ms`);
    } finally {
      this._pollingBlockhash = false;
    }
  }
  /**
   * Simulate a transaction
   */


  async simulateTransaction(transaction, signers) {
    if (transaction.nonceInfo && signers) {
      transaction.sign(...signers);
    } else {
      let disableCache = this._disableBlockhashCaching;

      for (;;) {
        transaction.recentBlockhash = await this._recentBlockhash(disableCache);
        if (!signers) break;
        transaction.sign(...signers);

        if (!transaction.signature) {
          throw new Error('!signature'); // should never happen
        }

        const signature = transaction.signature.toString('base64');

        if (!this._blockhashInfo.simulatedSignatures.includes(signature) && !this._blockhashInfo.transactionSignatures.includes(signature)) {
          // The signature of this transaction has not been seen before with the
          // current recentBlockhash, all done. Let's break
          this._blockhashInfo.simulatedSignatures.push(signature);

          break;
        } else {
          // This transaction would be treated as duplicate (its derived signature
          // matched to one of already recorded signatures).
          // So, we must fetch a new blockhash for a different signature by disabling
          // our cache not to wait for the cache expiration (BLOCKHASH_CACHE_TIMEOUT_MS).
          disableCache = true;
        }
      }
    }

    const signData = transaction.serializeMessage();

    const wireTransaction = transaction._serialize(signData);

    const encodedTransaction = wireTransaction.toString('base64');
    const config = {
      encoding: 'base64',
      commitment: this.commitment
    };

    if (signers) {
      config.sigVerify = true;
    }

    const args = [encodedTransaction, config];
    const unsafeRes = await this._rpcRequest('simulateTransaction', args);
    const res = create(unsafeRes, SimulatedTransactionResponseStruct);

    if ('error' in res) {
      let logs;

      if ('data' in res.error) {
        logs = res.error.data.logs;

        if (logs && Array.isArray(logs)) {
          const traceIndent = '\n    ';
          const logTrace = traceIndent + logs.join(traceIndent);
          console.error(res.error.message, logTrace);
        }
      }

      throw new SendTransactionError('failed to simulate transaction: ' + res.error.message, logs);
    }

    return res.result;
  }
  /**
   * Sign and send a transaction
   */


  async sendTransaction(transaction, signers, options) {
    if (transaction.nonceInfo) {
      transaction.sign(...signers);
    } else {
      let disableCache = this._disableBlockhashCaching;

      for (;;) {
        transaction.recentBlockhash = await this._recentBlockhash(disableCache);
        transaction.sign(...signers);

        if (!transaction.signature) {
          throw new Error('!signature'); // should never happen
        }

        const signature = transaction.signature.toString('base64');

        if (!this._blockhashInfo.transactionSignatures.includes(signature)) {
          // The signature of this transaction has not been seen before with the
          // current recentBlockhash, all done. Let's break
          this._blockhashInfo.transactionSignatures.push(signature);

          break;
        } else {
          // This transaction would be treated as duplicate (its derived signature
          // matched to one of already recorded signatures).
          // So, we must fetch a new blockhash for a different signature by disabling
          // our cache not to wait for the cache expiration (BLOCKHASH_CACHE_TIMEOUT_MS).
          disableCache = true;
        }
      }
    }

    const wireTransaction = transaction.serialize();
    return await this.sendRawTransaction(wireTransaction, options);
  }
  /**
   * Send a transaction that has already been signed and serialized into the
   * wire format
   */


  async sendRawTransaction(rawTransaction, options) {
    const encodedTransaction = toBuffer(rawTransaction).toString('base64');
    const result = await this.sendEncodedTransaction(encodedTransaction, options);
    return result;
  }
  /**
   * Send a transaction that has already been signed, serialized into the
   * wire format, and encoded as a base64 string
   */


  async sendEncodedTransaction(encodedTransaction, options) {
    const config = {
      encoding: 'base64'
    };
    const skipPreflight = options && options.skipPreflight;
    const preflightCommitment = options && options.preflightCommitment || this.commitment;

    if (skipPreflight) {
      config.skipPreflight = skipPreflight;
    }

    if (preflightCommitment) {
      config.preflightCommitment = preflightCommitment;
    }

    const args = [encodedTransaction, config];
    const unsafeRes = await this._rpcRequest('sendTransaction', args);
    const res = create(unsafeRes, SendTransactionRpcResult);

    if ('error' in res) {
      let logs;

      if ('data' in res.error) {
        logs = res.error.data.logs;

        if (logs && Array.isArray(logs)) {
          const traceIndent = '\n    ';
          const logTrace = traceIndent + logs.join(traceIndent);
          console.error(res.error.message, logTrace);
        }
      }

      throw new SendTransactionError('failed to send transaction: ' + res.error.message, logs);
    }

    return res.result;
  }
  /**
   * @internal
   */


  _wsOnOpen() {
    this._rpcWebSocketConnected = true;
    this._rpcWebSocketHeartbeat = setInterval(() => {
      // Ping server every 5s to prevent idle timeouts
      this._rpcWebSocket.notify('ping').catch(() => {});
    }, 10000);

    this._updateSubscriptions();
  }
  /**
   * @internal
   */


  _wsOnError(err) {
    console.error('ws error:', err.message);
  }
  /**
   * @internal
   */


  _wsOnClose(code) {
    if (this._rpcWebSocketHeartbeat) {
      clearInterval(this._rpcWebSocketHeartbeat);
      this._rpcWebSocketHeartbeat = null;
    }

    if (code === 1000) {
      // explicit close, check if any subscriptions have been made since close
      this._updateSubscriptions();

      return;
    } // implicit close, prepare subscriptions for auto-reconnect


    this._resetSubscriptions();
  }
  /**
   * @internal
   */


  async _subscribe(sub, rpcMethod, rpcArgs) {
    if (sub.subscriptionId == null) {
      sub.subscriptionId = 'subscribing';

      try {
        const id = await this._rpcWebSocket.call(rpcMethod, rpcArgs);

        if (typeof id === 'number' && sub.subscriptionId === 'subscribing') {
          // eslint-disable-next-line require-atomic-updates
          sub.subscriptionId = id;
        }
      } catch (err) {
        if (sub.subscriptionId === 'subscribing') {
          // eslint-disable-next-line require-atomic-updates
          sub.subscriptionId = null;
        } // @ts-ignore


        console.error(`${rpcMethod} error for argument`, rpcArgs, err.message);
      }
    }
  }
  /**
   * @internal
   */


  async _unsubscribe(sub, rpcMethod) {
    const subscriptionId = sub.subscriptionId;

    if (subscriptionId != null && typeof subscriptionId != 'string') {
      const unsubscribeId = subscriptionId;

      try {
        await this._rpcWebSocket.call(rpcMethod, [unsubscribeId]);
      } catch (err) {
        // @ts-ignore
        console.error(`${rpcMethod} error:`, err.message);
      }
    }
  }
  /**
   * @internal
   */


  _resetSubscriptions() {
    Object.values(this._accountChangeSubscriptions).forEach(s => s.subscriptionId = null);
    Object.values(this._programAccountChangeSubscriptions).forEach(s => s.subscriptionId = null);
    Object.values(this._rootSubscriptions).forEach(s => s.subscriptionId = null);
    Object.values(this._signatureSubscriptions).forEach(s => s.subscriptionId = null);
    Object.values(this._slotSubscriptions).forEach(s => s.subscriptionId = null);
    Object.values(this._slotUpdateSubscriptions).forEach(s => s.subscriptionId = null);
  }
  /**
   * @internal
   */


  _updateSubscriptions() {
    const accountKeys = Object.keys(this._accountChangeSubscriptions).map(Number);
    const programKeys = Object.keys(this._programAccountChangeSubscriptions).map(Number);
    const slotKeys = Object.keys(this._slotSubscriptions).map(Number);
    const slotUpdateKeys = Object.keys(this._slotUpdateSubscriptions).map(Number);
    const signatureKeys = Object.keys(this._signatureSubscriptions).map(Number);
    const rootKeys = Object.keys(this._rootSubscriptions).map(Number);
    const logsKeys = Object.keys(this._logsSubscriptions).map(Number);

    if (accountKeys.length === 0 && programKeys.length === 0 && slotKeys.length === 0 && slotUpdateKeys.length === 0 && signatureKeys.length === 0 && rootKeys.length === 0 && logsKeys.length === 0) {
      if (this._rpcWebSocketConnected) {
        this._rpcWebSocketConnected = false;
        this._rpcWebSocketIdleTimeout = setTimeout(() => {
          this._rpcWebSocketIdleTimeout = null;

          this._rpcWebSocket.close();
        }, 500);
      }

      return;
    }

    if (this._rpcWebSocketIdleTimeout !== null) {
      clearTimeout(this._rpcWebSocketIdleTimeout);
      this._rpcWebSocketIdleTimeout = null;
      this._rpcWebSocketConnected = true;
    }

    if (!this._rpcWebSocketConnected) {
      this._rpcWebSocket.connect();

      return;
    }

    for (let id of accountKeys) {
      const sub = this._accountChangeSubscriptions[id];

      this._subscribe(sub, 'accountSubscribe', this._buildArgs([sub.publicKey], sub.commitment, 'base64'));
    }

    for (let id of programKeys) {
      const sub = this._programAccountChangeSubscriptions[id];

      this._subscribe(sub, 'programSubscribe', this._buildArgs([sub.programId], sub.commitment, 'base64', {
        filters: sub.filters
      }));
    }

    for (let id of slotKeys) {
      const sub = this._slotSubscriptions[id];

      this._subscribe(sub, 'slotSubscribe', []);
    }

    for (let id of slotUpdateKeys) {
      const sub = this._slotUpdateSubscriptions[id];

      this._subscribe(sub, 'slotsUpdatesSubscribe', []);
    }

    for (let id of signatureKeys) {
      const sub = this._signatureSubscriptions[id];
      const args = [sub.signature];
      if (sub.options) args.push(sub.options);

      this._subscribe(sub, 'signatureSubscribe', args);
    }

    for (let id of rootKeys) {
      const sub = this._rootSubscriptions[id];

      this._subscribe(sub, 'rootSubscribe', []);
    }

    for (let id of logsKeys) {
      const sub = this._logsSubscriptions[id];
      let filter;

      if (typeof sub.filter === 'object') {
        filter = {
          mentions: [sub.filter.toString()]
        };
      } else {
        filter = sub.filter;
      }

      this._subscribe(sub, 'logsSubscribe', this._buildArgs([filter], sub.commitment));
    }
  }
  /**
   * @internal
   */


  _wsOnAccountNotification(notification) {
    const res = create(notification, AccountNotificationResult);

    for (const sub of Object.values(this._accountChangeSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        sub.callback(res.result.value, res.result.context);
        return;
      }
    }
  }
  /**
   * Register a callback to be invoked whenever the specified account changes
   *
   * @param publicKey Public key of the account to monitor
   * @param callback Function to invoke whenever the account is changed
   * @param commitment Specify the commitment level account changes must reach before notification
   * @return subscription id
   */


  onAccountChange(publicKey, callback, commitment) {
    const id = ++this._accountChangeSubscriptionCounter;
    this._accountChangeSubscriptions[id] = {
      publicKey: publicKey.toBase58(),
      callback,
      commitment,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister an account notification callback
   *
   * @param id subscription id to deregister
   */


  async removeAccountChangeListener(id) {
    if (this._accountChangeSubscriptions[id]) {
      const subInfo = this._accountChangeSubscriptions[id];
      delete this._accountChangeSubscriptions[id];
      await this._unsubscribe(subInfo, 'accountUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown account change id: ${id}`);
    }
  }
  /**
   * @internal
   */


  _wsOnProgramAccountNotification(notification) {
    const res = create(notification, ProgramAccountNotificationResult);

    for (const sub of Object.values(this._programAccountChangeSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        const {
          value,
          context
        } = res.result;
        sub.callback({
          accountId: value.pubkey,
          accountInfo: value.account
        }, context);
        return;
      }
    }
  }
  /**
   * Register a callback to be invoked whenever accounts owned by the
   * specified program change
   *
   * @param programId Public key of the program to monitor
   * @param callback Function to invoke whenever the account is changed
   * @param commitment Specify the commitment level account changes must reach before notification
   * @param filters The program account filters to pass into the RPC method
   * @return subscription id
   */


  onProgramAccountChange(programId, callback, commitment, filters) {
    const id = ++this._programAccountChangeSubscriptionCounter;
    this._programAccountChangeSubscriptions[id] = {
      programId: programId.toBase58(),
      callback,
      commitment,
      subscriptionId: null,
      filters
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister an account notification callback
   *
   * @param id subscription id to deregister
   */


  async removeProgramAccountChangeListener(id) {
    if (this._programAccountChangeSubscriptions[id]) {
      const subInfo = this._programAccountChangeSubscriptions[id];
      delete this._programAccountChangeSubscriptions[id];
      await this._unsubscribe(subInfo, 'programUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown program account change id: ${id}`);
    }
  }
  /**
   * Registers a callback to be invoked whenever logs are emitted.
   */


  onLogs(filter, callback, commitment) {
    const id = ++this._logsSubscriptionCounter;
    this._logsSubscriptions[id] = {
      filter,
      callback,
      commitment,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister a logs callback.
   *
   * @param id subscription id to deregister.
   */


  async removeOnLogsListener(id) {
    if (!this._logsSubscriptions[id]) {
      throw new Error(`Unknown logs id: ${id}`);
    }

    const subInfo = this._logsSubscriptions[id];
    delete this._logsSubscriptions[id];
    await this._unsubscribe(subInfo, 'logsUnsubscribe');

    this._updateSubscriptions();
  }
  /**
   * @internal
   */


  _wsOnLogsNotification(notification) {
    const res = create(notification, LogsNotificationResult);
    const keys = Object.keys(this._logsSubscriptions).map(Number);

    for (let id of keys) {
      const sub = this._logsSubscriptions[id];

      if (sub.subscriptionId === res.subscription) {
        sub.callback(res.result.value, res.result.context);
        return;
      }
    }
  }
  /**
   * @internal
   */


  _wsOnSlotNotification(notification) {
    const res = create(notification, SlotNotificationResult);

    for (const sub of Object.values(this._slotSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        sub.callback(res.result);
        return;
      }
    }
  }
  /**
   * Register a callback to be invoked upon slot changes
   *
   * @param callback Function to invoke whenever the slot changes
   * @return subscription id
   */


  onSlotChange(callback) {
    const id = ++this._slotSubscriptionCounter;
    this._slotSubscriptions[id] = {
      callback,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister a slot notification callback
   *
   * @param id subscription id to deregister
   */


  async removeSlotChangeListener(id) {
    if (this._slotSubscriptions[id]) {
      const subInfo = this._slotSubscriptions[id];
      delete this._slotSubscriptions[id];
      await this._unsubscribe(subInfo, 'slotUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown slot change id: ${id}`);
    }
  }
  /**
   * @internal
   */


  _wsOnSlotUpdatesNotification(notification) {
    const res = create(notification, SlotUpdateNotificationResult);

    for (const sub of Object.values(this._slotUpdateSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        sub.callback(res.result);
        return;
      }
    }
  }
  /**
   * Register a callback to be invoked upon slot updates. {@link SlotUpdate}'s
   * may be useful to track live progress of a cluster.
   *
   * @param callback Function to invoke whenever the slot updates
   * @return subscription id
   */


  onSlotUpdate(callback) {
    const id = ++this._slotUpdateSubscriptionCounter;
    this._slotUpdateSubscriptions[id] = {
      callback,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister a slot update notification callback
   *
   * @param id subscription id to deregister
   */


  async removeSlotUpdateListener(id) {
    if (this._slotUpdateSubscriptions[id]) {
      const subInfo = this._slotUpdateSubscriptions[id];
      delete this._slotUpdateSubscriptions[id];
      await this._unsubscribe(subInfo, 'slotsUpdatesUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown slot update id: ${id}`);
    }
  }

  _buildArgs(args, override, encoding, extra) {
    const commitment = override || this._commitment;

    if (commitment || encoding || extra) {
      let options = {};

      if (encoding) {
        options.encoding = encoding;
      }

      if (commitment) {
        options.commitment = commitment;
      }

      if (extra) {
        options = Object.assign(options, extra);
      }

      args.push(options);
    }

    return args;
  }
  /**
   * @internal
   */


  _buildArgsAtLeastConfirmed(args, override, encoding, extra) {
    const commitment = override || this._commitment;

    if (commitment && !['confirmed', 'finalized'].includes(commitment)) {
      throw new Error('Using Connection with default commitment: `' + this._commitment + '`, but method requires at least `confirmed`');
    }

    return this._buildArgs(args, override, encoding, extra);
  }
  /**
   * @internal
   */


  _wsOnSignatureNotification(notification) {
    const res = create(notification, SignatureNotificationResult);

    for (const [id, sub] of Object.entries(this._signatureSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        if (res.result.value === 'receivedSignature') {
          sub.callback({
            type: 'received'
          }, res.result.context);
        } else {
          // Signatures subscriptions are auto-removed by the RPC service so
          // no need to explicitly send an unsubscribe message
          delete this._signatureSubscriptions[Number(id)];

          this._updateSubscriptions();

          sub.callback({
            type: 'status',
            result: res.result.value
          }, res.result.context);
        }

        return;
      }
    }
  }
  /**
   * Register a callback to be invoked upon signature updates
   *
   * @param signature Transaction signature string in base 58
   * @param callback Function to invoke on signature notifications
   * @param commitment Specify the commitment level signature must reach before notification
   * @return subscription id
   */


  onSignature(signature, callback, commitment) {
    const id = ++this._signatureSubscriptionCounter;
    this._signatureSubscriptions[id] = {
      signature,
      callback: (notification, context) => {
        if (notification.type === 'status') {
          callback(notification.result, context);
        }
      },
      options: {
        commitment
      },
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Register a callback to be invoked when a transaction is
   * received and/or processed.
   *
   * @param signature Transaction signature string in base 58
   * @param callback Function to invoke on signature notifications
   * @param options Enable received notifications and set the commitment
   *   level that signature must reach before notification
   * @return subscription id
   */


  onSignatureWithOptions(signature, callback, options) {
    const id = ++this._signatureSubscriptionCounter;
    this._signatureSubscriptions[id] = {
      signature,
      callback,
      options,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister a signature notification callback
   *
   * @param id subscription id to deregister
   */


  async removeSignatureListener(id) {
    if (this._signatureSubscriptions[id]) {
      const subInfo = this._signatureSubscriptions[id];
      delete this._signatureSubscriptions[id];
      await this._unsubscribe(subInfo, 'signatureUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown signature result id: ${id}`);
    }
  }
  /**
   * @internal
   */


  _wsOnRootNotification(notification) {
    const res = create(notification, RootNotificationResult);

    for (const sub of Object.values(this._rootSubscriptions)) {
      if (sub.subscriptionId === res.subscription) {
        sub.callback(res.result);
        return;
      }
    }
  }
  /**
   * Register a callback to be invoked upon root changes
   *
   * @param callback Function to invoke whenever the root changes
   * @return subscription id
   */


  onRootChange(callback) {
    const id = ++this._rootSubscriptionCounter;
    this._rootSubscriptions[id] = {
      callback,
      subscriptionId: null
    };

    this._updateSubscriptions();

    return id;
  }
  /**
   * Deregister a root notification callback
   *
   * @param id subscription id to deregister
   */


  async removeRootChangeListener(id) {
    if (this._rootSubscriptions[id]) {
      const subInfo = this._rootSubscriptions[id];
      delete this._rootSubscriptions[id];
      await this._unsubscribe(subInfo, 'rootUnsubscribe');

      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown root change id: ${id}`);
    }
  }

}

/**
 * Keypair signer interface
 */

/**
 * An account keypair used for signing transactions.
 */
class Keypair {
  /**
   * Create a new keypair instance.
   * Generate random keypair if no {@link Ed25519Keypair} is provided.
   *
   * @param keypair ed25519 keypair
   */
  constructor(keypair) {
    _defineProperty(this, "_keypair", void 0);

    if (keypair) {
      this._keypair = keypair;
    } else {
      this._keypair = nacl.sign.keyPair();
    }
  }
  /**
   * Generate a new random keypair
   */


  static generate() {
    return new Keypair(nacl.sign.keyPair());
  }
  /**
   * Create a keypair from a raw secret key byte array.
   *
   * This method should only be used to recreate a keypair from a previously
   * generated secret key. Generating keypairs from a random seed should be done
   * with the {@link Keypair.fromSeed} method.
   *
   * @throws error if the provided secret key is invalid and validation is not skipped.
   *
   * @param secretKey secret key byte array
   * @param options: skip secret key validation
   */


  static fromSecretKey(secretKey, options) {
    const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);

    if (!options || !options.skipValidation) {
      const encoder = new TextEncoder();
      const signData = encoder.encode('@solana/web3.js-validation-v1');
      const signature = nacl.sign.detached(signData, keypair.secretKey);

      if (!nacl.sign.detached.verify(signData, signature, keypair.publicKey)) {
        throw new Error('provided secretKey is invalid');
      }
    }

    return new Keypair(keypair);
  }
  /**
   * Generate a keypair from a 32 byte seed.
   *
   * @param seed seed byte array
   */


  static fromSeed(seed) {
    return new Keypair(nacl.sign.keyPair.fromSeed(seed));
  }
  /**
   * The public key for this keypair
   */


  get publicKey() {
    return new PublicKey(this._keypair.publicKey);
  }
  /**
   * The raw secret key for this keypair
   */


  get secretKey() {
    return this._keypair.secretKey;
  }

}

/**
 * Address of the stake config account which configures the rate
 * of stake warmup and cooldown as well as the slashing penalty.
 */

const STAKE_CONFIG_ID = new PublicKey('StakeConfig11111111111111111111111111111111');
/**
 * Stake account authority info
 */

class Authorized {
  /** stake authority */

  /** withdraw authority */

  /**
   * Create a new Authorized object
   * @param staker the stake authority
   * @param withdrawer the withdraw authority
   */
  constructor(staker, withdrawer) {
    _defineProperty(this, "staker", void 0);

    _defineProperty(this, "withdrawer", void 0);

    this.staker = staker;
    this.withdrawer = withdrawer;
  }

}
/**
 * Stake account lockup info
 */

class Lockup {
  /** Unix timestamp of lockup expiration */

  /** Epoch of lockup expiration */

  /** Lockup custodian authority */

  /**
   * Create a new Lockup object
   */
  constructor(unixTimestamp, epoch, custodian) {
    _defineProperty(this, "unixTimestamp", void 0);

    _defineProperty(this, "epoch", void 0);

    _defineProperty(this, "custodian", void 0);

    this.unixTimestamp = unixTimestamp;
    this.epoch = epoch;
    this.custodian = custodian;
  }
  /**
   * Default, inactive Lockup value
   */


}
/**
 * Create stake account transaction params
 */

_defineProperty(Lockup, "default", new Lockup(0, 0, PublicKey.default));

/**
 * Stake Instruction class
 */
class StakeInstruction {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Decode a stake instruction and retrieve the instruction type.
   */


  static decodeInstructionType(instruction) {
    this.checkProgramId(instruction.programId);
    const instructionTypeLayout = BufferLayout.u32('instruction');
    const typeIndex = instructionTypeLayout.decode(instruction.data);
    let type;

    for (const [ixType, layout] of Object.entries(STAKE_INSTRUCTION_LAYOUTS)) {
      if (layout.index == typeIndex) {
        type = ixType;
        break;
      }
    }

    if (!type) {
      throw new Error('Instruction type incorrect; not a StakeInstruction');
    }

    return type;
  }
  /**
   * Decode a initialize stake instruction and retrieve the instruction params.
   */


  static decodeInitialize(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      authorized,
      lockup
    } = decodeData(STAKE_INSTRUCTION_LAYOUTS.Initialize, instruction.data);
    return {
      stakePubkey: instruction.keys[0].pubkey,
      authorized: new Authorized(new PublicKey(authorized.staker), new PublicKey(authorized.withdrawer)),
      lockup: new Lockup(lockup.unixTimestamp, lockup.epoch, new PublicKey(lockup.custodian))
    };
  }
  /**
   * Decode a delegate stake instruction and retrieve the instruction params.
   */


  static decodeDelegate(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 6);
    decodeData(STAKE_INSTRUCTION_LAYOUTS.Delegate, instruction.data);
    return {
      stakePubkey: instruction.keys[0].pubkey,
      votePubkey: instruction.keys[1].pubkey,
      authorizedPubkey: instruction.keys[5].pubkey
    };
  }
  /**
   * Decode an authorize stake instruction and retrieve the instruction params.
   */


  static decodeAuthorize(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    const {
      newAuthorized,
      stakeAuthorizationType
    } = decodeData(STAKE_INSTRUCTION_LAYOUTS.Authorize, instruction.data);
    const o = {
      stakePubkey: instruction.keys[0].pubkey,
      authorizedPubkey: instruction.keys[2].pubkey,
      newAuthorizedPubkey: new PublicKey(newAuthorized),
      stakeAuthorizationType: {
        index: stakeAuthorizationType
      }
    };

    if (instruction.keys.length > 3) {
      o.custodianPubkey = instruction.keys[3].pubkey;
    }

    return o;
  }
  /**
   * Decode an authorize-with-seed stake instruction and retrieve the instruction params.
   */


  static decodeAuthorizeWithSeed(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 2);
    const {
      newAuthorized,
      stakeAuthorizationType,
      authoritySeed,
      authorityOwner
    } = decodeData(STAKE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed, instruction.data);
    const o = {
      stakePubkey: instruction.keys[0].pubkey,
      authorityBase: instruction.keys[1].pubkey,
      authoritySeed: authoritySeed,
      authorityOwner: new PublicKey(authorityOwner),
      newAuthorizedPubkey: new PublicKey(newAuthorized),
      stakeAuthorizationType: {
        index: stakeAuthorizationType
      }
    };

    if (instruction.keys.length > 3) {
      o.custodianPubkey = instruction.keys[3].pubkey;
    }

    return o;
  }
  /**
   * Decode a split stake instruction and retrieve the instruction params.
   */


  static decodeSplit(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    const {
      lamports
    } = decodeData(STAKE_INSTRUCTION_LAYOUTS.Split, instruction.data);
    return {
      stakePubkey: instruction.keys[0].pubkey,
      splitStakePubkey: instruction.keys[1].pubkey,
      authorizedPubkey: instruction.keys[2].pubkey,
      lamports
    };
  }
  /**
   * Decode a merge stake instruction and retrieve the instruction params.
   */


  static decodeMerge(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    decodeData(STAKE_INSTRUCTION_LAYOUTS.Merge, instruction.data);
    return {
      stakePubkey: instruction.keys[0].pubkey,
      sourceStakePubKey: instruction.keys[1].pubkey,
      authorizedPubkey: instruction.keys[4].pubkey
    };
  }
  /**
   * Decode a withdraw stake instruction and retrieve the instruction params.
   */


  static decodeWithdraw(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 5);
    const {
      lamports
    } = decodeData(STAKE_INSTRUCTION_LAYOUTS.Withdraw, instruction.data);
    const o = {
      stakePubkey: instruction.keys[0].pubkey,
      toPubkey: instruction.keys[1].pubkey,
      authorizedPubkey: instruction.keys[4].pubkey,
      lamports
    };

    if (instruction.keys.length > 5) {
      o.custodianPubkey = instruction.keys[5].pubkey;
    }

    return o;
  }
  /**
   * Decode a deactivate stake instruction and retrieve the instruction params.
   */


  static decodeDeactivate(instruction) {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 3);
    decodeData(STAKE_INSTRUCTION_LAYOUTS.Deactivate, instruction.data);
    return {
      stakePubkey: instruction.keys[0].pubkey,
      authorizedPubkey: instruction.keys[2].pubkey
    };
  }
  /**
   * @internal
   */


  static checkProgramId(programId) {
    if (!programId.equals(StakeProgram.programId)) {
      throw new Error('invalid instruction; programId is not StakeProgram');
    }
  }
  /**
   * @internal
   */


  static checkKeyLength(keys, expectedLength) {
    if (keys.length < expectedLength) {
      throw new Error(`invalid instruction; found ${keys.length} keys, expected at least ${expectedLength}`);
    }
  }

}
/**
 * An enumeration of valid StakeInstructionType's
 */

/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
const STAKE_INSTRUCTION_LAYOUTS = Object.freeze({
  Initialize: {
    index: 0,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), authorized(), lockup()])
  },
  Authorize: {
    index: 1,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('newAuthorized'), BufferLayout.u32('stakeAuthorizationType')])
  },
  Delegate: {
    index: 2,
    layout: BufferLayout.struct([BufferLayout.u32('instruction')])
  },
  Split: {
    index: 3,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports')])
  },
  Withdraw: {
    index: 4,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('lamports')])
  },
  Deactivate: {
    index: 5,
    layout: BufferLayout.struct([BufferLayout.u32('instruction')])
  },
  Merge: {
    index: 7,
    layout: BufferLayout.struct([BufferLayout.u32('instruction')])
  },
  AuthorizeWithSeed: {
    index: 8,
    layout: BufferLayout.struct([BufferLayout.u32('instruction'), publicKey('newAuthorized'), BufferLayout.u32('stakeAuthorizationType'), rustString('authoritySeed'), publicKey('authorityOwner')])
  }
});
/**
 * Stake authorization type
 */

/**
 * An enumeration of valid StakeAuthorizationLayout's
 */
const StakeAuthorizationLayout = Object.freeze({
  Staker: {
    index: 0
  },
  Withdrawer: {
    index: 1
  }
});
/**
 * Factory class for transactions to interact with the Stake program
 */

class StakeProgram {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Public key that identifies the Stake program
   */


  /**
   * Generate an Initialize instruction to add to a Stake Create transaction
   */
  static initialize(params) {
    const {
      stakePubkey,
      authorized,
      lockup: maybeLockup
    } = params;
    const lockup = maybeLockup || Lockup.default;
    const type = STAKE_INSTRUCTION_LAYOUTS.Initialize;
    const data = encodeData(type, {
      authorized: {
        staker: toBuffer(authorized.staker.toBuffer()),
        withdrawer: toBuffer(authorized.withdrawer.toBuffer())
      },
      lockup: {
        unixTimestamp: lockup.unixTimestamp,
        epoch: lockup.epoch,
        custodian: toBuffer(lockup.custodian.toBuffer())
      }
    });
    const instructionData = {
      keys: [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false
      }],
      programId: this.programId,
      data
    };
    return new TransactionInstruction(instructionData);
  }
  /**
   * Generate a Transaction that creates a new Stake account at
   *   an address generated with `from`, a seed, and the Stake programId
   */


  static createAccountWithSeed(params) {
    const transaction = new Transaction();
    transaction.add(SystemProgram.createAccountWithSeed({
      fromPubkey: params.fromPubkey,
      newAccountPubkey: params.stakePubkey,
      basePubkey: params.basePubkey,
      seed: params.seed,
      lamports: params.lamports,
      space: this.space,
      programId: this.programId
    }));
    const {
      stakePubkey,
      authorized,
      lockup
    } = params;
    return transaction.add(this.initialize({
      stakePubkey,
      authorized,
      lockup
    }));
  }
  /**
   * Generate a Transaction that creates a new Stake account
   */


  static createAccount(params) {
    const transaction = new Transaction();
    transaction.add(SystemProgram.createAccount({
      fromPubkey: params.fromPubkey,
      newAccountPubkey: params.stakePubkey,
      lamports: params.lamports,
      space: this.space,
      programId: this.programId
    }));
    const {
      stakePubkey,
      authorized,
      lockup
    } = params;
    return transaction.add(this.initialize({
      stakePubkey,
      authorized,
      lockup
    }));
  }
  /**
   * Generate a Transaction that delegates Stake tokens to a validator
   * Vote PublicKey. This transaction can also be used to redelegate Stake
   * to a new validator Vote PublicKey.
   */


  static delegate(params) {
    const {
      stakePubkey,
      authorizedPubkey,
      votePubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.Delegate;
    const data = encodeData(type);
    return new Transaction().add({
      keys: [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: votePubkey,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: STAKE_CONFIG_ID,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that authorizes a new PublicKey as Staker
   * or Withdrawer on the Stake account.
   */


  static authorize(params) {
    const {
      stakePubkey,
      authorizedPubkey,
      newAuthorizedPubkey,
      stakeAuthorizationType,
      custodianPubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.Authorize;
    const data = encodeData(type, {
      newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
      stakeAuthorizationType: stakeAuthorizationType.index
    });
    const keys = [{
      pubkey: stakePubkey,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: authorizedPubkey,
      isSigner: true,
      isWritable: false
    }];

    if (custodianPubkey) {
      keys.push({
        pubkey: custodianPubkey,
        isSigner: false,
        isWritable: false
      });
    }

    return new Transaction().add({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that authorizes a new PublicKey as Staker
   * or Withdrawer on the Stake account.
   */


  static authorizeWithSeed(params) {
    const {
      stakePubkey,
      authorityBase,
      authoritySeed,
      authorityOwner,
      newAuthorizedPubkey,
      stakeAuthorizationType,
      custodianPubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed;
    const data = encodeData(type, {
      newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
      stakeAuthorizationType: stakeAuthorizationType.index,
      authoritySeed: authoritySeed,
      authorityOwner: toBuffer(authorityOwner.toBuffer())
    });
    const keys = [{
      pubkey: stakePubkey,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: authorityBase,
      isSigner: true,
      isWritable: false
    }, {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false
    }];

    if (custodianPubkey) {
      keys.push({
        pubkey: custodianPubkey,
        isSigner: false,
        isWritable: false
      });
    }

    return new Transaction().add({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that splits Stake tokens into another stake account
   */


  static split(params) {
    const {
      stakePubkey,
      authorizedPubkey,
      splitStakePubkey,
      lamports
    } = params;
    const transaction = new Transaction();
    transaction.add(SystemProgram.createAccount({
      fromPubkey: authorizedPubkey,
      newAccountPubkey: splitStakePubkey,
      lamports: 0,
      space: this.space,
      programId: this.programId
    }));
    const type = STAKE_INSTRUCTION_LAYOUTS.Split;
    const data = encodeData(type, {
      lamports
    });
    return transaction.add({
      keys: [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: splitStakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that merges Stake accounts.
   */


  static merge(params) {
    const {
      stakePubkey,
      sourceStakePubKey,
      authorizedPubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.Merge;
    const data = encodeData(type);
    return new Transaction().add({
      keys: [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: sourceStakePubKey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that withdraws deactivated Stake tokens.
   */


  static withdraw(params) {
    const {
      stakePubkey,
      authorizedPubkey,
      toPubkey,
      lamports,
      custodianPubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.Withdraw;
    const data = encodeData(type, {
      lamports
    });
    const keys = [{
      pubkey: stakePubkey,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: toPubkey,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false
    }, {
      pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
      isSigner: false,
      isWritable: false
    }, {
      pubkey: authorizedPubkey,
      isSigner: true,
      isWritable: false
    }];

    if (custodianPubkey) {
      keys.push({
        pubkey: custodianPubkey,
        isSigner: false,
        isWritable: false
      });
    }

    return new Transaction().add({
      keys,
      programId: this.programId,
      data
    });
  }
  /**
   * Generate a Transaction that deactivates Stake tokens.
   */


  static deactivate(params) {
    const {
      stakePubkey,
      authorizedPubkey
    } = params;
    const type = STAKE_INSTRUCTION_LAYOUTS.Deactivate;
    const data = encodeData(type);
    return new Transaction().add({
      keys: [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }],
      programId: this.programId,
      data
    });
  }

}

_defineProperty(StakeProgram, "programId", new PublicKey('Stake11111111111111111111111111111111111111'));

_defineProperty(StakeProgram, "space", 200);

const {
  publicKeyCreate,
  ecdsaSign
} = secp256k1;
const PRIVATE_KEY_BYTES = 32;
const ETHEREUM_ADDRESS_BYTES = 20;
const PUBLIC_KEY_BYTES = 64;
const SIGNATURE_OFFSETS_SERIALIZED_SIZE = 11;
/**
 * Params for creating an secp256k1 instruction using a public key
 */

const SECP256K1_INSTRUCTION_LAYOUT = BufferLayout.struct([BufferLayout.u8('numSignatures'), BufferLayout.u16('signatureOffset'), BufferLayout.u8('signatureInstructionIndex'), BufferLayout.u16('ethAddressOffset'), BufferLayout.u8('ethAddressInstructionIndex'), BufferLayout.u16('messageDataOffset'), BufferLayout.u16('messageDataSize'), BufferLayout.u8('messageInstructionIndex'), BufferLayout.blob(20, 'ethAddress'), BufferLayout.blob(64, 'signature'), BufferLayout.u8('recoveryId')]);
class Secp256k1Program {
  /**
   * @internal
   */
  constructor() {}
  /**
   * Public key that identifies the secp256k1 program
   */


  /**
   * Construct an Ethereum address from a secp256k1 public key buffer.
   * @param {Buffer} publicKey a 64 byte secp256k1 public key buffer
   */
  static publicKeyToEthAddress(publicKey) {
    assert(publicKey.length === PUBLIC_KEY_BYTES, `Public key must be ${PUBLIC_KEY_BYTES} bytes but received ${publicKey.length} bytes`);

    try {
      return Buffer.from(keccak_256.update(toBuffer(publicKey)).digest()).slice(-ETHEREUM_ADDRESS_BYTES);
    } catch (error) {
      throw new Error(`Error constructing Ethereum address: ${error}`);
    }
  }
  /**
   * Create an secp256k1 instruction with a public key. The public key
   * must be a buffer that is 64 bytes long.
   */


  static createInstructionWithPublicKey(params) {
    const {
      publicKey,
      message,
      signature,
      recoveryId,
      instructionIndex
    } = params;
    return Secp256k1Program.createInstructionWithEthAddress({
      ethAddress: Secp256k1Program.publicKeyToEthAddress(publicKey),
      message,
      signature,
      recoveryId,
      instructionIndex
    });
  }
  /**
   * Create an secp256k1 instruction with an Ethereum address. The address
   * must be a hex string or a buffer that is 20 bytes long.
   */


  static createInstructionWithEthAddress(params) {
    const {
      ethAddress: rawAddress,
      message,
      signature,
      recoveryId,
      instructionIndex = 0
    } = params;
    let ethAddress;

    if (typeof rawAddress === 'string') {
      if (rawAddress.startsWith('0x')) {
        ethAddress = Buffer.from(rawAddress.substr(2), 'hex');
      } else {
        ethAddress = Buffer.from(rawAddress, 'hex');
      }
    } else {
      ethAddress = rawAddress;
    }

    assert(ethAddress.length === ETHEREUM_ADDRESS_BYTES, `Address must be ${ETHEREUM_ADDRESS_BYTES} bytes but received ${ethAddress.length} bytes`);
    const dataStart = 1 + SIGNATURE_OFFSETS_SERIALIZED_SIZE;
    const ethAddressOffset = dataStart;
    const signatureOffset = dataStart + ethAddress.length;
    const messageDataOffset = signatureOffset + signature.length + 1;
    const numSignatures = 1;
    const instructionData = Buffer.alloc(SECP256K1_INSTRUCTION_LAYOUT.span + message.length);
    SECP256K1_INSTRUCTION_LAYOUT.encode({
      numSignatures,
      signatureOffset,
      signatureInstructionIndex: instructionIndex,
      ethAddressOffset,
      ethAddressInstructionIndex: instructionIndex,
      messageDataOffset,
      messageDataSize: message.length,
      messageInstructionIndex: instructionIndex,
      signature: toBuffer(signature),
      ethAddress: toBuffer(ethAddress),
      recoveryId
    }, instructionData);
    instructionData.fill(toBuffer(message), SECP256K1_INSTRUCTION_LAYOUT.span);
    return new TransactionInstruction({
      keys: [],
      programId: Secp256k1Program.programId,
      data: instructionData
    });
  }
  /**
   * Create an secp256k1 instruction with a private key. The private key
   * must be a buffer that is 32 bytes long.
   */


  static createInstructionWithPrivateKey(params) {
    const {
      privateKey: pkey,
      message,
      instructionIndex
    } = params;
    assert(pkey.length === PRIVATE_KEY_BYTES, `Private key must be ${PRIVATE_KEY_BYTES} bytes but received ${pkey.length} bytes`);

    try {
      const privateKey = toBuffer(pkey);
      const publicKey = publicKeyCreate(privateKey, false).slice(1); // throw away leading byte

      const messageHash = Buffer.from(keccak_256.update(toBuffer(message)).digest());
      const {
        signature,
        recid: recoveryId
      } = ecdsaSign(messageHash, privateKey);
      return this.createInstructionWithPublicKey({
        publicKey,
        message,
        signature,
        recoveryId,
        instructionIndex
      });
    } catch (error) {
      throw new Error(`Error creating instruction; ${error}`);
    }
  }

}

_defineProperty(Secp256k1Program, "programId", new PublicKey('KeccakSecp256k11111111111111111111111111111'));

const VALIDATOR_INFO_KEY = new PublicKey('Va1idator1nfo111111111111111111111111111111');
/**
 * @internal
 */

const InfoString = type({
  name: string(),
  website: optional(string()),
  details: optional(string()),
  keybaseUsername: optional(string())
});
/**
 * ValidatorInfo class
 */

class ValidatorInfo {
  /**
   * validator public key
   */

  /**
   * validator information
   */

  /**
   * Construct a valid ValidatorInfo
   *
   * @param key validator public key
   * @param info validator information
   */
  constructor(key, info) {
    _defineProperty(this, "key", void 0);

    _defineProperty(this, "info", void 0);

    this.key = key;
    this.info = info;
  }
  /**
   * Deserialize ValidatorInfo from the config account data. Exactly two config
   * keys are required in the data.
   *
   * @param buffer config account data
   * @return null if info was not found
   */


  static fromConfigData(buffer) {
    const PUBKEY_LENGTH = 32;
    let byteArray = [...buffer];
    const configKeyCount = decodeLength(byteArray);
    if (configKeyCount !== 2) return null;
    const configKeys = [];

    for (let i = 0; i < 2; i++) {
      const publicKey = new PublicKey(byteArray.slice(0, PUBKEY_LENGTH));
      byteArray = byteArray.slice(PUBKEY_LENGTH);
      const isSigner = byteArray.slice(0, 1)[0] === 1;
      byteArray = byteArray.slice(1);
      configKeys.push({
        publicKey,
        isSigner
      });
    }

    if (configKeys[0].publicKey.equals(VALIDATOR_INFO_KEY)) {
      if (configKeys[1].isSigner) {
        const rawInfo = rustString().decode(Buffer.from(byteArray));
        const info = JSON.parse(rawInfo);
        assert$1(info, InfoString);
        return new ValidatorInfo(configKeys[1].publicKey, info);
      }
    }

    return null;
  }

}

const VOTE_PROGRAM_ID = new PublicKey('Vote111111111111111111111111111111111111111');

/**
 * See https://github.com/solana-labs/solana/blob/8a12ed029cfa38d4a45400916c2463fb82bbec8c/programs/vote_api/src/vote_state.rs#L68-L88
 *
 * @internal
 */
const VoteAccountLayout = BufferLayout.struct([publicKey('nodePubkey'), publicKey('authorizedVoterPubkey'), publicKey('authorizedWithdrawerPubkey'), BufferLayout.u8('commission'), BufferLayout.nu64(), // votes.length
BufferLayout.seq(BufferLayout.struct([BufferLayout.nu64('slot'), BufferLayout.u32('confirmationCount')]), BufferLayout.offset(BufferLayout.u32(), -8), 'votes'), BufferLayout.u8('rootSlotValid'), BufferLayout.nu64('rootSlot'), BufferLayout.nu64('epoch'), BufferLayout.nu64('credits'), BufferLayout.nu64('lastEpochCredits'), BufferLayout.nu64(), // epochCredits.length
BufferLayout.seq(BufferLayout.struct([BufferLayout.nu64('epoch'), BufferLayout.nu64('credits'), BufferLayout.nu64('prevCredits')]), BufferLayout.offset(BufferLayout.u32(), -8), 'epochCredits')]);

/**
 * VoteAccount class
 */
class VoteAccount {
  /**
   * @internal
   */
  constructor(args) {
    _defineProperty(this, "nodePubkey", void 0);

    _defineProperty(this, "authorizedVoterPubkey", void 0);

    _defineProperty(this, "authorizedWithdrawerPubkey", void 0);

    _defineProperty(this, "commission", void 0);

    _defineProperty(this, "votes", void 0);

    _defineProperty(this, "rootSlot", void 0);

    _defineProperty(this, "epoch", void 0);

    _defineProperty(this, "credits", void 0);

    _defineProperty(this, "lastEpochCredits", void 0);

    _defineProperty(this, "epochCredits", void 0);

    this.nodePubkey = args.nodePubkey;
    this.authorizedVoterPubkey = args.authorizedVoterPubkey;
    this.authorizedWithdrawerPubkey = args.authorizedWithdrawerPubkey;
    this.commission = args.commission;
    this.votes = args.votes;
    this.rootSlot = args.rootSlot;
    this.epoch = args.epoch;
    this.credits = args.credits;
    this.lastEpochCredits = args.lastEpochCredits;
    this.epochCredits = args.epochCredits;
  }
  /**
   * Deserialize VoteAccount from the account data.
   *
   * @param buffer account data
   * @return VoteAccount
   */


  static fromAccountData(buffer) {
    const va = VoteAccountLayout.decode(toBuffer(buffer), 0);
    let rootSlot = va.rootSlot;

    if (!va.rootSlotValid) {
      rootSlot = null;
    }

    return new VoteAccount({
      nodePubkey: new PublicKey(va.nodePubkey),
      authorizedVoterPubkey: new PublicKey(va.authorizedVoterPubkey),
      authorizedWithdrawerPubkey: new PublicKey(va.authorizedWithdrawerPubkey),
      commission: va.commission,
      votes: va.votes,
      rootSlot,
      epoch: va.epoch,
      credits: va.credits,
      lastEpochCredits: va.lastEpochCredits,
      epochCredits: va.epochCredits
    });
  }

}

/**
 * Send and confirm a raw transaction
 *
 * If `commitment` option is not specified, defaults to 'max' commitment.
 *
 * @param {Connection} connection
 * @param {Buffer} rawTransaction
 * @param {ConfirmOptions} [options]
 * @returns {Promise<TransactionSignature>}
 */
async function sendAndConfirmRawTransaction(connection, rawTransaction, options) {
  const sendOptions = options && {
    skipPreflight: options.skipPreflight,
    preflightCommitment: options.preflightCommitment || options.commitment
  };
  const signature = await connection.sendRawTransaction(rawTransaction, sendOptions);
  const status = (await connection.confirmTransaction(signature, options && options.commitment)).value;

  if (status.err) {
    throw new Error(`Raw transaction ${signature} failed (${JSON.stringify(status)})`);
  }

  return signature;
}

const endpoint = {
  http: {
    devnet: 'http://api.devnet.solana.com',
    testnet: 'http://api.testnet.solana.com',
    'mainnet-beta': 'http://api.mainnet-beta.solana.com'
  },
  https: {
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com'
  }
};

/**
 * Retrieves the RPC API URL for the specified cluster
 */
function clusterApiUrl(cluster, tls) {
  const key = tls === false ? 'http' : 'https';

  if (!cluster) {
    return endpoint[key]['devnet'];
  }

  const url = endpoint[key][cluster];

  if (!url) {
    throw new Error(`Unknown ${key} cluster: ${cluster}`);
  }

  return url;
}

/**
 * There are 1-billion lamports in one SOL
 */

const LAMPORTS_PER_SOL = 1000000000;

export { Account, Authorized, BLOCKHASH_CACHE_TIMEOUT_MS, BPF_LOADER_DEPRECATED_PROGRAM_ID, BPF_LOADER_PROGRAM_ID, BpfLoader, Connection, Enum, EpochSchedule, FeeCalculatorLayout, Keypair, LAMPORTS_PER_SOL, Loader, Lockup, MAX_SEED_LENGTH, Message, NONCE_ACCOUNT_LENGTH, NonceAccount, PACKET_DATA_SIZE, PublicKey, SOLANA_SCHEMA, STAKE_CONFIG_ID, STAKE_INSTRUCTION_LAYOUTS, SYSTEM_INSTRUCTION_LAYOUTS, SYSVAR_CLOCK_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RECENT_BLOCKHASHES_PUBKEY, SYSVAR_RENT_PUBKEY, SYSVAR_REWARDS_PUBKEY, SYSVAR_STAKE_HISTORY_PUBKEY, Secp256k1Program, StakeAuthorizationLayout, StakeInstruction, StakeProgram, Struct, SystemInstruction, SystemProgram, Transaction, TransactionInstruction, VALIDATOR_INFO_KEY, VOTE_PROGRAM_ID, ValidatorInfo, VoteAccount, clusterApiUrl, sendAndConfirmRawTransaction, sendAndConfirmTransaction };
//# sourceMappingURL=index.esm.js.map
