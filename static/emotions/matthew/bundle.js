(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":2,"ieee754":3,"isarray":4}],2:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
var cmap = require('colormap'),
    canvas = document.getElementById('canvas'),
    c = canvas.getContext('2d'),
    n = 15000, // Number of strips.
    div = $(window).width() / n,
    colormaps = ['anger','anticipation','joy','disgust','sadness','fear']; // Name of coloring pattern.

run();

function drawColorMaps (colormap, name, height) {
    for (var j = 0; j < n; j++) {
        c.fillStyle = colormap[j];      
        c.fillRect(j*div*0.7, height, div, 200); 
    }
    c.fillStyle = '#FFFFFF';
    c.font = "30px lanenar";
    c.fillText(name, div*n*0.75, height + 100);
}

function run() {
    var height, colormap;
    c.canvas.height = 1200;
    c.canvas.width = 0.9*$(window).width();

    for (var i = 0; i < colormaps.length; i++) {
        height = i*200;
        colormap = cmap({
            colormap: colormaps[i],
            nshades: n,
            format: 'rgbaString'
        });
        drawColorMaps(colormap, colormaps[i], height);
    }
}
    

},{"colormap":7}],6:[function(require,module,exports){
module.exports={
	"jet":[{"index":0,"rgb":[0,0,131]},{"index":0.125,"rgb":[0,60,170]},{"index":0.375,"rgb":[5,255,255]},{"index":0.625,"rgb":[255,255,0]},{"index":0.875,"rgb":[250,0,0]},{"index":1,"rgb":[128,0,0]}],
	
	"hsv":[{"index":0,"rgb":[255,0,0]},{"index":0.169,"rgb":[253,255,2]},{"index":0.173,"rgb":[247,255,2]},{"index":0.337,"rgb":[0,252,4]},{"index":0.341,"rgb":[0,252,10]},{"index":0.506,"rgb":[1,249,255]},{"index":0.671,"rgb":[2,0,253]},{"index":0.675,"rgb":[8,0,253]},{"index":0.839,"rgb":[255,0,251]},{"index":0.843,"rgb":[255,0,245]},{"index":1,"rgb":[255,0,6]}],

	"hot":[{"index":0,"rgb":[0,0,0]},{"index":0.3,"rgb":[230,0,0]},{"index":0.6,"rgb":[255,210,0]},{"index":1,"rgb":[255,255,255]}],

	"cool":[{"index":0,"rgb":[0,255,255]},{"index":1,"rgb":[255,0,255]}],

	"spring":[{"index":0,"rgb":[255,0,255]},{"index":1,"rgb":[255,255,0]}],

	"summer":[{"index":0,"rgb":[0,128,102]},{"index":1,"rgb":[255,255,102]}],

	"autumn":[{"index":0,"rgb":[255,0,0]},{"index":1,"rgb":[255,255,0]}],

	"winter":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[0,255,128]}],

	"bone":[{"index":0,"rgb":[0,0,0]},{"index":0.376,"rgb":[84,84,116]},{"index":0.753,"rgb":[169,200,200]},{"index":1,"rgb":[255,255,255]}],

	"copper":[{"index":0,"rgb":[0,0,0]},{"index":0.804,"rgb":[255,160,102]},{"index":1,"rgb":[255,199,127]}],

	"greys":[{"index":0,"rgb":[0,0,0]},{"index":1,"rgb":[255,255,255]}],

	"yignbu":[{"index":0,"rgb":[8,29,88]},{"index":0.125,"rgb":[37,52,148]},{"index":0.25,"rgb":[34,94,168]},{"index":0.375,"rgb":[29,145,192]},{"index":0.5,"rgb":[65,182,196]},{"index":0.625,"rgb":[127,205,187]},{"index":0.75,"rgb":[199,233,180]},{"index":0.875,"rgb":[237,248,217]},{"index":1,"rgb":[255,255,217]}],

	"greens":[{"index":0,"rgb":[0,68,27]},{"index":0.125,"rgb":[0,109,44]},{"index":0.25,"rgb":[35,139,69]},{"index":0.375,"rgb":[65,171,93]},{"index":0.5,"rgb":[116,196,118]},{"index":0.625,"rgb":[161,217,155]},{"index":0.75,"rgb":[199,233,192]},{"index":0.875,"rgb":[229,245,224]},{"index":1,"rgb":[247,252,245]}],

	"yiorrd":[{"index":0,"rgb":[128,0,38]},{"index":0.125,"rgb":[189,0,38]},{"index":0.25,"rgb":[227,26,28]},{"index":0.375,"rgb":[252,78,42]},{"index":0.5,"rgb":[253,141,60]},{"index":0.625,"rgb":[254,178,76]},{"index":0.75,"rgb":[254,217,118]},{"index":0.875,"rgb":[255,237,160]},{"index":1,"rgb":[255,255,204]}],

	"bluered":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[255,0,0]}],

	"rdbu":[{"index":0,"rgb":[5,10,172]},{"index":0.35,"rgb":[106,137,247]},{"index":0.5,"rgb":[190,190,190]},{"index":0.6,"rgb":[220,170,132]},{"index":0.7,"rgb":[230,145,90]},{"index":1,"rgb":[178,10,28]}],

	"picnic":[{"index":0,"rgb":[0,0,255]},{"index":0.1,"rgb":[51,153,255]},{"index":0.2,"rgb":[102,204,255]},{"index":0.3,"rgb":[153,204,255]},{"index":0.4,"rgb":[204,204,255]},{"index":0.5,"rgb":[255,255,255]},{"index":0.6,"rgb":[255,204,255]},{"index":0.7,"rgb":[255,153,255]},{"index":0.8,"rgb":[255,102,204]},{"index":0.9,"rgb":[255,102,102]},{"index":1,"rgb":[255,0,0]}],

	"rainbow":[{"index":0,"rgb":[150,0,90]},{"index":0.125,"rgb":[0,0,200]},{"index":0.25,"rgb":[0,25,255]},{"index":0.375,"rgb":[0,152,255]},{"index":0.5,"rgb":[44,255,150]},{"index":0.625,"rgb":[151,255,0]},{"index":0.75,"rgb":[255,234,0]},{"index":0.875,"rgb":[255,111,0]},{"index":1,"rgb":[255,0,0]}],

	"portland":[{"index":0,"rgb":[12,51,131]},{"index":0.25,"rgb":[10,136,186]},{"index":0.5,"rgb":[242,211,56]},{"index":0.75,"rgb":[242,143,56]},{"index":1,"rgb":[217,30,30]}],

	"blackbody":[{"index":0,"rgb":[0,0,0]},{"index":0.2,"rgb":[230,0,0]},{"index":0.4,"rgb":[230,210,0]},{"index":0.7,"rgb":[255,255,255]},{"index":1,"rgb":[160,200,255]}],

	"earth":[{"index":0,"rgb":[0,0,130]},{"index":0.1,"rgb":[0,180,180]},{"index":0.2,"rgb":[40,210,40]},{"index":0.4,"rgb":[230,230,50]},{"index":0.6,"rgb":[120,70,20]},{"index":1,"rgb":[255,255,255]}],

	"electric":[{"index":0,"rgb":[0,0,0]},{"index":0.15,"rgb":[30,0,100]},{"index":0.4,"rgb":[120,0,100]},{"index":0.6,"rgb":[160,90,0]},{"index":0.8,"rgb":[230,200,0]},{"index":1,"rgb":[255,250,220]}],

	"alpha": [{"index":0, "rgb": [255,255,255,0]},{"index":0, "rgb": [255,255,255,1]}],

	"viridis": [{"index":0,"rgb":[68,1,84]},{"index":0.13,"rgb":[71,44,122]},{"index":0.25,"rgb":[59,81,139]},{"index":0.38,"rgb":[44,113,142]},{"index":0.5,"rgb":[33,144,141]},{"index":0.63,"rgb":[39,173,129]},{"index":0.75,"rgb":[92,200,99]},{"index":0.88,"rgb":[170,220,50]},{"index":1,"rgb":[253,231,37]}],

	"inferno": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[31,12,72]},{"index":0.25,"rgb":[85,15,109]},{"index":0.38,"rgb":[136,34,106]},{"index":0.5,"rgb":[186,54,85]},{"index":0.63,"rgb":[227,89,51]},{"index":0.75,"rgb":[249,140,10]},{"index":0.88,"rgb":[249,201,50]},{"index":1,"rgb":[252,255,164]}],

	"magma": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[28,16,68]},{"index":0.25,"rgb":[79,18,123]},{"index":0.38,"rgb":[129,37,129]},{"index":0.5,"rgb":[181,54,122]},{"index":0.63,"rgb":[229,80,100]},{"index":0.75,"rgb":[251,135,97]},{"index":0.88,"rgb":[254,194,135]},{"index":1,"rgb":[252,253,191]}],

	"plasma": [{"index":0,"rgb":[13,8,135]},{"index":0.13,"rgb":[75,3,161]},{"index":0.25,"rgb":[125,3,168]},{"index":0.38,"rgb":[168,34,150]},{"index":0.5,"rgb":[203,70,121]},{"index":0.63,"rgb":[229,107,93]},{"index":0.75,"rgb":[248,148,65]},{"index":0.88,"rgb":[253,195,40]},{"index":1,"rgb":[240,249,33]}],

	"warm": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[172,0,187]},{"index":0.25,"rgb":[219,0,170]},{"index":0.38,"rgb":[255,0,130]},{"index":0.5,"rgb":[255,63,74]},{"index":0.63,"rgb":[255,123,0]},{"index":0.75,"rgb":[234,176,0]},{"index":0.88,"rgb":[190,228,0]},{"index":1,"rgb":[147,255,0]}],

	"cool": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[116,0,218]},{"index":0.25,"rgb":[98,74,237]},{"index":0.38,"rgb":[68,146,231]},{"index":0.5,"rgb":[0,204,197]},{"index":0.63,"rgb":[0,247,146]},{"index":0.75,"rgb":[0,255,88]},{"index":0.88,"rgb":[40,255,8]},{"index":1,"rgb":[147,255,0]}],

	"rainbow-soft": [{"index":0,"rgb":[125,0,179]},{"index":0.1,"rgb":[199,0,180]},{"index":0.2,"rgb":[255,0,121]},{"index":0.3,"rgb":[255,108,0]},{"index":0.4,"rgb":[222,194,0]},{"index":0.5,"rgb":[150,255,0]},{"index":0.6,"rgb":[0,255,55]},{"index":0.7,"rgb":[0,246,150]},{"index":0.8,"rgb":[50,167,222]},{"index":0.9,"rgb":[103,51,235]},{"index":1,"rgb":[124,0,186]}],

	"bathymetry": [{"index":0,"rgb":[40,26,44]},{"index":0.13,"rgb":[59,49,90]},{"index":0.25,"rgb":[64,76,139]},{"index":0.38,"rgb":[63,110,151]},{"index":0.5,"rgb":[72,142,158]},{"index":0.63,"rgb":[85,174,163]},{"index":0.75,"rgb":[120,206,163]},{"index":0.88,"rgb":[187,230,172]},{"index":1,"rgb":[253,254,204]}],

	"cdom": [{"index":0,"rgb":[47,15,62]},{"index":0.13,"rgb":[87,23,86]},{"index":0.25,"rgb":[130,28,99]},{"index":0.38,"rgb":[171,41,96]},{"index":0.5,"rgb":[206,67,86]},{"index":0.63,"rgb":[230,106,84]},{"index":0.75,"rgb":[242,149,103]},{"index":0.88,"rgb":[249,193,135]},{"index":1,"rgb":[254,237,176]}],

	"chlorophyll": [{"index":0,"rgb":[18,36,20]},{"index":0.13,"rgb":[25,63,41]},{"index":0.25,"rgb":[24,91,59]},{"index":0.38,"rgb":[13,119,72]},{"index":0.5,"rgb":[18,148,80]},{"index":0.63,"rgb":[80,173,89]},{"index":0.75,"rgb":[132,196,122]},{"index":0.88,"rgb":[175,221,162]},{"index":1,"rgb":[215,249,208]}],

	"density": [{"index":0,"rgb":[54,14,36]},{"index":0.13,"rgb":[89,23,80]},{"index":0.25,"rgb":[110,45,132]},{"index":0.38,"rgb":[120,77,178]},{"index":0.5,"rgb":[120,113,213]},{"index":0.63,"rgb":[115,151,228]},{"index":0.75,"rgb":[134,185,227]},{"index":0.88,"rgb":[177,214,227]},{"index":1,"rgb":[230,241,241]}],

	"freesurface-blue": [{"index":0,"rgb":[30,4,110]},{"index":0.13,"rgb":[47,14,176]},{"index":0.25,"rgb":[41,45,236]},{"index":0.38,"rgb":[25,99,212]},{"index":0.5,"rgb":[68,131,200]},{"index":0.63,"rgb":[114,156,197]},{"index":0.75,"rgb":[157,181,203]},{"index":0.88,"rgb":[200,208,216]},{"index":1,"rgb":[241,237,236]}],

	"freesurface-red": [{"index":0,"rgb":[60,9,18]},{"index":0.13,"rgb":[100,17,27]},{"index":0.25,"rgb":[142,20,29]},{"index":0.38,"rgb":[177,43,27]},{"index":0.5,"rgb":[192,87,63]},{"index":0.63,"rgb":[205,125,105]},{"index":0.75,"rgb":[216,162,148]},{"index":0.88,"rgb":[227,199,193]},{"index":1,"rgb":[241,237,236]}],

	"oxygen": [{"index":0,"rgb":[64,5,5]},{"index":0.13,"rgb":[106,6,15]},{"index":0.25,"rgb":[144,26,7]},{"index":0.38,"rgb":[168,64,3]},{"index":0.5,"rgb":[188,100,4]},{"index":0.63,"rgb":[206,136,11]},{"index":0.75,"rgb":[220,174,25]},{"index":0.88,"rgb":[231,215,44]},{"index":1,"rgb":[248,254,105]}],

	"par": [{"index":0,"rgb":[51,20,24]},{"index":0.13,"rgb":[90,32,35]},{"index":0.25,"rgb":[129,44,34]},{"index":0.38,"rgb":[159,68,25]},{"index":0.5,"rgb":[182,99,19]},{"index":0.63,"rgb":[199,134,22]},{"index":0.75,"rgb":[212,171,35]},{"index":0.88,"rgb":[221,210,54]},{"index":1,"rgb":[225,253,75]}],

	"phase": [{"index":0,"rgb":[145,105,18]},{"index":0.13,"rgb":[184,71,38]},{"index":0.25,"rgb":[186,58,115]},{"index":0.38,"rgb":[160,71,185]},{"index":0.5,"rgb":[110,97,218]},{"index":0.63,"rgb":[50,123,164]},{"index":0.75,"rgb":[31,131,110]},{"index":0.88,"rgb":[77,129,34]},{"index":1,"rgb":[145,105,18]}],

	"salinity": [{"index":0,"rgb":[42,24,108]},{"index":0.13,"rgb":[33,50,162]},{"index":0.25,"rgb":[15,90,145]},{"index":0.38,"rgb":[40,118,137]},{"index":0.5,"rgb":[59,146,135]},{"index":0.63,"rgb":[79,175,126]},{"index":0.75,"rgb":[120,203,104]},{"index":0.88,"rgb":[193,221,100]},{"index":1,"rgb":[253,239,154]}],

	"temperature": [{"index":0,"rgb":[4,35,51]},{"index":0.13,"rgb":[23,51,122]},{"index":0.25,"rgb":[85,59,157]},{"index":0.38,"rgb":[129,79,143]},{"index":0.5,"rgb":[175,95,130]},{"index":0.63,"rgb":[222,112,101]},{"index":0.75,"rgb":[249,146,66]},{"index":0.88,"rgb":[249,196,65]},{"index":1,"rgb":[232,250,91]}],

	"turbidity": [{"index":0,"rgb":[34,31,27]},{"index":0.13,"rgb":[65,50,41]},{"index":0.25,"rgb":[98,69,52]},{"index":0.38,"rgb":[131,89,57]},{"index":0.5,"rgb":[161,112,59]},{"index":0.63,"rgb":[185,140,66]},{"index":0.75,"rgb":[202,174,88]},{"index":0.88,"rgb":[216,209,126]},{"index":1,"rgb":[233,246,171]}],

	"velocity-blue": [{"index":0,"rgb":[17,32,64]},{"index":0.13,"rgb":[35,52,116]},{"index":0.25,"rgb":[29,81,156]},{"index":0.38,"rgb":[31,113,162]},{"index":0.5,"rgb":[50,144,169]},{"index":0.63,"rgb":[87,173,176]},{"index":0.75,"rgb":[149,196,189]},{"index":0.88,"rgb":[203,221,211]},{"index":1,"rgb":[254,251,230]}],

	"velocity-green": [{"index":0,"rgb":[23,35,19]},{"index":0.13,"rgb":[24,64,38]},{"index":0.25,"rgb":[11,95,45]},{"index":0.38,"rgb":[39,123,35]},{"index":0.5,"rgb":[95,146,12]},{"index":0.63,"rgb":[152,165,18]},{"index":0.75,"rgb":[201,186,69]},{"index":0.88,"rgb":[233,216,137]},{"index":1,"rgb":[255,253,205]}],

	"cubehelix": [{"index":0,"rgb":[0,0,0]},{"index":0.07,"rgb":[22,5,59]},{"index":0.13,"rgb":[60,4,105]},{"index":0.2,"rgb":[109,1,135]},{"index":0.27,"rgb":[161,0,147]},{"index":0.33,"rgb":[210,2,142]},{"index":0.4,"rgb":[251,11,123]},{"index":0.47,"rgb":[255,29,97]},{"index":0.53,"rgb":[255,54,69]},{"index":0.6,"rgb":[255,85,46]},{"index":0.67,"rgb":[255,120,34]},{"index":0.73,"rgb":[255,157,37]},{"index":0.8,"rgb":[241,191,57]},{"index":0.87,"rgb":[224,220,93]},{"index":0.93,"rgb":[218,241,142]},{"index":1,"rgb":[227,253,198]}],
	
	"anger": [{"rgb": [0, 0, 0], "index": 0}, {"rgb": [0, 0, 0], "index": 0.013034115858807635}, {"rgb": [255, 0, 0], "index": 0.014482350954230705}, {"rgb": [0, 0, 0], "index": 0.015930586049653774}, {"rgb": [0, 0, 0], "index": 0.033558520520182405}, {"rgb": [255, 0, 0], "index": 0.035678094916399256}, {"rgb": [0, 0, 0], "index": 0.037797669312616106}, {"rgb": [0, 0, 0], "index": 0.050346225299780445}, {"rgb": [255, 0, 0], "index": 0.051976017564600574}, {"rgb": [0, 0, 0], "index": 0.0536058098294207}, {"rgb": [0, 0, 0], "index": 0.05410403648032427}, {"rgb": [255, 0, 0], "index": 0.05434048302651579}, {"rgb": [0, 0, 0], "index": 0.054576929572707315}, {"rgb": [0, 0, 0], "index": 0.05586049653774701}, {"rgb": [255, 0, 0], "index": 0.056029386927883805}, {"rgb": [0, 0, 0], "index": 0.0561982773180206}, {"rgb": [0, 0, 0], "index": 0.05747339976355345}, {"rgb": [255, 0, 0], "index": 0.05763384563418342}, {"rgb": [0, 0, 0], "index": 0.05779429150481338}, {"rgb": [0, 0, 0], "index": 0.06261188988346562}, {"rgb": [255, 0, 0], "index": 0.06316500591116365}, {"rgb": [0, 0, 0], "index": 0.06371812193886169}, {"rgb": [0, 0, 0], "index": 0.06574902888025672}, {"rgb": [255, 0, 0], "index": 0.06603614254348927}, {"rgb": [0, 0, 0], "index": 0.06632325620672183}, {"rgb": [0, 0, 0], "index": 0.06789815909474751}, {"rgb": [255, 0, 0], "index": 0.06810504982266509}, {"rgb": [0, 0, 0], "index": 0.06831194055058266}, {"rgb": [0, 0, 0], "index": 0.06859905421381524}, {"rgb": [255, 0, 0], "index": 0.0686539435906097}, {"rgb": [0, 0, 0], "index": 0.06870883296740415}, {"rgb": [0, 0, 0], "index": 0.06937595000844453}, {"rgb": [255, 0, 0], "index": 0.0694561729437595}, {"rgb": [0, 0, 0], "index": 0.06953639587907447}, {"rgb": [0, 0, 0], "index": 0.07211619658841413}, {"rgb": [255, 0, 0], "index": 0.07241175477115352}, {"rgb": [0, 0, 0], "index": 0.07270731295389292}, {"rgb": [0, 0, 0], "index": 0.0732097618645499}, {"rgb": [255, 0, 0], "index": 0.07329842931937172}, {"rgb": [0, 0, 0], "index": 0.07338709677419354}, {"rgb": [0, 0, 0], "index": 0.07580645161290323}, {"rgb": [255, 0, 0], "index": 0.07608512075662895}, {"rgb": [0, 0, 0], "index": 0.07636378990035467}, {"rgb": [0, 0, 0], "index": 0.07665512582334065}, {"rgb": [255, 0, 0], "index": 0.07671845971964195}, {"rgb": [0, 0, 0], "index": 0.07678179361594324}, {"rgb": [0, 0, 0], "index": 0.08234250971119743}, {"rgb": [255, 0, 0], "index": 0.08296740415470359}, {"rgb": [0, 0, 0], "index": 0.08359229859820975}, {"rgb": [0, 0, 0], "index": 0.08414541462590779}, {"rgb": [255, 0, 0], "index": 0.0842763046782638}, {"rgb": [0, 0, 0], "index": 0.08440719473061982}, {"rgb": [0, 0, 0], "index": 0.09096436412768114}, {"rgb": [255, 0, 0], "index": 0.09170748184428305}, {"rgb": [0, 0, 0], "index": 0.09245059956088497}, {"rgb": [0, 0, 0], "index": 0.0920114845465293}, {"rgb": [255, 0, 0], "index": 0.09204526262455666}, {"rgb": [0, 0, 0], "index": 0.09207904070258402}, {"rgb": [0, 0, 0], "index": 0.1031413612565445}, {"rgb": [255, 0, 0], "index": 0.10437426110454315}, {"rgb": [0, 0, 0], "index": 0.1056071609525418}, {"rgb": [0, 0, 0], "index": 0.10589427461577436}, {"rgb": [255, 0, 0], "index": 0.10606316500591116}, {"rgb": [0, 0, 0], "index": 0.10623205539604796}, {"rgb": [0, 0, 0], "index": 0.10788718121938862}, {"rgb": [255, 0, 0], "index": 0.10808984968755278}, {"rgb": [0, 0, 0], "index": 0.10829251815571694}, {"rgb": [0, 0, 0], "index": 0.10865985475426448}, {"rgb": [255, 0, 0], "index": 0.10872318865056578}, {"rgb": [0, 0, 0], "index": 0.10878652254686708}, {"rgb": [0, 0, 0], "index": 0.1094451950684006}, {"rgb": [255, 0, 0], "index": 0.10952541800371558}, {"rgb": [0, 0, 0], "index": 0.10960564093903057}, {"rgb": [0, 0, 0], "index": 0.11207144063502786}, {"rgb": [255, 0, 0], "index": 0.112354332038507}, {"rgb": [0, 0, 0], "index": 0.11263722344198615}, {"rgb": [0, 0, 0], "index": 0.11360834318527277}, {"rgb": [255, 0, 0], "index": 0.11374767775713562}, {"rgb": [0, 0, 0], "index": 0.11388701232899848}, {"rgb": [0, 0, 0], "index": 0.11397567978382031}, {"rgb": [255, 0, 0], "index": 0.11400101334234082}, {"rgb": [0, 0, 0], "index": 0.11402634690086133}, {"rgb": [0, 0, 0], "index": 0.11525502448910657}, {"rgb": [255, 0, 0], "index": 0.11539435906096943}, {"rgb": [0, 0, 0], "index": 0.11553369363283228}, {"rgb": [0, 0, 0], "index": 0.12113241006586727}, {"rgb": [255, 0, 0], "index": 0.12176997128863368}, {"rgb": [0, 0, 0], "index": 0.12240753251140009}, {"rgb": [0, 0, 0], "index": 0.12287198108427631}, {"rgb": [255, 0, 0], "index": 0.12299442661712548}, {"rgb": [0, 0, 0], "index": 0.12311687214997465}, {"rgb": [0, 0, 0], "index": 0.12314642796824861}, {"rgb": [255, 0, 0], "index": 0.12316331700726228}, {"rgb": [0, 0, 0], "index": 0.12318020604627596}, {"rgb": [0, 0, 0], "index": 0.12380932274953554}, {"rgb": [255, 0, 0], "index": 0.12388110116534369}, {"rgb": [0, 0, 0], "index": 0.12395287958115184}, {"rgb": [0, 0, 0], "index": 0.12619912176997128}, {"rgb": [255, 0, 0], "index": 0.1264566796149299}, {"rgb": [0, 0, 0], "index": 0.12671423745988852}, {"rgb": [0, 0, 0], "index": 0.12653268029049147}, {"rgb": [255, 0, 0], "index": 0.12654112480999832}, {"rgb": [0, 0, 0], "index": 0.12654956932950517}, {"rgb": [0, 0, 0], "index": 0.12699712886336767}, {"rgb": [255, 0, 0], "index": 0.12704779598040872}, {"rgb": [0, 0, 0], "index": 0.12709846309744977}, {"rgb": [0, 0, 0], "index": 0.1273137983448742}, {"rgb": [255, 0, 0], "index": 0.12734335416314813}, {"rgb": [0, 0, 0], "index": 0.12737290998142206}, {"rgb": [0, 0, 0], "index": 0.12776135787873671}, {"rgb": [255, 0, 0], "index": 0.12780780273602432}, {"rgb": [0, 0, 0], "index": 0.12785424759331193}, {"rgb": [0, 0, 0], "index": 0.12871981084276307}, {"rgb": [255, 0, 0], "index": 0.12882114507684514}, {"rgb": [0, 0, 0], "index": 0.1289224793109272}, {"rgb": [0, 0, 0], "index": 0.12935314980577606}, {"rgb": [255, 0, 0], "index": 0.12941226144232393}, {"rgb": [0, 0, 0], "index": 0.1294713730788718}, {"rgb": [0, 0, 0], "index": 0.14218037493666613}, {"rgb": [255, 0, 0], "index": 0.14359905421381525}, {"rgb": [0, 0, 0], "index": 0.14501773349096436}, {"rgb": [0, 0, 0], "index": 0.1488431008275629}, {"rgb": [255, 0, 0], "index": 0.14942577267353488}, {"rgb": [0, 0, 0], "index": 0.15000844451950684}, {"rgb": [0, 0, 0], "index": 0.15033778078027363}, {"rgb": [255, 0, 0], "index": 0.1504391150143557}, {"rgb": [0, 0, 0], "index": 0.15054044924843776}, {"rgb": [0, 0, 0], "index": 0.15192112818780612}, {"rgb": [255, 0, 0], "index": 0.1520857963181895}, {"rgb": [0, 0, 0], "index": 0.15225046444857288}, {"rgb": [0, 0, 0], "index": 0.15238979902043576}, {"rgb": [255, 0, 0], "index": 0.1524235770984631}, {"rgb": [0, 0, 0], "index": 0.15245735517649045}, {"rgb": [0, 0, 0], "index": 0.1528035804762709}, {"rgb": [255, 0, 0], "index": 0.1528458030738051}, {"rgb": [0, 0, 0], "index": 0.1528880256713393}, {"rgb": [0, 0, 0], "index": 0.15303580476270898}, {"rgb": [255, 0, 0], "index": 0.1530569160614761}, {"rgb": [0, 0, 0], "index": 0.1530780273602432}, {"rgb": [0, 0, 0], "index": 0.1534749197770647}, {"rgb": [255, 0, 0], "index": 0.15352136463435231}, {"rgb": [0, 0, 0], "index": 0.15356780949163992}, {"rgb": [0, 0, 0], "index": 0.15412937003884478}, {"rgb": [255, 0, 0], "index": 0.1541969261948995}, {"rgb": [0, 0, 0], "index": 0.15426448235095422}, {"rgb": [0, 0, 0], "index": 0.16400101334234082}, {"rgb": [255, 0, 0], "index": 0.16509035635872318}, {"rgb": [0, 0, 0], "index": 0.16617969937510554}, {"rgb": [0, 0, 0], "index": 0.1725764229015369}, {"rgb": [255, 0, 0], "index": 0.17340820807296065}, {"rgb": [0, 0, 0], "index": 0.17423999324438438}, {"rgb": [0, 0, 0], "index": 0.17405421381523392}, {"rgb": [255, 0, 0], "index": 0.17412599223104205}, {"rgb": [0, 0, 0], "index": 0.1741977706468502}, {"rgb": [0, 0, 0], "index": 0.1769380172268198}, {"rgb": [255, 0, 0], "index": 0.17725046444857287}, {"rgb": [0, 0, 0], "index": 0.17756291167032595}, {"rgb": [0, 0, 0], "index": 0.17983448741766594}, {"rgb": [255, 0, 0], "index": 0.1801216010808985}, {"rgb": [0, 0, 0], "index": 0.18040871474413106}, {"rgb": [0, 0, 0], "index": 0.18042560378314473}, {"rgb": [255, 0, 0], "index": 0.1804593818611721}, {"rgb": [0, 0, 0], "index": 0.18049315993919948}, {"rgb": [0, 0, 0], "index": 0.18057338287451444}, {"rgb": [255, 0, 0], "index": 0.1805860496537747}, {"rgb": [0, 0, 0], "index": 0.18059871643303496}, {"rgb": [0, 0, 0], "index": 0.18073805100489782}, {"rgb": [255, 0, 0], "index": 0.1807549400439115}, {"rgb": [0, 0, 0], "index": 0.18077182908292516}, {"rgb": [0, 0, 0], "index": 0.18090694139503463}, {"rgb": [255, 0, 0], "index": 0.1809238304340483}, {"rgb": [0, 0, 0], "index": 0.18094071947306198}, {"rgb": [0, 0, 0], "index": 0.181151832460733}, {"rgb": [255, 0, 0], "index": 0.18117716601925352}, {"rgb": [0, 0, 0], "index": 0.18120249957777404}, {"rgb": [0, 0, 0], "index": 0.18140516804593818}, {"rgb": [255, 0, 0], "index": 0.1814305016044587}, {"rgb": [0, 0, 0], "index": 0.18145583516297922}, {"rgb": [0, 0, 0], "index": 0.20039267015706808}, {"rgb": [255, 0, 0], "index": 0.20249957777402466}, {"rgb": [0, 0, 0], "index": 0.20460648539098125}, {"rgb": [0, 0, 0], "index": 0.20576760682317174}, {"rgb": [255, 0, 0], "index": 0.20613072116196587}, {"rgb": [0, 0, 0], "index": 0.20649383550076}, {"rgb": [0, 0, 0], "index": 0.21190677250464449}, {"rgb": [255, 0, 0], "index": 0.21254855598716432}, {"rgb": [0, 0, 0], "index": 0.21319033946968416}, {"rgb": [0, 0, 0], "index": 0.21638659010302314}, {"rgb": [255, 0, 0], "index": 0.21681303833811857}, {"rgb": [0, 0, 0], "index": 0.217239486573214}, {"rgb": [0, 0, 0], "index": 0.21715504137814562}, {"rgb": [255, 0, 0], "index": 0.21719304171592638}, {"rgb": [0, 0, 0], "index": 0.21723104205370714}, {"rgb": [0, 0, 0], "index": 0.21844705286269211}, {"rgb": [255, 0, 0], "index": 0.21858638743455497}, {"rgb": [0, 0, 0], "index": 0.21872572200641782}, {"rgb": [0, 0, 0], "index": 0.22117041040364804}, {"rgb": [255, 0, 0], "index": 0.2214575240668806}, {"rgb": [0, 0, 0], "index": 0.22174463773011316}, {"rgb": [0, 0, 0], "index": 0.2228255362269887}, {"rgb": [255, 0, 0], "index": 0.2229775375781118}, {"rgb": [0, 0, 0], "index": 0.22312953892923493}, {"rgb": [0, 0, 0], "index": 0.22514355683161627}, {"rgb": [255, 0, 0], "index": 0.22538422563756122}, {"rgb": [0, 0, 0], "index": 0.22562489444350617}, {"rgb": [0, 0, 0], "index": 0.2271702415132579}, {"rgb": [255, 0, 0], "index": 0.22736868772166863}, {"rgb": [0, 0, 0], "index": 0.22756713393007935}, {"rgb": [0, 0, 0], "index": 0.24606485390981253}, {"rgb": [255, 0, 0], "index": 0.24814220570849518}, {"rgb": [0, 0, 0], "index": 0.25021955750717784}, {"rgb": [0, 0, 0], "index": 0.25357625401114675}, {"rgb": [255, 0, 0], "index": 0.25418003715588583}, {"rgb": [0, 0, 0], "index": 0.2547838203006249}, {"rgb": [0, 0, 0], "index": 0.2542940381692282}, {"rgb": [255, 0, 0], "index": 0.25430670494848845}, {"rgb": [0, 0, 0], "index": 0.2543193717277487}, {"rgb": [0, 0, 0], "index": 0.25445870629961154}, {"rgb": [255, 0, 0], "index": 0.25447559533862524}, {"rgb": [0, 0, 0], "index": 0.25449248437763894}, {"rgb": [0, 0, 0], "index": 0.2567176152676913}, {"rgb": [255, 0, 0], "index": 0.25696672859314307}, {"rgb": [0, 0, 0], "index": 0.2572158419185948}, {"rgb": [0, 0, 0], "index": 0.2605387603445364}, {"rgb": [255, 0, 0], "index": 0.2609356527613579}, {"rgb": [0, 0, 0], "index": 0.2613325451781794}, {"rgb": [0, 0, 0], "index": 0.26944772842425263}, {"rgb": [255, 0, 0], "index": 0.2703935146090187}, {"rgb": [0, 0, 0], "index": 0.2713393007937848}, {"rgb": [0, 0, 0], "index": 0.27347154196926193}, {"rgb": [255, 0, 0], "index": 0.27381354500928895}, {"rgb": [0, 0, 0], "index": 0.27415554804931597}, {"rgb": [0, 0, 0], "index": 0.2768535720317514}, {"rgb": [255, 0, 0], "index": 0.277191352812025}, {"rgb": [0, 0, 0], "index": 0.2775291335922986}, {"rgb": [0, 0, 0], "index": 0.2780273602432022}, {"rgb": [255, 0, 0], "index": 0.2781202499577774}, {"rgb": [0, 0, 0], "index": 0.2782131396723526}, {"rgb": [0, 0, 0], "index": 0.2791082587400777}, {"rgb": [255, 0, 0], "index": 0.27921803749366664}, {"rgb": [0, 0, 0], "index": 0.27932781624725556}, {"rgb": [0, 0, 0], "index": 0.28237206552947136}, {"rgb": [255, 0, 0], "index": 0.28272251308900526}, {"rgb": [0, 0, 0], "index": 0.28307296064853915}, {"rgb": [0, 0, 0], "index": 0.2837105218713055}, {"rgb": [255, 0, 0], "index": 0.28382030062489444}, {"rgb": [0, 0, 0], "index": 0.28393007937848336}, {"rgb": [0, 0, 0], "index": 0.28458030738051004}, {"rgb": [255, 0, 0], "index": 0.28466475257557844}, {"rgb": [0, 0, 0], "index": 0.28474919777064683}, {"rgb": [0, 0, 0], "index": 0.28531075831785174}, {"rgb": [255, 0, 0], "index": 0.2853825367336599}, {"rgb": [0, 0, 0], "index": 0.285454315149468}, {"rgb": [0, 0, 0], "index": 0.2858385407870292}, {"rgb": [255, 0, 0], "index": 0.28588920790407024}, {"rgb": [0, 0, 0], "index": 0.2859398750211113}, {"rgb": [0, 0, 0], "index": 0.2871052187130552}, {"rgb": [255, 0, 0], "index": 0.28724033102516466}, {"rgb": [0, 0, 0], "index": 0.2873754433372741}, {"rgb": [0, 0, 0], "index": 0.2885323425097112}, {"rgb": [255, 0, 0], "index": 0.2886758993413275}, {"rgb": [0, 0, 0], "index": 0.28881945617294374}, {"rgb": [0, 0, 0], "index": 0.2889799020435737}, {"rgb": [255, 0, 0], "index": 0.28901368012160106}, {"rgb": [0, 0, 0], "index": 0.2890474581996284}, {"rgb": [0, 0, 0], "index": 0.29292771491302144}, {"rgb": [255, 0, 0], "index": 0.29336260766762373}, {"rgb": [0, 0, 0], "index": 0.293797500422226}, {"rgb": [0, 0, 0], "index": 0.29397061307211625}, {"rgb": [255, 0, 0], "index": 0.29403816922817094}, {"rgb": [0, 0, 0], "index": 0.29410572538422564}, {"rgb": [0, 0, 0], "index": 0.2978382030062489}, {"rgb": [255, 0, 0], "index": 0.29826042898159094}, {"rgb": [0, 0, 0], "index": 0.29868265495693297}, {"rgb": [0, 0, 0], "index": 0.29966644147947985}, {"rgb": [255, 0, 0], "index": 0.2998226650903564}, {"rgb": [0, 0, 0], "index": 0.2999788887012329}, {"rgb": [0, 0, 0], "index": 0.3030526938017227}, {"rgb": [255, 0, 0], "index": 0.3034115858807634}, {"rgb": [0, 0, 0], "index": 0.3037704779598041}, {"rgb": [0, 0, 0], "index": 0.30911163654788043}, {"rgb": [255, 0, 0], "index": 0.3097449755108934}, {"rgb": [0, 0, 0], "index": 0.3103783144739064}, {"rgb": [0, 0, 0], "index": 0.3098589765242358}, {"rgb": [255, 0, 0], "index": 0.30987164330349604}, {"rgb": [0, 0, 0], "index": 0.3098843100827563}, {"rgb": [0, 0, 0], "index": 0.3100236446546191}, {"rgb": [255, 0, 0], "index": 0.3100405336936328}, {"rgb": [0, 0, 0], "index": 0.3100574227326465}, {"rgb": [0, 0, 0], "index": 0.31346056409390305}, {"rgb": [255, 0, 0], "index": 0.31384056747171085}, {"rgb": [0, 0, 0], "index": 0.31422057084951865}, {"rgb": [0, 0, 0], "index": 0.3154745819962844}, {"rgb": [255, 0, 0], "index": 0.31565613916568147}, {"rgb": [0, 0, 0], "index": 0.3158376963350785}, {"rgb": [0, 0, 0], "index": 0.31637814558351635}, {"rgb": [255, 0, 0], "index": 0.3164583685188313}, {"rgb": [0, 0, 0], "index": 0.31653859145414626}, {"rgb": [0, 0, 0], "index": 0.3187003884478973}, {"rgb": [255, 0, 0], "index": 0.3189495017733491}, {"rgb": [0, 0, 0], "index": 0.3191986150988009}, {"rgb": [0, 0, 0], "index": 0.3191015031244722}, {"rgb": [255, 0, 0], "index": 0.3191183921634859}, {"rgb": [0, 0, 0], "index": 0.3191352812024996}, {"rgb": [0, 0, 0], "index": 0.3307464955244047}, {"rgb": [255, 0, 0], "index": 0.3320385070089512}, {"rgb": [0, 0, 0], "index": 0.3333305184934977}, {"rgb": [0, 0, 0], "index": 0.34423661543658163}, {"rgb": [255, 0, 0], "index": 0.3455919608174295}, {"rgb": [0, 0, 0], "index": 0.34694730619827735}, {"rgb": [0, 0, 0], "index": 0.34570596183077185}, {"rgb": [255, 0, 0], "index": 0.3457186286100321}, {"rgb": [0, 0, 0], "index": 0.34573129538929237}, {"rgb": [0, 0, 0], "index": 0.3532806958284074}, {"rgb": [255, 0, 0], "index": 0.35412092551933794}, {"rgb": [0, 0, 0], "index": 0.3549611552102685}, {"rgb": [0, 0, 0], "index": 0.3541969261948995}, {"rgb": [255, 0, 0], "index": 0.35420537071440633}, {"rgb": [0, 0, 0], "index": 0.35421381523391315}, {"rgb": [0, 0, 0], "index": 0.35450937341665256}, {"rgb": [255, 0, 0], "index": 0.35454315149467996}, {"rgb": [0, 0, 0], "index": 0.35457692957270737}, {"rgb": [0, 0, 0], "index": 0.35651916905928055}, {"rgb": [255, 0, 0], "index": 0.3567387265664584}, {"rgb": [0, 0, 0], "index": 0.3569582840736362}, {"rgb": [0, 0, 0], "index": 0.3571187299442662}, {"rgb": [255, 0, 0], "index": 0.35716095254180036}, {"rgb": [0, 0, 0], "index": 0.35720317513933453}, {"rgb": [0, 0, 0], "index": 0.3574649552440466}, {"rgb": [255, 0, 0], "index": 0.357498733322074}, {"rgb": [0, 0, 0], "index": 0.3575325114001014}, {"rgb": [0, 0, 0], "index": 0.3580307380510049}, {"rgb": [255, 0, 0], "index": 0.35808984968755275}, {"rgb": [0, 0, 0], "index": 0.3581489613241006}, {"rgb": [0, 0, 0], "index": 0.35930586049653773}, {"rgb": [255, 0, 0], "index": 0.3594409728086472}, {"rgb": [0, 0, 0], "index": 0.3595760851207566}, {"rgb": [0, 0, 0], "index": 0.3596309744975511}, {"rgb": [255, 0, 0], "index": 0.3596520857963182}, {"rgb": [0, 0, 0], "index": 0.3596731970950853}, {"rgb": [0, 0, 0], "index": 0.3598040871474413}, {"rgb": [255, 0, 0], "index": 0.359820976186455}, {"rgb": [0, 0, 0], "index": 0.3598378652254687}, {"rgb": [0, 0, 0], "index": 0.36088498564431687}, {"rgb": [255, 0, 0], "index": 0.3610032089174126}, {"rgb": [0, 0, 0], "index": 0.36112143219050835}, {"rgb": [0, 0, 0], "index": 0.36130721161965884}, {"rgb": [255, 0, 0], "index": 0.3613409896976862}, {"rgb": [0, 0, 0], "index": 0.36137476777571353}, {"rgb": [0, 0, 0], "index": 0.36255700050667117}, {"rgb": [255, 0, 0], "index": 0.3626921128187806}, {"rgb": [0, 0, 0], "index": 0.36282722513089005}, {"rgb": [0, 0, 0], "index": 0.36527613578787366}, {"rgb": [255, 0, 0], "index": 0.36556324945110624}, {"rgb": [0, 0, 0], "index": 0.36585036311433883}, {"rgb": [0, 0, 0], "index": 0.3668552609356528}, {"rgb": [255, 0, 0], "index": 0.36699881776726906}, {"rgb": [0, 0, 0], "index": 0.3671423745988853}, {"rgb": [0, 0, 0], "index": 0.3926490457692957}, {"rgb": [255, 0, 0], "index": 0.39549907110285426}, {"rgb": [0, 0, 0], "index": 0.3983490964364128}, {"rgb": [0, 0, 0], "index": 0.39591707481844285}, {"rgb": [255, 0, 0], "index": 0.39596351967573046}, {"rgb": [0, 0, 0], "index": 0.39600996453301807}, {"rgb": [0, 0, 0], "index": 0.3969515284580307}, {"rgb": [255, 0, 0], "index": 0.39706130721161964}, {"rgb": [0, 0, 0], "index": 0.39717108596520856}, {"rgb": [0, 0, 0], "index": 0.39964533018071274}, {"rgb": [255, 0, 0], "index": 0.3999324438439453}, {"rgb": [0, 0, 0], "index": 0.4002195575071778}, {"rgb": [0, 0, 0], "index": 0.40221246411079203}, {"rgb": [255, 0, 0], "index": 0.4024657996959973}, {"rgb": [0, 0, 0], "index": 0.4027191352812025}, {"rgb": [0, 0, 0], "index": 0.407367843269718}, {"rgb": [255, 0, 0], "index": 0.40791251477790913}, {"rgb": [0, 0, 0], "index": 0.4084571862861003}, {"rgb": [0, 0, 0], "index": 0.41433457186286105}, {"rgb": [255, 0, 0], "index": 0.415048133761189}, {"rgb": [0, 0, 0], "index": 0.4157616956595169}, {"rgb": [0, 0, 0], "index": 0.41527613578787365}, {"rgb": [255, 0, 0], "index": 0.41530146934639417}, {"rgb": [0, 0, 0], "index": 0.4153268029049147}, {"rgb": [0, 0, 0], "index": 0.41742948826211784}, {"rgb": [255, 0, 0], "index": 0.4176659348083094}, {"rgb": [0, 0, 0], "index": 0.4179023813545009}, {"rgb": [0, 0, 0], "index": 0.41812193886167875}, {"rgb": [255, 0, 0], "index": 0.4181726059787198}, {"rgb": [0, 0, 0], "index": 0.41822327309576085}, {"rgb": [0, 0, 0], "index": 0.42375865563249454}, {"rgb": [255, 0, 0], "index": 0.42437932781624726}, {"rgb": [0, 0, 0], "index": 0.425}, {"rgb": [0, 0, 0], "index": 0.42555733828745146}, {"rgb": [255, 0, 0], "index": 0.42568822833980746}, {"rgb": [0, 0, 0], "index": 0.42581911839216346}, {"rgb": [0, 0, 0], "index": 0.4297922648201318}, {"rgb": [255, 0, 0], "index": 0.4302482688735011}, {"rgb": [0, 0, 0], "index": 0.4307042729268704}, {"rgb": [0, 0, 0], "index": 0.43192028373585545}, {"rgb": [255, 0, 0], "index": 0.43210606316500594}, {"rgb": [0, 0, 0], "index": 0.43229184259415643}, {"rgb": [0, 0, 0], "index": 0.43320807296064856}, {"rgb": [255, 0, 0], "index": 0.43333051849349774}, {"rgb": [0, 0, 0], "index": 0.4334529640263469}, {"rgb": [0, 0, 0], "index": 0.4347365309913866}, {"rgb": [255, 0, 0], "index": 0.4348927546022631}, {"rgb": [0, 0, 0], "index": 0.43504897821313965}, {"rgb": [0, 0, 0], "index": 0.43572876203344024}, {"rgb": [255, 0, 0], "index": 0.4358216517480155}, {"rgb": [0, 0, 0], "index": 0.4359145414625908}, {"rgb": [0, 0, 0], "index": 0.436961661881439}, {"rgb": [255, 0, 0], "index": 0.43708832967404154}, {"rgb": [0, 0, 0], "index": 0.4372149974666441}, {"rgb": [0, 0, 0], "index": 0.4405843607498733}, {"rgb": [255, 0, 0], "index": 0.44097280864718796}, {"rgb": [0, 0, 0], "index": 0.44136125654450264}, {"rgb": [0, 0, 0], "index": 0.44287282553622703}, {"rgb": [255, 0, 0], "index": 0.443083938523898}, {"rgb": [0, 0, 0], "index": 0.44329505151156895}, {"rgb": [0, 0, 0], "index": 0.44513595676406015}, {"rgb": [255, 0, 0], "index": 0.4453639587907448}, {"rgb": [0, 0, 0], "index": 0.44559196081742947}, {"rgb": [0, 0, 0], "index": 0.454674041547036}, {"rgb": [255, 0, 0], "index": 0.4557084951866239}, {"rgb": [0, 0, 0], "index": 0.45674294882621175}, {"rgb": [0, 0, 0], "index": 0.45821651748015535}, {"rgb": [255, 0, 0], "index": 0.4584951866238811}, {"rgb": [0, 0, 0], "index": 0.4587738557676069}, {"rgb": [0, 0, 0], "index": 0.4662092551933795}, {"rgb": [255, 0, 0], "index": 0.4670663739233238}, {"rgb": [0, 0, 0], "index": 0.46792349265326805}, {"rgb": [0, 0, 0], "index": 0.47253842256375617}, {"rgb": [255, 0, 0], "index": 0.47314642796824863}, {"rgb": [0, 0, 0], "index": 0.4737544333727411}, {"rgb": [0, 0, 0], "index": 0.4775544671508191}, {"rgb": [255, 0, 0], "index": 0.47804424928221584}, {"rgb": [0, 0, 0], "index": 0.47853403141361256}, {"rgb": [0, 0, 0], "index": 0.48085627427799355}, {"rgb": [255, 0, 0], "index": 0.48116872149974665}, {"rgb": [0, 0, 0], "index": 0.48148116872149976}, {"rgb": [0, 0, 0], "index": 0.4942028373585543}, {"rgb": [255, 0, 0], "index": 0.4956510724539774}, {"rgb": [0, 0, 0], "index": 0.49709930754940046}, {"rgb": [0, 0, 0], "index": 0.4989191015031245}, {"rgb": [255, 0, 0], "index": 0.4992822158419186}, {"rgb": [0, 0, 0], "index": 0.4996453301807127}, {"rgb": [0, 0, 0], "index": 0.5127343354163149}, {"rgb": [255, 0, 0], "index": 0.5142290153690255}, {"rgb": [0, 0, 0], "index": 0.5157236953217362}, {"rgb": [0, 0, 0], "index": 0.5207270731295389}, {"rgb": [255, 0, 0], "index": 0.5214490795473737}, {"rgb": [0, 0, 0], "index": 0.5221710859652086}, {"rgb": [0, 0, 0], "index": 0.5216770815740585}, {"rgb": [255, 0, 0], "index": 0.521702415132579}, {"rgb": [0, 0, 0], "index": 0.5217277486910995}, {"rgb": [0, 0, 0], "index": 0.5221204188481676}, {"rgb": [255, 0, 0], "index": 0.5221668637054552}, {"rgb": [0, 0, 0], "index": 0.5222133085627427}, {"rgb": [0, 0, 0], "index": 0.5223568653943591}, {"rgb": [255, 0, 0], "index": 0.5223779766931261}, {"rgb": [0, 0, 0], "index": 0.5223990879918932}, {"rgb": [0, 0, 0], "index": 0.5232519844620841}, {"rgb": [255, 0, 0], "index": 0.5233490964364128}, {"rgb": [0, 0, 0], "index": 0.5234462084107415}, {"rgb": [0, 0, 0], "index": 0.5255151156899172}, {"rgb": [255, 0, 0], "index": 0.5257557844958621}, {"rgb": [0, 0, 0], "index": 0.5259964533018071}, {"rgb": [0, 0, 0], "index": 0.5314178348251984}, {"rgb": [255, 0, 0], "index": 0.532046951528458}, {"rgb": [0, 0, 0], "index": 0.5326760682317176}, {"rgb": [0, 0, 0], "index": 0.53846900861341}, {"rgb": [255, 0, 0], "index": 0.5391825705117379}, {"rgb": [0, 0, 0], "index": 0.5398961324100658}, {"rgb": [0, 0, 0], "index": 0.5405125823340653}, {"rgb": [255, 0, 0], "index": 0.5406603614254349}, {"rgb": [0, 0, 0], "index": 0.5408081405168046}, {"rgb": [0, 0, 0], "index": 0.5415723695321736}, {"rgb": [255, 0, 0], "index": 0.5416737037662557}, {"rgb": [0, 0, 0], "index": 0.5417750380003378}, {"rgb": [0, 0, 0], "index": 0.544067725046445}, {"rgb": [255, 0, 0], "index": 0.5443337274109104}, {"rgb": [0, 0, 0], "index": 0.5445997297753757}, {"rgb": [0, 0, 0], "index": 0.5446377301131565}, {"rgb": [255, 0, 0], "index": 0.5446715081911839}, {"rgb": [0, 0, 0], "index": 0.5447052862692113}, {"rgb": [0, 0, 0], "index": 0.5473695321736194}, {"rgb": [255, 0, 0], "index": 0.5476693126161122}, {"rgb": [0, 0, 0], "index": 0.547969093058605}, {"rgb": [0, 0, 0], "index": 0.5502913359229861}, {"rgb": [255, 0, 0], "index": 0.550582671845972}, {"rgb": [0, 0, 0], "index": 0.5508740077689579}, {"rgb": [0, 0, 0], "index": 0.5518366829927377}, {"rgb": [255, 0, 0], "index": 0.5519760175646006}, {"rgb": [0, 0, 0], "index": 0.5521153521364635}, {"rgb": [0, 0, 0], "index": 0.5559660530315825}, {"rgb": [255, 0, 0], "index": 0.5564093903056916}, {"rgb": [0, 0, 0], "index": 0.5568527275798006}, {"rgb": [0, 0, 0], "index": 0.5589174125992231}, {"rgb": [255, 0, 0], "index": 0.5591960817429489}, {"rgb": [0, 0, 0], "index": 0.5594747508866746}, {"rgb": [0, 0, 0], "index": 0.5607160952541801}, {"rgb": [255, 0, 0], "index": 0.5608849856443169}, {"rgb": [0, 0, 0], "index": 0.5610538760344537}, {"rgb": [0, 0, 0], "index": 0.562062996115521}, {"rgb": [255, 0, 0], "index": 0.562193886167877}, {"rgb": [0, 0, 0], "index": 0.562324776220233}, {"rgb": [0, 0, 0], "index": 0.5624218881945617}, {"rgb": [255, 0, 0], "index": 0.5624472217530823}, {"rgb": [0, 0, 0], "index": 0.5624725553116028}, {"rgb": [0, 0, 0], "index": 0.5675772673534876}, {"rgb": [255, 0, 0], "index": 0.5681472724201992}, {"rgb": [0, 0, 0], "index": 0.5687172774869109}, {"rgb": [0, 0, 0], "index": 0.5750253335585206}, {"rgb": [255, 0, 0], "index": 0.5757895625738896}, {"rgb": [0, 0, 0], "index": 0.5765537915892586}, {"rgb": [0, 0, 0], "index": 0.5833516297922648}, {"rgb": [255, 0, 0], "index": 0.5841918594831954}, {"rgb": [0, 0, 0], "index": 0.585032089174126}, {"rgb": [0, 0, 0], "index": 0.604484039858132}, {"rgb": [255, 0, 0], "index": 0.6067387265664583}, {"rgb": [0, 0, 0], "index": 0.6089934132747846}, {"rgb": [0, 0, 0], "index": 0.6070807296064854}, {"rgb": [255, 0, 0], "index": 0.6071187299442662}, {"rgb": [0, 0, 0], "index": 0.607156730282047}, {"rgb": [0, 0, 0], "index": 0.6072707312953893}, {"rgb": [255, 0, 0], "index": 0.607287620334403}, {"rgb": [0, 0, 0], "index": 0.6073045093734166}, {"rgb": [0, 0, 0], "index": 0.6084656308056071}, {"rgb": [255, 0, 0], "index": 0.6085965208579632}, {"rgb": [0, 0, 0], "index": 0.6087274109103193}, {"rgb": [0, 0, 0], "index": 0.6144865732139843}, {"rgb": [255, 0, 0], "index": 0.6151410234757643}, {"rgb": [0, 0, 0], "index": 0.6157954737375443}, {"rgb": [0, 0, 0], "index": 0.6174210437426111}, {"rgb": [255, 0, 0], "index": 0.6176743793278162}, {"rgb": [0, 0, 0], "index": 0.6179277149130213}, {"rgb": [0, 0, 0], "index": 0.6313165005911163}, {"rgb": [255, 0, 0], "index": 0.6328322918425942}, {"rgb": [0, 0, 0], "index": 0.634348083094072}, {"rgb": [0, 0, 0], "index": 0.6353023137983449}, {"rgb": [255, 0, 0], "index": 0.6355767606823172}, {"rgb": [0, 0, 0], "index": 0.6358512075662894}, {"rgb": [0, 0, 0], "index": 0.6356907616956595}, {"rgb": [255, 0, 0], "index": 0.6357034284749198}, {"rgb": [0, 0, 0], "index": 0.63571609525418}, {"rgb": [0, 0, 0], "index": 0.6361594325282891}, {"rgb": [255, 0, 0], "index": 0.6362100996453302}, {"rgb": [0, 0, 0], "index": 0.6362607667623712}, {"rgb": [0, 0, 0], "index": 0.6428981590947475}, {"rgb": [255, 0, 0], "index": 0.6436412768113494}, {"rgb": [0, 0, 0], "index": 0.6443843945279514}, {"rgb": [0, 0, 0], "index": 0.6469473061982773}, {"rgb": [255, 0, 0], "index": 0.6473146427968248}, {"rgb": [0, 0, 0], "index": 0.6476819793953723}, {"rgb": [0, 0, 0], "index": 0.6646807971626414}, {"rgb": [255, 0, 0], "index": 0.6666103698699544}, {"rgb": [0, 0, 0], "index": 0.6685399425772673}, {"rgb": [0, 0, 0], "index": 0.6666483702077353}, {"rgb": [255, 0, 0], "index": 0.6666525924674886}, {"rgb": [0, 0, 0], "index": 0.666656814727242}, {"rgb": [0, 0, 0], "index": 0.6691606147610201}, {"rgb": [255, 0, 0], "index": 0.6694392839047458}, {"rgb": [0, 0, 0], "index": 0.6697179530484716}, {"rgb": [0, 0, 0], "index": 0.6706552947137309}, {"rgb": [255, 0, 0], "index": 0.6707904070258403}, {"rgb": [0, 0, 0], "index": 0.6709255193379496}, {"rgb": [0, 0, 0], "index": 0.6714364127681136}, {"rgb": [255, 0, 0], "index": 0.6715081911839217}, {"rgb": [0, 0, 0], "index": 0.6715799695997298}, {"rgb": [0, 0, 0], "index": 0.6727622023306874}, {"rgb": [255, 0, 0], "index": 0.6729015369025503}, {"rgb": [0, 0, 0], "index": 0.6730408714744132}, {"rgb": [0, 0, 0], "index": 0.6787155885830096}, {"rgb": [255, 0, 0], "index": 0.6793615943252829}, {"rgb": [0, 0, 0], "index": 0.6800076000675561}, {"rgb": [0, 0, 0], "index": 0.6936877216686371}, {"rgb": [255, 0, 0], "index": 0.6952795135956764}, {"rgb": [0, 0, 0], "index": 0.6968713055227157}, {"rgb": [0, 0, 0], "index": 0.6974075325114001}, {"rgb": [255, 0, 0], "index": 0.6976439790575916}, {"rgb": [0, 0, 0], "index": 0.697880425603783}, {"rgb": [0, 0, 0], "index": 0.6977579800709339}, {"rgb": [255, 0, 0], "index": 0.6977706468501942}, {"rgb": [0, 0, 0], "index": 0.6977833136294544}, {"rgb": [0, 0, 0], "index": 0.7046107076507346}, {"rgb": [255, 0, 0], "index": 0.7053707144063502}, {"rgb": [0, 0, 0], "index": 0.7061307211619658}, {"rgb": [0, 0, 0], "index": 0.7076887350109778}, {"rgb": [255, 0, 0], "index": 0.7079462928559365}, {"rgb": [0, 0, 0], "index": 0.7082038507008951}, {"rgb": [0, 0, 0], "index": 0.7107203175139335}, {"rgb": [255, 0, 0], "index": 0.7110285424759332}, {"rgb": [0, 0, 0], "index": 0.7113367674379328}, {"rgb": [0, 0, 0], "index": 0.7150565782806959}, {"rgb": [255, 0, 0], "index": 0.7155041378145583}, {"rgb": [0, 0, 0], "index": 0.7159516973484208}, {"rgb": [0, 0, 0], "index": 0.7174421550413782}, {"rgb": [255, 0, 0], "index": 0.7176574902888025}, {"rgb": [0, 0, 0], "index": 0.7178728255362269}, {"rgb": [0, 0, 0], "index": 0.726739571018409}, {"rgb": [255, 0, 0], "index": 0.7277486910994765}, {"rgb": [0, 0, 0], "index": 0.728757811180544}, {"rgb": [0, 0, 0], "index": 0.7360707650734674}, {"rgb": [255, 0, 0], "index": 0.7369954399594663}, {"rgb": [0, 0, 0], "index": 0.7379201148454652}, {"rgb": [0, 0, 0], "index": 0.7448995102178686}, {"rgb": [255, 0, 0], "index": 0.74577774024658}, {"rgb": [0, 0, 0], "index": 0.7466559702752913}, {"rgb": [0, 0, 0], "index": 0.7469557507177842}, {"rgb": [255, 0, 0], "index": 0.7470866407701402}, {"rgb": [0, 0, 0], "index": 0.7472175308224962}, {"rgb": [0, 0, 0], "index": 0.7498606654281371}, {"rgb": [255, 0, 0], "index": 0.7501688903901368}, {"rgb": [0, 0, 0], "index": 0.7504771153521365}, {"rgb": [0, 0, 0], "index": 0.7618729944266172}, {"rgb": [255, 0, 0], "index": 0.7631734504306705}, {"rgb": [0, 0, 0], "index": 0.7644739064347239}, {"rgb": [0, 0, 0], "index": 0.7632494511062321}, {"rgb": [255, 0, 0], "index": 0.7632578956257389}, {"rgb": [0, 0, 0], "index": 0.7632663401452456}, {"rgb": [0, 0, 0], "index": 0.7643219050836008}, {"rgb": [255, 0, 0], "index": 0.7644401283566965}, {"rgb": [0, 0, 0], "index": 0.7645583516297922}, {"rgb": [0, 0, 0], "index": 0.7646301300456004}, {"rgb": [255, 0, 0], "index": 0.7646512413443675}, {"rgb": [0, 0, 0], "index": 0.7646723526431345}, {"rgb": [0, 0, 0], "index": 0.7713013004560041}, {"rgb": [255, 0, 0], "index": 0.7720401959128526}, {"rgb": [0, 0, 0], "index": 0.772779091369701}, {"rgb": [0, 0, 0], "index": 0.7743202161796994}, {"rgb": [255, 0, 0], "index": 0.7745735517649046}, {"rgb": [0, 0, 0], "index": 0.7748268873501098}, {"rgb": [0, 0, 0], "index": 0.7751435568316163}, {"rgb": [255, 0, 0], "index": 0.7752068907279176}, {"rgb": [0, 0, 0], "index": 0.7752702246242189}, {"rgb": [0, 0, 0], "index": 0.7786649214659686}, {"rgb": [255, 0, 0], "index": 0.7790491471035298}, {"rgb": [0, 0, 0], "index": 0.779433372741091}, {"rgb": [0, 0, 0], "index": 0.7791631481168722}, {"rgb": [255, 0, 0], "index": 0.7791758148961324}, {"rgb": [0, 0, 0], "index": 0.7791884816753927}, {"rgb": [0, 0, 0], "index": 0.7793658165850363}, {"rgb": [255, 0, 0], "index": 0.7793869278838034}, {"rgb": [0, 0, 0], "index": 0.7794080391825704}, {"rgb": [0, 0, 0], "index": 0.779804931599392}, {"rgb": [255, 0, 0], "index": 0.7798513764566796}, {"rgb": [0, 0, 0], "index": 0.7798978213139671}, {"rgb": [0, 0, 0], "index": 0.7820553960479649}, {"rgb": [255, 0, 0], "index": 0.7823002871136633}, {"rgb": [0, 0, 0], "index": 0.7825451781793616}, {"rgb": [0, 0, 0], "index": 0.789254348927546}, {"rgb": [255, 0, 0], "index": 0.7900270224624218}, {"rgb": [0, 0, 0], "index": 0.7907996959972977}, {"rgb": [0, 0, 0], "index": 0.790863029893599}, {"rgb": [255, 0, 0], "index": 0.7909559196081742}, {"rgb": [0, 0, 0], "index": 0.7910488093227495}, {"rgb": [0, 0, 0], "index": 0.7916019253504475}, {"rgb": [255, 0, 0], "index": 0.7916737037662557}, {"rgb": [0, 0, 0], "index": 0.7917454821820639}, {"rgb": [0, 0, 0], "index": 0.7974497551089342}, {"rgb": [255, 0, 0], "index": 0.7980915385914541}, {"rgb": [0, 0, 0], "index": 0.798733322073974}, {"rgb": [0, 0, 0], "index": 0.800371558858301}, {"rgb": [255, 0, 0], "index": 0.8006248944435062}, {"rgb": [0, 0, 0], "index": 0.8008782300287113}, {"rgb": [0, 0, 0], "index": 0.8065149467995272}, {"rgb": [255, 0, 0], "index": 0.8071693970613072}, {"rgb": [0, 0, 0], "index": 0.8078238473230872}, {"rgb": [0, 0, 0], "index": 0.8077774024657998}, {"rgb": [255, 0, 0], "index": 0.8078449586218545}, {"rgb": [0, 0, 0], "index": 0.8079125147779092}, {"rgb": [0, 0, 0], "index": 0.8108089849687552}, {"rgb": [255, 0, 0], "index": 0.811138321229522}, {"rgb": [0, 0, 0], "index": 0.8114676574902888}, {"rgb": [0, 0, 0], "index": 0.8117463266340146}, {"rgb": [255, 0, 0], "index": 0.8118138827900693}, {"rgb": [0, 0, 0], "index": 0.811881438946124}, {"rgb": [0, 0, 0], "index": 0.825684006080054}, {"rgb": [255, 0, 0], "index": 0.8272251308900523}, {"rgb": [0, 0, 0], "index": 0.8287662557000507}, {"rgb": [0, 0, 0], "index": 0.8360412092551934}, {"rgb": [255, 0, 0], "index": 0.8370207735179869}, {"rgb": [0, 0, 0], "index": 0.8380003377807803}, {"rgb": [0, 0, 0], "index": 0.8396427968248608}, {"rgb": [255, 0, 0], "index": 0.8399341327478467}, {"rgb": [0, 0, 0], "index": 0.8402254686708326}, {"rgb": [0, 0, 0], "index": 0.8455581827394022}, {"rgb": [255, 0, 0], "index": 0.8461830771829083}, {"rgb": [0, 0, 0], "index": 0.8468079716264144}, {"rgb": [0, 0, 0], "index": 0.8481590947475088}, {"rgb": [255, 0, 0], "index": 0.8483786522546867}, {"rgb": [0, 0, 0], "index": 0.8485982097618645}, {"rgb": [0, 0, 0], "index": 0.8504686708326297}, {"rgb": [255, 0, 0], "index": 0.8507008951190678}, {"rgb": [0, 0, 0], "index": 0.8509331194055059}, {"rgb": [0, 0, 0], "index": 0.8509668974835333}, {"rgb": [255, 0, 0], "index": 0.8509964533018072}, {"rgb": [0, 0, 0], "index": 0.8510260091200811}, {"rgb": [0, 0, 0], "index": 0.8526304678263807}, {"rgb": [255, 0, 0], "index": 0.8528120249957778}, {"rgb": [0, 0, 0], "index": 0.8529935821651748}, {"rgb": [0, 0, 0], "index": 0.8539900354669819}, {"rgb": [255, 0, 0], "index": 0.8541209255193379}, {"rgb": [0, 0, 0], "index": 0.8542518155716939}, {"rgb": [0, 0, 0], "index": 0.8557929403816923}, {"rgb": [255, 0, 0], "index": 0.8559787198108427}, {"rgb": [0, 0, 0], "index": 0.8561644992399932}, {"rgb": [0, 0, 0], "index": 0.8615267691268367}, {"rgb": [255, 0, 0], "index": 0.862143219050836}, {"rgb": [0, 0, 0], "index": 0.8627596689748354}, {"rgb": [0, 0, 0], "index": 0.8649552440466137}, {"rgb": [255, 0, 0], "index": 0.8652676912683668}, {"rgb": [0, 0, 0], "index": 0.8655801384901198}, {"rgb": [0, 0, 0], "index": 0.8682697179530484}, {"rgb": [255, 0, 0], "index": 0.8686032764735686}, {"rgb": [0, 0, 0], "index": 0.8689368349940888}, {"rgb": [0, 0, 0], "index": 0.8727833136294545}, {"rgb": [255, 0, 0], "index": 0.8732477622023307}, {"rgb": [0, 0, 0], "index": 0.8737122107752069}, {"rgb": [0, 0, 0], "index": 0.8747297753757811}, {"rgb": [255, 0, 0], "index": 0.8748944435061645}, {"rgb": [0, 0, 0], "index": 0.8750591116365479}, {"rgb": [0, 0, 0], "index": 0.8816585036311434}, {"rgb": [255, 0, 0], "index": 0.8824100658672521}, {"rgb": [0, 0, 0], "index": 0.8831616281033609}, {"rgb": [0, 0, 0], "index": 0.8828660699206216}, {"rgb": [255, 0, 0], "index": 0.8829167370376626}, {"rgb": [0, 0, 0], "index": 0.8829674041547037}, {"rgb": [0, 0, 0], "index": 0.8843227495355515}, {"rgb": [255, 0, 0], "index": 0.884478973146428}, {"rgb": [0, 0, 0], "index": 0.8846351967573045}, {"rgb": [0, 0, 0], "index": 0.8848209761864549}, {"rgb": [255, 0, 0], "index": 0.8848589765242357}, {"rgb": [0, 0, 0], "index": 0.8848969768620165}, {"rgb": [0, 0, 0], "index": 0.8855809829420707}, {"rgb": [255, 0, 0], "index": 0.8856612058773856}, {"rgb": [0, 0, 0], "index": 0.8857414288127006}, {"rgb": [0, 0, 0], "index": 0.8863072116196589}, {"rgb": [255, 0, 0], "index": 0.8863789900354669}, {"rgb": [0, 0, 0], "index": 0.886450768451275}, {"rgb": [0, 0, 0], "index": 0.8888110116534369}, {"rgb": [255, 0, 0], "index": 0.8890812362776558}, {"rgb": [0, 0, 0], "index": 0.8893514609018747}, {"rgb": [0, 0, 0], "index": 0.894591285255869}, {"rgb": [255, 0, 0], "index": 0.8952035129201148}, {"rgb": [0, 0, 0], "index": 0.8958157405843606}, {"rgb": [0, 0, 0], "index": 0.8970275291335924}, {"rgb": [255, 0, 0], "index": 0.8972301976017565}, {"rgb": [0, 0, 0], "index": 0.8974328660699206}, {"rgb": [0, 0, 0], "index": 0.9046022631312278}, {"rgb": [255, 0, 0], "index": 0.9054213815233914}, {"rgb": [0, 0, 0], "index": 0.9062404999155549}, {"rgb": [0, 0, 0], "index": 0.9097154196926195}, {"rgb": [255, 0, 0], "index": 0.910192535044756}, {"rgb": [0, 0, 0], "index": 0.9106696503968924}, {"rgb": [0, 0, 0], "index": 0.915550582671846}, {"rgb": [255, 0, 0], "index": 0.9161459212970782}, {"rgb": [0, 0, 0], "index": 0.9167412599223104}, {"rgb": [0, 0, 0], "index": 0.9166779260260091}, {"rgb": [255, 0, 0], "index": 0.916737037662557}, {"rgb": [0, 0, 0], "index": 0.9167961492991049}, {"rgb": [0, 0, 0], "index": 0.9171170410403648}, {"rgb": [255, 0, 0], "index": 0.917159263637899}, {"rgb": [0, 0, 0], "index": 0.9172014862354332}, {"rgb": [0, 0, 0], "index": 0.9172352643134605}, {"rgb": [255, 0, 0], "index": 0.9172437088329674}, {"rgb": [0, 0, 0], "index": 0.9172521533524742}, {"rgb": [0, 0, 0], "index": 0.9225257557844959}, {"rgb": [255, 0, 0], "index": 0.9231126498902212}, {"rgb": [0, 0, 0], "index": 0.9236995439959466}, {"rgb": [0, 0, 0], "index": 0.9243286606992062}, {"rgb": [255, 0, 0], "index": 0.9244637730113157}, {"rgb": [0, 0, 0], "index": 0.9245988853234252}, {"rgb": [0, 0, 0], "index": 0.9248057760513426}, {"rgb": [255, 0, 0], "index": 0.9248437763891234}, {"rgb": [0, 0, 0], "index": 0.9248817767269042}, {"rgb": [0, 0, 0], "index": 0.9257177841580815}, {"rgb": [255, 0, 0], "index": 0.9258148961324101}, {"rgb": [0, 0, 0], "index": 0.9259120081067387}, {"rgb": [0, 0, 0], "index": 0.9342889714575241}, {"rgb": [255, 0, 0], "index": 0.9352305353825368}, {"rgb": [0, 0, 0], "index": 0.9361720993075494}, {"rgb": [0, 0, 0], "index": 0.9372445532849181}, {"rgb": [255, 0, 0], "index": 0.9374683330518494}, {"rgb": [0, 0, 0], "index": 0.9376921128187807}, {"rgb": [0, 0, 0], "index": 0.9378483364296571}, {"rgb": [255, 0, 0], "index": 0.9378905590271913}, {"rgb": [0, 0, 0], "index": 0.9379327816247255}, {"rgb": [0, 0, 0], "index": 0.9433626076676237}, {"rgb": [255, 0, 0], "index": 0.9439706130721162}, {"rgb": [0, 0, 0], "index": 0.9445786184766086}, {"rgb": [0, 0, 0], "index": 0.9449966221921973}, {"rgb": [255, 0, 0], "index": 0.9451106232055396}, {"rgb": [0, 0, 0], "index": 0.945224624218882}, {"rgb": [0, 0, 0], "index": 0.9483406519169059}, {"rgb": [255, 0, 0], "index": 0.9486995439959466}, {"rgb": [0, 0, 0], "index": 0.9490584360749873}, {"rgb": [0, 0, 0], "index": 0.9528035804762709}, {"rgb": [255, 0, 0], "index": 0.9532595845296402}, {"rgb": [0, 0, 0], "index": 0.9537155885830095}, {"rgb": [0, 0, 0], "index": 0.9533355852052018}, {"rgb": [255, 0, 0], "index": 0.9533440297247087}, {"rgb": [0, 0, 0], "index": 0.9533524742442155}, {"rgb": [0, 0, 0], "index": 0.9544080391825706}, {"rgb": [255, 0, 0], "index": 0.9545262624556663}, {"rgb": [0, 0, 0], "index": 0.954644485728762}, {"rgb": [0, 0, 0], "index": 0.956806282722513}, {"rgb": [255, 0, 0], "index": 0.9570596183077182}, {"rgb": [0, 0, 0], "index": 0.9573129538929235}, {"rgb": [0, 0, 0], "index": 0.9594916399256882}, {"rgb": [255, 0, 0], "index": 0.9597618645499071}, {"rgb": [0, 0, 0], "index": 0.960032089174126}, {"rgb": [0, 0, 0], "index": 0.9599898665765918}, {"rgb": [255, 0, 0], "index": 0.9600152001351123}, {"rgb": [0, 0, 0], "index": 0.9600405336936328}, {"rgb": [0, 0, 0], "index": 0.961117209930755}, {"rgb": [255, 0, 0], "index": 0.9612396554636041}, {"rgb": [0, 0, 0], "index": 0.9613621009964533}, {"rgb": [0, 0, 0], "index": 0.9631396723526431}, {"rgb": [255, 0, 0], "index": 0.9633507853403142}, {"rgb": [0, 0, 0], "index": 0.9635618983279852}, {"rgb": [0, 0, 0], "index": 0.9647187975004223}, {"rgb": [255, 0, 0], "index": 0.9648707988515454}, {"rgb": [0, 0, 0], "index": 0.9650228002026684}, {"rgb": [0, 0, 0], "index": 0.9704188481675393}, {"rgb": [255, 0, 0], "index": 0.9710352980915385}, {"rgb": [0, 0, 0], "index": 0.9716517480155378}, {"rgb": [0, 0, 0], "index": 0.9758613409896977}, {"rgb": [255, 0, 0], "index": 0.9763975679783821}, {"rgb": [0, 0, 0], "index": 0.9769337949670664}, {"rgb": [0, 0, 0], "index": 0.979513595676406}, {"rgb": [255, 0, 0], "index": 0.9798598209761864}, {"rgb": [0, 0, 0], "index": 0.9802060462759669}, {"rgb": [0, 0, 0], "index": 0.981835838540787}, {"rgb": [255, 0, 0], "index": 0.9820553960479649}, {"rgb": [0, 0, 0], "index": 0.9822749535551427}, {"rgb": [0, 0, 0], "index": 0.9835754095591961}, {"rgb": [255, 0, 0], "index": 0.9837442999493329}, {"rgb": [0, 0, 0], "index": 0.9839131903394697}, {"rgb": [0, 0, 0], "index": 0.9843523053538253}, {"rgb": [255, 0, 0], "index": 0.98441986150988}, {"rgb": [0, 0, 0], "index": 0.9844874176659347}, {"rgb": [0, 0, 0], "index": 0.9848758655632495}, {"rgb": [255, 0, 0], "index": 0.9849265326802905}, {"rgb": [0, 0, 0], "index": 0.9849771997973316}, {"rgb": [0, 0, 0], "index": 0.9852685357203175}, {"rgb": [255, 0, 0], "index": 0.9853065360580983}, {"rgb": [0, 0, 0], "index": 0.985344536395879}, {"rgb": [0, 0, 0], "index": 0.9861045431514947}, {"rgb": [255, 0, 0], "index": 0.9861932106063165}, {"rgb": [0, 0, 0], "index": 0.9862818780611383}, {"rgb": [0, 0, 0], "index": 0.9889292349265327}, {"rgb": [255, 0, 0], "index": 0.9892332376287789}, {"rgb": [0, 0, 0], "index": 0.9895372403310251}, {"rgb": [0, 0, 0], "index": 0.9931472724201994}, {"rgb": [255, 0, 0], "index": 0.9935821651748016}, {"rgb": [0, 0, 0], "index": 0.9940170579294038}, {"rgb": [0, 0, 0], "index": 0.9950261780104712}, {"rgb": [255, 0, 0], "index": 0.9951866238811011}, {"rgb": [0, 0, 0], "index": 0.995347069751731}, {"rgb": [0, 0, 0], "index": 1}],
	
	"anticipation": [{"index": 0, "rgb": [0, 0, 0]}, {"index": 0.005814051680459382, "rgb": [0, 0, 0]}, {"index": 0.006460057422732647, "rgb": [255, 165, 0]}, {"index": 0.007106063165005911, "rgb": [0, 0, 0]}, {"index": 0.010678094916399258, "rgb": [0, 0, 0]}, {"index": 0.01114676574902888, "rgb": [255, 165, 0]}, {"index": 0.011615436581658502, "rgb": [0, 0, 0]}, {"index": 0.011564769464617463, "rgb": [0, 0, 0]}, {"index": 0.011611214321905084, "rgb": [255, 165, 0]}, {"index": 0.011657659179192705, "rgb": [0, 0, 0]}, {"index": 0.012143219050836008, "rgb": [0, 0, 0]}, {"index": 0.012202330687383888, "rgb": [255, 165, 0]}, {"index": 0.01226144232393177, "rgb": [0, 0, 0]}, {"index": 0.013418341496368858, "rgb": [0, 0, 0]}, {"index": 0.013553453808478298, "rgb": [255, 165, 0]}, {"index": 0.013688566120587739, "rgb": [0, 0, 0]}, {"index": 0.013781455835162978, "rgb": [0, 0, 0]}, {"index": 0.013806789393683499, "rgb": [255, 165, 0]}, {"index": 0.01383212295220402, "rgb": [0, 0, 0]}, {"index": 0.016770815740584363, "rgb": [0, 0, 0]}, {"index": 0.017100152001351124, "rgb": [255, 165, 0]}, {"index": 0.017429488262117886, "rgb": [0, 0, 0]}, {"index": 0.017404154703597366, "rgb": [0, 0, 0]}, {"index": 0.017437932781624726, "rgb": [255, 165, 0]}, {"index": 0.017471710859652087, "rgb": [0, 0, 0]}, {"index": 0.01812193886167877, "rgb": [0, 0, 0]}, {"index": 0.018197939537240332, "rgb": [255, 165, 0]}, {"index": 0.018273940212801893, "rgb": [0, 0, 0]}, {"index": 0.018653943590609696, "rgb": [0, 0, 0]}, {"index": 0.018704610707650733, "rgb": [255, 165, 0]}, {"index": 0.01875527782469177, "rgb": [0, 0, 0]}, {"index": 0.019578618476608682, "rgb": [0, 0, 0]}, {"index": 0.019675730450937342, "rgb": [255, 165, 0]}, {"index": 0.019772842425266002, "rgb": [0, 0, 0]}, {"index": 0.021575747339976355, "rgb": [0, 0, 0]}, {"index": 0.021786860327647355, "rgb": [255, 165, 0]}, {"index": 0.021997973315318355, "rgb": [0, 0, 0]}, {"index": 0.0220908630298936, "rgb": [0, 0, 0]}, {"index": 0.02212464110792096, "rgb": [255, 165, 0]}, {"index": 0.02215841918594832, "rgb": [0, 0, 0]}, {"index": 0.024328660699206216, "rgb": [0, 0, 0]}, {"index": 0.024573551764904576, "rgb": [255, 165, 0]}, {"index": 0.024818442830602937, "rgb": [0, 0, 0]}, {"index": 0.0249155548049316, "rgb": [0, 0, 0]}, {"index": 0.02495355514271238, "rgb": [255, 165, 0]}, {"index": 0.024991555480493158, "rgb": [0, 0, 0]}, {"index": 0.026397567978382032, "rgb": [0, 0, 0]}, {"index": 0.02655801384901199, "rgb": [255, 165, 0]}, {"index": 0.02671845971964195, "rgb": [0, 0, 0]}, {"index": 0.026634014524573556, "rgb": [0, 0, 0]}, {"index": 0.026642459044080392, "rgb": [255, 165, 0]}, {"index": 0.02665090356358723, "rgb": [0, 0, 0]}, {"index": 0.02725046444857288, "rgb": [0, 0, 0]}, {"index": 0.027318020604627596, "rgb": [255, 165, 0]}, {"index": 0.027385576760682314, "rgb": [0, 0, 0]}, {"index": 0.027356020942408375, "rgb": [0, 0, 0]}, {"index": 0.027360243202161797, "rgb": [255, 165, 0]}, {"index": 0.02736446546191522, "rgb": [0, 0, 0]}, {"index": 0.02796824860665428, "rgb": [0, 0, 0]}, {"index": 0.028035804762709, "rgb": [255, 165, 0]}, {"index": 0.028103360918763722, "rgb": [0, 0, 0]}, {"index": 0.02856780949163993, "rgb": [0, 0, 0]}, {"index": 0.028626921128187807, "rgb": [255, 165, 0]}, {"index": 0.028686032764735685, "rgb": [0, 0, 0]}, {"index": 0.029310927208241855, "rgb": [0, 0, 0]}, {"index": 0.029386927883803413, "rgb": [255, 165, 0]}, {"index": 0.02946292855936497, "rgb": [0, 0, 0]}, {"index": 0.02942492822158419, "rgb": [0, 0, 0]}, {"index": 0.029429150481337613, "rgb": [255, 165, 0]}, {"index": 0.029433372741091035, "rgb": [0, 0, 0]}, {"index": 0.029657152508022293, "rgb": [0, 0, 0]}, {"index": 0.029682486066542814, "rgb": [255, 165, 0]}, {"index": 0.029707819625063334, "rgb": [0, 0, 0]}, {"index": 0.03036649214659686, "rgb": [0, 0, 0]}, {"index": 0.03044249282215842, "rgb": [255, 165, 0]}, {"index": 0.030518493497719977, "rgb": [0, 0, 0]}, {"index": 0.0304804931599392, "rgb": [0, 0, 0]}, {"index": 0.03048471541969262, "rgb": [255, 165, 0]}, {"index": 0.03048893767944604, "rgb": [0, 0, 0]}, {"index": 0.03063671677081574, "rgb": [0, 0, 0]}, {"index": 0.03065360580982942, "rgb": [255, 165, 0]}, {"index": 0.0306704948488431, "rgb": [0, 0, 0]}, {"index": 0.031641614592129705, "rgb": [0, 0, 0]}, {"index": 0.03175139334571863, "rgb": [255, 165, 0]}, {"index": 0.031861172099307555, "rgb": [0, 0, 0]}, {"index": 0.03182739402128019, "rgb": [0, 0, 0]}, {"index": 0.03183583854078703, "rgb": [255, 165, 0]}, {"index": 0.031844283060293875, "rgb": [0, 0, 0]}, {"index": 0.03282384732308732, "rgb": [0, 0, 0]}, {"index": 0.032933626076676235, "rgb": [255, 165, 0]}, {"index": 0.033043404830265154, "rgb": [0, 0, 0]}, {"index": 0.03350363114338794, "rgb": [0, 0, 0]}, {"index": 0.03356696503968924, "rgb": [255, 165, 0]}, {"index": 0.033630298935990545, "rgb": [0, 0, 0]}, {"index": 0.03360496537747002, "rgb": [0, 0, 0]}, {"index": 0.03360918763722344, "rgb": [255, 165, 0]}, {"index": 0.03361340989697686, "rgb": [0, 0, 0]}, {"index": 0.03372318865056578, "rgb": [0, 0, 0]}, {"index": 0.033735855429826045, "rgb": [255, 165, 0]}, {"index": 0.03374852220908631, "rgb": [0, 0, 0]}, {"index": 0.03438186117209931, "rgb": [0, 0, 0]}, {"index": 0.034453639587907446, "rgb": [255, 165, 0]}, {"index": 0.034525418003715586, "rgb": [0, 0, 0]}, {"index": 0.03452964026346901, "rgb": [0, 0, 0]}, {"index": 0.03453808478297585, "rgb": [255, 165, 0]}, {"index": 0.034546529302482684, "rgb": [0, 0, 0]}, {"index": 0.03457608512075663, "rgb": [0, 0, 0]}, {"index": 0.03458030738051005, "rgb": [255, 165, 0]}, {"index": 0.03458452964026347, "rgb": [0, 0, 0]}, {"index": 0.03496031075831785, "rgb": [0, 0, 0]}, {"index": 0.03500253335585205, "rgb": [255, 165, 0]}, {"index": 0.035044755953386256, "rgb": [0, 0, 0]}, {"index": 0.03504053369363284, "rgb": [0, 0, 0]}, {"index": 0.035044755953386256, "rgb": [255, 165, 0]}, {"index": 0.035048978213139674, "rgb": [0, 0, 0]}, {"index": 0.03515875696672859, "rgb": [0, 0, 0]}, {"index": 0.035171423745988854, "rgb": [255, 165, 0]}, {"index": 0.035184090525249116, "rgb": [0, 0, 0]}, {"index": 0.03562742779935822, "rgb": [0, 0, 0]}, {"index": 0.035678094916399256, "rgb": [255, 165, 0]}, {"index": 0.03572876203344029, "rgb": [0, 0, 0]}, {"index": 0.036286100320891745, "rgb": [0, 0, 0]}, {"index": 0.03635365647694646, "rgb": [255, 165, 0]}, {"index": 0.036421212633001174, "rgb": [0, 0, 0]}, {"index": 0.038367674379327824, "rgb": [0, 0, 0]}, {"index": 0.03859145414625908, "rgb": [255, 165, 0]}, {"index": 0.03881523391319033, "rgb": [0, 0, 0]}, {"index": 0.03935146090187469, "rgb": [0, 0, 0]}, {"index": 0.039435906096943085, "rgb": [255, 165, 0]}, {"index": 0.03952035129201148, "rgb": [0, 0, 0]}, {"index": 0.040803918257051174, "rgb": [0, 0, 0]}, {"index": 0.040955919608174296, "rgb": [255, 165, 0]}, {"index": 0.04110792095929742, "rgb": [0, 0, 0]}, {"index": 0.04160192535044756, "rgb": [0, 0, 0]}, {"index": 0.0416737037662557, "rgb": [255, 165, 0]}, {"index": 0.04174548218206384, "rgb": [0, 0, 0]}, {"index": 0.04171170410403648, "rgb": [0, 0, 0]}, {"index": 0.0417159263637899, "rgb": [255, 165, 0]}, {"index": 0.04172014862354332, "rgb": [0, 0, 0]}, {"index": 0.041829927377132245, "rgb": [0, 0, 0]}, {"index": 0.0418425941563925, "rgb": [255, 165, 0]}, {"index": 0.041855260935652755, "rgb": [0, 0, 0]}, {"index": 0.042412599223104204, "rgb": [0, 0, 0]}, {"index": 0.04247593311940551, "rgb": [255, 165, 0]}, {"index": 0.04253926701570681, "rgb": [0, 0, 0]}, {"index": 0.04281793615943253, "rgb": [0, 0, 0]}, {"index": 0.04285593649721331, "rgb": [255, 165, 0]}, {"index": 0.04289393683499409, "rgb": [0, 0, 0]}, {"index": 0.04289393683499409, "rgb": [0, 0, 0]}, {"index": 0.04289815909474751, "rgb": [255, 165, 0]}, {"index": 0.042902381354500925, "rgb": [0, 0, 0]}, {"index": 0.04301216010808985, "rgb": [0, 0, 0]}, {"index": 0.04302482688735011, "rgb": [255, 165, 0]}, {"index": 0.043037493666610374, "rgb": [0, 0, 0]}, {"index": 0.04427883803411586, "rgb": [0, 0, 0]}, {"index": 0.04441817260597872, "rgb": [255, 165, 0]}, {"index": 0.04455750717784158, "rgb": [0, 0, 0]}, {"index": 0.044494173281540275, "rgb": [0, 0, 0]}, {"index": 0.04450261780104712, "rgb": [255, 165, 0]}, {"index": 0.04451106232055396, "rgb": [0, 0, 0]}, {"index": 0.04636463435230535, "rgb": [0, 0, 0]}, {"index": 0.046571525080222935, "rgb": [255, 165, 0]}, {"index": 0.04677841580814052, "rgb": [0, 0, 0]}, {"index": 0.04752153352474244, "rgb": [0, 0, 0]}, {"index": 0.04762709001857794, "rgb": [255, 165, 0]}, {"index": 0.04773264651241344, "rgb": [0, 0, 0]}, {"index": 0.04800709339638575, "rgb": [0, 0, 0]}, {"index": 0.04804931599391995, "rgb": [255, 165, 0]}, {"index": 0.048091538591454146, "rgb": [0, 0, 0]}, {"index": 0.04808731633170073, "rgb": [0, 0, 0]}, {"index": 0.048091538591454146, "rgb": [255, 165, 0]}, {"index": 0.048095760851207564, "rgb": [0, 0, 0]}, {"index": 0.05135956764060125, "rgb": [0, 0, 0]}, {"index": 0.05172268197939537, "rgb": [255, 165, 0]}, {"index": 0.05208579631818949, "rgb": [0, 0, 0]}, {"index": 0.053052693801722686, "rgb": [0, 0, 0]}, {"index": 0.05320047289309238, "rgb": [255, 165, 0]}, {"index": 0.05334825198446208, "rgb": [0, 0, 0]}, {"index": 0.05422648201317345, "rgb": [0, 0, 0]}, {"index": 0.05434048302651579, "rgb": [255, 165, 0]}, {"index": 0.054454484039858135, "rgb": [0, 0, 0]}, {"index": 0.05453048471541969, "rgb": [0, 0, 0]}, {"index": 0.05455159601418679, "rgb": [255, 165, 0]}, {"index": 0.05457270731295389, "rgb": [0, 0, 0]}, {"index": 0.06066965039689242, "rgb": [0, 0, 0]}, {"index": 0.06134943421719304, "rgb": [255, 165, 0]}, {"index": 0.062029218037493665, "rgb": [0, 0, 0]}, {"index": 0.061501435568316165, "rgb": [0, 0, 0]}, {"index": 0.061518324607329845, "rgb": [255, 165, 0]}, {"index": 0.061535213646343526, "rgb": [0, 0, 0]}, {"index": 0.0627723357540956, "rgb": [0, 0, 0]}, {"index": 0.06291167032595846, "rgb": [255, 165, 0]}, {"index": 0.06305100489782131, "rgb": [0, 0, 0]}, {"index": 0.06313967235264313, "rgb": [0, 0, 0]}, {"index": 0.06316500591116365, "rgb": [255, 165, 0]}, {"index": 0.06319033946968418, "rgb": [0, 0, 0]}, {"index": 0.06434301638236785, "rgb": [0, 0, 0]}, {"index": 0.06447390643472387, "rgb": [255, 165, 0]}, {"index": 0.06460479648707988, "rgb": [0, 0, 0]}, {"index": 0.06576591791927039, "rgb": [0, 0, 0]}, {"index": 0.06590947475088667, "rgb": [255, 165, 0]}, {"index": 0.06605303158250295, "rgb": [0, 0, 0]}, {"index": 0.06602347576422901, "rgb": [0, 0, 0]}, {"index": 0.06603614254348927, "rgb": [255, 165, 0]}, {"index": 0.06604880932274954, "rgb": [0, 0, 0]}, {"index": 0.06706215166357034, "rgb": [0, 0, 0]}, {"index": 0.06717615267691268, "rgb": [255, 165, 0]}, {"index": 0.06729015369025503, "rgb": [0, 0, 0]}, {"index": 0.06824016213477452, "rgb": [0, 0, 0]}, {"index": 0.06835838540787029, "rgb": [255, 165, 0]}, {"index": 0.06847660868096606, "rgb": [0, 0, 0]}, {"index": 0.06923239317682825, "rgb": [0, 0, 0]}, {"index": 0.0693295051511569, "rgb": [255, 165, 0]}, {"index": 0.06942661712548556, "rgb": [0, 0, 0]}, {"index": 0.06944350616449925, "rgb": [0, 0, 0]}, {"index": 0.0694561729437595, "rgb": [255, 165, 0]}, {"index": 0.06946883972301975, "rgb": [0, 0, 0]}, {"index": 0.06976017564600576, "rgb": [0, 0, 0]}, {"index": 0.0697939537240331, "rgb": [255, 165, 0]}, {"index": 0.06982773180206045, "rgb": [0, 0, 0]}, {"index": 0.07024995777740248, "rgb": [0, 0, 0]}, {"index": 0.07030062489444351, "rgb": [255, 165, 0]}, {"index": 0.07035129201148455, "rgb": [0, 0, 0]}, {"index": 0.07106063165005912, "rgb": [0, 0, 0]}, {"index": 0.07114507684512751, "rgb": [255, 165, 0]}, {"index": 0.0712295220401959, "rgb": [0, 0, 0]}, {"index": 0.07179108258740077, "rgb": [0, 0, 0]}, {"index": 0.07186286100320892, "rgb": [255, 165, 0]}, {"index": 0.07193463941901707, "rgb": [0, 0, 0]}, {"index": 0.07201486235433205, "rgb": [0, 0, 0]}, {"index": 0.07203175139334572, "rgb": [255, 165, 0]}, {"index": 0.0720486404323594, "rgb": [0, 0, 0]}, {"index": 0.07237375443337275, "rgb": [0, 0, 0]}, {"index": 0.07241175477115352, "rgb": [255, 165, 0]}, {"index": 0.0724497551089343, "rgb": [0, 0, 0]}, {"index": 0.07465377470021956, "rgb": [0, 0, 0]}, {"index": 0.07490288802567134, "rgb": [255, 165, 0]}, {"index": 0.07515200135112313, "rgb": [0, 0, 0]}, {"index": 0.0765369025502449, "rgb": [0, 0, 0]}, {"index": 0.07671845971964195, "rgb": [255, 165, 0]}, {"index": 0.076900016889039, "rgb": [0, 0, 0]}, {"index": 0.07698446208410742, "rgb": [0, 0, 0]}, {"index": 0.07701401790238135, "rgb": [255, 165, 0]}, {"index": 0.07704357372065529, "rgb": [0, 0, 0]}, {"index": 0.08043404830265158, "rgb": [0, 0, 0]}, {"index": 0.08081405168045938, "rgb": [255, 165, 0]}, {"index": 0.08119405505826718, "rgb": [0, 0, 0]}, {"index": 0.0813460564093903, "rgb": [0, 0, 0]}, {"index": 0.08140516804593818, "rgb": [255, 165, 0]}, {"index": 0.08146427968248607, "rgb": [0, 0, 0]}, {"index": 0.08151916905928054, "rgb": [0, 0, 0]}, {"index": 0.08153183583854079, "rgb": [255, 165, 0]}, {"index": 0.08154450261780104, "rgb": [0, 0, 0]}, {"index": 0.0824818442830603, "rgb": [0, 0, 0]}, {"index": 0.08258740077689579, "rgb": [255, 165, 0]}, {"index": 0.08269295727073128, "rgb": [0, 0, 0]}, {"index": 0.08600743117716601, "rgb": [0, 0, 0]}, {"index": 0.08638743455497382, "rgb": [255, 165, 0]}, {"index": 0.08676743793278162, "rgb": [0, 0, 0]}, {"index": 0.08866745482182065, "rgb": [0, 0, 0]}, {"index": 0.08892079040702584, "rgb": [255, 165, 0]}, {"index": 0.08917412599223104, "rgb": [0, 0, 0]}, {"index": 0.08994679952710691, "rgb": [0, 0, 0]}, {"index": 0.09006080054044925, "rgb": [255, 165, 0]}, {"index": 0.0901748015537916, "rgb": [0, 0, 0]}, {"index": 0.0905548049315994, "rgb": [0, 0, 0]}, {"index": 0.09060969430839386, "rgb": [255, 165, 0]}, {"index": 0.09066458368518832, "rgb": [0, 0, 0]}, {"index": 0.09216770815740584, "rgb": [0, 0, 0]}, {"index": 0.09234082080729607, "rgb": [255, 165, 0]}, {"index": 0.0925139334571863, "rgb": [0, 0, 0]}, {"index": 0.0924928221584192, "rgb": [0, 0, 0]}, {"index": 0.09250971119743287, "rgb": [255, 165, 0]}, {"index": 0.09252660023644654, "rgb": [0, 0, 0]}, {"index": 0.09269971288633677, "rgb": [0, 0, 0]}, {"index": 0.09272082418510387, "rgb": [255, 165, 0]}, {"index": 0.09274193548387097, "rgb": [0, 0, 0]}, {"index": 0.09408883634521195, "rgb": [0, 0, 0]}, {"index": 0.09424083769633508, "rgb": [255, 165, 0]}, {"index": 0.09439283904745821, "rgb": [0, 0, 0]}, {"index": 0.09701486235433204, "rgb": [0, 0, 0]}, {"index": 0.0973230873163317, "rgb": [255, 165, 0]}, {"index": 0.09763131227833136, "rgb": [0, 0, 0]}, {"index": 0.09743708832967404, "rgb": [0, 0, 0]}, {"index": 0.0974497551089343, "rgb": [255, 165, 0]}, {"index": 0.09746242188819457, "rgb": [0, 0, 0]}, {"index": 0.10162979226482013, "rgb": [0, 0, 0]}, {"index": 0.10209424083769633, "rgb": [255, 165, 0]}, {"index": 0.10255868941057253, "rgb": [0, 0, 0]}, {"index": 0.10323425097111975, "rgb": [0, 0, 0]}, {"index": 0.10336091876372235, "rgb": [255, 165, 0]}, {"index": 0.10348758655632494, "rgb": [0, 0, 0]}, {"index": 0.10533693632832292, "rgb": [0, 0, 0]}, {"index": 0.10555649383550075, "rgb": [255, 165, 0]}, {"index": 0.10577605134267859, "rgb": [0, 0, 0]}, {"index": 0.1062785002533356, "rgb": [0, 0, 0]}, {"index": 0.10635872318865057, "rgb": [255, 165, 0]}, {"index": 0.10643894612396554, "rgb": [0, 0, 0]}, {"index": 0.10700472893092383, "rgb": [0, 0, 0]}, {"index": 0.10707650734673198, "rgb": [255, 165, 0]}, {"index": 0.10714828576254012, "rgb": [0, 0, 0]}, {"index": 0.10783651410234758, "rgb": [0, 0, 0]}, {"index": 0.10792095929741598, "rgb": [255, 165, 0]}, {"index": 0.10800540449248437, "rgb": [0, 0, 0]}, {"index": 0.10822496199966222, "rgb": [0, 0, 0]}, {"index": 0.10825874007768958, "rgb": [255, 165, 0]}, {"index": 0.10829251815571694, "rgb": [0, 0, 0]}, {"index": 0.10860074311771661, "rgb": [0, 0, 0]}, {"index": 0.10863874345549739, "rgb": [255, 165, 0]}, {"index": 0.10867674379327816, "rgb": [0, 0, 0]}, {"index": 0.11065276135787874, "rgb": [0, 0, 0]}, {"index": 0.11087654112481, "rgb": [255, 165, 0]}, {"index": 0.11110032089174127, "rgb": [0, 0, 0]}, {"index": 0.11156054720486405, "rgb": [0, 0, 0]}, {"index": 0.11163654788042561, "rgb": [255, 165, 0]}, {"index": 0.11171254855598717, "rgb": [0, 0, 0]}, {"index": 0.11672859314305016, "rgb": [0, 0, 0]}, {"index": 0.11729437595000844, "rgb": [255, 165, 0]}, {"index": 0.11786015875696672, "rgb": [0, 0, 0]}, {"index": 0.11805438270562406, "rgb": [0, 0, 0]}, {"index": 0.11813882790069245, "rgb": [255, 165, 0]}, {"index": 0.11822327309576085, "rgb": [0, 0, 0]}, {"index": 0.12064685019422396, "rgb": [0, 0, 0]}, {"index": 0.12092551933794968, "rgb": [255, 165, 0]}, {"index": 0.1212041884816754, "rgb": [0, 0, 0]}, {"index": 0.1263215673028205, "rgb": [0, 0, 0]}, {"index": 0.12692112818780613, "rgb": [255, 165, 0]}, {"index": 0.12752068907279177, "rgb": [0, 0, 0]}, {"index": 0.12714913021449079, "rgb": [0, 0, 0]}, {"index": 0.1271744637730113, "rgb": [255, 165, 0]}, {"index": 0.12719979733153183, "rgb": [0, 0, 0]}, {"index": 0.12744046613747678, "rgb": [0, 0, 0]}, {"index": 0.12747002195575072, "rgb": [255, 165, 0]}, {"index": 0.12749957777402465, "rgb": [0, 0, 0]}, {"index": 0.1284960310758318, "rgb": [0, 0, 0]}, {"index": 0.12861003208917413, "rgb": [255, 165, 0]}, {"index": 0.12872403310251646, "rgb": [0, 0, 0]}, {"index": 0.12895203512920114, "rgb": [0, 0, 0]}, {"index": 0.12899003546698193, "rgb": [255, 165, 0]}, {"index": 0.12902803580476271, "rgb": [0, 0, 0]}, {"index": 0.12975004222259753, "rgb": [0, 0, 0]}, {"index": 0.12983448741766593, "rgb": [255, 165, 0]}, {"index": 0.12991893261273432, "rgb": [0, 0, 0]}, {"index": 0.1310504982266509, "rgb": [0, 0, 0]}, {"index": 0.13118561053876035, "rgb": [255, 165, 0]}, {"index": 0.1313207228508698, "rgb": [0, 0, 0]}, {"index": 0.13156561391656815, "rgb": [0, 0, 0]}, {"index": 0.13160783651410235, "rgb": [255, 165, 0]}, {"index": 0.13165005911163655, "rgb": [0, 0, 0]}, {"index": 0.13236784326971796, "rgb": [0, 0, 0]}, {"index": 0.13245228846478635, "rgb": [255, 165, 0]}, {"index": 0.13253673365985474, "rgb": [0, 0, 0]}, {"index": 0.13382030062489444, "rgb": [0, 0, 0]}, {"index": 0.13397230197601756, "rgb": [255, 165, 0]}, {"index": 0.13412430332714068, "rgb": [0, 0, 0]}, {"index": 0.13439030569160615, "rgb": [0, 0, 0]}, {"index": 0.13443675054889376, "rgb": [255, 165, 0]}, {"index": 0.13448319540618137, "rgb": [0, 0, 0]}, {"index": 0.13569076169565952, "rgb": [0, 0, 0]}, {"index": 0.13583009626752238, "rgb": [255, 165, 0]}, {"index": 0.13596943083938523, "rgb": [0, 0, 0]}, {"index": 0.1365521026853572, "rgb": [0, 0, 0]}, {"index": 0.13663232562067218, "rgb": [255, 165, 0]}, {"index": 0.13671254855598716, "rgb": [0, 0, 0]}, {"index": 0.13765833474075326, "rgb": [0, 0, 0]}, {"index": 0.1377723357540956, "rgb": [255, 165, 0]}, {"index": 0.13788633676743792, "rgb": [0, 0, 0]}, {"index": 0.13841834149636886, "rgb": [0, 0, 0]}, {"index": 0.138490119912177, "rgb": [255, 165, 0]}, {"index": 0.13856189832798513, "rgb": [0, 0, 0]}, {"index": 0.13909812531666949, "rgb": [0, 0, 0]}, {"index": 0.1391656814727242, "rgb": [255, 165, 0]}, {"index": 0.13923323762877893, "rgb": [0, 0, 0]}, {"index": 0.1393936834994089, "rgb": [0, 0, 0]}, {"index": 0.13941901705792942, "rgb": [255, 165, 0]}, {"index": 0.13944435061644994, "rgb": [0, 0, 0]}, {"index": 0.1411670325958453, "rgb": [0, 0, 0]}, {"index": 0.14136125654450263, "rgb": [255, 165, 0]}, {"index": 0.14155548049315997, "rgb": [0, 0, 0]}, {"index": 0.14155125823340653, "rgb": [0, 0, 0]}, {"index": 0.14157236953217361, "rgb": [255, 165, 0]}, {"index": 0.1415934808309407, "rgb": [0, 0, 0]}, {"index": 0.1425603783144739, "rgb": [0, 0, 0]}, {"index": 0.14267015706806283, "rgb": [255, 165, 0]}, {"index": 0.14277993582165174, "rgb": [0, 0, 0]}, {"index": 0.1439241682148286, "rgb": [0, 0, 0]}, {"index": 0.14406350278669144, "rgb": [255, 165, 0]}, {"index": 0.1442028373585543, "rgb": [0, 0, 0]}, {"index": 0.14451950684006082, "rgb": [0, 0, 0]}, {"index": 0.14457017395710184, "rgb": [255, 165, 0]}, {"index": 0.14462084107414286, "rgb": [0, 0, 0]}, {"index": 0.14666019253504475, "rgb": [0, 0, 0]}, {"index": 0.14689241682148285, "rgb": [255, 165, 0]}, {"index": 0.14712464110792095, "rgb": [0, 0, 0]}, {"index": 0.1482984293193717, "rgb": [0, 0, 0]}, {"index": 0.14845465293024826, "rgb": [255, 165, 0]}, {"index": 0.14861087654112481, "rgb": [0, 0, 0]}, {"index": 0.15039267015706806, "rgb": [0, 0, 0]}, {"index": 0.15060800540449248, "rgb": [255, 165, 0]}, {"index": 0.1508233406519169, "rgb": [0, 0, 0]}, {"index": 0.1540660361425435, "rgb": [0, 0, 0]}, {"index": 0.1544502617801047, "rgb": [255, 165, 0]}, {"index": 0.15483448741766592, "rgb": [0, 0, 0]}, {"index": 0.1548302651579125, "rgb": [0, 0, 0]}, {"index": 0.1548724877554467, "rgb": [255, 165, 0]}, {"index": 0.1549147103529809, "rgb": [0, 0, 0]}, {"index": 0.15696250633338962, "rgb": [0, 0, 0]}, {"index": 0.15719473061982772, "rgb": [255, 165, 0]}, {"index": 0.15742695490626582, "rgb": [0, 0, 0]}, {"index": 0.1578027360243202, "rgb": [0, 0, 0]}, {"index": 0.15787029218037493, "rgb": [255, 165, 0]}, {"index": 0.15793784833642965, "rgb": [0, 0, 0]}, {"index": 0.15832629623374428, "rgb": [0, 0, 0]}, {"index": 0.15837696335078533, "rgb": [255, 165, 0]}, {"index": 0.15842763046782637, "rgb": [0, 0, 0]}, {"index": 0.15879496706637394, "rgb": [0, 0, 0]}, {"index": 0.15884141192366155, "rgb": [255, 165, 0]}, {"index": 0.15888785678094916, "rgb": [0, 0, 0]}, {"index": 0.15960141867927713, "rgb": [0, 0, 0]}, {"index": 0.15968586387434555, "rgb": [255, 165, 0]}, {"index": 0.15977030906941397, "rgb": [0, 0, 0]}, {"index": 0.16006586725215335, "rgb": [0, 0, 0]}, {"index": 0.16010808984968755, "rgb": [255, 165, 0]}, {"index": 0.16015031244722175, "rgb": [0, 0, 0]}, {"index": 0.1606400945786185, "rgb": [0, 0, 0]}, {"index": 0.16069920621516637, "rgb": [255, 165, 0]}, {"index": 0.16075831785171424, "rgb": [0, 0, 0]}, {"index": 0.16134521195743962, "rgb": [0, 0, 0]}, {"index": 0.16141699037324775, "rgb": [255, 165, 0]}, {"index": 0.16148876878905588, "rgb": [0, 0, 0]}, {"index": 0.16156899172437086, "rgb": [0, 0, 0]}, {"index": 0.16158588076338457, "rgb": [255, 165, 0]}, {"index": 0.16160276980239827, "rgb": [0, 0, 0]}, {"index": 0.1625358892079041, "rgb": [0, 0, 0]}, {"index": 0.16264144570173958, "rgb": [255, 165, 0]}, {"index": 0.16274700219557506, "rgb": [0, 0, 0]}, {"index": 0.1627554467150819, "rgb": [0, 0, 0]}, {"index": 0.16276811349434217, "rgb": [255, 165, 0]}, {"index": 0.16278078027360243, "rgb": [0, 0, 0]}, {"index": 0.16322411754771152, "rgb": [0, 0, 0]}, {"index": 0.16327478466475256, "rgb": [255, 165, 0]}, {"index": 0.1633254517817936, "rgb": [0, 0, 0]}, {"index": 0.16350278669143725, "rgb": [0, 0, 0]}, {"index": 0.16352812024995778, "rgb": [255, 165, 0]}, {"index": 0.1635534538084783, "rgb": [0, 0, 0]}, {"index": 0.16413612565445027, "rgb": [0, 0, 0]}, {"index": 0.164203681810505, "rgb": [255, 165, 0]}, {"index": 0.1642712379665597, "rgb": [0, 0, 0]}, {"index": 0.16431768282384732, "rgb": [0, 0, 0]}, {"index": 0.16433034960310758, "rgb": [255, 165, 0]}, {"index": 0.16434301638236784, "rgb": [0, 0, 0]}, {"index": 0.16444435061644994, "rgb": [0, 0, 0]}, {"index": 0.1644570173957102, "rgb": [255, 165, 0]}, {"index": 0.16446968417497046, "rgb": [0, 0, 0]}, {"index": 0.16457101840905253, "rgb": [0, 0, 0]}, {"index": 0.1645836851883128, "rgb": [255, 165, 0]}, {"index": 0.16459635196757305, "rgb": [0, 0, 0]}, {"index": 0.17058773855767606, "rgb": [0, 0, 0]}, {"index": 0.17125485559871642, "rgb": [255, 165, 0]}, {"index": 0.17192197263975678, "rgb": [0, 0, 0]}, {"index": 0.1740288802567134, "rgb": [0, 0, 0]}, {"index": 0.17433710521871307, "rgb": [255, 165, 0]}, {"index": 0.17464533018071274, "rgb": [0, 0, 0]}, {"index": 0.17494511062320556, "rgb": [0, 0, 0]}, {"index": 0.17501266677926025, "rgb": [255, 165, 0]}, {"index": 0.17508022293531494, "rgb": [0, 0, 0]}, {"index": 0.17816669481506506, "rgb": [0, 0, 0]}, {"index": 0.1785171423745989, "rgb": [255, 165, 0]}, {"index": 0.17886758993413274, "rgb": [0, 0, 0]}, {"index": 0.17992315487248778, "rgb": [0, 0, 0]}, {"index": 0.1800793784833643, "rgb": [255, 165, 0]}, {"index": 0.18023560209424083, "rgb": [0, 0, 0]}, {"index": 0.1801173788211451, "rgb": [0, 0, 0]}, {"index": 0.1801216010808985, "rgb": [255, 165, 0]}, {"index": 0.1801258233406519, "rgb": [0, 0, 0]}, {"index": 0.18023560209424083, "rgb": [0, 0, 0]}, {"index": 0.1802482688735011, "rgb": [255, 165, 0]}, {"index": 0.18026093565276136, "rgb": [0, 0, 0]}, {"index": 0.180438270562405, "rgb": [0, 0, 0]}, {"index": 0.1804593818611721, "rgb": [255, 165, 0]}, {"index": 0.18048049315993922, "rgb": [0, 0, 0]}, {"index": 0.1806873838878568, "rgb": [0, 0, 0]}, {"index": 0.1807127174463773, "rgb": [255, 165, 0]}, {"index": 0.1807380510048978, "rgb": [0, 0, 0]}, {"index": 0.18075071778415808, "rgb": [0, 0, 0]}, {"index": 0.1807549400439115, "rgb": [255, 165, 0]}, {"index": 0.1807591623036649, "rgb": [0, 0, 0]}, {"index": 0.18113494342171932, "rgb": [0, 0, 0]}, {"index": 0.18117716601925352, "rgb": [255, 165, 0]}, {"index": 0.1812193886167877, "rgb": [0, 0, 0]}, {"index": 0.18129116703259585, "rgb": [0, 0, 0]}, {"index": 0.1813038338118561, "rgb": [255, 165, 0]}, {"index": 0.18131650059111637, "rgb": [0, 0, 0]}, {"index": 0.18141783482519844, "rgb": [0, 0, 0]}, {"index": 0.1814305016044587, "rgb": [255, 165, 0]}, {"index": 0.18144316838371896, "rgb": [0, 0, 0]}, {"index": 0.18162050329336263, "rgb": [0, 0, 0]}, {"index": 0.1816416145921297, "rgb": [255, 165, 0]}, {"index": 0.1816627258908968, "rgb": [0, 0, 0]}, {"index": 0.1850996453301807, "rgb": [0, 0, 0]}, {"index": 0.18548387096774194, "rgb": [255, 165, 0]}, {"index": 0.18586809660530318, "rgb": [0, 0, 0]}, {"index": 0.19125992231042055, "rgb": [0, 0, 0]}, {"index": 0.19190170579294039, "rgb": [255, 165, 0]}, {"index": 0.19254348927546022, "rgb": [0, 0, 0]}, {"index": 0.1934217193041716, "rgb": [0, 0, 0]}, {"index": 0.19359060969430839, "rgb": [255, 165, 0]}, {"index": 0.19375950008444517, "rgb": [0, 0, 0]}, {"index": 0.19461661881438946, "rgb": [0, 0, 0]}, {"index": 0.1947306198277318, "rgb": [255, 165, 0]}, {"index": 0.19484462084107412, "rgb": [0, 0, 0]}, {"index": 0.1999746664414795, "rgb": [0, 0, 0]}, {"index": 0.20055733828745145, "rgb": [255, 165, 0]}, {"index": 0.20114001013342342, "rgb": [0, 0, 0]}, {"index": 0.20420537071440634, "rgb": [0, 0, 0]}, {"index": 0.20461070765073466, "rgb": [255, 165, 0]}, {"index": 0.205016044587063, "rgb": [0, 0, 0]}, {"index": 0.20628272251308902, "rgb": [0, 0, 0]}, {"index": 0.20646850194223948, "rgb": [255, 165, 0]}, {"index": 0.20665428137138994, "rgb": [0, 0, 0]}, {"index": 0.20726650903563587, "rgb": [0, 0, 0]}, {"index": 0.2073551764904577, "rgb": [255, 165, 0]}, {"index": 0.20744384394527954, "rgb": [0, 0, 0]}, {"index": 0.20819118392163485, "rgb": [0, 0, 0]}, {"index": 0.2082840736362101, "rgb": [255, 165, 0]}, {"index": 0.20837696335078534, "rgb": [0, 0, 0]}, {"index": 0.21170410403648032, "rgb": [0, 0, 0]}, {"index": 0.21208410741428813, "rgb": [255, 165, 0]}, {"index": 0.21246411079209593, "rgb": [0, 0, 0]}, {"index": 0.21250211112987671, "rgb": [0, 0, 0]}, {"index": 0.21254855598716432, "rgb": [255, 165, 0]}, {"index": 0.21259500084445193, "rgb": [0, 0, 0]}, {"index": 0.2128145583516298, "rgb": [0, 0, 0]}, {"index": 0.21284411416990373, "rgb": [255, 165, 0]}, {"index": 0.21287366998817767, "rgb": [0, 0, 0]}, {"index": 0.21428812700557337, "rgb": [0, 0, 0]}, {"index": 0.21444857287620334, "rgb": [255, 165, 0]}, {"index": 0.2146090187468333, "rgb": [0, 0, 0]}, {"index": 0.2166905928052694, "rgb": [0, 0, 0]}, {"index": 0.21693970613072117, "rgb": [255, 165, 0]}, {"index": 0.21718881945617294, "rgb": [0, 0, 0]}, {"index": 0.21819371727748693, "rgb": [0, 0, 0]}, {"index": 0.21833305184934979, "rgb": [255, 165, 0]}, {"index": 0.21847238642121264, "rgb": [0, 0, 0]}, {"index": 0.21837105218713057, "rgb": [0, 0, 0]}, {"index": 0.21837527444688398, "rgb": [255, 165, 0]}, {"index": 0.2183794967066374, "rgb": [0, 0, 0]}, {"index": 0.218717277486911, "rgb": [0, 0, 0]}, {"index": 0.21875527782469179, "rgb": [255, 165, 0]}, {"index": 0.21879327816247257, "rgb": [0, 0, 0]}, {"index": 0.2189452795135957, "rgb": [0, 0, 0]}, {"index": 0.21896639081236277, "rgb": [255, 165, 0]}, {"index": 0.21898750211112986, "rgb": [0, 0, 0]}, {"index": 0.22352643134605643, "rgb": [0, 0, 0]}, {"index": 0.22403310251646683, "rgb": [255, 165, 0]}, {"index": 0.22453977368687722, "rgb": [0, 0, 0]}, {"index": 0.22441310589427463, "rgb": [0, 0, 0]}, {"index": 0.22445532849180883, "rgb": [255, 165, 0]}, {"index": 0.22449755108934302, "rgb": [0, 0, 0]}, {"index": 0.22559533862523223, "rgb": [0, 0, 0]}, {"index": 0.22572200641783483, "rgb": [255, 165, 0]}, {"index": 0.22584867421043742, "rgb": [0, 0, 0]}, {"index": 0.22614001013342339, "rgb": [0, 0, 0]}, {"index": 0.22618645499071102, "rgb": [255, 165, 0]}, {"index": 0.22623289984799866, "rgb": [0, 0, 0]}, {"index": 0.2262244553284918, "rgb": [0, 0, 0]}, {"index": 0.22622867758824522, "rgb": [255, 165, 0]}, {"index": 0.22623289984799863, "rgb": [0, 0, 0]}, {"index": 0.23010471204188482, "rgb": [0, 0, 0]}, {"index": 0.23053538253673367, "rgb": [255, 165, 0]}, {"index": 0.23096605303158252, "rgb": [0, 0, 0]}, {"index": 0.2370334402972471, "rgb": [0, 0, 0]}, {"index": 0.23775544671508192, "rgb": [255, 165, 0]}, {"index": 0.23847745313291674, "rgb": [0, 0, 0]}, {"index": 0.23786944772842425, "rgb": [0, 0, 0]}, {"index": 0.2378821145076845, "rgb": [255, 165, 0]}, {"index": 0.23789478128694477, "rgb": [0, 0, 0]}, {"index": 0.2383001182232731, "rgb": [0, 0, 0]}, {"index": 0.2383465630805607, "rgb": [255, 165, 0]}, {"index": 0.23839300793784832, "rgb": [0, 0, 0]}, {"index": 0.24511062320553959, "rgb": [0, 0, 0]}, {"index": 0.24586218544164837, "rgb": [255, 165, 0]}, {"index": 0.24661374767775715, "rgb": [0, 0, 0]}, {"index": 0.24590018577942915, "rgb": [0, 0, 0]}, {"index": 0.24590440803918256, "rgb": [255, 165, 0]}, {"index": 0.24590863029893598, "rgb": [0, 0, 0]}, {"index": 0.24598040871474414, "rgb": [0, 0, 0]}, {"index": 0.24598885323425096, "rgb": [255, 165, 0]}, {"index": 0.24599729775375778, "rgb": [0, 0, 0]}, {"index": 0.25153690255024486, "rgb": [0, 0, 0]}, {"index": 0.2521533524742442, "rgb": [255, 165, 0]}, {"index": 0.25276980239824354, "rgb": [0, 0, 0]}, {"index": 0.25409136970106405, "rgb": [0, 0, 0]}, {"index": 0.25430670494848845, "rgb": [255, 165, 0]}, {"index": 0.25452204019591285, "rgb": [0, 0, 0]}, {"index": 0.25445870629961154, "rgb": [0, 0, 0]}, {"index": 0.25447559533862524, "rgb": [255, 165, 0]}, {"index": 0.25449248437763894, "rgb": [0, 0, 0]}, {"index": 0.2565276135787874, "rgb": [0, 0, 0]}, {"index": 0.25675561560547205, "rgb": [255, 165, 0]}, {"index": 0.2569836176321567, "rgb": [0, 0, 0]}, {"index": 0.25831362945448405, "rgb": [0, 0, 0]}, {"index": 0.2584867421043743, "rgb": [255, 165, 0]}, {"index": 0.2586598547542645, "rgb": [0, 0, 0]}, {"index": 0.2588287451444013, "rgb": [0, 0, 0]}, {"index": 0.2588667454821821, "rgb": [255, 165, 0]}, {"index": 0.25890474581996287, "rgb": [0, 0, 0]}, {"index": 0.2591327478466475, "rgb": [0, 0, 0]}, {"index": 0.2591623036649215, "rgb": [255, 165, 0]}, {"index": 0.25919185948319545, "rgb": [0, 0, 0]}, {"index": 0.2595043067049485, "rgb": [0, 0, 0]}, {"index": 0.2595423070427293, "rgb": [255, 165, 0]}, {"index": 0.2595803073805101, "rgb": [0, 0, 0]}, {"index": 0.26018831278500254, "rgb": [0, 0, 0]}, {"index": 0.2602600912008107, "rgb": [255, 165, 0]}, {"index": 0.2603318696166188, "rgb": [0, 0, 0]}, {"index": 0.26630214490795473, "rgb": [0, 0, 0]}, {"index": 0.2669734842087485, "rgb": [255, 165, 0]}, {"index": 0.2676448235095423, "rgb": [0, 0, 0]}, {"index": 0.26910150312447223, "rgb": [0, 0, 0]}, {"index": 0.2693379496706637, "rgb": [255, 165, 0]}, {"index": 0.2695743962168552, "rgb": [0, 0, 0]}, {"index": 0.2697939537240331, "rgb": [0, 0, 0]}, {"index": 0.26984462084107413, "rgb": [255, 165, 0]}, {"index": 0.2698952879581152, "rgb": [0, 0, 0]}, {"index": 0.27045262624556665, "rgb": [0, 0, 0]}, {"index": 0.27052018240162135, "rgb": [255, 165, 0]}, {"index": 0.27058773855767604, "rgb": [0, 0, 0]}, {"index": 0.2729142036818105, "rgb": [0, 0, 0]}, {"index": 0.27318020604627596, "rgb": [255, 165, 0]}, {"index": 0.2734462084107414, "rgb": [0, 0, 0]}, {"index": 0.2750042222597534, "rgb": [0, 0, 0]}, {"index": 0.2752068907279176, "rgb": [255, 165, 0]}, {"index": 0.2754095591960818, "rgb": [0, 0, 0]}, {"index": 0.2769929066036143, "rgb": [0, 0, 0]}, {"index": 0.277191352812025, "rgb": [255, 165, 0]}, {"index": 0.2773897990204357, "rgb": [0, 0, 0]}, {"index": 0.27738135450092893, "rgb": [0, 0, 0]}, {"index": 0.277402465799696, "rgb": [255, 165, 0]}, {"index": 0.2774235770984631, "rgb": [0, 0, 0]}, {"index": 0.27804847154196927, "rgb": [0, 0, 0]}, {"index": 0.2781202499577774, "rgb": [255, 165, 0]}, {"index": 0.27819202837358553, "rgb": [0, 0, 0]}, {"index": 0.28853234250971116, "rgb": [0, 0, 0]}, {"index": 0.28968924168214827, "rgb": [255, 165, 0]}, {"index": 0.2908461408545854, "rgb": [0, 0, 0]}, {"index": 0.28999324438439456, "rgb": [0, 0, 0]}, {"index": 0.2900270224624219, "rgb": [255, 165, 0]}, {"index": 0.29006080054044925, "rgb": [0, 0, 0]}, {"index": 0.2908630298935991, "rgb": [0, 0, 0]}, {"index": 0.2909559196081743, "rgb": [255, 165, 0]}, {"index": 0.2910488093227495, "rgb": [0, 0, 0]}, {"index": 0.2912599223104205, "rgb": [0, 0, 0]}, {"index": 0.2912937003884479, "rgb": [255, 165, 0]}, {"index": 0.2913274784664752, "rgb": [0, 0, 0]}, {"index": 0.29201570680628275, "rgb": [0, 0, 0]}, {"index": 0.2920959297415977, "rgb": [255, 165, 0]}, {"index": 0.29217615267691266, "rgb": [0, 0, 0]}, {"index": 0.2951359567640601, "rgb": [0, 0, 0]}, {"index": 0.2954737375443337, "rgb": [255, 165, 0]}, {"index": 0.2958115183246073, "rgb": [0, 0, 0]}, {"index": 0.2957017395710185, "rgb": [0, 0, 0]}, {"index": 0.29572707312953894, "rgb": [255, 165, 0]}, {"index": 0.2957524066880594, "rgb": [0, 0, 0]}, {"index": 0.29591707481844287, "rgb": [0, 0, 0]}, {"index": 0.29593818611720996, "rgb": [255, 165, 0]}, {"index": 0.29595929741597704, "rgb": [0, 0, 0]}, {"index": 0.29669819287282556, "rgb": [0, 0, 0]}, {"index": 0.29678263806789396, "rgb": [255, 165, 0]}, {"index": 0.29686708326296235, "rgb": [0, 0, 0]}, {"index": 0.2981886505657828, "rgb": [0, 0, 0]}, {"index": 0.29834487417665934, "rgb": [255, 165, 0]}, {"index": 0.29850109778753586, "rgb": [0, 0, 0]}, {"index": 0.30024489106569835, "rgb": [0, 0, 0]}, {"index": 0.30045600405336936, "rgb": [255, 165, 0]}, {"index": 0.3006671170410404, "rgb": [0, 0, 0]}, {"index": 0.30395203512920116, "rgb": [0, 0, 0]}, {"index": 0.3043404830265158, "rgb": [255, 165, 0]}, {"index": 0.3047289309238304, "rgb": [0, 0, 0]}, {"index": 0.3059364972133085, "rgb": [0, 0, 0]}, {"index": 0.3061138321229522, "rgb": [255, 165, 0]}, {"index": 0.30629116703259585, "rgb": [0, 0, 0]}, {"index": 0.30649383550076004, "rgb": [0, 0, 0]}, {"index": 0.3065360580982942, "rgb": [255, 165, 0]}, {"index": 0.3065782806958284, "rgb": [0, 0, 0]}, {"index": 0.3072960648539098, "rgb": [0, 0, 0]}, {"index": 0.3073805100489782, "rgb": [255, 165, 0]}, {"index": 0.3074649552440466, "rgb": [0, 0, 0]}, {"index": 0.3131945617294376, "rgb": [0, 0, 0]}, {"index": 0.31384056747171085, "rgb": [255, 165, 0]}, {"index": 0.3144865732139841, "rgb": [0, 0, 0]}, {"index": 0.31688059449417333, "rgb": [0, 0, 0]}, {"index": 0.3172183752744469, "rgb": [255, 165, 0]}, {"index": 0.3175561560547205, "rgb": [0, 0, 0]}, {"index": 0.31843438608343183, "rgb": [0, 0, 0]}, {"index": 0.3185694983955413, "rgb": [255, 165, 0]}, {"index": 0.3187046107076507, "rgb": [0, 0, 0]}, {"index": 0.3208115183246073, "rgb": [0, 0, 0]}, {"index": 0.3210606316500591, "rgb": [255, 165, 0]}, {"index": 0.3213097449755109, "rgb": [0, 0, 0]}, {"index": 0.3225426448235096, "rgb": [0, 0, 0]}, {"index": 0.32270731295389293, "rgb": [255, 165, 0]}, {"index": 0.3228719810842763, "rgb": [0, 0, 0]}, {"index": 0.3262793447052863, "rgb": [0, 0, 0]}, {"index": 0.32667623712210775, "rgb": [255, 165, 0]}, {"index": 0.3270731295389292, "rgb": [0, 0, 0]}, {"index": 0.32979226482013174, "rgb": [0, 0, 0]}, {"index": 0.3301384901199122, "rgb": [255, 165, 0]}, {"index": 0.33048471541969265, "rgb": [0, 0, 0]}, {"index": 0.338992568822834, "rgb": [0, 0, 0]}, {"index": 0.33997635534538084, "rgb": [255, 165, 0]}, {"index": 0.34096014186792767, "rgb": [0, 0, 0]}, {"index": 0.34183837189663907, "rgb": [0, 0, 0]}, {"index": 0.34204526262455665, "rgb": [255, 165, 0]}, {"index": 0.3422521533524742, "rgb": [0, 0, 0]}, {"index": 0.34341327478466477, "rgb": [0, 0, 0]}, {"index": 0.34356527613578786, "rgb": [255, 165, 0]}, {"index": 0.34371727748691094, "rgb": [0, 0, 0]}, {"index": 0.3448192872825536, "rgb": [0, 0, 0]}, {"index": 0.3449586218544165, "rgb": [255, 165, 0]}, {"index": 0.3450979564262794, "rgb": [0, 0, 0]}, {"index": 0.34564262793447054, "rgb": [0, 0, 0]}, {"index": 0.3457186286100321, "rgb": [255, 165, 0]}, {"index": 0.3457946292855937, "rgb": [0, 0, 0]}, {"index": 0.3508106738726567, "rgb": [0, 0, 0]}, {"index": 0.3513764566796149, "rgb": [255, 165, 0]}, {"index": 0.35194223948657316, "rgb": [0, 0, 0]}, {"index": 0.35156645836851885, "rgb": [0, 0, 0]}, {"index": 0.35158756966728594, "rgb": [255, 165, 0]}, {"index": 0.351608680966053, "rgb": [0, 0, 0]}, {"index": 0.35622361087654114, "rgb": [0, 0, 0]}, {"index": 0.3567387265664584, "rgb": [255, 165, 0]}, {"index": 0.35725384225637563, "rgb": [0, 0, 0]}, {"index": 0.35677672690423917, "rgb": [0, 0, 0]}, {"index": 0.35678094916399256, "rgb": [255, 165, 0]}, {"index": 0.35678517142374594, "rgb": [0, 0, 0]}, {"index": 0.35693295051511564, "rgb": [0, 0, 0]}, {"index": 0.35694983955412934, "rgb": [255, 165, 0]}, {"index": 0.35696672859314305, "rgb": [0, 0, 0]}, {"index": 0.3571398412430333, "rgb": [0, 0, 0]}, {"index": 0.35716095254180036, "rgb": [255, 165, 0]}, {"index": 0.35718206384056744, "rgb": [0, 0, 0]}, {"index": 0.3574649552440466, "rgb": [0, 0, 0]}, {"index": 0.357498733322074, "rgb": [255, 165, 0]}, {"index": 0.3575325114001014, "rgb": [0, 0, 0]}, {"index": 0.3581067387265665, "rgb": [0, 0, 0]}, {"index": 0.3581742948826212, "rgb": [255, 165, 0]}, {"index": 0.3582418510386759, "rgb": [0, 0, 0]}, {"index": 0.35840229690930586, "rgb": [0, 0, 0]}, {"index": 0.3584276304678264, "rgb": [255, 165, 0]}, {"index": 0.3584529640263469, "rgb": [0, 0, 0]}, {"index": 0.3587316331700726, "rgb": [0, 0, 0]}, {"index": 0.35876541124809996, "rgb": [255, 165, 0]}, {"index": 0.3587991893261273, "rgb": [0, 0, 0]}, {"index": 0.3589554129370039, "rgb": [0, 0, 0]}, {"index": 0.358976524235771, "rgb": [255, 165, 0]}, {"index": 0.35899763553453806, "rgb": [0, 0, 0]}, {"index": 0.3590145245735518, "rgb": [0, 0, 0]}, {"index": 0.3590187468333052, "rgb": [255, 165, 0]}, {"index": 0.3590229690930586, "rgb": [0, 0, 0]}, {"index": 0.35924674885998986, "rgb": [0, 0, 0]}, {"index": 0.3592720824185104, "rgb": [255, 165, 0]}, {"index": 0.3592974159770309, "rgb": [0, 0, 0]}, {"index": 0.3596520857963182, "rgb": [0, 0, 0]}, {"index": 0.3596943083938524, "rgb": [255, 165, 0]}, {"index": 0.35973653099138664, "rgb": [0, 0, 0]}, {"index": 0.36322833980746494, "rgb": [0, 0, 0]}, {"index": 0.363621009964533, "rgb": [255, 165, 0]}, {"index": 0.36401368012160107, "rgb": [0, 0, 0]}, {"index": 0.3697390643472387, "rgb": [0, 0, 0]}, {"index": 0.3704188481675393, "rgb": [255, 165, 0]}, {"index": 0.3710986319878399, "rgb": [0, 0, 0]}, {"index": 0.37205286269211285, "rgb": [0, 0, 0]}, {"index": 0.3722344198615099, "rgb": [255, 165, 0]}, {"index": 0.37241597703090695, "rgb": [0, 0, 0]}, {"index": 0.372918425941564, "rgb": [0, 0, 0]}, {"index": 0.3729944266171255, "rgb": [255, 165, 0]}, {"index": 0.373070427292687, "rgb": [0, 0, 0]}, {"index": 0.3739064347238642, "rgb": [0, 0, 0]}, {"index": 0.3740077689579463, "rgb": [255, 165, 0]}, {"index": 0.3741091031920284, "rgb": [0, 0, 0]}, {"index": 0.3747297753757811, "rgb": [0, 0, 0]}, {"index": 0.37480999831109607, "rgb": [255, 165, 0]}, {"index": 0.374890221246411, "rgb": [0, 0, 0]}, {"index": 0.37576000675561555, "rgb": [0, 0, 0]}, {"index": 0.3758655632494511, "rgb": [255, 165, 0]}, {"index": 0.3759711197432866, "rgb": [0, 0, 0]}, {"index": 0.37700557338287455, "rgb": [0, 0, 0]}, {"index": 0.3771322411754771, "rgb": [255, 165, 0]}, {"index": 0.3772589089680797, "rgb": [0, 0, 0]}, {"index": 0.3799062658334741, "rgb": [0, 0, 0]}, {"index": 0.38021449079547376, "rgb": [255, 165, 0]}, {"index": 0.38052271575747343, "rgb": [0, 0, 0]}, {"index": 0.3814305016044587, "rgb": [0, 0, 0]}, {"index": 0.3815656139165681, "rgb": [255, 165, 0]}, {"index": 0.38170072622867757, "rgb": [0, 0, 0]}, {"index": 0.3844916399256882, "rgb": [0, 0, 0]}, {"index": 0.38481675392670156, "rgb": [255, 165, 0]}, {"index": 0.38514186792771493, "rgb": [0, 0, 0]}, {"index": 0.3864127681134944, "rgb": [0, 0, 0]}, {"index": 0.386590103023138, "rgb": [255, 165, 0]}, {"index": 0.3867674379327816, "rgb": [0, 0, 0]}, {"index": 0.38833811856105394, "rgb": [0, 0, 0]}, {"index": 0.3885323425097112, "rgb": [255, 165, 0]}, {"index": 0.38872656645836845, "rgb": [0, 0, 0]}, {"index": 0.39674041547035976, "rgb": [0, 0, 0]}, {"index": 0.39765242357709846, "rgb": [255, 165, 0]}, {"index": 0.39856443168383715, "rgb": [0, 0, 0]}, {"index": 0.3993244384394528, "rgb": [0, 0, 0]}, {"index": 0.3995102178686033, "rgb": [255, 165, 0]}, {"index": 0.3996959972977538, "rgb": [0, 0, 0]}, {"index": 0.40156223610876546, "rgb": [0, 0, 0]}, {"index": 0.4017902381354501, "rgb": [255, 165, 0]}, {"index": 0.4020182401621348, "rgb": [0, 0, 0]}, {"index": 0.4039182570511738, "rgb": [0, 0, 0]}, {"index": 0.40415470359736533, "rgb": [255, 165, 0]}, {"index": 0.40439115014355687, "rgb": [0, 0, 0]}, {"index": 0.4043067049484884, "rgb": [0, 0, 0]}, {"index": 0.4043235939875021, "rgb": [255, 165, 0]}, {"index": 0.4043404830265158, "rgb": [0, 0, 0]}, {"index": 0.40447559533862526, "rgb": [0, 0, 0]}, {"index": 0.4044924843776389, "rgb": [255, 165, 0]}, {"index": 0.40450937341665255, "rgb": [0, 0, 0]}, {"index": 0.4045684850532005, "rgb": [0, 0, 0]}, {"index": 0.4045769295727073, "rgb": [255, 165, 0]}, {"index": 0.4045853740922141, "rgb": [0, 0, 0]}, {"index": 0.407578956257389, "rgb": [0, 0, 0]}, {"index": 0.40791251477790913, "rgb": [255, 165, 0]}, {"index": 0.40824607329842927, "rgb": [0, 0, 0]}, {"index": 0.41072453977368684, "rgb": [0, 0, 0]}, {"index": 0.41103698699543995, "rgb": [255, 165, 0]}, {"index": 0.41134943421719306, "rgb": [0, 0, 0]}, {"index": 0.4134310082756291, "rgb": [0, 0, 0]}, {"index": 0.41369701064009456, "rgb": [255, 165, 0]}, {"index": 0.41396301300456, "rgb": [0, 0, 0]}, {"index": 0.41419101503124467, "rgb": [0, 0, 0]}, {"index": 0.41424590440803916, "rgb": [255, 165, 0]}, {"index": 0.41430079378483364, "rgb": [0, 0, 0]}, {"index": 0.4151959128525587, "rgb": [0, 0, 0]}, {"index": 0.41530146934639417, "rgb": [255, 165, 0]}, {"index": 0.41540702584022965, "rgb": [0, 0, 0]}, {"index": 0.41537747002195574, "rgb": [0, 0, 0]}, {"index": 0.41538591454146256, "rgb": [255, 165, 0]}, {"index": 0.4153943590609694, "rgb": [0, 0, 0]}, {"index": 0.4186159432528289, "rgb": [0, 0, 0]}, {"index": 0.41897483533186963, "rgb": [255, 165, 0]}, {"index": 0.41933372741091035, "rgb": [0, 0, 0]}, {"index": 0.41984884310082754, "rgb": [0, 0, 0]}, {"index": 0.4199459550751562, "rgb": [255, 165, 0]}, {"index": 0.42004306704948485, "rgb": [0, 0, 0]}, {"index": 0.42370798851545344, "rgb": [0, 0, 0]}, {"index": 0.424125992231042, "rgb": [255, 165, 0]}, {"index": 0.4245439959466306, "rgb": [0, 0, 0]}, {"index": 0.4277360243202162, "rgb": [0, 0, 0]}, {"index": 0.42813713899679107, "rgb": [255, 165, 0]}, {"index": 0.42853825367336595, "rgb": [0, 0, 0]}, {"index": 0.43045515960141867, "rgb": [0, 0, 0]}, {"index": 0.4307127174463773, "rgb": [255, 165, 0]}, {"index": 0.4309702752913359, "rgb": [0, 0, 0]}, {"index": 0.4323087316331701, "rgb": [0, 0, 0]}, {"index": 0.43248606654281374, "rgb": [255, 165, 0]}, {"index": 0.4326634014524574, "rgb": [0, 0, 0]}, {"index": 0.43358807633845636, "rgb": [0, 0, 0]}, {"index": 0.43371052187130554, "rgb": [255, 165, 0]}, {"index": 0.4338329674041547, "rgb": [0, 0, 0]}, {"index": 0.43675054889376796, "rgb": [0, 0, 0]}, {"index": 0.43708832967404154, "rgb": [255, 165, 0]}, {"index": 0.4374261104543151, "rgb": [0, 0, 0]}, {"index": 0.4375063333896302, "rgb": [0, 0, 0]}, {"index": 0.43755277824691774, "rgb": [255, 165, 0]}, {"index": 0.4375992231042053, "rgb": [0, 0, 0]}, {"index": 0.4377047795980409, "rgb": [0, 0, 0]}, {"index": 0.43772166863705453, "rgb": [255, 165, 0]}, {"index": 0.4377385576760682, "rgb": [0, 0, 0]}, {"index": 0.4389756797838203, "rgb": [0, 0, 0]}, {"index": 0.4391150143556832, "rgb": [255, 165, 0]}, {"index": 0.43925434892754606, "rgb": [0, 0, 0]}, {"index": 0.4415470359736531, "rgb": [0, 0, 0]}, {"index": 0.44181726059787196, "rgb": [255, 165, 0]}, {"index": 0.44208748522209085, "rgb": [0, 0, 0]}, {"index": 0.44284326971795307, "rgb": [0, 0, 0]}, {"index": 0.44295727073129537, "rgb": [255, 165, 0]}, {"index": 0.4430712717446377, "rgb": [0, 0, 0]}, {"index": 0.44527529133592303, "rgb": [0, 0, 0]}, {"index": 0.4455328491808816, "rgb": [255, 165, 0]}, {"index": 0.44579040702584016, "rgb": [0, 0, 0]}, {"index": 0.44655885830096265, "rgb": [0, 0, 0]}, {"index": 0.446672859314305, "rgb": [255, 165, 0]}, {"index": 0.44678686032764736, "rgb": [0, 0, 0]}, {"index": 0.4509668974835332, "rgb": [0, 0, 0]}, {"index": 0.45144401283566965, "rgb": [255, 165, 0]}, {"index": 0.4519211281878061, "rgb": [0, 0, 0]}, {"index": 0.4525460226313123, "rgb": [0, 0, 0]}, {"index": 0.45266846816416145, "rgb": [255, 165, 0]}, {"index": 0.45279091369701063, "rgb": [0, 0, 0]}, {"index": 0.4527824691775038, "rgb": [0, 0, 0]}, {"index": 0.45279513595676407, "rgb": [255, 165, 0]}, {"index": 0.45280780273602433, "rgb": [0, 0, 0]}, {"index": 0.4532891403479142, "rgb": [0, 0, 0]}, {"index": 0.45334402972470866, "rgb": [255, 165, 0]}, {"index": 0.45339891910150315, "rgb": [0, 0, 0]}, {"index": 0.4541420368181051, "rgb": [0, 0, 0]}, {"index": 0.4542307042729269, "rgb": [255, 165, 0]}, {"index": 0.45431937172774867, "rgb": [0, 0, 0]}, {"index": 0.45594071947306203, "rgb": [0, 0, 0]}, {"index": 0.4561307211619659, "rgb": [255, 165, 0]}, {"index": 0.4563207228508698, "rgb": [0, 0, 0]}, {"index": 0.45616872149974663, "rgb": [0, 0, 0]}, {"index": 0.45617294375950007, "rgb": [255, 165, 0]}, {"index": 0.4561771660192535, "rgb": [0, 0, 0]}, {"index": 0.45765495693295055, "rgb": [0, 0, 0]}, {"index": 0.4578196250633339, "rgb": [255, 165, 0]}, {"index": 0.45798429319371725, "rgb": [0, 0, 0]}, {"index": 0.45842763046782636, "rgb": [0, 0, 0]}, {"index": 0.4584951866238811, "rgb": [255, 165, 0]}, {"index": 0.45856274277993586, "rgb": [0, 0, 0]}, {"index": 0.45906519169059284, "rgb": [0, 0, 0]}, {"index": 0.4591285255868941, "rgb": [255, 165, 0]}, {"index": 0.45919185948319535, "rgb": [0, 0, 0]}, {"index": 0.4597745313291674, "rgb": [0, 0, 0]}, {"index": 0.45984630974497553, "rgb": [255, 165, 0]}, {"index": 0.45991808816078367, "rgb": [0, 0, 0]}, {"index": 0.4603023137983449, "rgb": [0, 0, 0]}, {"index": 0.4603529809153859, "rgb": [255, 165, 0]}, {"index": 0.4604036480324269, "rgb": [0, 0, 0]}, {"index": 0.46073298429319376, "rgb": [0, 0, 0]}, {"index": 0.46077520689072793, "rgb": [255, 165, 0]}, {"index": 0.4608174294882621, "rgb": [0, 0, 0]}, {"index": 0.4611552102685357, "rgb": [0, 0, 0]}, {"index": 0.4611974328660699, "rgb": [255, 165, 0]}, {"index": 0.4612396554636041, "rgb": [0, 0, 0]}, {"index": 0.4613494342171931, "rgb": [0, 0, 0]}, {"index": 0.46136632325620675, "rgb": [255, 165, 0]}, {"index": 0.4613832122952204, "rgb": [0, 0, 0]}, {"index": 0.4655843607498733, "rgb": [0, 0, 0]}, {"index": 0.46605303158250294, "rgb": [255, 165, 0]}, {"index": 0.4665217024151326, "rgb": [0, 0, 0]}, {"index": 0.46624303327140687, "rgb": [0, 0, 0]}, {"index": 0.46626414457017396, "rgb": [255, 165, 0]}, {"index": 0.46628525586894104, "rgb": [0, 0, 0]}, {"index": 0.46653014693463946, "rgb": [0, 0, 0]}, {"index": 0.46655970275291336, "rgb": [255, 165, 0]}, {"index": 0.46658925857118727, "rgb": [0, 0, 0]}, {"index": 0.46682570511737886, "rgb": [0, 0, 0]}, {"index": 0.46685526093565277, "rgb": [255, 165, 0]}, {"index": 0.4668848167539267, "rgb": [0, 0, 0]}, {"index": 0.4670452626245567, "rgb": [0, 0, 0]}, {"index": 0.4670663739233238, "rgb": [255, 165, 0]}, {"index": 0.46708748522209087, "rgb": [0, 0, 0]}, {"index": 0.4675223779766931, "rgb": [0, 0, 0]}, {"index": 0.46757304509373415, "rgb": [255, 165, 0]}, {"index": 0.4676237122107752, "rgb": [0, 0, 0]}, {"index": 0.4677250464448573, "rgb": [0, 0, 0]}, {"index": 0.46774193548387094, "rgb": [255, 165, 0]}, {"index": 0.4677588245228846, "rgb": [0, 0, 0]}, {"index": 0.4683499408883634, "rgb": [0, 0, 0]}, {"index": 0.46841749704441815, "rgb": [255, 165, 0]}, {"index": 0.4684850532004729, "rgb": [0, 0, 0]}, {"index": 0.4688735010977875, "rgb": [0, 0, 0]}, {"index": 0.4689241682148286, "rgb": [255, 165, 0]}, {"index": 0.4689748353318696, "rgb": [0, 0, 0]}, {"index": 0.47055818273940214, "rgb": [0, 0, 0]}, {"index": 0.4707397399087992, "rgb": [255, 165, 0]}, {"index": 0.47092129707819624, "rgb": [0, 0, 0]}, {"index": 0.4734757642290154, "rgb": [0, 0, 0]}, {"index": 0.4737797669312616, "rgb": [255, 165, 0]}, {"index": 0.47408376963350785, "rgb": [0, 0, 0]}, {"index": 0.48042982604289813, "rgb": [0, 0, 0]}, {"index": 0.48116872149974665, "rgb": [255, 165, 0]}, {"index": 0.4819076169565952, "rgb": [0, 0, 0]}, {"index": 0.48508275629116704, "rgb": [0, 0, 0]}, {"index": 0.4855176490457693, "rgb": [255, 165, 0]}, {"index": 0.4859525418003715, "rgb": [0, 0, 0]}, {"index": 0.4869236615436582, "rgb": [0, 0, 0]}, {"index": 0.4870798851545347, "rgb": [255, 165, 0]}, {"index": 0.48723610876541124, "rgb": [0, 0, 0]}, {"index": 0.48954990711028545, "rgb": [0, 0, 0]}, {"index": 0.4898243539942577, "rgb": [255, 165, 0]}, {"index": 0.49009880087823, "rgb": [0, 0, 0]}, {"index": 0.4905843607498733, "rgb": [0, 0, 0]}, {"index": 0.4906688059449417, "rgb": [255, 165, 0]}, {"index": 0.4907532511400101, "rgb": [0, 0, 0]}, {"index": 0.49218881945617293, "rgb": [0, 0, 0]}, {"index": 0.4923577098463097, "rgb": [255, 165, 0]}, {"index": 0.4925266002364465, "rgb": [0, 0, 0]}, {"index": 0.4964237459888532, "rgb": [0, 0, 0]}, {"index": 0.4968755277824692, "rgb": [255, 165, 0]}, {"index": 0.4973273095760852, "rgb": [0, 0, 0]}, {"index": 0.5011315656139166, "rgb": [0, 0, 0]}, {"index": 0.5016044587062997, "rgb": [255, 165, 0]}, {"index": 0.5020773517986827, "rgb": [0, 0, 0]}, {"index": 0.5028204695152846, "rgb": [0, 0, 0]}, {"index": 0.502955581827394, "rgb": [255, 165, 0]}, {"index": 0.5030906941395034, "rgb": [0, 0, 0]}, {"index": 0.5043615943252829, "rgb": [0, 0, 0]}, {"index": 0.5045178179361595, "rgb": [255, 165, 0]}, {"index": 0.504674041547036, "rgb": [0, 0, 0]}, {"index": 0.5071018409052526, "rgb": [0, 0, 0]}, {"index": 0.5073889545684851, "rgb": [255, 165, 0]}, {"index": 0.5076760682317176, "rgb": [0, 0, 0]}, {"index": 0.5081489613241006, "rgb": [0, 0, 0]}, {"index": 0.508233406519169, "rgb": [255, 165, 0]}, {"index": 0.5083178517142375, "rgb": [0, 0, 0]}, {"index": 0.5100954230704273, "rgb": [0, 0, 0]}, {"index": 0.5103023137983449, "rgb": [255, 165, 0]}, {"index": 0.5105092045262625, "rgb": [0, 0, 0]}, {"index": 0.5115183246073299, "rgb": [0, 0, 0]}, {"index": 0.5116534369194393, "rgb": [255, 165, 0]}, {"index": 0.5117885492315487, "rgb": [0, 0, 0]}, {"index": 0.5119574396216856, "rgb": [0, 0, 0]}, {"index": 0.5119912176997129, "rgb": [255, 165, 0]}, {"index": 0.5120249957777402, "rgb": [0, 0, 0]}, {"index": 0.5123332207397399, "rgb": [0, 0, 0]}, {"index": 0.5123712210775206, "rgb": [255, 165, 0]}, {"index": 0.5124092214153014, "rgb": [0, 0, 0]}, {"index": 0.5134732308731633, "rgb": [0, 0, 0]}, {"index": 0.5135956764060124, "rgb": [255, 165, 0]}, {"index": 0.5137181219388616, "rgb": [0, 0, 0]}, {"index": 0.5139756797838203, "rgb": [0, 0, 0]}, {"index": 0.5140179023813545, "rgb": [255, 165, 0]}, {"index": 0.5140601249788886, "rgb": [0, 0, 0]}, {"index": 0.5143219050836007, "rgb": [0, 0, 0]}, {"index": 0.514355683161628, "rgb": [255, 165, 0]}, {"index": 0.5143894612396555, "rgb": [0, 0, 0]}, {"index": 0.5165977030906941, "rgb": [0, 0, 0]}, {"index": 0.5168468164161459, "rgb": [255, 165, 0]}, {"index": 0.5170959297415978, "rgb": [0, 0, 0]}, {"index": 0.5196208410741429, "rgb": [0, 0, 0]}, {"index": 0.5199290660361425, "rgb": [255, 165, 0]}, {"index": 0.5202372909981422, "rgb": [0, 0, 0]}, {"index": 0.5204610707650734, "rgb": [0, 0, 0]}, {"index": 0.5205201824016213, "rgb": [255, 165, 0]}, {"index": 0.5205792940381693, "rgb": [0, 0, 0]}, {"index": 0.5228762033440297, "rgb": [0, 0, 0]}, {"index": 0.5231379834487417, "rgb": [255, 165, 0]}, {"index": 0.5233997635534537, "rgb": [0, 0, 0]}, {"index": 0.5242399932443844, "rgb": [0, 0, 0]}, {"index": 0.5243624387772335, "rgb": [255, 165, 0]}, {"index": 0.5244848843100827, "rgb": [0, 0, 0]}, {"index": 0.5247804424928222, "rgb": [0, 0, 0]}, {"index": 0.5248268873501097, "rgb": [255, 165, 0]}, {"index": 0.5248733322073973, "rgb": [0, 0, 0]}, {"index": 0.5256628947812869, "rgb": [0, 0, 0]}, {"index": 0.5257557844958621, "rgb": [255, 165, 0]}, {"index": 0.5258486742104374, "rgb": [0, 0, 0]}, {"index": 0.5260597871981085, "rgb": [0, 0, 0]}, {"index": 0.5260935652761358, "rgb": [255, 165, 0]}, {"index": 0.5261273433541631, "rgb": [0, 0, 0]}, {"index": 0.5269675730450938, "rgb": [0, 0, 0]}, {"index": 0.5270646850194224, "rgb": [255, 165, 0]}, {"index": 0.527161796993751, "rgb": [0, 0, 0]}, {"index": 0.5275966897483534, "rgb": [0, 0, 0]}, {"index": 0.5276558013849012, "rgb": [255, 165, 0]}, {"index": 0.527714913021449, "rgb": [0, 0, 0]}, {"index": 0.527845803073805, "rgb": [0, 0, 0]}, {"index": 0.5278669143725722, "rgb": [255, 165, 0]}, {"index": 0.5278880256713393, "rgb": [0, 0, 0]}, {"index": 0.5288549231548725, "rgb": [0, 0, 0]}, {"index": 0.5289647019084615, "rgb": [255, 165, 0]}, {"index": 0.5290744806620504, "rgb": [0, 0, 0]}, {"index": 0.5331447390643472, "rgb": [0, 0, 0]}, {"index": 0.5336091876372234, "rgb": [255, 165, 0]}, {"index": 0.5340736362100996, "rgb": [0, 0, 0]}, {"index": 0.5338751900016889, "rgb": [0, 0, 0]}, {"index": 0.5339047458199628, "rgb": [255, 165, 0]}, {"index": 0.5339343016382367, "rgb": [0, 0, 0]}, {"index": 0.54009880087823, "rgb": [0, 0, 0]}, {"index": 0.5407870292180375, "rgb": [255, 165, 0]}, {"index": 0.5414752575578449, "rgb": [0, 0, 0]}, {"index": 0.541053031582503, "rgb": [0, 0, 0]}, {"index": 0.5410825874007769, "rgb": [255, 165, 0]}, {"index": 0.5411121432190508, "rgb": [0, 0, 0]}, {"index": 0.5416145921297078, "rgb": [0, 0, 0]}, {"index": 0.5416737037662557, "rgb": [255, 165, 0]}, {"index": 0.5417328154028036, "rgb": [0, 0, 0]}, {"index": 0.5420157068062827, "rgb": [0, 0, 0]}, {"index": 0.5420537071440635, "rgb": [255, 165, 0]}, {"index": 0.5420917074818443, "rgb": [0, 0, 0]}, {"index": 0.5436117209930755, "rgb": [0, 0, 0]}, {"index": 0.5437848336429657, "rgb": [255, 165, 0]}, {"index": 0.5439579462928559, "rgb": [0, 0, 0]}, {"index": 0.544240837696335, "rgb": [0, 0, 0]}, {"index": 0.5442915048133761, "rgb": [255, 165, 0]}, {"index": 0.5443421719304171, "rgb": [0, 0, 0]}, {"index": 0.5473315318358386, "rgb": [0, 0, 0]}, {"index": 0.5476693126161122, "rgb": [255, 165, 0]}, {"index": 0.5480070933963858, "rgb": [0, 0, 0]}, {"index": 0.5480493159939199, "rgb": [0, 0, 0]}, {"index": 0.5480915385914541, "rgb": [255, 165, 0]}, {"index": 0.5481337611889883, "rgb": [0, 0, 0]}, {"index": 0.551587569667286, "rgb": [0, 0, 0]}, {"index": 0.5519760175646006, "rgb": [255, 165, 0]}, {"index": 0.5523644654619152, "rgb": [0, 0, 0]}, {"index": 0.5525080222935316, "rgb": [0, 0, 0]}, {"index": 0.5525671339300794, "rgb": [255, 165, 0]}, {"index": 0.5526262455666272, "rgb": [0, 0, 0]}, {"index": 0.5533651410234758, "rgb": [0, 0, 0]}, {"index": 0.5534538084782976, "rgb": [255, 165, 0]}, {"index": 0.5535424759331194, "rgb": [0, 0, 0]}, {"index": 0.555125823340652, "rgb": [0, 0, 0]}, {"index": 0.5553116027698024, "rgb": [255, 165, 0]}, {"index": 0.5554973821989528, "rgb": [0, 0, 0]}, {"index": 0.5559576085120758, "rgb": [0, 0, 0]}, {"index": 0.5560293869278838, "rgb": [255, 165, 0]}, {"index": 0.5561011653436919, "rgb": [0, 0, 0]}, {"index": 0.5694055058267184, "rgb": [0, 0, 0]}, {"index": 0.5708917412599223, "rgb": [255, 165, 0]}, {"index": 0.5723779766931261, "rgb": [0, 0, 0]}, {"index": 0.5711957439621687, "rgb": [0, 0, 0]}, {"index": 0.571229522040196, "rgb": [255, 165, 0]}, {"index": 0.5712633001182232, "rgb": [0, 0, 0]}, {"index": 0.5771955750717784, "rgb": [0, 0, 0]}, {"index": 0.5778584698530653, "rgb": [255, 165, 0]}, {"index": 0.5785213646343522, "rgb": [0, 0, 0]}, {"index": 0.5786564769464617, "rgb": [0, 0, 0]}, {"index": 0.5787451444012836, "rgb": [255, 165, 0]}, {"index": 0.5788338118561054, "rgb": [0, 0, 0]}, {"index": 0.5800371558858302, "rgb": [0, 0, 0]}, {"index": 0.5801807127174464, "rgb": [255, 165, 0]}, {"index": 0.5803242695490627, "rgb": [0, 0, 0]}, {"index": 0.580408714744131, "rgb": [0, 0, 0]}, {"index": 0.5804340483026516, "rgb": [255, 165, 0]}, {"index": 0.5804593818611721, "rgb": [0, 0, 0]}, {"index": 0.5824100658672522, "rgb": [0, 0, 0]}, {"index": 0.58262962337443, "rgb": [255, 165, 0]}, {"index": 0.5828491808816079, "rgb": [0, 0, 0]}, {"index": 0.5833136294544841, "rgb": [0, 0, 0]}, {"index": 0.5833896301300456, "rgb": [255, 165, 0]}, {"index": 0.5834656308056072, "rgb": [0, 0, 0]}, {"index": 0.5836176321567302, "rgb": [0, 0, 0]}, {"index": 0.5836429657152508, "rgb": [255, 165, 0]}, {"index": 0.5836682992737713, "rgb": [0, 0, 0]}, {"index": 0.5842889714575241, "rgb": [0, 0, 0]}, {"index": 0.5843607498733322, "rgb": [255, 165, 0]}, {"index": 0.5844325282891403, "rgb": [0, 0, 0]}, {"index": 0.587514777909137, "rgb": [0, 0, 0]}, {"index": 0.5878652254686708, "rgb": [255, 165, 0]}, {"index": 0.5882156730282047, "rgb": [0, 0, 0]}, {"index": 0.5882832291842595, "rgb": [0, 0, 0]}, {"index": 0.588329674041547, "rgb": [255, 165, 0]}, {"index": 0.5883761188988346, "rgb": [0, 0, 0]}, {"index": 0.5926997128863367, "rgb": [0, 0, 0]}, {"index": 0.59318527275798, "rgb": [255, 165, 0]}, {"index": 0.5936708326296234, "rgb": [0, 0, 0]}, {"index": 0.5941352812024996, "rgb": [0, 0, 0]}, {"index": 0.5942408376963351, "rgb": [255, 165, 0]}, {"index": 0.5943463941901705, "rgb": [0, 0, 0]}, {"index": 0.5970528626921129, "rgb": [0, 0, 0]}, {"index": 0.5973653099138659, "rgb": [255, 165, 0]}, {"index": 0.597677757135619, "rgb": [0, 0, 0]}, {"index": 0.5986573213984125, "rgb": [0, 0, 0]}, {"index": 0.5988008782300287, "rgb": [255, 165, 0]}, {"index": 0.5989444350616449, "rgb": [0, 0, 0]}, {"index": 0.5988768789055904, "rgb": [0, 0, 0]}, {"index": 0.5988853234250971, "rgb": [255, 165, 0]}, {"index": 0.5988937679446039, "rgb": [0, 0, 0]}, {"index": 0.6021533524742443, "rgb": [0, 0, 0]}, {"index": 0.6025164668130384, "rgb": [255, 165, 0]}, {"index": 0.6028795811518325, "rgb": [0, 0, 0]}, {"index": 0.6042644823509542, "rgb": [0, 0, 0]}, {"index": 0.6044587062996115, "rgb": [255, 165, 0]}, {"index": 0.6046529302482688, "rgb": [0, 0, 0]}, {"index": 0.6045727073129539, "rgb": [0, 0, 0]}, {"index": 0.6045853740922141, "rgb": [255, 165, 0]}, {"index": 0.6045980408714744, "rgb": [0, 0, 0]}, {"index": 0.6053453808478297, "rgb": [0, 0, 0]}, {"index": 0.6054298260428982, "rgb": [255, 165, 0]}, {"index": 0.6055142712379666, "rgb": [0, 0, 0]}, {"index": 0.6055818273940213, "rgb": [0, 0, 0]}, {"index": 0.605598716433035, "rgb": [255, 165, 0]}, {"index": 0.6056156054720486, "rgb": [0, 0, 0]}, {"index": 0.6057887181219388, "rgb": [0, 0, 0]}, {"index": 0.6058098294207059, "rgb": [255, 165, 0]}, {"index": 0.6058309407194731, "rgb": [0, 0, 0]}, {"index": 0.6074438439452795, "rgb": [0, 0, 0]}, {"index": 0.6076254011146766, "rgb": [255, 165, 0]}, {"index": 0.6078069582840736, "rgb": [0, 0, 0]}, {"index": 0.6080054044924844, "rgb": [0, 0, 0]}, {"index": 0.6080476270900186, "rgb": [255, 165, 0]}, {"index": 0.6080898496875528, "rgb": [0, 0, 0]}, {"index": 0.6085416314811687, "rgb": [0, 0, 0]}, {"index": 0.6085965208579632, "rgb": [255, 165, 0]}, {"index": 0.6086514102347578, "rgb": [0, 0, 0]}, {"index": 0.6091285255868941, "rgb": [0, 0, 0]}, {"index": 0.6091876372234419, "rgb": [255, 165, 0]}, {"index": 0.6092467488599898, "rgb": [0, 0, 0]}, {"index": 0.6097956426279345, "rgb": [0, 0, 0]}, {"index": 0.6098631987839892, "rgb": [255, 165, 0]}, {"index": 0.6099307549400439, "rgb": [0, 0, 0]}, {"index": 0.6102812024995778, "rgb": [0, 0, 0]}, {"index": 0.6103276473568654, "rgb": [255, 165, 0]}, {"index": 0.610374092214153, "rgb": [0, 0, 0]}, {"index": 0.6129116703259585, "rgb": [0, 0, 0]}, {"index": 0.613198783989191, "rgb": [255, 165, 0]}, {"index": 0.6134858976524236, "rgb": [0, 0, 0]}, {"index": 0.6143767944603952, "rgb": [0, 0, 0]}, {"index": 0.6145076845127512, "rgb": [255, 165, 0]}, {"index": 0.6146385745651072, "rgb": [0, 0, 0]}, {"index": 0.6166357034284748, "rgb": [0, 0, 0]}, {"index": 0.6168721499746664, "rgb": [255, 165, 0]}, {"index": 0.617108596520858, "rgb": [0, 0, 0]}, {"index": 0.6179361594325283, "rgb": [0, 0, 0]}, {"index": 0.6180543827056241, "rgb": [255, 165, 0]}, {"index": 0.6181726059787198, "rgb": [0, 0, 0]}, {"index": 0.6201824016213477, "rgb": [0, 0, 0]}, {"index": 0.6204188481675392, "rgb": [255, 165, 0]}, {"index": 0.6206552947137307, "rgb": [0, 0, 0]}, {"index": 0.6261188988346563, "rgb": [0, 0, 0]}, {"index": 0.6267522377976693, "rgb": [255, 165, 0]}, {"index": 0.6273855767606823, "rgb": [0, 0, 0]}, {"index": 0.6323762877892248, "rgb": [0, 0, 0]}, {"index": 0.6330011822327309, "rgb": [255, 165, 0]}, {"index": 0.633626076676237, "rgb": [0, 0, 0]}, {"index": 0.6354332038507009, "rgb": [0, 0, 0]}, {"index": 0.6357034284749198, "rgb": [255, 165, 0]}, {"index": 0.6359736530991387, "rgb": [0, 0, 0]}, {"index": 0.6368434386083431, "rgb": [0, 0, 0]}, {"index": 0.6369701064009458, "rgb": [255, 165, 0]}, {"index": 0.6370967741935484, "rgb": [0, 0, 0]}, {"index": 0.6380341158588076, "rgb": [0, 0, 0]}, {"index": 0.6381523391319034, "rgb": [255, 165, 0]}, {"index": 0.6382705624049991, "rgb": [0, 0, 0]}, {"index": 0.6425603783144739, "rgb": [0, 0, 0]}, {"index": 0.6430501604458706, "rgb": [255, 165, 0]}, {"index": 0.6435399425772673, "rgb": [0, 0, 0]}, {"index": 0.6489402128018915, "rgb": [0, 0, 0]}, {"index": 0.6495946630636716, "rgb": [255, 165, 0]}, {"index": 0.6502491133254518, "rgb": [0, 0, 0]}, {"index": 0.6517606823171762, "rgb": [0, 0, 0]}, {"index": 0.6520013511231211, "rgb": [255, 165, 0]}, {"index": 0.6522420199290659, "rgb": [0, 0, 0]}, {"index": 0.6557253842256375, "rgb": [0, 0, 0]}, {"index": 0.6561391656814727, "rgb": [255, 165, 0]}, {"index": 0.6565529471373078, "rgb": [0, 0, 0]}, {"index": 0.6603572031751394, "rgb": [0, 0, 0]}, {"index": 0.6608258740077689, "rgb": [255, 165, 0]}, {"index": 0.6612945448403985, "rgb": [0, 0, 0]}, {"index": 0.6617758824522885, "rgb": [0, 0, 0]}, {"index": 0.661881438946124, "rgb": [255, 165, 0]}, {"index": 0.6619869954399594, "rgb": [0, 0, 0]}, {"index": 0.6623374429994934, "rgb": [0, 0, 0]}, {"index": 0.6623881101165344, "rgb": [255, 165, 0]}, {"index": 0.6624387772335755, "rgb": [0, 0, 0]}, {"index": 0.6687341665259247, "rgb": [0, 0, 0]}, {"index": 0.6694392839047458, "rgb": [255, 165, 0]}, {"index": 0.670144401283567, "rgb": [0, 0, 0]}, {"index": 0.670275291335923, "rgb": [0, 0, 0]}, {"index": 0.6703681810504982, "rgb": [255, 165, 0]}, {"index": 0.6704610707650734, "rgb": [0, 0, 0]}, {"index": 0.6707481844283061, "rgb": [0, 0, 0]}, {"index": 0.6707904070258403, "rgb": [255, 165, 0]}, {"index": 0.6708326296233744, "rgb": [0, 0, 0]}, {"index": 0.6714364127681136, "rgb": [0, 0, 0]}, {"index": 0.6715081911839217, "rgb": [255, 165, 0]}, {"index": 0.6715799695997298, "rgb": [0, 0, 0]}, {"index": 0.6721541969261949, "rgb": [0, 0, 0]}, {"index": 0.672225975342003, "rgb": [255, 165, 0]}, {"index": 0.6722977537578111, "rgb": [0, 0, 0]}, {"index": 0.6728339807464956, "rgb": [0, 0, 0]}, {"index": 0.6729015369025503, "rgb": [255, 165, 0]}, {"index": 0.672969093058605, "rgb": [0, 0, 0]}, {"index": 0.6732435399425772, "rgb": [0, 0, 0]}, {"index": 0.673281540280358, "rgb": [255, 165, 0]}, {"index": 0.6733195406181388, "rgb": [0, 0, 0]}, {"index": 0.6790955919608175, "rgb": [0, 0, 0]}, {"index": 0.6797415977030907, "rgb": [255, 165, 0]}, {"index": 0.680387603445364, "rgb": [0, 0, 0]}, {"index": 0.6843396385745651, "rgb": [0, 0, 0]}, {"index": 0.6848505320047289, "rgb": [255, 165, 0]}, {"index": 0.6853614254348926, "rgb": [0, 0, 0]}, {"index": 0.6880045600405337, "rgb": [0, 0, 0]}, {"index": 0.6883550076000675, "rgb": [255, 165, 0]}, {"index": 0.6887054551596014, "rgb": [0, 0, 0]}, {"index": 0.6918890390136802, "rgb": [0, 0, 0]}, {"index": 0.6922817091707482, "rgb": [255, 165, 0]}, {"index": 0.6926743793278162, "rgb": [0, 0, 0]}, {"index": 0.69627174463773, "rgb": [0, 0, 0]}, {"index": 0.6967150819118392, "rgb": [255, 165, 0]}, {"index": 0.6971584191859483, "rgb": [0, 0, 0]}, {"index": 0.6995651072453978, "rgb": [0, 0, 0]}, {"index": 0.6998817767269042, "rgb": [255, 165, 0]}, {"index": 0.7001984462084107, "rgb": [0, 0, 0]}, {"index": 0.7008697855092044, "rgb": [0, 0, 0]}, {"index": 0.7009795642627934, "rgb": [255, 165, 0]}, {"index": 0.7010893430163824, "rgb": [0, 0, 0]}, {"index": 0.7024235770984631, "rgb": [0, 0, 0]}, {"index": 0.7025840229690931, "rgb": [255, 165, 0]}, {"index": 0.702744468839723, "rgb": [0, 0, 0]}, {"index": 0.703116027698024, "rgb": [0, 0, 0]}, {"index": 0.7031751393345719, "rgb": [255, 165, 0]}, {"index": 0.7032342509711198, "rgb": [0, 0, 0]}, {"index": 0.703327140685695, "rgb": [0, 0, 0]}, {"index": 0.7033440297247087, "rgb": [255, 165, 0]}, {"index": 0.7033609187637223, "rgb": [0, 0, 0]}, {"index": 0.7038760344536396, "rgb": [0, 0, 0]}, {"index": 0.7039351460901875, "rgb": [255, 165, 0]}, {"index": 0.7039942577267354, "rgb": [0, 0, 0]}, {"index": 0.7058731633170073, "rgb": [0, 0, 0]}, {"index": 0.7060884985644317, "rgb": [255, 165, 0]}, {"index": 0.706303833811856, "rgb": [0, 0, 0]}, {"index": 0.7070385070089511, "rgb": [0, 0, 0]}, {"index": 0.7071440635027867, "rgb": [255, 165, 0]}, {"index": 0.7072496199966223, "rgb": [0, 0, 0]}, {"index": 0.7079420705961832, "rgb": [0, 0, 0]}, {"index": 0.7080307380510049, "rgb": [255, 165, 0]}, {"index": 0.7081194055058266, "rgb": [0, 0, 0]}, {"index": 0.7125907785846985, "rgb": [0, 0, 0]}, {"index": 0.7130974497551089, "rgb": [255, 165, 0]}, {"index": 0.7136041209255193, "rgb": [0, 0, 0]}, {"index": 0.7133634521195744, "rgb": [0, 0, 0]}, {"index": 0.7133930079378483, "rgb": [255, 165, 0]}, {"index": 0.7134225637561222, "rgb": [0, 0, 0]}, {"index": 0.7152930248268874, "rgb": [0, 0, 0]}, {"index": 0.7155041378145583, "rgb": [255, 165, 0]}, {"index": 0.7157152508022293, "rgb": [0, 0, 0]}, {"index": 0.7170241513257896, "rgb": [0, 0, 0]}, {"index": 0.7171930417159263, "rgb": [255, 165, 0]}, {"index": 0.7173619321060631, "rgb": [0, 0, 0]}, {"index": 0.7192070596183078, "rgb": [0, 0, 0]}, {"index": 0.719430839385239, "rgb": [255, 165, 0]}, {"index": 0.7196546191521702, "rgb": [0, 0, 0]}, {"index": 0.7228128694477285, "rgb": [0, 0, 0]}, {"index": 0.7231886505657829, "rgb": [255, 165, 0]}, {"index": 0.7235644316838372, "rgb": [0, 0, 0]}, {"index": 0.7234546529302484, "rgb": [0, 0, 0]}, {"index": 0.7234842087485223, "rgb": [255, 165, 0]}, {"index": 0.7235137645667962, "rgb": [0, 0, 0]}, {"index": 0.7236742104374262, "rgb": [0, 0, 0]}, {"index": 0.7236953217361932, "rgb": [255, 165, 0]}, {"index": 0.7237164330349602, "rgb": [0, 0, 0]}, {"index": 0.7239613241006587, "rgb": [0, 0, 0]}, {"index": 0.7239908799189326, "rgb": [255, 165, 0]}, {"index": 0.7240204357372065, "rgb": [0, 0, 0]}, {"index": 0.7248268873501098, "rgb": [0, 0, 0]}, {"index": 0.724919777064685, "rgb": [255, 165, 0]}, {"index": 0.7250126667792602, "rgb": [0, 0, 0]}, {"index": 0.725109778753589, "rgb": [0, 0, 0]}, {"index": 0.725130890052356, "rgb": [255, 165, 0]}, {"index": 0.725152001351123, "rgb": [0, 0, 0]}, {"index": 0.7253208917412599, "rgb": [0, 0, 0]}, {"index": 0.725342003040027, "rgb": [255, 165, 0]}, {"index": 0.7253631143387942, "rgb": [0, 0, 0]}, {"index": 0.725532004728931, "rgb": [0, 0, 0]}, {"index": 0.725553116027698, "rgb": [255, 165, 0]}, {"index": 0.725574227326465, "rgb": [0, 0, 0]}, {"index": 0.7256671170410405, "rgb": [0, 0, 0]}, {"index": 0.7256797838203006, "rgb": [255, 165, 0]}, {"index": 0.7256924505995608, "rgb": [0, 0, 0]}, {"index": 0.7258317851714238, "rgb": [0, 0, 0]}, {"index": 0.7258486742104374, "rgb": [255, 165, 0]}, {"index": 0.7258655632494511, "rgb": [0, 0, 0]}, {"index": 0.7286226988684343, "rgb": [0, 0, 0]}, {"index": 0.728930923830434, "rgb": [255, 165, 0]}, {"index": 0.7292391487924337, "rgb": [0, 0, 0]}, {"index": 0.7413190339469684, "rgb": [0, 0, 0]}, {"index": 0.7426954906265834, "rgb": [255, 165, 0]}, {"index": 0.7440719473061983, "rgb": [0, 0, 0]}, {"index": 0.7451655125823341, "rgb": [0, 0, 0]}, {"index": 0.7454399594663064, "rgb": [255, 165, 0]}, {"index": 0.7457144063502786, "rgb": [0, 0, 0]}, {"index": 0.7468459719641952, "rgb": [0, 0, 0]}, {"index": 0.7470021955750717, "rgb": [255, 165, 0]}, {"index": 0.7471584191859483, "rgb": [0, 0, 0]}, {"index": 0.7495862185441649, "rgb": [0, 0, 0]}, {"index": 0.7498733322073974, "rgb": [255, 165, 0]}, {"index": 0.7501604458706299, "rgb": [0, 0, 0]}, {"index": 0.7505193379496706, "rgb": [0, 0, 0]}, {"index": 0.7505911163654788, "rgb": [255, 165, 0]}, {"index": 0.750662894781287, "rgb": [0, 0, 0]}, {"index": 0.7508571187299443, "rgb": [0, 0, 0]}, {"index": 0.7508866745482182, "rgb": [255, 165, 0]}, {"index": 0.7509162303664921, "rgb": [0, 0, 0]}, {"index": 0.7525586894105725, "rgb": [0, 0, 0]}, {"index": 0.752744468839723, "rgb": [255, 165, 0]}, {"index": 0.7529302482688736, "rgb": [0, 0, 0]}, {"index": 0.7533524742442156, "rgb": [0, 0, 0]}, {"index": 0.7534200304002703, "rgb": [255, 165, 0]}, {"index": 0.753487586556325, "rgb": [0, 0, 0]}, {"index": 0.7541800371558859, "rgb": [0, 0, 0]}, {"index": 0.7542644823509542, "rgb": [255, 165, 0]}, {"index": 0.7543489275460226, "rgb": [0, 0, 0]}, {"index": 0.7622065529471374, "rgb": [0, 0, 0]}, {"index": 0.7630890052356021, "rgb": [255, 165, 0]}, {"index": 0.7639714575240668, "rgb": [0, 0, 0]}, {"index": 0.7726650903563588, "rgb": [0, 0, 0]}, {"index": 0.7737290998142206, "rgb": [255, 165, 0]}, {"index": 0.7747931092720823, "rgb": [0, 0, 0]}, {"index": 0.7817471710859653, "rgb": [0, 0, 0]}, {"index": 0.7826380678939369, "rgb": [255, 165, 0]}, {"index": 0.7835289647019085, "rgb": [0, 0, 0]}, {"index": 0.7849560884985645, "rgb": [0, 0, 0]}, {"index": 0.7852136463435231, "rgb": [255, 165, 0]}, {"index": 0.7854712041884817, "rgb": [0, 0, 0]}, {"index": 0.7856316500591117, "rgb": [0, 0, 0]}, {"index": 0.7856780949163993, "rgb": [255, 165, 0]}, {"index": 0.7857245397736868, "rgb": [0, 0, 0]}, {"index": 0.7869321060631651, "rgb": [0, 0, 0]}, {"index": 0.7870714406350279, "rgb": [255, 165, 0]}, {"index": 0.7872107752068906, "rgb": [0, 0, 0]}, {"index": 0.7918214828576254, "rgb": [0, 0, 0]}, {"index": 0.7923492653268029, "rgb": [255, 165, 0]}, {"index": 0.7928770477959804, "rgb": [0, 0, 0]}, {"index": 0.7930712717446378, "rgb": [0, 0, 0]}, {"index": 0.7931514946799527, "rgb": [255, 165, 0]}, {"index": 0.7932317176152677, "rgb": [0, 0, 0]}, {"index": 0.7934934977199797, "rgb": [0, 0, 0]}, {"index": 0.7935314980577605, "rgb": [255, 165, 0]}, {"index": 0.7935694983955413, "rgb": [0, 0, 0]}, {"index": 0.7957355176490458, "rgb": [0, 0, 0]}, {"index": 0.7959804087147442, "rgb": [255, 165, 0]}, {"index": 0.7962252997804425, "rgb": [0, 0, 0]}, {"index": 0.796360412092552, "rgb": [0, 0, 0]}, {"index": 0.7964026346900861, "rgb": [255, 165, 0]}, {"index": 0.7964448572876202, "rgb": [0, 0, 0]}, {"index": 0.7979226482013173, "rgb": [0, 0, 0]}, {"index": 0.7980915385914541, "rgb": [255, 165, 0]}, {"index": 0.7982604289815909, "rgb": [0, 0, 0]}, {"index": 0.8017015706806283, "rgb": [0, 0, 0]}, {"index": 0.8021026853572032, "rgb": [255, 165, 0]}, {"index": 0.8025038000337781, "rgb": [0, 0, 0]}, {"index": 0.8030906941395035, "rgb": [0, 0, 0]}, {"index": 0.8032004728930924, "rgb": [255, 165, 0]}, {"index": 0.8033102516466812, "rgb": [0, 0, 0]}, {"index": 0.8041884816753926, "rgb": [0, 0, 0]}, {"index": 0.8042982604289816, "rgb": [255, 165, 0]}, {"index": 0.8044080391825705, "rgb": [0, 0, 0]}, {"index": 0.805438270562405, "rgb": [0, 0, 0]}, {"index": 0.8055649383550076, "rgb": [255, 165, 0]}, {"index": 0.8056916061476103, "rgb": [0, 0, 0]}, {"index": 0.8059449417328154, "rgb": [0, 0, 0]}, {"index": 0.8059871643303496, "rgb": [255, 165, 0]}, {"index": 0.8060293869278837, "rgb": [0, 0, 0]}, {"index": 0.80697517311265, "rgb": [0, 0, 0]}, {"index": 0.8070849518662389, "rgb": [255, 165, 0]}, {"index": 0.8071947306198277, "rgb": [0, 0, 0]}, {"index": 0.8079969599729776, "rgb": [0, 0, 0]}, {"index": 0.8080982942070596, "rgb": [255, 165, 0]}, {"index": 0.8081996284411416, "rgb": [0, 0, 0]}, {"index": 0.8112523222428645, "rgb": [0, 0, 0]}, {"index": 0.8116027698023982, "rgb": [255, 165, 0]}, {"index": 0.8119532173619319, "rgb": [0, 0, 0]}, {"index": 0.8147947981759839, "rgb": [0, 0, 0]}, {"index": 0.8151494679952711, "rgb": [255, 165, 0]}, {"index": 0.8155041378145583, "rgb": [0, 0, 0]}, {"index": 0.81655548049316, "rgb": [0, 0, 0]}, {"index": 0.8167117041040365, "rgb": [255, 165, 0]}, {"index": 0.816867927714913, "rgb": [0, 0, 0]}, {"index": 0.8173577098463097, "rgb": [0, 0, 0]}, {"index": 0.8174294882621179, "rgb": [255, 165, 0]}, {"index": 0.8175012666779261, "rgb": [0, 0, 0]}, {"index": 0.8200895119067725, "rgb": [0, 0, 0]}, {"index": 0.8203850700895119, "rgb": [255, 165, 0]}, {"index": 0.8206806282722513, "rgb": [0, 0, 0]}, {"index": 0.8206130721161966, "rgb": [0, 0, 0]}, {"index": 0.8206384056747171, "rgb": [255, 165, 0]}, {"index": 0.8206637392332377, "rgb": [0, 0, 0]}, {"index": 0.8209044080391826, "rgb": [0, 0, 0]}, {"index": 0.8209339638574565, "rgb": [255, 165, 0]}, {"index": 0.8209635196757304, "rgb": [0, 0, 0]}, {"index": 0.8221499746664416, "rgb": [0, 0, 0]}, {"index": 0.822285086978551, "rgb": [255, 165, 0]}, {"index": 0.8224201992906603, "rgb": [0, 0, 0]}, {"index": 0.8248691099476441, "rgb": [0, 0, 0]}, {"index": 0.8251562236108766, "rgb": [255, 165, 0]}, {"index": 0.8254433372741091, "rgb": [0, 0, 0]}, {"index": 0.8270182401621348, "rgb": [0, 0, 0]}, {"index": 0.8272251308900523, "rgb": [255, 165, 0]}, {"index": 0.8274320216179699, "rgb": [0, 0, 0]}, {"index": 0.8273391319033947, "rgb": [0, 0, 0]}, {"index": 0.827351798682655, "rgb": [255, 165, 0]}, {"index": 0.8273644654619152, "rgb": [0, 0, 0]}, {"index": 0.8273897990204357, "rgb": [0, 0, 0]}, {"index": 0.8273940212801891, "rgb": [255, 165, 0]}, {"index": 0.8273982435399425, "rgb": [0, 0, 0]}, {"index": 0.8292940381692282, "rgb": [0, 0, 0]}, {"index": 0.8295051511568992, "rgb": [255, 165, 0]}, {"index": 0.8297162641445701, "rgb": [0, 0, 0]}, {"index": 0.8318231717615269, "rgb": [0, 0, 0]}, {"index": 0.8320807296064854, "rgb": [255, 165, 0]}, {"index": 0.8323382874514439, "rgb": [0, 0, 0]}, {"index": 0.8337907448066206, "rgb": [0, 0, 0]}, {"index": 0.8339807464955244, "rgb": [255, 165, 0]}, {"index": 0.8341707481844283, "rgb": [0, 0, 0]}, {"index": 0.8367167708157406, "rgb": [0, 0, 0]}, {"index": 0.8370207735179869, "rgb": [255, 165, 0]}, {"index": 0.8373247762202332, "rgb": [0, 0, 0]}, {"index": 0.8373247762202332, "rgb": [0, 0, 0]}, {"index": 0.8373585542982604, "rgb": [255, 165, 0]}, {"index": 0.8373923323762877, "rgb": [0, 0, 0]}, {"index": 0.8387645667961493, "rgb": [0, 0, 0]}, {"index": 0.8389207904070258, "rgb": [255, 165, 0]}, {"index": 0.8390770140179024, "rgb": [0, 0, 0]}, {"index": 0.8405168045938187, "rgb": [0, 0, 0]}, {"index": 0.8406941395034623, "rgb": [255, 165, 0]}, {"index": 0.8408714744131058, "rgb": [0, 0, 0]}, {"index": 0.8413401452457354, "rgb": [0, 0, 0]}, {"index": 0.8414119236615436, "rgb": [255, 165, 0]}, {"index": 0.8414837020773518, "rgb": [0, 0, 0]}, {"index": 0.8437679446039521, "rgb": [0, 0, 0]}, {"index": 0.8440297247086641, "rgb": [255, 165, 0]}, {"index": 0.8442915048133761, "rgb": [0, 0, 0]}, {"index": 0.8498817767269042, "rgb": [0, 0, 0]}, {"index": 0.850532004728931, "rgb": [255, 165, 0]}, {"index": 0.8511822327309577, "rgb": [0, 0, 0]}, {"index": 0.8508360074311773, "rgb": [0, 0, 0]}, {"index": 0.8508697855092046, "rgb": [255, 165, 0]}, {"index": 0.8509035635872318, "rgb": [0, 0, 0]}, {"index": 0.8509837865225469, "rgb": [0, 0, 0]}, {"index": 0.8509964533018072, "rgb": [255, 165, 0]}, {"index": 0.8510091200810674, "rgb": [0, 0, 0]}, {"index": 0.8602305353825368, "rgb": [0, 0, 0]}, {"index": 0.8612565445026178, "rgb": [255, 165, 0]}, {"index": 0.8622825536226988, "rgb": [0, 0, 0]}, {"index": 0.8635745651072454, "rgb": [0, 0, 0]}, {"index": 0.863832122952204, "rgb": [255, 165, 0]}, {"index": 0.8640896807971626, "rgb": [0, 0, 0]}, {"index": 0.8679361594325283, "rgb": [0, 0, 0]}, {"index": 0.8683921634858977, "rgb": [255, 165, 0]}, {"index": 0.868848167539267, "rgb": [0, 0, 0]}, {"index": 0.86850616449924, "rgb": [0, 0, 0]}, {"index": 0.8685188312785003, "rgb": [255, 165, 0]}, {"index": 0.8685314980577605, "rgb": [0, 0, 0]}, {"index": 0.8695448403985813, "rgb": [0, 0, 0]}, {"index": 0.8696588414119236, "rgb": [255, 165, 0]}, {"index": 0.869772842425266, "rgb": [0, 0, 0]}, {"index": 0.8706468501942239, "rgb": [0, 0, 0]}, {"index": 0.8707566289478129, "rgb": [255, 165, 0]}, {"index": 0.8708664077014019, "rgb": [0, 0, 0]}, {"index": 0.8717826380678939, "rgb": [0, 0, 0]}, {"index": 0.8718966390812363, "rgb": [255, 165, 0]}, {"index": 0.8720106400945786, "rgb": [0, 0, 0]}, {"index": 0.8756966728593144, "rgb": [0, 0, 0]}, {"index": 0.8761188988346563, "rgb": [255, 165, 0]}, {"index": 0.8765411248099982, "rgb": [0, 0, 0]}, {"index": 0.8793109272082418, "rgb": [0, 0, 0]}, {"index": 0.8796655970275291, "rgb": [255, 165, 0]}, {"index": 0.8800202668468164, "rgb": [0, 0, 0]}, {"index": 0.8814516129032258, "rgb": [0, 0, 0]}, {"index": 0.8816500591116365, "rgb": [255, 165, 0]}, {"index": 0.8818485053200472, "rgb": [0, 0, 0]}, {"index": 0.8870461070765074, "rgb": [0, 0, 0]}, {"index": 0.887645667961493, "rgb": [255, 165, 0]}, {"index": 0.8882452288464786, "rgb": [0, 0, 0]}, {"index": 0.8889376794460395, "rgb": [0, 0, 0]}, {"index": 0.8890812362776558, "rgb": [255, 165, 0]}, {"index": 0.889224793109272, "rgb": [0, 0, 0]}, {"index": 0.8892712379665597, "rgb": [0, 0, 0]}, {"index": 0.8892923492653269, "rgb": [255, 165, 0]}, {"index": 0.889313460564094, "rgb": [0, 0, 0]}, {"index": 0.8914583685188313, "rgb": [0, 0, 0]}, {"index": 0.8916990373247762, "rgb": [255, 165, 0]}, {"index": 0.891939706130721, "rgb": [0, 0, 0]}, {"index": 0.8918890390136802, "rgb": [0, 0, 0]}, {"index": 0.8919101503124472, "rgb": [255, 165, 0]}, {"index": 0.8919312616112143, "rgb": [0, 0, 0]}, {"index": 0.8919861509880087, "rgb": [0, 0, 0]}, {"index": 0.8919945955075156, "rgb": [255, 165, 0]}, {"index": 0.8920030400270225, "rgb": [0, 0, 0]}, {"index": 0.8928686032764737, "rgb": [0, 0, 0]}, {"index": 0.8929657152508023, "rgb": [255, 165, 0]}, {"index": 0.8930628272251309, "rgb": [0, 0, 0]}, {"index": 0.8948277318020604, "rgb": [0, 0, 0]}, {"index": 0.895034622529978, "rgb": [255, 165, 0]}, {"index": 0.8952415132578956, "rgb": [0, 0, 0]}, {"index": 0.8987586556324946, "rgb": [0, 0, 0]}, {"index": 0.8991724370883297, "rgb": [255, 165, 0]}, {"index": 0.8995862185441649, "rgb": [0, 0, 0]}, {"index": 0.9002364465461916, "rgb": [0, 0, 0]}, {"index": 0.9003546698192872, "rgb": [255, 165, 0]}, {"index": 0.9004728930923829, "rgb": [0, 0, 0]}, {"index": 0.9032046951528458, "rgb": [0, 0, 0]}, {"index": 0.9035213646343523, "rgb": [255, 165, 0]}, {"index": 0.9038380341158587, "rgb": [0, 0, 0]}, {"index": 0.9056493835500761, "rgb": [0, 0, 0]}, {"index": 0.9058858300962676, "rgb": [255, 165, 0]}, {"index": 0.906122276642459, "rgb": [0, 0, 0]}, {"index": 0.9093818611720993, "rgb": [0, 0, 0]}, {"index": 0.9097703090694139, "rgb": [255, 165, 0]}, {"index": 0.9101587569667285, "rgb": [0, 0, 0]}, {"index": 0.9101503124472218, "rgb": [0, 0, 0]}, {"index": 0.910192535044756, "rgb": [255, 165, 0]}, {"index": 0.9102347576422901, "rgb": [0, 0, 0]}, {"index": 0.9114845465293026, "rgb": [0, 0, 0]}, {"index": 0.9116281033609188, "rgb": [255, 165, 0]}, {"index": 0.9117716601925351, "rgb": [0, 0, 0]}, {"index": 0.9128441141699037, "rgb": [0, 0, 0]}, {"index": 0.9129792264820131, "rgb": [255, 165, 0]}, {"index": 0.9131143387941225, "rgb": [0, 0, 0]}, {"index": 0.9135872318865057, "rgb": [0, 0, 0]}, {"index": 0.9136547880425604, "rgb": [255, 165, 0]}, {"index": 0.9137223441986151, "rgb": [0, 0, 0]}, {"index": 0.9141487924337105, "rgb": [0, 0, 0]}, {"index": 0.9142036818105049, "rgb": [255, 165, 0]}, {"index": 0.9142585711872994, "rgb": [0, 0, 0]}, {"index": 0.9153056916061476, "rgb": [0, 0, 0]}, {"index": 0.9154281371389968, "rgb": [255, 165, 0]}, {"index": 0.9155505826718461, "rgb": [0, 0, 0]}, {"index": 0.9170621516635703, "rgb": [0, 0, 0]}, {"index": 0.9172437088329674, "rgb": [255, 165, 0]}, {"index": 0.9174252660023644, "rgb": [0, 0, 0]}, {"index": 0.9220317513933457, "rgb": [0, 0, 0]}, {"index": 0.9225637561222766, "rgb": [255, 165, 0]}, {"index": 0.9230957608512075, "rgb": [0, 0, 0]}, {"index": 0.9234757642290153, "rgb": [0, 0, 0]}, {"index": 0.9235770984630974, "rgb": [255, 165, 0]}, {"index": 0.9236784326971795, "rgb": [0, 0, 0]}, {"index": 0.9255911163654789, "rgb": [0, 0, 0]}, {"index": 0.9258148961324101, "rgb": [255, 165, 0]}, {"index": 0.9260386758993413, "rgb": [0, 0, 0]}, {"index": 0.931704948488431, "rgb": [0, 0, 0]}, {"index": 0.9323593987502111, "rgb": [255, 165, 0]}, {"index": 0.9330138490119912, "rgb": [0, 0, 0]}, {"index": 0.9342594156392502, "rgb": [0, 0, 0]}, {"index": 0.9344705286269211, "rgb": [255, 165, 0]}, {"index": 0.9346816416145921, "rgb": [0, 0, 0]}, {"index": 0.9369025502448911, "rgb": [0, 0, 0]}, {"index": 0.93717277486911, "rgb": [255, 165, 0]}, {"index": 0.9374429994933289, "rgb": [0, 0, 0]}, {"index": 0.944088836345212, "rgb": [0, 0, 0]}, {"index": 0.9448572876203344, "rgb": [255, 165, 0]}, {"index": 0.9456257388954568, "rgb": [0, 0, 0]}, {"index": 0.9483153183583853, "rgb": [0, 0, 0]}, {"index": 0.9486995439959466, "rgb": [255, 165, 0]}, {"index": 0.9490837696335078, "rgb": [0, 0, 0]}, {"index": 0.9551216010808985, "rgb": [0, 0, 0]}, {"index": 0.9558351629792264, "rgb": [255, 165, 0]}, {"index": 0.9565487248775544, "rgb": [0, 0, 0]}, {"index": 0.9591791927039351, "rgb": [0, 0, 0]}, {"index": 0.9595507515622361, "rgb": [255, 165, 0]}, {"index": 0.9599223104205371, "rgb": [0, 0, 0]}, {"index": 0.9614127681134943, "rgb": [0, 0, 0]}, {"index": 0.9616196588414119, "rgb": [255, 165, 0]}, {"index": 0.9618265495693294, "rgb": [0, 0, 0]}, {"index": 0.9623416652592468, "rgb": [0, 0, 0]}, {"index": 0.9624218881945618, "rgb": [255, 165, 0]}, {"index": 0.9625021111298767, "rgb": [0, 0, 0]}, {"index": 0.9643979057591623, "rgb": [0, 0, 0]}, {"index": 0.9646174632663401, "rgb": [255, 165, 0]}, {"index": 0.964837020773518, "rgb": [0, 0, 0]}, {"index": 0.9646934639419018, "rgb": [0, 0, 0]}, {"index": 0.9647019084614086, "rgb": [255, 165, 0]}, {"index": 0.9647103529809153, "rgb": [0, 0, 0]}, {"index": 0.9681219388616787, "rgb": [0, 0, 0]}, {"index": 0.9685019422394866, "rgb": [255, 165, 0]}, {"index": 0.9688819456172945, "rgb": [0, 0, 0]}, {"index": 0.9714279682486067, "rgb": [0, 0, 0]}, {"index": 0.97175308224962, "rgb": [255, 165, 0]}, {"index": 0.9720781962506333, "rgb": [0, 0, 0]}, {"index": 0.9727030906941395, "rgb": [0, 0, 0]}, {"index": 0.972808647187975, "rgb": [255, 165, 0]}, {"index": 0.9729142036818105, "rgb": [0, 0, 0]}, {"index": 0.9730746495524405, "rgb": [0, 0, 0]}, {"index": 0.9731042053707144, "rgb": [255, 165, 0]}, {"index": 0.9731337611889883, "rgb": [0, 0, 0]}, {"index": 0.9773222428643811, "rgb": [0, 0, 0]}, {"index": 0.9777909136970107, "rgb": [255, 165, 0]}, {"index": 0.9782595845296402, "rgb": [0, 0, 0]}, {"index": 0.9786269211281878, "rgb": [0, 0, 0]}, {"index": 0.978719810842763, "rgb": [255, 165, 0]}, {"index": 0.9788127005573383, "rgb": [0, 0, 0]}, {"index": 0.9809238304340483, "rgb": [0, 0, 0]}, {"index": 0.9811687214997467, "rgb": [255, 165, 0]}, {"index": 0.981413612565445, "rgb": [0, 0, 0]}, {"index": 0.9821187299442662, "rgb": [0, 0, 0]}, {"index": 0.9822242864381017, "rgb": [255, 165, 0]}, {"index": 0.9823298429319371, "rgb": [0, 0, 0]}, {"index": 0.9826422901536902, "rgb": [0, 0, 0]}, {"index": 0.9826887350109779, "rgb": [255, 165, 0]}, {"index": 0.9827351798682655, "rgb": [0, 0, 0]}, {"index": 0.9837527444688398, "rgb": [0, 0, 0]}, {"index": 0.9838709677419355, "rgb": [255, 165, 0]}, {"index": 0.9839891910150312, "rgb": [0, 0, 0]}, {"index": 0.9849729775375782, "rgb": [0, 0, 0]}, {"index": 0.9850954230704273, "rgb": [255, 165, 0]}, {"index": 0.9852178686032764, "rgb": [0, 0, 0]}, {"index": 0.985817429488262, "rgb": [0, 0, 0]}, {"index": 0.9858976524235771, "rgb": [255, 165, 0]}, {"index": 0.9859778753588921, "rgb": [0, 0, 0]}, {"index": 0.9864676574902889, "rgb": [0, 0, 0]}, {"index": 0.9865309913865901, "rgb": [255, 165, 0]}, {"index": 0.9865943252828913, "rgb": [0, 0, 0]}, {"index": 0.9916610369869955, "rgb": [0, 0, 0]}, {"index": 0.9922310420537072, "rgb": [255, 165, 0]}, {"index": 0.9928010471204188, "rgb": [0, 0, 0]}, {"index": 0.9934470528626922, "rgb": [0, 0, 0]}, {"index": 0.9935821651748016, "rgb": [255, 165, 0]}, {"index": 0.993717277486911, "rgb": [0, 0, 0]}, {"index": 0.9950261780104712, "rgb": [0, 0, 0]}, {"index": 0.9951866238811011, "rgb": [255, 165, 0]}, {"index": 0.995347069751731, "rgb": [0, 0, 0]}, {"index": 0.9962886336767438, "rgb": [0, 0, 0]}, {"index": 0.9964110792095929, "rgb": [255, 165, 0]}, {"index": 0.9965335247424421, "rgb": [0, 0, 0]}, {"index": 1, "rgb": [0, 0, 0]}],
	
	"joy": [{"index": 0, "rgb": [0, 0, 0]}, {"index": 0.010032089174125992, "rgb": [0, 0, 0]}, {"index": 0.01114676574902888, "rgb": [255, 255, 0]}, {"index": 0.012261442323931768, "rgb": [0, 0, 0]}, {"index": 0.011564769464617463, "rgb": [0, 0, 0]}, {"index": 0.011611214321905084, "rgb": [255, 255, 0]}, {"index": 0.011657659179192705, "rgb": [0, 0, 0]}, {"index": 0.012067218375274446, "rgb": [0, 0, 0]}, {"index": 0.012117885492315487, "rgb": [255, 255, 0]}, {"index": 0.012168552609356528, "rgb": [0, 0, 0]}, {"index": 0.012193886167877048, "rgb": [0, 0, 0]}, {"index": 0.012202330687383888, "rgb": [255, 255, 0]}, {"index": 0.012210775206890729, "rgb": [0, 0, 0]}, {"index": 0.013646343523053538, "rgb": [0, 0, 0]}, {"index": 0.013806789393683499, "rgb": [255, 255, 0]}, {"index": 0.01396723526431346, "rgb": [0, 0, 0]}, {"index": 0.015858807633845635, "rgb": [0, 0, 0]}, {"index": 0.016086809660530315, "rgb": [255, 255, 0]}, {"index": 0.016314811687214995, "rgb": [0, 0, 0]}, {"index": 0.017302820469515284, "rgb": [0, 0, 0]}, {"index": 0.017437932781624726, "rgb": [255, 255, 0]}, {"index": 0.01757304509373417, "rgb": [0, 0, 0]}, {"index": 0.01812193886167877, "rgb": [0, 0, 0]}, {"index": 0.018197939537240332, "rgb": [255, 255, 0]}, {"index": 0.018273940212801893, "rgb": [0, 0, 0]}, {"index": 0.018653943590609696, "rgb": [0, 0, 0]}, {"index": 0.018704610707650733, "rgb": [255, 255, 0]}, {"index": 0.01875527782469177, "rgb": [0, 0, 0]}, {"index": 0.019578618476608682, "rgb": [0, 0, 0]}, {"index": 0.019675730450937342, "rgb": [255, 255, 0]}, {"index": 0.019772842425266002, "rgb": [0, 0, 0]}, {"index": 0.021575747339976355, "rgb": [0, 0, 0]}, {"index": 0.021786860327647355, "rgb": [255, 255, 0]}, {"index": 0.021997973315318355, "rgb": [0, 0, 0]}, {"index": 0.0220908630298936, "rgb": [0, 0, 0]}, {"index": 0.02212464110792096, "rgb": [255, 255, 0]}, {"index": 0.02215841918594832, "rgb": [0, 0, 0]}, {"index": 0.024670663739233236, "rgb": [0, 0, 0]}, {"index": 0.02495355514271238, "rgb": [255, 255, 0]}, {"index": 0.025236446546191522, "rgb": [0, 0, 0]}, {"index": 0.026473568653943593, "rgb": [0, 0, 0]}, {"index": 0.026642459044080392, "rgb": [255, 255, 0]}, {"index": 0.02681134943421719, "rgb": [0, 0, 0]}, {"index": 0.02725046444857288, "rgb": [0, 0, 0]}, {"index": 0.027318020604627596, "rgb": [255, 255, 0]}, {"index": 0.027385576760682314, "rgb": [0, 0, 0]}, {"index": 0.027356020942408375, "rgb": [0, 0, 0]}, {"index": 0.027360243202161797, "rgb": [255, 255, 0]}, {"index": 0.02736446546191522, "rgb": [0, 0, 0]}, {"index": 0.0275502448910657, "rgb": [0, 0, 0]}, {"index": 0.027571356189832797, "rgb": [255, 255, 0]}, {"index": 0.027592467488599896, "rgb": [0, 0, 0]}, {"index": 0.02798935990542138, "rgb": [0, 0, 0]}, {"index": 0.028035804762709, "rgb": [255, 255, 0]}, {"index": 0.028082249619996624, "rgb": [0, 0, 0]}, {"index": 0.02856780949163993, "rgb": [0, 0, 0]}, {"index": 0.028626921128187807, "rgb": [255, 255, 0]}, {"index": 0.028686032764735685, "rgb": [0, 0, 0]}, {"index": 0.029310927208241855, "rgb": [0, 0, 0]}, {"index": 0.029386927883803413, "rgb": [255, 255, 0]}, {"index": 0.02946292855936497, "rgb": [0, 0, 0]}, {"index": 0.02942492822158419, "rgb": [0, 0, 0]}, {"index": 0.029429150481337613, "rgb": [255, 255, 0]}, {"index": 0.029433372741091035, "rgb": [0, 0, 0]}, {"index": 0.029657152508022293, "rgb": [0, 0, 0]}, {"index": 0.029682486066542814, "rgb": [255, 255, 0]}, {"index": 0.029707819625063334, "rgb": [0, 0, 0]}, {"index": 0.029910488093227494, "rgb": [0, 0, 0]}, {"index": 0.029935821651748015, "rgb": [255, 255, 0]}, {"index": 0.029961155210268535, "rgb": [0, 0, 0]}, {"index": 0.030391825705117382, "rgb": [0, 0, 0]}, {"index": 0.03044249282215842, "rgb": [255, 255, 0]}, {"index": 0.030493159939199457, "rgb": [0, 0, 0]}, {"index": 0.0304804931599392, "rgb": [0, 0, 0]}, {"index": 0.03048471541969262, "rgb": [255, 255, 0]}, {"index": 0.03048893767944604, "rgb": [0, 0, 0]}, {"index": 0.03063671677081574, "rgb": [0, 0, 0]}, {"index": 0.03065360580982942, "rgb": [255, 255, 0]}, {"index": 0.0306704948488431, "rgb": [0, 0, 0]}, {"index": 0.03171761526769127, "rgb": [0, 0, 0]}, {"index": 0.03183583854078703, "rgb": [255, 255, 0]}, {"index": 0.03195406181388279, "rgb": [0, 0, 0]}, {"index": 0.03282384732308732, "rgb": [0, 0, 0]}, {"index": 0.032933626076676235, "rgb": [255, 255, 0]}, {"index": 0.033043404830265154, "rgb": [0, 0, 0]}, {"index": 0.03350363114338794, "rgb": [0, 0, 0]}, {"index": 0.03356696503968924, "rgb": [255, 255, 0]}, {"index": 0.033630298935990545, "rgb": [0, 0, 0]}, {"index": 0.03360496537747002, "rgb": [0, 0, 0]}, {"index": 0.03360918763722344, "rgb": [255, 255, 0]}, {"index": 0.03361340989697686, "rgb": [0, 0, 0]}, {"index": 0.03372318865056578, "rgb": [0, 0, 0]}, {"index": 0.033735855429826045, "rgb": [255, 255, 0]}, {"index": 0.03374852220908631, "rgb": [0, 0, 0]}, {"index": 0.034457861847660864, "rgb": [0, 0, 0]}, {"index": 0.03453808478297585, "rgb": [255, 255, 0]}, {"index": 0.03461830771829083, "rgb": [0, 0, 0]}, {"index": 0.03457608512075663, "rgb": [0, 0, 0]}, {"index": 0.03458030738051005, "rgb": [255, 255, 0]}, {"index": 0.03458452964026347, "rgb": [0, 0, 0]}, {"index": 0.03496031075831785, "rgb": [0, 0, 0]}, {"index": 0.03500253335585205, "rgb": [255, 255, 0]}, {"index": 0.035044755953386256, "rgb": [0, 0, 0]}, {"index": 0.03504053369363284, "rgb": [0, 0, 0]}, {"index": 0.035044755953386256, "rgb": [255, 255, 0]}, {"index": 0.035048978213139674, "rgb": [0, 0, 0]}, {"index": 0.03515875696672859, "rgb": [0, 0, 0]}, {"index": 0.035171423745988854, "rgb": [255, 255, 0]}, {"index": 0.035184090525249116, "rgb": [0, 0, 0]}, {"index": 0.040377470021955755, "rgb": [0, 0, 0]}, {"index": 0.040955919608174296, "rgb": [255, 255, 0]}, {"index": 0.04153436919439284, "rgb": [0, 0, 0]}, {"index": 0.04160192535044756, "rgb": [0, 0, 0]}, {"index": 0.0416737037662557, "rgb": [255, 255, 0]}, {"index": 0.04174548218206384, "rgb": [0, 0, 0]}, {"index": 0.04171170410403648, "rgb": [0, 0, 0]}, {"index": 0.0417159263637899, "rgb": [255, 255, 0]}, {"index": 0.04172014862354332, "rgb": [0, 0, 0]}, {"index": 0.041829927377132245, "rgb": [0, 0, 0]}, {"index": 0.0418425941563925, "rgb": [255, 255, 0]}, {"index": 0.041855260935652755, "rgb": [0, 0, 0]}, {"index": 0.042412599223104204, "rgb": [0, 0, 0]}, {"index": 0.04247593311940551, "rgb": [255, 255, 0]}, {"index": 0.04253926701570681, "rgb": [0, 0, 0]}, {"index": 0.04281793615943253, "rgb": [0, 0, 0]}, {"index": 0.04285593649721331, "rgb": [255, 255, 0]}, {"index": 0.04289393683499409, "rgb": [0, 0, 0]}, {"index": 0.04289393683499409, "rgb": [0, 0, 0]}, {"index": 0.04289815909474751, "rgb": [255, 255, 0]}, {"index": 0.042902381354500925, "rgb": [0, 0, 0]}, {"index": 0.04301216010808985, "rgb": [0, 0, 0]}, {"index": 0.04302482688735011, "rgb": [255, 255, 0]}, {"index": 0.043037493666610374, "rgb": [0, 0, 0]}, {"index": 0.044354838709677415, "rgb": [0, 0, 0]}, {"index": 0.04450261780104712, "rgb": [255, 255, 0]}, {"index": 0.04465039689241682, "rgb": [0, 0, 0]}, {"index": 0.05233068738388786, "rgb": [0, 0, 0]}, {"index": 0.05320047289309238, "rgb": [255, 255, 0]}, {"index": 0.05407025840229691, "rgb": [0, 0, 0]}, {"index": 0.05422648201317345, "rgb": [0, 0, 0]}, {"index": 0.05434048302651579, "rgb": [255, 255, 0]}, {"index": 0.054454484039858135, "rgb": [0, 0, 0]}, {"index": 0.05453048471541969, "rgb": [0, 0, 0]}, {"index": 0.05455159601418679, "rgb": [255, 255, 0]}, {"index": 0.05457270731295389, "rgb": [0, 0, 0]}, {"index": 0.06025164668130384, "rgb": [0, 0, 0]}, {"index": 0.06088498564431684, "rgb": [255, 255, 0]}, {"index": 0.06151832460732984, "rgb": [0, 0, 0]}, {"index": 0.06130298935990543, "rgb": [0, 0, 0]}, {"index": 0.06134943421719304, "rgb": [255, 255, 0]}, {"index": 0.06139587907448066, "rgb": [0, 0, 0]}, {"index": 0.061501435568316165, "rgb": [0, 0, 0]}, {"index": 0.061518324607329845, "rgb": [255, 255, 0]}, {"index": 0.061535213646343526, "rgb": [0, 0, 0]}, {"index": 0.06235433203850701, "rgb": [0, 0, 0]}, {"index": 0.06244722175308225, "rgb": [255, 255, 0]}, {"index": 0.06254011146765748, "rgb": [0, 0, 0]}, {"index": 0.0642712379665597, "rgb": [0, 0, 0]}, {"index": 0.06447390643472387, "rgb": [255, 255, 0]}, {"index": 0.06467657490288803, "rgb": [0, 0, 0]}, {"index": 0.06576591791927039, "rgb": [0, 0, 0]}, {"index": 0.06590947475088667, "rgb": [255, 255, 0]}, {"index": 0.06605303158250295, "rgb": [0, 0, 0]}, {"index": 0.06704948488431008, "rgb": [0, 0, 0]}, {"index": 0.06717615267691268, "rgb": [255, 255, 0]}, {"index": 0.06730282046951529, "rgb": [0, 0, 0]}, {"index": 0.06911416990373248, "rgb": [0, 0, 0]}, {"index": 0.0693295051511569, "rgb": [255, 255, 0]}, {"index": 0.06954484039858133, "rgb": [0, 0, 0]}, {"index": 0.07020351292011486, "rgb": [0, 0, 0]}, {"index": 0.07030062489444351, "rgb": [255, 255, 0]}, {"index": 0.07039773686877217, "rgb": [0, 0, 0]}, {"index": 0.07106063165005912, "rgb": [0, 0, 0]}, {"index": 0.07114507684512751, "rgb": [255, 255, 0]}, {"index": 0.0712295220401959, "rgb": [0, 0, 0]}, {"index": 0.07179108258740077, "rgb": [0, 0, 0]}, {"index": 0.07186286100320892, "rgb": [255, 255, 0]}, {"index": 0.07193463941901707, "rgb": [0, 0, 0]}, {"index": 0.07201486235433205, "rgb": [0, 0, 0]}, {"index": 0.07203175139334572, "rgb": [255, 255, 0]}, {"index": 0.0720486404323594, "rgb": [0, 0, 0]}, {"index": 0.08153183583854079, "rgb": [0, 0, 0]}, {"index": 0.08258740077689579, "rgb": [255, 255, 0]}, {"index": 0.08364296571525079, "rgb": [0, 0, 0]}, {"index": 0.08676743793278163, "rgb": [0, 0, 0]}, {"index": 0.08723188650565783, "rgb": [255, 255, 0]}, {"index": 0.08769633507853403, "rgb": [0, 0, 0]}, {"index": 0.08772589089680798, "rgb": [0, 0, 0]}, {"index": 0.08778078027360244, "rgb": [255, 255, 0]}, {"index": 0.0878356696503969, "rgb": [0, 0, 0]}, {"index": 0.08816078365141024, "rgb": [0, 0, 0]}, {"index": 0.08820300624894443, "rgb": [255, 255, 0]}, {"index": 0.08824522884647863, "rgb": [0, 0, 0]}, {"index": 0.08858300962675224, "rgb": [0, 0, 0]}, {"index": 0.08862523222428643, "rgb": [255, 255, 0]}, {"index": 0.08866745482182063, "rgb": [0, 0, 0]}, {"index": 0.08919523729099815, "rgb": [0, 0, 0]}, {"index": 0.08925857118729945, "rgb": [255, 255, 0]}, {"index": 0.08932190508360074, "rgb": [0, 0, 0]}, {"index": 0.08960057422732648, "rgb": [0, 0, 0]}, {"index": 0.08963857456510725, "rgb": [255, 255, 0]}, {"index": 0.08967657490288802, "rgb": [0, 0, 0]}, {"index": 0.09001857794291505, "rgb": [0, 0, 0]}, {"index": 0.09006080054044925, "rgb": [255, 255, 0]}, {"index": 0.09010302313798345, "rgb": [0, 0, 0]}, {"index": 0.09009880087823002, "rgb": [0, 0, 0]}, {"index": 0.09010302313798345, "rgb": [255, 255, 0]}, {"index": 0.09010724539773687, "rgb": [0, 0, 0]}, {"index": 0.09055902719135282, "rgb": [0, 0, 0]}, {"index": 0.09060969430839386, "rgb": [255, 255, 0]}, {"index": 0.09066036142543489, "rgb": [0, 0, 0]}, {"index": 0.09064769464617463, "rgb": [0, 0, 0]}, {"index": 0.09065191690592805, "rgb": [255, 255, 0]}, {"index": 0.09065613916568148, "rgb": [0, 0, 0]}, {"index": 0.09125992231042053, "rgb": [0, 0, 0]}, {"index": 0.09132747846647525, "rgb": [255, 255, 0]}, {"index": 0.09139503462252997, "rgb": [0, 0, 0]}, {"index": 0.09223948657321399, "rgb": [0, 0, 0]}, {"index": 0.09234082080729607, "rgb": [255, 255, 0]}, {"index": 0.09244215504137815, "rgb": [0, 0, 0]}, {"index": 0.0924928221584192, "rgb": [0, 0, 0]}, {"index": 0.09250971119743287, "rgb": [255, 255, 0]}, {"index": 0.09252660023644654, "rgb": [0, 0, 0]}, {"index": 0.09269971288633677, "rgb": [0, 0, 0]}, {"index": 0.09272082418510387, "rgb": [255, 255, 0]}, {"index": 0.09274193548387097, "rgb": [0, 0, 0]}, {"index": 0.09408883634521195, "rgb": [0, 0, 0]}, {"index": 0.09424083769633508, "rgb": [255, 255, 0]}, {"index": 0.09439283904745821, "rgb": [0, 0, 0]}, {"index": 0.09701486235433204, "rgb": [0, 0, 0]}, {"index": 0.0973230873163317, "rgb": [255, 255, 0]}, {"index": 0.09763131227833136, "rgb": [0, 0, 0]}, {"index": 0.09743708832967404, "rgb": [0, 0, 0]}, {"index": 0.0974497551089343, "rgb": [255, 255, 0]}, {"index": 0.09746242188819457, "rgb": [0, 0, 0]}, {"index": 0.10003377807802737, "rgb": [0, 0, 0]}, {"index": 0.10032089174125992, "rgb": [255, 255, 0]}, {"index": 0.10060800540449248, "rgb": [0, 0, 0]}, {"index": 0.10104289815909476, "rgb": [0, 0, 0]}, {"index": 0.10112312109440973, "rgb": [255, 255, 0]}, {"index": 0.1012033440297247, "rgb": [0, 0, 0]}, {"index": 0.10199712886336768, "rgb": [0, 0, 0]}, {"index": 0.10209424083769633, "rgb": [255, 255, 0]}, {"index": 0.10219135281202499, "rgb": [0, 0, 0]}, {"index": 0.10593227495355516, "rgb": [0, 0, 0]}, {"index": 0.10635872318865057, "rgb": [255, 255, 0]}, {"index": 0.10678517142374598, "rgb": [0, 0, 0]}, {"index": 0.10700472893092383, "rgb": [0, 0, 0]}, {"index": 0.10707650734673198, "rgb": [255, 255, 0]}, {"index": 0.10714828576254012, "rgb": [0, 0, 0]}, {"index": 0.10783651410234758, "rgb": [0, 0, 0]}, {"index": 0.10792095929741598, "rgb": [255, 255, 0]}, {"index": 0.10800540449248437, "rgb": [0, 0, 0]}, {"index": 0.10822496199966222, "rgb": [0, 0, 0]}, {"index": 0.10825874007768958, "rgb": [255, 255, 0]}, {"index": 0.10829251815571694, "rgb": [0, 0, 0]}, {"index": 0.11639081236277657, "rgb": [0, 0, 0]}, {"index": 0.11729437595000844, "rgb": [255, 255, 0]}, {"index": 0.11819793953724031, "rgb": [0, 0, 0]}, {"index": 0.12056240499915556, "rgb": [0, 0, 0]}, {"index": 0.12092551933794968, "rgb": [255, 255, 0]}, {"index": 0.12128863367674379, "rgb": [0, 0, 0]}, {"index": 0.12575156223610878, "rgb": [0, 0, 0]}, {"index": 0.1262877892247931, "rgb": [255, 255, 0]}, {"index": 0.12682401621347744, "rgb": [0, 0, 0]}, {"index": 0.1267437932781625, "rgb": [0, 0, 0]}, {"index": 0.1267944603952035, "rgb": [255, 255, 0]}, {"index": 0.12684512751224453, "rgb": [0, 0, 0]}, {"index": 0.12690846140854586, "rgb": [0, 0, 0]}, {"index": 0.12692112818780613, "rgb": [255, 255, 0]}, {"index": 0.1269337949670664, "rgb": [0, 0, 0]}, {"index": 0.12714913021449079, "rgb": [0, 0, 0]}, {"index": 0.1271744637730113, "rgb": [255, 255, 0]}, {"index": 0.12719979733153183, "rgb": [0, 0, 0]}, {"index": 0.12744046613747678, "rgb": [0, 0, 0]}, {"index": 0.12747002195575072, "rgb": [255, 255, 0]}, {"index": 0.12749957777402465, "rgb": [0, 0, 0]}, {"index": 0.1284960310758318, "rgb": [0, 0, 0]}, {"index": 0.12861003208917413, "rgb": [255, 255, 0]}, {"index": 0.12872403310251646, "rgb": [0, 0, 0]}, {"index": 0.12895203512920114, "rgb": [0, 0, 0]}, {"index": 0.12899003546698193, "rgb": [255, 255, 0]}, {"index": 0.12902803580476271, "rgb": [0, 0, 0]}, {"index": 0.12952204019591285, "rgb": [0, 0, 0]}, {"index": 0.12958115183246074, "rgb": [255, 255, 0]}, {"index": 0.12964026346900864, "rgb": [0, 0, 0]}, {"index": 0.12969515284580307, "rgb": [0, 0, 0]}, {"index": 0.12970781962506334, "rgb": [255, 255, 0]}, {"index": 0.1297204864043236, "rgb": [0, 0, 0]}, {"index": 0.12982182063840567, "rgb": [0, 0, 0]}, {"index": 0.12983448741766593, "rgb": [255, 255, 0]}, {"index": 0.1298471541969262, "rgb": [0, 0, 0]}, {"index": 0.1303284918088161, "rgb": [0, 0, 0]}, {"index": 0.13038338118561055, "rgb": [255, 255, 0]}, {"index": 0.130438270562405, "rgb": [0, 0, 0]}, {"index": 0.13110538760344537, "rgb": [0, 0, 0]}, {"index": 0.13118561053876035, "rgb": [255, 255, 0]}, {"index": 0.13126583347407533, "rgb": [0, 0, 0]}, {"index": 0.13156561391656815, "rgb": [0, 0, 0]}, {"index": 0.13160783651410235, "rgb": [255, 255, 0]}, {"index": 0.13165005911163655, "rgb": [0, 0, 0]}, {"index": 0.13236784326971796, "rgb": [0, 0, 0]}, {"index": 0.13245228846478635, "rgb": [255, 255, 0]}, {"index": 0.13253673365985474, "rgb": [0, 0, 0]}, {"index": 0.13382030062489444, "rgb": [0, 0, 0]}, {"index": 0.13397230197601756, "rgb": [255, 255, 0]}, {"index": 0.13412430332714068, "rgb": [0, 0, 0]}, {"index": 0.13439030569160615, "rgb": [0, 0, 0]}, {"index": 0.13443675054889376, "rgb": [255, 255, 0]}, {"index": 0.13448319540618137, "rgb": [0, 0, 0]}, {"index": 0.13569076169565952, "rgb": [0, 0, 0]}, {"index": 0.13583009626752238, "rgb": [255, 255, 0]}, {"index": 0.13596943083938523, "rgb": [0, 0, 0]}, {"index": 0.13647610200979565, "rgb": [0, 0, 0]}, {"index": 0.13654788042560378, "rgb": [255, 255, 0]}, {"index": 0.13661965884141192, "rgb": [0, 0, 0]}, {"index": 0.13662388110116536, "rgb": [0, 0, 0]}, {"index": 0.13663232562067218, "rgb": [255, 255, 0]}, {"index": 0.136640770140179, "rgb": [0, 0, 0]}, {"index": 0.13765833474075326, "rgb": [0, 0, 0]}, {"index": 0.1377723357540956, "rgb": [255, 255, 0]}, {"index": 0.13788633676743792, "rgb": [0, 0, 0]}, {"index": 0.13841834149636886, "rgb": [0, 0, 0]}, {"index": 0.138490119912177, "rgb": [255, 255, 0]}, {"index": 0.13856189832798513, "rgb": [0, 0, 0]}, {"index": 0.13909812531666949, "rgb": [0, 0, 0]}, {"index": 0.1391656814727242, "rgb": [255, 255, 0]}, {"index": 0.13923323762877893, "rgb": [0, 0, 0]}, {"index": 0.1393936834994089, "rgb": [0, 0, 0]}, {"index": 0.13941901705792942, "rgb": [255, 255, 0]}, {"index": 0.13944435061644994, "rgb": [0, 0, 0]}, {"index": 0.1411670325958453, "rgb": [0, 0, 0]}, {"index": 0.14136125654450263, "rgb": [255, 255, 0]}, {"index": 0.14155548049315997, "rgb": [0, 0, 0]}, {"index": 0.14155125823340653, "rgb": [0, 0, 0]}, {"index": 0.14157236953217361, "rgb": [255, 255, 0]}, {"index": 0.1415934808309407, "rgb": [0, 0, 0]}, {"index": 0.14381438946123967, "rgb": [0, 0, 0]}, {"index": 0.14406350278669144, "rgb": [255, 255, 0]}, {"index": 0.14431261611214322, "rgb": [0, 0, 0]}, {"index": 0.1441775038000338, "rgb": [0, 0, 0]}, {"index": 0.14419017057929404, "rgb": [255, 255, 0]}, {"index": 0.14420283735855427, "rgb": [0, 0, 0]}, {"index": 0.14453217361932108, "rgb": [0, 0, 0]}, {"index": 0.14457017395710184, "rgb": [255, 255, 0]}, {"index": 0.1446081742948826, "rgb": [0, 0, 0]}, {"index": 0.14666019253504475, "rgb": [0, 0, 0]}, {"index": 0.14689241682148285, "rgb": [255, 255, 0]}, {"index": 0.14712464110792095, "rgb": [0, 0, 0]}, {"index": 0.1482984293193717, "rgb": [0, 0, 0]}, {"index": 0.14845465293024826, "rgb": [255, 255, 0]}, {"index": 0.14861087654112481, "rgb": [0, 0, 0]}, {"index": 0.15039267015706806, "rgb": [0, 0, 0]}, {"index": 0.15060800540449248, "rgb": [255, 255, 0]}, {"index": 0.1508233406519169, "rgb": [0, 0, 0]}, {"index": 0.15338203006248946, "rgb": [0, 0, 0]}, {"index": 0.1536902550244891, "rgb": [255, 255, 0]}, {"index": 0.15399847998648875, "rgb": [0, 0, 0]}, {"index": 0.15437426110454316, "rgb": [0, 0, 0]}, {"index": 0.1544502617801047, "rgb": [255, 255, 0]}, {"index": 0.15452626245566625, "rgb": [0, 0, 0]}, {"index": 0.15692028373585543, "rgb": [0, 0, 0]}, {"index": 0.15719473061982772, "rgb": [255, 255, 0]}, {"index": 0.15746917750380002, "rgb": [0, 0, 0]}, {"index": 0.15867674379327817, "rgb": [0, 0, 0]}, {"index": 0.15884141192366155, "rgb": [255, 255, 0]}, {"index": 0.15900608005404493, "rgb": [0, 0, 0]}, {"index": 0.15960141867927713, "rgb": [0, 0, 0]}, {"index": 0.15968586387434555, "rgb": [255, 255, 0]}, {"index": 0.15977030906941397, "rgb": [0, 0, 0]}, {"index": 0.16006586725215335, "rgb": [0, 0, 0]}, {"index": 0.16010808984968755, "rgb": [255, 255, 0]}, {"index": 0.16015031244722175, "rgb": [0, 0, 0]}, {"index": 0.16128610032089175, "rgb": [0, 0, 0]}, {"index": 0.16141699037324775, "rgb": [255, 255, 0]}, {"index": 0.16154788042560375, "rgb": [0, 0, 0]}, {"index": 0.16263300118223273, "rgb": [0, 0, 0]}, {"index": 0.16276811349434217, "rgb": [255, 255, 0]}, {"index": 0.1629032258064516, "rgb": [0, 0, 0]}, {"index": 0.1634521195743962, "rgb": [0, 0, 0]}, {"index": 0.16352812024995778, "rgb": [255, 255, 0]}, {"index": 0.16360412092551935, "rgb": [0, 0, 0]}, {"index": 0.16675814896132413, "rgb": [0, 0, 0]}, {"index": 0.16711704104036482, "rgb": [255, 255, 0]}, {"index": 0.1674759331194055, "rgb": [0, 0, 0]}, {"index": 0.16818105049822668, "rgb": [0, 0, 0]}, {"index": 0.16829927377132242, "rgb": [255, 255, 0]}, {"index": 0.16841749704441816, "rgb": [0, 0, 0]}, {"index": 0.16875527782469177, "rgb": [0, 0, 0]}, {"index": 0.16880594494173282, "rgb": [255, 255, 0]}, {"index": 0.16885661205877386, "rgb": [0, 0, 0]}, {"index": 0.17378398919101504, "rgb": [0, 0, 0]}, {"index": 0.17433710521871307, "rgb": [255, 255, 0]}, {"index": 0.1748902212464111, "rgb": [0, 0, 0]}, {"index": 0.17494511062320556, "rgb": [0, 0, 0]}, {"index": 0.17501266677926025, "rgb": [255, 255, 0]}, {"index": 0.17508022293531494, "rgb": [0, 0, 0]}, {"index": 0.1795727073129539, "rgb": [0, 0, 0]}, {"index": 0.1800793784833643, "rgb": [255, 255, 0]}, {"index": 0.1805860496537747, "rgb": [0, 0, 0]}, {"index": 0.1801173788211451, "rgb": [0, 0, 0]}, {"index": 0.1801216010808985, "rgb": [255, 255, 0]}, {"index": 0.1801258233406519, "rgb": [0, 0, 0]}, {"index": 0.18023560209424083, "rgb": [0, 0, 0]}, {"index": 0.1802482688735011, "rgb": [255, 255, 0]}, {"index": 0.18026093565276136, "rgb": [0, 0, 0]}, {"index": 0.180438270562405, "rgb": [0, 0, 0]}, {"index": 0.1804593818611721, "rgb": [255, 255, 0]}, {"index": 0.18048049315993922, "rgb": [0, 0, 0]}, {"index": 0.1806873838878568, "rgb": [0, 0, 0]}, {"index": 0.1807127174463773, "rgb": [255, 255, 0]}, {"index": 0.1807380510048978, "rgb": [0, 0, 0]}, {"index": 0.18075071778415808, "rgb": [0, 0, 0]}, {"index": 0.1807549400439115, "rgb": [255, 255, 0]}, {"index": 0.1807591623036649, "rgb": [0, 0, 0]}, {"index": 0.18113494342171932, "rgb": [0, 0, 0]}, {"index": 0.18117716601925352, "rgb": [255, 255, 0]}, {"index": 0.1812193886167877, "rgb": [0, 0, 0]}, {"index": 0.18129116703259585, "rgb": [0, 0, 0]}, {"index": 0.1813038338118561, "rgb": [255, 255, 0]}, {"index": 0.18131650059111637, "rgb": [0, 0, 0]}, {"index": 0.18141783482519844, "rgb": [0, 0, 0]}, {"index": 0.1814305016044587, "rgb": [255, 255, 0]}, {"index": 0.18144316838371896, "rgb": [0, 0, 0]}, {"index": 0.18162050329336263, "rgb": [0, 0, 0]}, {"index": 0.1816416145921297, "rgb": [255, 255, 0]}, {"index": 0.1816627258908968, "rgb": [0, 0, 0]}, {"index": 0.18460564093903054, "rgb": [0, 0, 0]}, {"index": 0.18493497719979732, "rgb": [255, 255, 0]}, {"index": 0.1852643134605641, "rgb": [0, 0, 0]}, {"index": 0.19207904070258403, "rgb": [0, 0, 0]}, {"index": 0.19287282553622698, "rgb": [255, 255, 0]}, {"index": 0.19366661036986993, "rgb": [0, 0, 0]}, {"index": 0.19344283060293868, "rgb": [0, 0, 0]}, {"index": 0.19350616449924, "rgb": [255, 255, 0]}, {"index": 0.1935694983955413, "rgb": [0, 0, 0]}, {"index": 0.1946081742948826, "rgb": [0, 0, 0]}, {"index": 0.1947306198277318, "rgb": [255, 255, 0]}, {"index": 0.19485306536058097, "rgb": [0, 0, 0]}, {"index": 0.1965166357034285, "rgb": [0, 0, 0]}, {"index": 0.19671508191183923, "rgb": [255, 255, 0]}, {"index": 0.19691352812024995, "rgb": [0, 0, 0]}, {"index": 0.20005911163654788, "rgb": [0, 0, 0]}, {"index": 0.20043067049484883, "rgb": [255, 255, 0]}, {"index": 0.20080222935314979, "rgb": [0, 0, 0]}, {"index": 0.2005446715081912, "rgb": [0, 0, 0]}, {"index": 0.20055733828745145, "rgb": [255, 255, 0]}, {"index": 0.20057000506671172, "rgb": [0, 0, 0]}, {"index": 0.20420537071440634, "rgb": [0, 0, 0]}, {"index": 0.20461070765073466, "rgb": [255, 255, 0]}, {"index": 0.205016044587063, "rgb": [0, 0, 0]}, {"index": 0.20628272251308902, "rgb": [0, 0, 0]}, {"index": 0.20646850194223948, "rgb": [255, 255, 0]}, {"index": 0.20665428137138994, "rgb": [0, 0, 0]}, {"index": 0.2130045600405337, "rgb": [0, 0, 0]}, {"index": 0.21373078871812193, "rgb": [255, 255, 0]}, {"index": 0.21445701739571016, "rgb": [0, 0, 0]}, {"index": 0.2143767944603952, "rgb": [0, 0, 0]}, {"index": 0.21444857287620334, "rgb": [255, 255, 0]}, {"index": 0.21452035129201147, "rgb": [0, 0, 0]}, {"index": 0.21794460395203513, "rgb": [0, 0, 0]}, {"index": 0.21833305184934979, "rgb": [255, 255, 0]}, {"index": 0.21872149974666444, "rgb": [0, 0, 0]}, {"index": 0.21837105218713057, "rgb": [0, 0, 0]}, {"index": 0.21837527444688398, "rgb": [255, 255, 0]}, {"index": 0.2183794967066374, "rgb": [0, 0, 0]}, {"index": 0.2189072791758149, "rgb": [0, 0, 0]}, {"index": 0.21896639081236277, "rgb": [255, 255, 0]}, {"index": 0.21902550244891064, "rgb": [0, 0, 0]}, {"index": 0.22504644485728764, "rgb": [0, 0, 0]}, {"index": 0.22572200641783483, "rgb": [255, 255, 0]}, {"index": 0.226397567978382, "rgb": [0, 0, 0]}, {"index": 0.22614001013342339, "rgb": [0, 0, 0]}, {"index": 0.22618645499071102, "rgb": [255, 255, 0]}, {"index": 0.22623289984799866, "rgb": [0, 0, 0]}, {"index": 0.2262244553284918, "rgb": [0, 0, 0]}, {"index": 0.22622867758824522, "rgb": [255, 255, 0]}, {"index": 0.22623289984799863, "rgb": [0, 0, 0]}, {"index": 0.23010471204188482, "rgb": [0, 0, 0]}, {"index": 0.23053538253673367, "rgb": [255, 255, 0]}, {"index": 0.23096605303158252, "rgb": [0, 0, 0]}, {"index": 0.23714744131058943, "rgb": [0, 0, 0]}, {"index": 0.2378821145076845, "rgb": [255, 255, 0]}, {"index": 0.2386167877047796, "rgb": [0, 0, 0]}, {"index": 0.2383001182232731, "rgb": [0, 0, 0]}, {"index": 0.2383465630805607, "rgb": [255, 255, 0]}, {"index": 0.23839300793784832, "rgb": [0, 0, 0]}, {"index": 0.24195659516973483, "rgb": [0, 0, 0]}, {"index": 0.24235770984630975, "rgb": [255, 255, 0]}, {"index": 0.24275882452288466, "rgb": [0, 0, 0]}, {"index": 0.24539773686877217, "rgb": [0, 0, 0]}, {"index": 0.24573551764904578, "rgb": [255, 255, 0]}, {"index": 0.24607329842931938, "rgb": [0, 0, 0]}, {"index": 0.2458495186623881, "rgb": [0, 0, 0]}, {"index": 0.24586218544164837, "rgb": [255, 255, 0]}, {"index": 0.24587485222090863, "rgb": [0, 0, 0]}, {"index": 0.24590018577942915, "rgb": [0, 0, 0]}, {"index": 0.24590440803918256, "rgb": [255, 255, 0]}, {"index": 0.24590863029893598, "rgb": [0, 0, 0]}, {"index": 0.24598040871474414, "rgb": [0, 0, 0]}, {"index": 0.24598885323425096, "rgb": [255, 255, 0]}, {"index": 0.24599729775375778, "rgb": [0, 0, 0]}, {"index": 0.25153690255024486, "rgb": [0, 0, 0]}, {"index": 0.2521533524742442, "rgb": [255, 255, 0]}, {"index": 0.25276980239824354, "rgb": [0, 0, 0]}, {"index": 0.2562953892923493, "rgb": [0, 0, 0]}, {"index": 0.25675561560547205, "rgb": [255, 255, 0]}, {"index": 0.2572158419185948, "rgb": [0, 0, 0]}, {"index": 0.25831362945448405, "rgb": [0, 0, 0]}, {"index": 0.2584867421043743, "rgb": [255, 255, 0]}, {"index": 0.2586598547542645, "rgb": [0, 0, 0]}, {"index": 0.2588287451444013, "rgb": [0, 0, 0]}, {"index": 0.2588667454821821, "rgb": [255, 255, 0]}, {"index": 0.25890474581996287, "rgb": [0, 0, 0]}, {"index": 0.2591327478466475, "rgb": [0, 0, 0]}, {"index": 0.2591623036649215, "rgb": [255, 255, 0]}, {"index": 0.25919185948319545, "rgb": [0, 0, 0]}, {"index": 0.2595043067049485, "rgb": [0, 0, 0]}, {"index": 0.2595423070427293, "rgb": [255, 255, 0]}, {"index": 0.2595803073805101, "rgb": [0, 0, 0]}, {"index": 0.26018831278500254, "rgb": [0, 0, 0]}, {"index": 0.2602600912008107, "rgb": [255, 255, 0]}, {"index": 0.2603318696166188, "rgb": [0, 0, 0]}, {"index": 0.2605260935652761, "rgb": [0, 0, 0]}, {"index": 0.2605556493835501, "rgb": [255, 255, 0]}, {"index": 0.26058520520182404, "rgb": [0, 0, 0]}, {"index": 0.26511568991724377, "rgb": [0, 0, 0]}, {"index": 0.26562236108765414, "rgb": [255, 255, 0]}, {"index": 0.2661290322580645, "rgb": [0, 0, 0]}, {"index": 0.26607836514102345, "rgb": [0, 0, 0]}, {"index": 0.2661290322580645, "rgb": [255, 255, 0]}, {"index": 0.26617969937510555, "rgb": [0, 0, 0]}, {"index": 0.26628103360918765, "rgb": [0, 0, 0]}, {"index": 0.2662979226482013, "rgb": [255, 255, 0]}, {"index": 0.26631481168721494, "rgb": [0, 0, 0]}, {"index": 0.2669059280526938, "rgb": [0, 0, 0]}, {"index": 0.2669734842087485, "rgb": [255, 255, 0]}, {"index": 0.2670410403648032, "rgb": [0, 0, 0]}, {"index": 0.2687214997466644, "rgb": [0, 0, 0]}, {"index": 0.26891572369532174, "rgb": [255, 255, 0]}, {"index": 0.26910994764397905, "rgb": [0, 0, 0]}, {"index": 0.26929572707312954, "rgb": [0, 0, 0]}, {"index": 0.2693379496706637, "rgb": [255, 255, 0]}, {"index": 0.2693801722681979, "rgb": [0, 0, 0]}, {"index": 0.2697939537240331, "rgb": [0, 0, 0]}, {"index": 0.26984462084107413, "rgb": [255, 255, 0]}, {"index": 0.2698952879581152, "rgb": [0, 0, 0]}, {"index": 0.27664668130383385, "rgb": [0, 0, 0]}, {"index": 0.277402465799696, "rgb": [255, 255, 0]}, {"index": 0.2781582502955582, "rgb": [0, 0, 0]}, {"index": 0.288460564093903, "rgb": [0, 0, 0]}, {"index": 0.28968924168214827, "rgb": [255, 255, 0]}, {"index": 0.2909179192703935, "rgb": [0, 0, 0]}, {"index": 0.28999324438439456, "rgb": [0, 0, 0]}, {"index": 0.2900270224624219, "rgb": [255, 255, 0]}, {"index": 0.29006080054044925, "rgb": [0, 0, 0]}, {"index": 0.2907490288802567, "rgb": [0, 0, 0]}, {"index": 0.2908292518155717, "rgb": [255, 255, 0]}, {"index": 0.29090947475088663, "rgb": [0, 0, 0]}, {"index": 0.2909432528289141, "rgb": [0, 0, 0]}, {"index": 0.2909559196081743, "rgb": [255, 255, 0]}, {"index": 0.2909685863874345, "rgb": [0, 0, 0]}, {"index": 0.2910699206215167, "rgb": [0, 0, 0]}, {"index": 0.2910825874007769, "rgb": [255, 255, 0]}, {"index": 0.2910952541800371, "rgb": [0, 0, 0]}, {"index": 0.2912725890896808, "rgb": [0, 0, 0]}, {"index": 0.2912937003884479, "rgb": [255, 255, 0]}, {"index": 0.29131481168721496, "rgb": [0, 0, 0]}, {"index": 0.29201570680628275, "rgb": [0, 0, 0]}, {"index": 0.2920959297415977, "rgb": [255, 255, 0]}, {"index": 0.29217615267691266, "rgb": [0, 0, 0]}, {"index": 0.2926659348083094, "rgb": [0, 0, 0]}, {"index": 0.2927292687046107, "rgb": [255, 255, 0]}, {"index": 0.292792602600912, "rgb": [0, 0, 0]}, {"index": 0.29561729437595, "rgb": [0, 0, 0]}, {"index": 0.29593818611720996, "rgb": [255, 255, 0]}, {"index": 0.2962590778584699, "rgb": [0, 0, 0]}, {"index": 0.29669819287282556, "rgb": [0, 0, 0]}, {"index": 0.29678263806789396, "rgb": [255, 255, 0]}, {"index": 0.29686708326296235, "rgb": [0, 0, 0]}, {"index": 0.2981886505657828, "rgb": [0, 0, 0]}, {"index": 0.29834487417665934, "rgb": [255, 255, 0]}, {"index": 0.29850109778753586, "rgb": [0, 0, 0]}, {"index": 0.2991428812700557, "rgb": [0, 0, 0]}, {"index": 0.29923154872487756, "rgb": [255, 255, 0]}, {"index": 0.2993202161796994, "rgb": [0, 0, 0]}, {"index": 0.3003335585205202, "rgb": [0, 0, 0]}, {"index": 0.30045600405336936, "rgb": [255, 255, 0]}, {"index": 0.30057844958621854, "rgb": [0, 0, 0]}, {"index": 0.30285002533355854, "rgb": [0, 0, 0]}, {"index": 0.303116027698024, "rgb": [255, 255, 0]}, {"index": 0.3033820300624894, "rgb": [0, 0, 0]}, {"index": 0.31352812024995774, "rgb": [0, 0, 0]}, {"index": 0.31468501942239485, "rgb": [255, 255, 0]}, {"index": 0.31584191859483196, "rgb": [0, 0, 0]}, {"index": 0.3155590271913528, "rgb": [0, 0, 0]}, {"index": 0.31565613916568147, "rgb": [255, 255, 0]}, {"index": 0.3157532511400101, "rgb": [0, 0, 0]}, {"index": 0.31637814558351635, "rgb": [0, 0, 0]}, {"index": 0.3164583685188313, "rgb": [255, 255, 0]}, {"index": 0.31653859145414626, "rgb": [0, 0, 0]}, {"index": 0.3183583854078703, "rgb": [0, 0, 0]}, {"index": 0.3185694983955413, "rgb": [255, 255, 0]}, {"index": 0.31878061138321223, "rgb": [0, 0, 0]}, {"index": 0.31860749873332206, "rgb": [0, 0, 0]}, {"index": 0.3186117209930755, "rgb": [255, 255, 0]}, {"index": 0.31861594325282894, "rgb": [0, 0, 0]}, {"index": 0.31906772504644487, "rgb": [0, 0, 0]}, {"index": 0.3191183921634859, "rgb": [255, 255, 0]}, {"index": 0.31916905928052697, "rgb": [0, 0, 0]}, {"index": 0.32234842087485227, "rgb": [0, 0, 0]}, {"index": 0.32270731295389293, "rgb": [255, 255, 0]}, {"index": 0.3230662050329336, "rgb": [0, 0, 0]}, {"index": 0.32377132241175477, "rgb": [0, 0, 0]}, {"index": 0.3238895456848505, "rgb": [255, 255, 0]}, {"index": 0.32400776895794625, "rgb": [0, 0, 0]}, {"index": 0.32951359567640603, "rgb": [0, 0, 0]}, {"index": 0.3301384901199122, "rgb": [255, 255, 0]}, {"index": 0.33076338456341836, "rgb": [0, 0, 0]}, {"index": 0.33511653436919436, "rgb": [0, 0, 0]}, {"index": 0.3356696503968924, "rgb": [255, 255, 0]}, {"index": 0.3362227664245904, "rgb": [0, 0, 0]}, {"index": 0.3420537071440635, "rgb": [0, 0, 0]}, {"index": 0.3427630467826381, "rgb": [255, 255, 0]}, {"index": 0.34347238642121264, "rgb": [0, 0, 0]}, {"index": 0.34473906434723867, "rgb": [0, 0, 0]}, {"index": 0.3449586218544165, "rgb": [255, 255, 0]}, {"index": 0.34517817936159434, "rgb": [0, 0, 0]}, {"index": 0.3507346731970951, "rgb": [0, 0, 0]}, {"index": 0.3513764566796149, "rgb": [255, 255, 0]}, {"index": 0.35201824016213473, "rgb": [0, 0, 0]}, {"index": 0.35156645836851885, "rgb": [0, 0, 0]}, {"index": 0.35158756966728594, "rgb": [255, 255, 0]}, {"index": 0.351608680966053, "rgb": [0, 0, 0]}, {"index": 0.35622361087654114, "rgb": [0, 0, 0]}, {"index": 0.3567387265664584, "rgb": [255, 255, 0]}, {"index": 0.35725384225637563, "rgb": [0, 0, 0]}, {"index": 0.35677672690423917, "rgb": [0, 0, 0]}, {"index": 0.35678094916399256, "rgb": [255, 255, 0]}, {"index": 0.35678517142374594, "rgb": [0, 0, 0]}, {"index": 0.35693295051511564, "rgb": [0, 0, 0]}, {"index": 0.35694983955412934, "rgb": [255, 255, 0]}, {"index": 0.35696672859314305, "rgb": [0, 0, 0]}, {"index": 0.3571398412430333, "rgb": [0, 0, 0]}, {"index": 0.35716095254180036, "rgb": [255, 255, 0]}, {"index": 0.35718206384056744, "rgb": [0, 0, 0]}, {"index": 0.3574649552440466, "rgb": [0, 0, 0]}, {"index": 0.357498733322074, "rgb": [255, 255, 0]}, {"index": 0.3575325114001014, "rgb": [0, 0, 0]}, {"index": 0.3581067387265665, "rgb": [0, 0, 0]}, {"index": 0.3581742948826212, "rgb": [255, 255, 0]}, {"index": 0.3582418510386759, "rgb": [0, 0, 0]}, {"index": 0.35840229690930586, "rgb": [0, 0, 0]}, {"index": 0.3584276304678264, "rgb": [255, 255, 0]}, {"index": 0.3584529640263469, "rgb": [0, 0, 0]}, {"index": 0.3587316331700726, "rgb": [0, 0, 0]}, {"index": 0.35876541124809996, "rgb": [255, 255, 0]}, {"index": 0.3587991893261273, "rgb": [0, 0, 0]}, {"index": 0.3589554129370039, "rgb": [0, 0, 0]}, {"index": 0.358976524235771, "rgb": [255, 255, 0]}, {"index": 0.35899763553453806, "rgb": [0, 0, 0]}, {"index": 0.3590145245735518, "rgb": [0, 0, 0]}, {"index": 0.3590187468333052, "rgb": [255, 255, 0]}, {"index": 0.3590229690930586, "rgb": [0, 0, 0]}, {"index": 0.35924674885998986, "rgb": [0, 0, 0]}, {"index": 0.3592720824185104, "rgb": [255, 255, 0]}, {"index": 0.3592974159770309, "rgb": [0, 0, 0]}, {"index": 0.3596520857963182, "rgb": [0, 0, 0]}, {"index": 0.3596943083938524, "rgb": [255, 255, 0]}, {"index": 0.35973653099138664, "rgb": [0, 0, 0]}, {"index": 0.3693463941901706, "rgb": [0, 0, 0]}, {"index": 0.3704188481675393, "rgb": [255, 255, 0]}, {"index": 0.37149130214490794, "rgb": [0, 0, 0]}, {"index": 0.37205286269211285, "rgb": [0, 0, 0]}, {"index": 0.3722344198615099, "rgb": [255, 255, 0]}, {"index": 0.37241597703090695, "rgb": [0, 0, 0]}, {"index": 0.372918425941564, "rgb": [0, 0, 0]}, {"index": 0.3729944266171255, "rgb": [255, 255, 0]}, {"index": 0.373070427292687, "rgb": [0, 0, 0]}, {"index": 0.3739064347238642, "rgb": [0, 0, 0]}, {"index": 0.3740077689579463, "rgb": [255, 255, 0]}, {"index": 0.3741091031920284, "rgb": [0, 0, 0]}, {"index": 0.3747297753757811, "rgb": [0, 0, 0]}, {"index": 0.37480999831109607, "rgb": [255, 255, 0]}, {"index": 0.374890221246411, "rgb": [0, 0, 0]}, {"index": 0.37576000675561555, "rgb": [0, 0, 0]}, {"index": 0.3758655632494511, "rgb": [255, 255, 0]}, {"index": 0.3759711197432866, "rgb": [0, 0, 0]}, {"index": 0.3797795980408715, "rgb": [0, 0, 0]}, {"index": 0.38021449079547376, "rgb": [255, 255, 0]}, {"index": 0.380649383550076, "rgb": [0, 0, 0]}, {"index": 0.3814305016044587, "rgb": [0, 0, 0]}, {"index": 0.3815656139165681, "rgb": [255, 255, 0]}, {"index": 0.38170072622867757, "rgb": [0, 0, 0]}, {"index": 0.3844916399256882, "rgb": [0, 0, 0]}, {"index": 0.38481675392670156, "rgb": [255, 255, 0]}, {"index": 0.38514186792771493, "rgb": [0, 0, 0]}, {"index": 0.38911079209592975, "rgb": [0, 0, 0]}, {"index": 0.3895879074480662, "rgb": [255, 255, 0]}, {"index": 0.39006502280020267, "rgb": [0, 0, 0]}, {"index": 0.38970190846140856, "rgb": [0, 0, 0]}, {"index": 0.3897145752406688, "rgb": [255, 255, 0]}, {"index": 0.3897272420199291, "rgb": [0, 0, 0]}, {"index": 0.3941986150988009, "rgb": [0, 0, 0]}, {"index": 0.39469684174970443, "rgb": [255, 255, 0]}, {"index": 0.395195068400608, "rgb": [0, 0, 0]}, {"index": 0.39735686539435905, "rgb": [0, 0, 0]}, {"index": 0.39765242357709846, "rgb": [255, 255, 0]}, {"index": 0.39794798175983787, "rgb": [0, 0, 0]}, {"index": 0.3993244384394528, "rgb": [0, 0, 0]}, {"index": 0.3995102178686033, "rgb": [255, 255, 0]}, {"index": 0.3996959972977538, "rgb": [0, 0, 0]}, {"index": 0.40156223610876546, "rgb": [0, 0, 0]}, {"index": 0.4017902381354501, "rgb": [255, 255, 0]}, {"index": 0.4020182401621348, "rgb": [0, 0, 0]}, {"index": 0.4039182570511738, "rgb": [0, 0, 0]}, {"index": 0.40415470359736533, "rgb": [255, 255, 0]}, {"index": 0.40439115014355687, "rgb": [0, 0, 0]}, {"index": 0.4043067049484884, "rgb": [0, 0, 0]}, {"index": 0.4043235939875021, "rgb": [255, 255, 0]}, {"index": 0.4043404830265158, "rgb": [0, 0, 0]}, {"index": 0.40455159601418683, "rgb": [0, 0, 0]}, {"index": 0.4045769295727073, "rgb": [255, 255, 0]}, {"index": 0.40460226313122777, "rgb": [0, 0, 0]}, {"index": 0.407578956257389, "rgb": [0, 0, 0]}, {"index": 0.40791251477790913, "rgb": [255, 255, 0]}, {"index": 0.40824607329842927, "rgb": [0, 0, 0]}, {"index": 0.413118561053876, "rgb": [0, 0, 0]}, {"index": 0.41369701064009456, "rgb": [255, 255, 0]}, {"index": 0.4142754602263131, "rgb": [0, 0, 0]}, {"index": 0.41419101503124467, "rgb": [0, 0, 0]}, {"index": 0.41424590440803916, "rgb": [255, 255, 0]}, {"index": 0.41430079378483364, "rgb": [0, 0, 0]}, {"index": 0.41527191352812026, "rgb": [0, 0, 0]}, {"index": 0.41538591454146256, "rgb": [255, 255, 0]}, {"index": 0.41549991555480487, "rgb": [0, 0, 0]}, {"index": 0.4186159432528289, "rgb": [0, 0, 0]}, {"index": 0.41897483533186963, "rgb": [255, 255, 0]}, {"index": 0.41933372741091035, "rgb": [0, 0, 0]}, {"index": 0.41984884310082754, "rgb": [0, 0, 0]}, {"index": 0.4199459550751562, "rgb": [255, 255, 0]}, {"index": 0.42004306704948485, "rgb": [0, 0, 0]}, {"index": 0.42036395879074484, "rgb": [0, 0, 0]}, {"index": 0.42041040364803245, "rgb": [255, 255, 0]}, {"index": 0.42045684850532006, "rgb": [0, 0, 0]}, {"index": 0.4206004053369363, "rgb": [0, 0, 0]}, {"index": 0.4206215166357034, "rgb": [255, 255, 0]}, {"index": 0.4206426279344705, "rgb": [0, 0, 0]}, {"index": 0.42179952710690766, "rgb": [0, 0, 0]}, {"index": 0.42193041715926366, "rgb": [255, 255, 0]}, {"index": 0.42206130721161966, "rgb": [0, 0, 0]}, {"index": 0.4232984293193717, "rgb": [0, 0, 0]}, {"index": 0.42345043067049487, "rgb": [255, 255, 0]}, {"index": 0.423602432021618, "rgb": [0, 0, 0]}, {"index": 0.42405843607498733, "rgb": [0, 0, 0]}, {"index": 0.424125992231042, "rgb": [255, 255, 0]}, {"index": 0.4241935483870967, "rgb": [0, 0, 0]}, {"index": 0.4277360243202162, "rgb": [0, 0, 0]}, {"index": 0.42813713899679107, "rgb": [255, 255, 0]}, {"index": 0.42853825367336595, "rgb": [0, 0, 0]}, {"index": 0.43003715588583014, "rgb": [0, 0, 0]}, {"index": 0.4302482688735011, "rgb": [255, 255, 0]}, {"index": 0.43045938186117205, "rgb": [0, 0, 0]}, {"index": 0.4306662725890897, "rgb": [0, 0, 0]}, {"index": 0.4307127174463773, "rgb": [255, 255, 0]}, {"index": 0.4307591623036649, "rgb": [0, 0, 0]}, {"index": 0.432498733322074, "rgb": [0, 0, 0]}, {"index": 0.4326971795304847, "rgb": [255, 255, 0]}, {"index": 0.4328956257388954, "rgb": [0, 0, 0]}, {"index": 0.43326718459719643, "rgb": [0, 0, 0]}, {"index": 0.43333051849349774, "rgb": [255, 255, 0]}, {"index": 0.43339385238979905, "rgb": [0, 0, 0]}, {"index": 0.4347365309913866, "rgb": [0, 0, 0]}, {"index": 0.4348927546022631, "rgb": [255, 255, 0]}, {"index": 0.43504897821313965, "rgb": [0, 0, 0]}, {"index": 0.4374387772335754, "rgb": [0, 0, 0]}, {"index": 0.43772166863705453, "rgb": [255, 255, 0]}, {"index": 0.4380045600405337, "rgb": [0, 0, 0]}, {"index": 0.43787366998817767, "rgb": [0, 0, 0]}, {"index": 0.4378905590271914, "rgb": [255, 255, 0]}, {"index": 0.4379074480662051, "rgb": [0, 0, 0]}, {"index": 0.4381565613916569, "rgb": [0, 0, 0]}, {"index": 0.4381861172099308, "rgb": [255, 255, 0]}, {"index": 0.4382156730282047, "rgb": [0, 0, 0]}, {"index": 0.4390221246411079, "rgb": [0, 0, 0]}, {"index": 0.4391150143556832, "rgb": [255, 255, 0]}, {"index": 0.43920790407025845, "rgb": [0, 0, 0]}, {"index": 0.4415470359736531, "rgb": [0, 0, 0]}, {"index": 0.44181726059787196, "rgb": [255, 255, 0]}, {"index": 0.44208748522209085, "rgb": [0, 0, 0]}, {"index": 0.4482013173450431, "rgb": [0, 0, 0]}, {"index": 0.44891065698361765, "rgb": [255, 255, 0]}, {"index": 0.4496199966221922, "rgb": [0, 0, 0]}, {"index": 0.45240668805944945, "rgb": [0, 0, 0]}, {"index": 0.45279513595676407, "rgb": [255, 255, 0]}, {"index": 0.4531835838540787, "rgb": [0, 0, 0]}, {"index": 0.4557971626414457, "rgb": [0, 0, 0]}, {"index": 0.4561307211619659, "rgb": [255, 255, 0]}, {"index": 0.4564642796824861, "rgb": [0, 0, 0]}, {"index": 0.45616872149974663, "rgb": [0, 0, 0]}, {"index": 0.45617294375950007, "rgb": [255, 255, 0]}, {"index": 0.4561771660192535, "rgb": [0, 0, 0]}, {"index": 0.458262962337443, "rgb": [0, 0, 0]}, {"index": 0.4584951866238811, "rgb": [255, 255, 0]}, {"index": 0.4587274109103192, "rgb": [0, 0, 0]}, {"index": 0.4589511906772505, "rgb": [0, 0, 0]}, {"index": 0.4590018577942915, "rgb": [255, 255, 0]}, {"index": 0.45905252491133247, "rgb": [0, 0, 0]}, {"index": 0.45976186454990714, "rgb": [0, 0, 0]}, {"index": 0.45984630974497553, "rgb": [255, 255, 0]}, {"index": 0.45993075494004393, "rgb": [0, 0, 0]}, {"index": 0.46106232055396046, "rgb": [0, 0, 0]}, {"index": 0.4611974328660699, "rgb": [255, 255, 0]}, {"index": 0.46133254517817934, "rgb": [0, 0, 0]}, {"index": 0.4613494342171931, "rgb": [0, 0, 0]}, {"index": 0.46136632325620675, "rgb": [255, 255, 0]}, {"index": 0.4613832122952204, "rgb": [0, 0, 0]}, {"index": 0.4655843607498733, "rgb": [0, 0, 0]}, {"index": 0.46605303158250294, "rgb": [255, 255, 0]}, {"index": 0.4665217024151326, "rgb": [0, 0, 0]}, {"index": 0.46624303327140687, "rgb": [0, 0, 0]}, {"index": 0.46626414457017396, "rgb": [255, 255, 0]}, {"index": 0.46628525586894104, "rgb": [0, 0, 0]}, {"index": 0.46653014693463946, "rgb": [0, 0, 0]}, {"index": 0.46655970275291336, "rgb": [255, 255, 0]}, {"index": 0.46658925857118727, "rgb": [0, 0, 0]}, {"index": 0.46682570511737886, "rgb": [0, 0, 0]}, {"index": 0.46685526093565277, "rgb": [255, 255, 0]}, {"index": 0.4668848167539267, "rgb": [0, 0, 0]}, {"index": 0.467501266677926, "rgb": [0, 0, 0]}, {"index": 0.46757304509373415, "rgb": [255, 255, 0]}, {"index": 0.4676448235095423, "rgb": [0, 0, 0]}, {"index": 0.4677250464448573, "rgb": [0, 0, 0]}, {"index": 0.46774193548387094, "rgb": [255, 255, 0]}, {"index": 0.4677588245228846, "rgb": [0, 0, 0]}, {"index": 0.4683499408883634, "rgb": [0, 0, 0]}, {"index": 0.46841749704441815, "rgb": [255, 255, 0]}, {"index": 0.4684850532004729, "rgb": [0, 0, 0]}, {"index": 0.4688735010977875, "rgb": [0, 0, 0]}, {"index": 0.4689241682148286, "rgb": [255, 255, 0]}, {"index": 0.4689748353318696, "rgb": [0, 0, 0]}, {"index": 0.47055818273940214, "rgb": [0, 0, 0]}, {"index": 0.4707397399087992, "rgb": [255, 255, 0]}, {"index": 0.47092129707819624, "rgb": [0, 0, 0]}, {"index": 0.4734757642290154, "rgb": [0, 0, 0]}, {"index": 0.4737797669312616, "rgb": [255, 255, 0]}, {"index": 0.47408376963350785, "rgb": [0, 0, 0]}, {"index": 0.4802018240162135, "rgb": [0, 0, 0]}, {"index": 0.48091538591454147, "rgb": [255, 255, 0]}, {"index": 0.48162894781286947, "rgb": [0, 0, 0]}, {"index": 0.4850574227326465, "rgb": [0, 0, 0]}, {"index": 0.4855176490457693, "rgb": [255, 255, 0]}, {"index": 0.48597787535889203, "rgb": [0, 0, 0]}, {"index": 0.4859356527613579, "rgb": [0, 0, 0]}, {"index": 0.4859820976186455, "rgb": [255, 255, 0]}, {"index": 0.48602854247593313, "rgb": [0, 0, 0]}, {"index": 0.48944012835669654, "rgb": [0, 0, 0]}, {"index": 0.4898243539942577, "rgb": [255, 255, 0]}, {"index": 0.4902085796318189, "rgb": [0, 0, 0]}, {"index": 0.5030484715419693, "rgb": [0, 0, 0]}, {"index": 0.5045178179361595, "rgb": [255, 255, 0]}, {"index": 0.5059871643303496, "rgb": [0, 0, 0]}, {"index": 0.5097238642121263, "rgb": [0, 0, 0]}, {"index": 0.5103023137983449, "rgb": [255, 255, 0]}, {"index": 0.5108807633845635, "rgb": [0, 0, 0]}, {"index": 0.5115183246073299, "rgb": [0, 0, 0]}, {"index": 0.5116534369194393, "rgb": [255, 255, 0]}, {"index": 0.5117885492315487, "rgb": [0, 0, 0]}, {"index": 0.5119574396216856, "rgb": [0, 0, 0]}, {"index": 0.5119912176997129, "rgb": [255, 255, 0]}, {"index": 0.5120249957777402, "rgb": [0, 0, 0]}, {"index": 0.5122952204019592, "rgb": [0, 0, 0]}, {"index": 0.5123289984799865, "rgb": [255, 255, 0]}, {"index": 0.5123627765580138, "rgb": [0, 0, 0]}, {"index": 0.5123669988177673, "rgb": [0, 0, 0]}, {"index": 0.5123712210775206, "rgb": [255, 255, 0]}, {"index": 0.512375443337274, "rgb": [0, 0, 0]}, {"index": 0.5134732308731633, "rgb": [0, 0, 0]}, {"index": 0.5135956764060124, "rgb": [255, 255, 0]}, {"index": 0.5137181219388616, "rgb": [0, 0, 0]}, {"index": 0.5139756797838203, "rgb": [0, 0, 0]}, {"index": 0.5140179023813545, "rgb": [255, 255, 0]}, {"index": 0.5140601249788886, "rgb": [0, 0, 0]}, {"index": 0.5143219050836007, "rgb": [0, 0, 0]}, {"index": 0.514355683161628, "rgb": [255, 255, 0]}, {"index": 0.5143894612396555, "rgb": [0, 0, 0]}, {"index": 0.5193717277486911, "rgb": [0, 0, 0]}, {"index": 0.5199290660361425, "rgb": [255, 255, 0]}, {"index": 0.5204864043235939, "rgb": [0, 0, 0]}, {"index": 0.5204610707650734, "rgb": [0, 0, 0]}, {"index": 0.5205201824016213, "rgb": [255, 255, 0]}, {"index": 0.5205792940381693, "rgb": [0, 0, 0]}, {"index": 0.5218501942239486, "rgb": [0, 0, 0]}, {"index": 0.5219979733153184, "rgb": [255, 255, 0]}, {"index": 0.5221457524066881, "rgb": [0, 0, 0]}, {"index": 0.5230239824353994, "rgb": [0, 0, 0]}, {"index": 0.5231379834487417, "rgb": [255, 255, 0]}, {"index": 0.5232519844620841, "rgb": [0, 0, 0]}, {"index": 0.5242399932443844, "rgb": [0, 0, 0]}, {"index": 0.5243624387772335, "rgb": [255, 255, 0]}, {"index": 0.5244848843100827, "rgb": [0, 0, 0]}, {"index": 0.5247804424928222, "rgb": [0, 0, 0]}, {"index": 0.5248268873501097, "rgb": [255, 255, 0]}, {"index": 0.5248733322073973, "rgb": [0, 0, 0]}, {"index": 0.5273729099814221, "rgb": [0, 0, 0]}, {"index": 0.5276558013849012, "rgb": [255, 255, 0]}, {"index": 0.5279386927883803, "rgb": [0, 0, 0]}, {"index": 0.527845803073805, "rgb": [0, 0, 0]}, {"index": 0.5278669143725722, "rgb": [255, 255, 0]}, {"index": 0.5278880256713393, "rgb": [0, 0, 0]}, {"index": 0.5288549231548725, "rgb": [0, 0, 0]}, {"index": 0.5289647019084615, "rgb": [255, 255, 0]}, {"index": 0.5290744806620504, "rgb": [0, 0, 0]}, {"index": 0.5310927208241851, "rgb": [0, 0, 0]}, {"index": 0.5313291673703766, "rgb": [255, 255, 0]}, {"index": 0.5315656139165681, "rgb": [0, 0, 0]}, {"index": 0.533001182232731, "rgb": [0, 0, 0]}, {"index": 0.5331869616618814, "rgb": [255, 255, 0]}, {"index": 0.5333727410910318, "rgb": [0, 0, 0]}, {"index": 0.5411670325958453, "rgb": [0, 0, 0]}, {"index": 0.5420537071440635, "rgb": [255, 255, 0]}, {"index": 0.5429403816922818, "rgb": [0, 0, 0]}, {"index": 0.5436117209930755, "rgb": [0, 0, 0]}, {"index": 0.5437848336429657, "rgb": [255, 255, 0]}, {"index": 0.5439579462928559, "rgb": [0, 0, 0]}, {"index": 0.54496284411417, "rgb": [0, 0, 0]}, {"index": 0.545093734166526, "rgb": [255, 255, 0]}, {"index": 0.545224624218882, "rgb": [0, 0, 0]}, {"index": 0.5474117547711536, "rgb": [0, 0, 0]}, {"index": 0.5476693126161122, "rgb": [255, 255, 0]}, {"index": 0.5479268704610708, "rgb": [0, 0, 0]}, {"index": 0.5480493159939199, "rgb": [0, 0, 0]}, {"index": 0.5480915385914541, "rgb": [255, 255, 0]}, {"index": 0.5481337611889883, "rgb": [0, 0, 0]}, {"index": 0.551587569667286, "rgb": [0, 0, 0]}, {"index": 0.5519760175646006, "rgb": [255, 255, 0]}, {"index": 0.5523644654619152, "rgb": [0, 0, 0]}, {"index": 0.553306029386928, "rgb": [0, 0, 0]}, {"index": 0.5534538084782976, "rgb": [255, 255, 0]}, {"index": 0.5536015875696673, "rgb": [0, 0, 0]}, {"index": 0.555125823340652, "rgb": [0, 0, 0]}, {"index": 0.5553116027698024, "rgb": [255, 255, 0]}, {"index": 0.5554973821989528, "rgb": [0, 0, 0]}, {"index": 0.5559576085120758, "rgb": [0, 0, 0]}, {"index": 0.5560293869278838, "rgb": [255, 255, 0]}, {"index": 0.5561011653436919, "rgb": [0, 0, 0]}, {"index": 0.5632114507684514, "rgb": [0, 0, 0]}, {"index": 0.5640094578618476, "rgb": [255, 255, 0]}, {"index": 0.5648074649552439, "rgb": [0, 0, 0]}, {"index": 0.5697095085289647, "rgb": [0, 0, 0]}, {"index": 0.5703428474919777, "rgb": [255, 255, 0]}, {"index": 0.5709761864549907, "rgb": [0, 0, 0]}, {"index": 0.5708368518831278, "rgb": [0, 0, 0]}, {"index": 0.5708917412599223, "rgb": [255, 255, 0]}, {"index": 0.5709466306367167, "rgb": [0, 0, 0]}, {"index": 0.5711957439621687, "rgb": [0, 0, 0]}, {"index": 0.571229522040196, "rgb": [255, 255, 0]}, {"index": 0.5712633001182232, "rgb": [0, 0, 0]}, {"index": 0.5779935821651748, "rgb": [0, 0, 0]}, {"index": 0.5787451444012836, "rgb": [255, 255, 0]}, {"index": 0.5794967066373923, "rgb": [0, 0, 0]}, {"index": 0.5802651579125148, "rgb": [0, 0, 0]}, {"index": 0.5804340483026516, "rgb": [255, 255, 0]}, {"index": 0.5806029386927883, "rgb": [0, 0, 0]}, {"index": 0.5814980577605134, "rgb": [0, 0, 0]}, {"index": 0.5816162810336092, "rgb": [255, 255, 0]}, {"index": 0.5817345043067049, "rgb": [0, 0, 0]}, {"index": 0.5825282891403479, "rgb": [0, 0, 0]}, {"index": 0.58262962337443, "rgb": [255, 255, 0]}, {"index": 0.5827309576085121, "rgb": [0, 0, 0]}, {"index": 0.5835416314811687, "rgb": [0, 0, 0]}, {"index": 0.5836429657152508, "rgb": [255, 255, 0]}, {"index": 0.5837442999493329, "rgb": [0, 0, 0]}, {"index": 0.5842889714575241, "rgb": [0, 0, 0]}, {"index": 0.5843607498733322, "rgb": [255, 255, 0]}, {"index": 0.5844325282891403, "rgb": [0, 0, 0]}, {"index": 0.587514777909137, "rgb": [0, 0, 0]}, {"index": 0.5878652254686708, "rgb": [255, 255, 0]}, {"index": 0.5882156730282047, "rgb": [0, 0, 0]}, {"index": 0.5882832291842595, "rgb": [0, 0, 0]}, {"index": 0.588329674041547, "rgb": [255, 255, 0]}, {"index": 0.5883761188988346, "rgb": [0, 0, 0]}, {"index": 0.5926997128863367, "rgb": [0, 0, 0]}, {"index": 0.59318527275798, "rgb": [255, 255, 0]}, {"index": 0.5936708326296234, "rgb": [0, 0, 0]}, {"index": 0.5941352812024996, "rgb": [0, 0, 0]}, {"index": 0.5942408376963351, "rgb": [255, 255, 0]}, {"index": 0.5943463941901705, "rgb": [0, 0, 0]}, {"index": 0.5970528626921129, "rgb": [0, 0, 0]}, {"index": 0.5973653099138659, "rgb": [255, 255, 0]}, {"index": 0.597677757135619, "rgb": [0, 0, 0]}, {"index": 0.5986573213984125, "rgb": [0, 0, 0]}, {"index": 0.5988008782300287, "rgb": [255, 255, 0]}, {"index": 0.5989444350616449, "rgb": [0, 0, 0]}, {"index": 0.5988768789055904, "rgb": [0, 0, 0]}, {"index": 0.5988853234250971, "rgb": [255, 255, 0]}, {"index": 0.5988937679446039, "rgb": [0, 0, 0]}, {"index": 0.5993413274784665, "rgb": [0, 0, 0]}, {"index": 0.5993919945955075, "rgb": [255, 255, 0]}, {"index": 0.5994426617125486, "rgb": [0, 0, 0]}, {"index": 0.6010640094578619, "rgb": [0, 0, 0]}, {"index": 0.6012497888870123, "rgb": [255, 255, 0]}, {"index": 0.6014355683161627, "rgb": [0, 0, 0]}, {"index": 0.6023897990204359, "rgb": [0, 0, 0]}, {"index": 0.6025164668130384, "rgb": [255, 255, 0]}, {"index": 0.6026431346056409, "rgb": [0, 0, 0]}, {"index": 0.6042644823509542, "rgb": [0, 0, 0]}, {"index": 0.6044587062996115, "rgb": [255, 255, 0]}, {"index": 0.6046529302482688, "rgb": [0, 0, 0]}, {"index": 0.6045727073129539, "rgb": [0, 0, 0]}, {"index": 0.6045853740922141, "rgb": [255, 255, 0]}, {"index": 0.6045980408714744, "rgb": [0, 0, 0]}, {"index": 0.6053453808478297, "rgb": [0, 0, 0]}, {"index": 0.6054298260428982, "rgb": [255, 255, 0]}, {"index": 0.6055142712379666, "rgb": [0, 0, 0]}, {"index": 0.6055818273940213, "rgb": [0, 0, 0]}, {"index": 0.605598716433035, "rgb": [255, 255, 0]}, {"index": 0.6056156054720486, "rgb": [0, 0, 0]}, {"index": 0.6057887181219388, "rgb": [0, 0, 0]}, {"index": 0.6058098294207059, "rgb": [255, 255, 0]}, {"index": 0.6058309407194731, "rgb": [0, 0, 0]}, {"index": 0.6074438439452795, "rgb": [0, 0, 0]}, {"index": 0.6076254011146766, "rgb": [255, 255, 0]}, {"index": 0.6078069582840736, "rgb": [0, 0, 0]}, {"index": 0.6077774024657997, "rgb": [0, 0, 0]}, {"index": 0.6077942915048133, "rgb": [255, 255, 0]}, {"index": 0.607811180543827, "rgb": [0, 0, 0]}, {"index": 0.6080222935314981, "rgb": [0, 0, 0]}, {"index": 0.6080476270900186, "rgb": [255, 255, 0]}, {"index": 0.6080729606485391, "rgb": [0, 0, 0]}, {"index": 0.6085416314811687, "rgb": [0, 0, 0]}, {"index": 0.6085965208579632, "rgb": [255, 255, 0]}, {"index": 0.6086514102347578, "rgb": [0, 0, 0]}, {"index": 0.6091285255868941, "rgb": [0, 0, 0]}, {"index": 0.6091876372234419, "rgb": [255, 255, 0]}, {"index": 0.6092467488599898, "rgb": [0, 0, 0]}, {"index": 0.6097956426279345, "rgb": [0, 0, 0]}, {"index": 0.6098631987839892, "rgb": [255, 255, 0]}, {"index": 0.6099307549400439, "rgb": [0, 0, 0]}, {"index": 0.6102812024995778, "rgb": [0, 0, 0]}, {"index": 0.6103276473568654, "rgb": [255, 255, 0]}, {"index": 0.610374092214153, "rgb": [0, 0, 0]}, {"index": 0.6129116703259585, "rgb": [0, 0, 0]}, {"index": 0.613198783989191, "rgb": [255, 255, 0]}, {"index": 0.6134858976524236, "rgb": [0, 0, 0]}, {"index": 0.6143767944603952, "rgb": [0, 0, 0]}, {"index": 0.6145076845127512, "rgb": [255, 255, 0]}, {"index": 0.6146385745651072, "rgb": [0, 0, 0]}, {"index": 0.6166357034284748, "rgb": [0, 0, 0]}, {"index": 0.6168721499746664, "rgb": [255, 255, 0]}, {"index": 0.617108596520858, "rgb": [0, 0, 0]}, {"index": 0.6179361594325283, "rgb": [0, 0, 0]}, {"index": 0.6180543827056241, "rgb": [255, 255, 0]}, {"index": 0.6181726059787198, "rgb": [0, 0, 0]}, {"index": 0.6201824016213477, "rgb": [0, 0, 0]}, {"index": 0.6204188481675392, "rgb": [255, 255, 0]}, {"index": 0.6206552947137307, "rgb": [0, 0, 0]}, {"index": 0.6236488768789056, "rgb": [0, 0, 0]}, {"index": 0.6240077689579463, "rgb": [255, 255, 0]}, {"index": 0.624366661036987, "rgb": [0, 0, 0]}, {"index": 0.626477790913697, "rgb": [0, 0, 0]}, {"index": 0.6267522377976693, "rgb": [255, 255, 0]}, {"index": 0.6270266846816416, "rgb": [0, 0, 0]}, {"index": 0.6303242695490627, "rgb": [0, 0, 0]}, {"index": 0.6307211619658841, "rgb": [255, 255, 0]}, {"index": 0.6311180543827055, "rgb": [0, 0, 0]}, {"index": 0.6327731802060462, "rgb": [0, 0, 0]}, {"index": 0.6330011822327309, "rgb": [255, 255, 0]}, {"index": 0.6332291842594157, "rgb": [0, 0, 0]}, {"index": 0.6365732139841243, "rgb": [0, 0, 0]}, {"index": 0.6369701064009458, "rgb": [255, 255, 0]}, {"index": 0.6373669988177673, "rgb": [0, 0, 0]}, {"index": 0.6380341158588076, "rgb": [0, 0, 0]}, {"index": 0.6381523391319034, "rgb": [255, 255, 0]}, {"index": 0.6382705624049991, "rgb": [0, 0, 0]}, {"index": 0.6484504306704948, "rgb": [0, 0, 0]}, {"index": 0.6495946630636716, "rgb": [255, 255, 0]}, {"index": 0.6507388954568485, "rgb": [0, 0, 0]}, {"index": 0.6556747171085966, "rgb": [0, 0, 0]}, {"index": 0.6563502786691437, "rgb": [255, 255, 0]}, {"index": 0.6570258402296909, "rgb": [0, 0, 0]}, {"index": 0.6598463097449755, "rgb": [0, 0, 0]}, {"index": 0.6602347576422901, "rgb": [255, 255, 0]}, {"index": 0.6606232055396047, "rgb": [0, 0, 0]}, {"index": 0.660766762371221, "rgb": [0, 0, 0]}, {"index": 0.6608258740077689, "rgb": [255, 255, 0]}, {"index": 0.6608849856443169, "rgb": [0, 0, 0]}, {"index": 0.6622318865056579, "rgb": [0, 0, 0]}, {"index": 0.6623881101165344, "rgb": [255, 255, 0]}, {"index": 0.662544333727411, "rgb": [0, 0, 0]}, {"index": 0.6653521364634352, "rgb": [0, 0, 0]}, {"index": 0.665681472724202, "rgb": [255, 255, 0]}, {"index": 0.6660108089849688, "rgb": [0, 0, 0]}, {"index": 0.6677334909643642, "rgb": [0, 0, 0]}, {"index": 0.6679614929910488, "rgb": [255, 255, 0]}, {"index": 0.6681894950177334, "rgb": [0, 0, 0]}, {"index": 0.6692915048133761, "rgb": [0, 0, 0]}, {"index": 0.6694392839047458, "rgb": [255, 255, 0]}, {"index": 0.6695870629961156, "rgb": [0, 0, 0]}, {"index": 0.6697812869447728, "rgb": [0, 0, 0]}, {"index": 0.6698192872825536, "rgb": [255, 255, 0]}, {"index": 0.6698572876203344, "rgb": [0, 0, 0]}, {"index": 0.6703132916737038, "rgb": [0, 0, 0]}, {"index": 0.6703681810504982, "rgb": [255, 255, 0]}, {"index": 0.6704230704272927, "rgb": [0, 0, 0]}, {"index": 0.6707481844283061, "rgb": [0, 0, 0]}, {"index": 0.6707904070258403, "rgb": [255, 255, 0]}, {"index": 0.6708326296233744, "rgb": [0, 0, 0]}, {"index": 0.6714364127681136, "rgb": [0, 0, 0]}, {"index": 0.6715081911839217, "rgb": [255, 255, 0]}, {"index": 0.6715799695997298, "rgb": [0, 0, 0]}, {"index": 0.6721541969261949, "rgb": [0, 0, 0]}, {"index": 0.672225975342003, "rgb": [255, 255, 0]}, {"index": 0.6722977537578111, "rgb": [0, 0, 0]}, {"index": 0.6728339807464956, "rgb": [0, 0, 0]}, {"index": 0.6729015369025503, "rgb": [255, 255, 0]}, {"index": 0.672969093058605, "rgb": [0, 0, 0]}, {"index": 0.6836556324945111, "rgb": [0, 0, 0]}, {"index": 0.6848505320047289, "rgb": [255, 255, 0]}, {"index": 0.6860454315149467, "rgb": [0, 0, 0]}, {"index": 0.6904365816585036, "rgb": [0, 0, 0]}, {"index": 0.6910572538422564, "rgb": [255, 255, 0]}, {"index": 0.6916779260260091, "rgb": [0, 0, 0]}, {"index": 0.692159263637899, "rgb": [0, 0, 0]}, {"index": 0.6922817091707482, "rgb": [255, 255, 0]}, {"index": 0.6924041547035973, "rgb": [0, 0, 0]}, {"index": 0.69627174463773, "rgb": [0, 0, 0]}, {"index": 0.6967150819118392, "rgb": [255, 255, 0]}, {"index": 0.6971584191859483, "rgb": [0, 0, 0]}, {"index": 0.700553116027698, "rgb": [0, 0, 0]}, {"index": 0.7009795642627934, "rgb": [255, 255, 0]}, {"index": 0.7014060124978888, "rgb": [0, 0, 0]}, {"index": 0.7031075831785172, "rgb": [0, 0, 0]}, {"index": 0.7033440297247087, "rgb": [255, 255, 0]}, {"index": 0.7035804762709001, "rgb": [0, 0, 0]}, {"index": 0.7067640601249788, "rgb": [0, 0, 0]}, {"index": 0.7071440635027867, "rgb": [255, 255, 0]}, {"index": 0.7075240668805945, "rgb": [0, 0, 0]}, {"index": 0.70779006924506, "rgb": [0, 0, 0]}, {"index": 0.7078618476608681, "rgb": [255, 255, 0]}, {"index": 0.7079336260766762, "rgb": [0, 0, 0]}, {"index": 0.7080138490119913, "rgb": [0, 0, 0]}, {"index": 0.7080307380510049, "rgb": [255, 255, 0]}, {"index": 0.7080476270900186, "rgb": [0, 0, 0]}, {"index": 0.7093607498733323, "rgb": [0, 0, 0]}, {"index": 0.709508528964702, "rgb": [255, 255, 0]}, {"index": 0.7096563080560716, "rgb": [0, 0, 0]}, {"index": 0.7127385576760682, "rgb": [0, 0, 0]}, {"index": 0.7130974497551089, "rgb": [255, 255, 0]}, {"index": 0.7134563418341496, "rgb": [0, 0, 0]}, {"index": 0.7131354500928897, "rgb": [0, 0, 0]}, {"index": 0.7131396723526431, "rgb": [255, 255, 0]}, {"index": 0.7131438946123965, "rgb": [0, 0, 0]}, {"index": 0.7133676743793278, "rgb": [0, 0, 0]}, {"index": 0.7133930079378483, "rgb": [255, 255, 0]}, {"index": 0.7134183414963688, "rgb": [0, 0, 0]}, {"index": 0.7152930248268874, "rgb": [0, 0, 0]}, {"index": 0.7155041378145583, "rgb": [255, 255, 0]}, {"index": 0.7157152508022293, "rgb": [0, 0, 0]}, {"index": 0.7170241513257896, "rgb": [0, 0, 0]}, {"index": 0.7171930417159263, "rgb": [255, 255, 0]}, {"index": 0.7173619321060631, "rgb": [0, 0, 0]}, {"index": 0.7192070596183078, "rgb": [0, 0, 0]}, {"index": 0.719430839385239, "rgb": [255, 255, 0]}, {"index": 0.7196546191521702, "rgb": [0, 0, 0]}, {"index": 0.7228128694477285, "rgb": [0, 0, 0]}, {"index": 0.7231886505657829, "rgb": [255, 255, 0]}, {"index": 0.7235644316838372, "rgb": [0, 0, 0]}, {"index": 0.7234546529302484, "rgb": [0, 0, 0]}, {"index": 0.7234842087485223, "rgb": [255, 255, 0]}, {"index": 0.7235137645667962, "rgb": [0, 0, 0]}, {"index": 0.7236742104374262, "rgb": [0, 0, 0]}, {"index": 0.7236953217361932, "rgb": [255, 255, 0]}, {"index": 0.7237164330349602, "rgb": [0, 0, 0]}, {"index": 0.7239613241006587, "rgb": [0, 0, 0]}, {"index": 0.7239908799189326, "rgb": [255, 255, 0]}, {"index": 0.7240204357372065, "rgb": [0, 0, 0]}, {"index": 0.7248268873501098, "rgb": [0, 0, 0]}, {"index": 0.724919777064685, "rgb": [255, 255, 0]}, {"index": 0.7250126667792602, "rgb": [0, 0, 0]}, {"index": 0.725109778753589, "rgb": [0, 0, 0]}, {"index": 0.725130890052356, "rgb": [255, 255, 0]}, {"index": 0.725152001351123, "rgb": [0, 0, 0]}, {"index": 0.7253208917412599, "rgb": [0, 0, 0]}, {"index": 0.725342003040027, "rgb": [255, 255, 0]}, {"index": 0.7253631143387942, "rgb": [0, 0, 0]}, {"index": 0.725532004728931, "rgb": [0, 0, 0]}, {"index": 0.725553116027698, "rgb": [255, 255, 0]}, {"index": 0.725574227326465, "rgb": [0, 0, 0]}, {"index": 0.7256671170410405, "rgb": [0, 0, 0]}, {"index": 0.7256797838203006, "rgb": [255, 255, 0]}, {"index": 0.7256924505995608, "rgb": [0, 0, 0]}, {"index": 0.7258317851714238, "rgb": [0, 0, 0]}, {"index": 0.7258486742104374, "rgb": [255, 255, 0]}, {"index": 0.7258655632494511, "rgb": [0, 0, 0]}, {"index": 0.7284706975173113, "rgb": [0, 0, 0]}, {"index": 0.7287620334402972, "rgb": [255, 255, 0]}, {"index": 0.7290533693632831, "rgb": [0, 0, 0]}, {"index": 0.7289140347914203, "rgb": [0, 0, 0]}, {"index": 0.728930923830434, "rgb": [255, 255, 0]}, {"index": 0.7289478128694478, "rgb": [0, 0, 0]}, {"index": 0.7301089343016383, "rgb": [0, 0, 0]}, {"index": 0.7302398243539943, "rgb": [255, 255, 0]}, {"index": 0.7303707144063503, "rgb": [0, 0, 0]}, {"index": 0.7381058942746157, "rgb": [0, 0, 0]}, {"index": 0.7389799020435737, "rgb": [255, 255, 0]}, {"index": 0.7398539098125316, "rgb": [0, 0, 0]}, {"index": 0.7423239317682824, "rgb": [0, 0, 0]}, {"index": 0.7426954906265834, "rgb": [255, 255, 0]}, {"index": 0.7430670494848843, "rgb": [0, 0, 0]}, {"index": 0.7431894950177336, "rgb": [0, 0, 0]}, {"index": 0.743244384394528, "rgb": [255, 255, 0]}, {"index": 0.7432992737713224, "rgb": [0, 0, 0]}, {"index": 0.7466264144570174, "rgb": [0, 0, 0]}, {"index": 0.7470021955750717, "rgb": [255, 255, 0]}, {"index": 0.7473779766931261, "rgb": [0, 0, 0]}, {"index": 0.7495862185441649, "rgb": [0, 0, 0]}, {"index": 0.7498733322073974, "rgb": [255, 255, 0]}, {"index": 0.7501604458706299, "rgb": [0, 0, 0]}, {"index": 0.7505193379496706, "rgb": [0, 0, 0]}, {"index": 0.7505911163654788, "rgb": [255, 255, 0]}, {"index": 0.750662894781287, "rgb": [0, 0, 0]}, {"index": 0.7508571187299443, "rgb": [0, 0, 0]}, {"index": 0.7508866745482182, "rgb": [255, 255, 0]}, {"index": 0.7509162303664921, "rgb": [0, 0, 0]}, {"index": 0.7525586894105725, "rgb": [0, 0, 0]}, {"index": 0.752744468839723, "rgb": [255, 255, 0]}, {"index": 0.7529302482688736, "rgb": [0, 0, 0]}, {"index": 0.7533524742442156, "rgb": [0, 0, 0]}, {"index": 0.7534200304002703, "rgb": [255, 255, 0]}, {"index": 0.753487586556325, "rgb": [0, 0, 0]}, {"index": 0.7541800371558859, "rgb": [0, 0, 0]}, {"index": 0.7542644823509542, "rgb": [255, 255, 0]}, {"index": 0.7543489275460226, "rgb": [0, 0, 0]}, {"index": 0.7556324945110624, "rgb": [0, 0, 0]}, {"index": 0.7557844958621854, "rgb": [255, 255, 0]}, {"index": 0.7559364972133085, "rgb": [0, 0, 0]}, {"index": 0.7572665090356359, "rgb": [0, 0, 0]}, {"index": 0.7574311771660193, "rgb": [255, 255, 0]}, {"index": 0.7575958452964027, "rgb": [0, 0, 0]}, {"index": 0.7581531835838541, "rgb": [0, 0, 0]}, {"index": 0.758233406519169, "rgb": [255, 255, 0]}, {"index": 0.758313629454484, "rgb": [0, 0, 0]}, {"index": 0.768455497382199, "rgb": [0, 0, 0]}, {"index": 0.769591285255869, "rgb": [255, 255, 0]}, {"index": 0.7707270731295389, "rgb": [0, 0, 0]}, {"index": 0.7791293700388449, "rgb": [0, 0, 0]}, {"index": 0.7801891572369533, "rgb": [255, 255, 0]}, {"index": 0.7812489444350617, "rgb": [0, 0, 0]}, {"index": 0.7847111974328661, "rgb": [0, 0, 0]}, {"index": 0.7852136463435231, "rgb": [255, 255, 0]}, {"index": 0.7857160952541801, "rgb": [0, 0, 0]}, {"index": 0.7856316500591117, "rgb": [0, 0, 0]}, {"index": 0.7856780949163993, "rgb": [255, 255, 0]}, {"index": 0.7857245397736868, "rgb": [0, 0, 0]}, {"index": 0.7927461577436243, "rgb": [0, 0, 0]}, {"index": 0.7935314980577605, "rgb": [255, 255, 0]}, {"index": 0.7943168383718966, "rgb": [0, 0, 0]}, {"index": 0.7944055058267184, "rgb": [0, 0, 0]}, {"index": 0.7945026178010471, "rgb": [255, 255, 0]}, {"index": 0.7945997297753759, "rgb": [0, 0, 0]}, {"index": 0.7962126330011823, "rgb": [0, 0, 0]}, {"index": 0.7964026346900861, "rgb": [255, 255, 0]}, {"index": 0.7965926363789899, "rgb": [0, 0, 0]}, {"index": 0.7979226482013173, "rgb": [0, 0, 0]}, {"index": 0.7980915385914541, "rgb": [255, 255, 0]}, {"index": 0.7982604289815909, "rgb": [0, 0, 0]}, {"index": 0.7983195406181388, "rgb": [0, 0, 0]}, {"index": 0.7983448741766593, "rgb": [255, 255, 0]}, {"index": 0.7983702077351799, "rgb": [0, 0, 0]}, {"index": 0.8027149130214492, "rgb": [0, 0, 0]}, {"index": 0.8032004728930924, "rgb": [255, 255, 0]}, {"index": 0.8036860327647356, "rgb": [0, 0, 0]}, {"index": 0.8090905252491134, "rgb": [0, 0, 0]}, {"index": 0.8097449755108934, "rgb": [255, 255, 0]}, {"index": 0.8103994257726734, "rgb": [0, 0, 0]}, {"index": 0.8146090187468333, "rgb": [0, 0, 0]}, {"index": 0.8151494679952711, "rgb": [255, 255, 0]}, {"index": 0.8156899172437089, "rgb": [0, 0, 0]}, {"index": 0.81655548049316, "rgb": [0, 0, 0]}, {"index": 0.8167117041040365, "rgb": [255, 255, 0]}, {"index": 0.816867927714913, "rgb": [0, 0, 0]}, {"index": 0.8173577098463097, "rgb": [0, 0, 0]}, {"index": 0.8174294882621179, "rgb": [255, 255, 0]}, {"index": 0.8175012666779261, "rgb": [0, 0, 0]}, {"index": 0.8200895119067725, "rgb": [0, 0, 0]}, {"index": 0.8203850700895119, "rgb": [255, 255, 0]}, {"index": 0.8206806282722513, "rgb": [0, 0, 0]}, {"index": 0.8208790744806621, "rgb": [0, 0, 0]}, {"index": 0.8209339638574565, "rgb": [255, 255, 0]}, {"index": 0.820988853234251, "rgb": [0, 0, 0]}, {"index": 0.8247339976355346, "rgb": [0, 0, 0]}, {"index": 0.8251562236108766, "rgb": [255, 255, 0]}, {"index": 0.8255784495862186, "rgb": [0, 0, 0]}, {"index": 0.8270182401621348, "rgb": [0, 0, 0]}, {"index": 0.8272251308900523, "rgb": [255, 255, 0]}, {"index": 0.8274320216179699, "rgb": [0, 0, 0]}, {"index": 0.8292771491302146, "rgb": [0, 0, 0]}, {"index": 0.8295051511568992, "rgb": [255, 255, 0]}, {"index": 0.8297331531835838, "rgb": [0, 0, 0]}, {"index": 0.830417159263638, "rgb": [0, 0, 0]}, {"index": 0.83051849349772, "rgb": [255, 255, 0]}, {"index": 0.830619827731802, "rgb": [0, 0, 0]}, {"index": 0.8319245059956089, "rgb": [0, 0, 0]}, {"index": 0.8320807296064854, "rgb": [255, 255, 0]}, {"index": 0.8322369532173619, "rgb": [0, 0, 0]}, {"index": 0.8329927377132242, "rgb": [0, 0, 0]}, {"index": 0.8330940719473062, "rgb": [255, 255, 0]}, {"index": 0.8331954061813882, "rgb": [0, 0, 0]}, {"index": 0.8338920790407027, "rgb": [0, 0, 0]}, {"index": 0.8339807464955244, "rgb": [255, 255, 0]}, {"index": 0.8340694139503462, "rgb": [0, 0, 0]}, {"index": 0.8367167708157406, "rgb": [0, 0, 0]}, {"index": 0.8370207735179869, "rgb": [255, 255, 0]}, {"index": 0.8373247762202332, "rgb": [0, 0, 0]}, {"index": 0.8387307887181219, "rgb": [0, 0, 0]}, {"index": 0.8389207904070258, "rgb": [255, 255, 0]}, {"index": 0.8391107920959298, "rgb": [0, 0, 0]}, {"index": 0.8405168045938187, "rgb": [0, 0, 0]}, {"index": 0.8406941395034623, "rgb": [255, 255, 0]}, {"index": 0.8408714744131058, "rgb": [0, 0, 0]}, {"index": 0.8413401452457354, "rgb": [0, 0, 0]}, {"index": 0.8414119236615436, "rgb": [255, 255, 0]}, {"index": 0.8414837020773518, "rgb": [0, 0, 0]}, {"index": 0.8435019422394866, "rgb": [0, 0, 0]}, {"index": 0.8437341665259247, "rgb": [255, 255, 0]}, {"index": 0.8439663908123628, "rgb": [0, 0, 0]}, {"index": 0.8595043067049485, "rgb": [0, 0, 0]}, {"index": 0.8612565445026178, "rgb": [255, 255, 0]}, {"index": 0.8630087823002871, "rgb": [0, 0, 0]}, {"index": 0.8635745651072454, "rgb": [0, 0, 0]}, {"index": 0.863832122952204, "rgb": [255, 255, 0]}, {"index": 0.8640896807971626, "rgb": [0, 0, 0]}, {"index": 0.8748902212464111, "rgb": [0, 0, 0]}, {"index": 0.8761188988346563, "rgb": [255, 255, 0]}, {"index": 0.8773475764229015, "rgb": [0, 0, 0]}, {"index": 0.8775629116703259, "rgb": [0, 0, 0]}, {"index": 0.8777233575409559, "rgb": [255, 255, 0]}, {"index": 0.8778838034115859, "rgb": [0, 0, 0]}, {"index": 0.8812573889545685, "rgb": [0, 0, 0]}, {"index": 0.8816500591116365, "rgb": [255, 255, 0]}, {"index": 0.8820427292687045, "rgb": [0, 0, 0]}, {"index": 0.8870461070765074, "rgb": [0, 0, 0]}, {"index": 0.887645667961493, "rgb": [255, 255, 0]}, {"index": 0.8882452288464786, "rgb": [0, 0, 0]}, {"index": 0.8915597027529133, "rgb": [0, 0, 0]}, {"index": 0.8919945955075156, "rgb": [255, 255, 0]}, {"index": 0.8924294882621179, "rgb": [0, 0, 0]}, {"index": 0.8939326127343354, "rgb": [0, 0, 0]}, {"index": 0.8941479479817598, "rgb": [255, 255, 0]}, {"index": 0.8943632832291841, "rgb": [0, 0, 0]}, {"index": 0.8986699881776727, "rgb": [0, 0, 0]}, {"index": 0.8991724370883297, "rgb": [255, 255, 0]}, {"index": 0.8996748859989867, "rgb": [0, 0, 0]}, {"index": 0.90016044587063, "rgb": [0, 0, 0]}, {"index": 0.9002702246242189, "rgb": [255, 255, 0]}, {"index": 0.9003800033778078, "rgb": [0, 0, 0]}, {"index": 0.9003462252997805, "rgb": [0, 0, 0]}, {"index": 0.9003546698192872, "rgb": [255, 255, 0]}, {"index": 0.900363114338794, "rgb": [0, 0, 0]}, {"index": 0.9032046951528458, "rgb": [0, 0, 0]}, {"index": 0.9035213646343523, "rgb": [255, 255, 0]}, {"index": 0.9038380341158587, "rgb": [0, 0, 0]}, {"index": 0.9096014186792771, "rgb": [0, 0, 0]}, {"index": 0.9102769802398244, "rgb": [255, 255, 0]}, {"index": 0.9109525418003717, "rgb": [0, 0, 0]}, {"index": 0.9106189832798515, "rgb": [0, 0, 0]}, {"index": 0.9106569836176321, "rgb": [255, 255, 0]}, {"index": 0.9106949839554128, "rgb": [0, 0, 0]}, {"index": 0.9115309913865902, "rgb": [0, 0, 0]}, {"index": 0.9116281033609188, "rgb": [255, 255, 0]}, {"index": 0.9117252153352474, "rgb": [0, 0, 0]}, {"index": 0.9128441141699037, "rgb": [0, 0, 0]}, {"index": 0.9129792264820131, "rgb": [255, 255, 0]}, {"index": 0.9131143387941225, "rgb": [0, 0, 0]}, {"index": 0.9135872318865057, "rgb": [0, 0, 0]}, {"index": 0.9136547880425604, "rgb": [255, 255, 0]}, {"index": 0.9137223441986151, "rgb": [0, 0, 0]}, {"index": 0.9141487924337105, "rgb": [0, 0, 0]}, {"index": 0.9142036818105049, "rgb": [255, 255, 0]}, {"index": 0.9142585711872994, "rgb": [0, 0, 0]}, {"index": 0.9217277486910994, "rgb": [0, 0, 0]}, {"index": 0.9225637561222766, "rgb": [255, 255, 0]}, {"index": 0.9233997635534538, "rgb": [0, 0, 0]}, {"index": 0.9332798513764567, "rgb": [0, 0, 0]}, {"index": 0.9344705286269211, "rgb": [255, 255, 0]}, {"index": 0.9356612058773855, "rgb": [0, 0, 0]}, {"index": 0.9375105556493835, "rgb": [0, 0, 0]}, {"index": 0.9378483364296571, "rgb": [255, 255, 0]}, {"index": 0.9381861172099308, "rgb": [0, 0, 0]}, {"index": 0.9441563925012667, "rgb": [0, 0, 0]}, {"index": 0.9448572876203344, "rgb": [255, 255, 0]}, {"index": 0.9455581827394021, "rgb": [0, 0, 0]}, {"index": 0.9519633507853403, "rgb": [0, 0, 0]}, {"index": 0.9527529133592298, "rgb": [255, 255, 0]}, {"index": 0.9535424759331194, "rgb": [0, 0, 0]}, {"index": 0.9585669650396893, "rgb": [0, 0, 0]}, {"index": 0.9592129707819625, "rgb": [255, 255, 0]}, {"index": 0.9598589765242358, "rgb": [0, 0, 0]}, {"index": 0.9595169734842088, "rgb": [0, 0, 0]}, {"index": 0.9595507515622361, "rgb": [255, 255, 0]}, {"index": 0.9595845296402634, "rgb": [0, 0, 0]}, {"index": 0.9605007600067557, "rgb": [0, 0, 0]}, {"index": 0.9606063165005911, "rgb": [255, 255, 0]}, {"index": 0.9607118729944266, "rgb": [0, 0, 0]}, {"index": 0.9615183246073298, "rgb": [0, 0, 0]}, {"index": 0.9616196588414119, "rgb": [255, 255, 0]}, {"index": 0.961720993075494, "rgb": [0, 0, 0]}, {"index": 0.9623416652592468, "rgb": [0, 0, 0]}, {"index": 0.9624218881945618, "rgb": [255, 255, 0]}, {"index": 0.9625021111298767, "rgb": [0, 0, 0]}, {"index": 0.9643979057591623, "rgb": [0, 0, 0]}, {"index": 0.9646174632663401, "rgb": [255, 255, 0]}, {"index": 0.964837020773518, "rgb": [0, 0, 0]}, {"index": 0.9646934639419018, "rgb": [0, 0, 0]}, {"index": 0.9647019084614086, "rgb": [255, 255, 0]}, {"index": 0.9647103529809153, "rgb": [0, 0, 0]}, {"index": 0.9670199290660362, "rgb": [0, 0, 0]}, {"index": 0.9672774869109948, "rgb": [255, 255, 0]}, {"index": 0.9675350447559534, "rgb": [0, 0, 0]}, {"index": 0.9713055227157574, "rgb": [0, 0, 0]}, {"index": 0.97175308224962, "rgb": [255, 255, 0]}, {"index": 0.9722006417834825, "rgb": [0, 0, 0]}, {"index": 0.9727030906941395, "rgb": [0, 0, 0]}, {"index": 0.972808647187975, "rgb": [255, 255, 0]}, {"index": 0.9729142036818105, "rgb": [0, 0, 0]}, {"index": 0.9730746495524405, "rgb": [0, 0, 0]}, {"index": 0.9731042053707144, "rgb": [255, 255, 0]}, {"index": 0.9731337611889883, "rgb": [0, 0, 0]}, {"index": 0.9751562236108766, "rgb": [0, 0, 0]}, {"index": 0.9753842256375612, "rgb": [255, 255, 0]}, {"index": 0.9756122276642458, "rgb": [0, 0, 0]}, {"index": 0.9783862523222429, "rgb": [0, 0, 0]}, {"index": 0.978719810842763, "rgb": [255, 255, 0]}, {"index": 0.9790533693632832, "rgb": [0, 0, 0]}, {"index": 0.9822918425941564, "rgb": [0, 0, 0]}, {"index": 0.9826887350109779, "rgb": [255, 255, 0]}, {"index": 0.9830856274277994, "rgb": [0, 0, 0]}, {"index": 0.9837527444688398, "rgb": [0, 0, 0]}, {"index": 0.9838709677419355, "rgb": [255, 255, 0]}, {"index": 0.9839891910150312, "rgb": [0, 0, 0]}, {"index": 0.9849729775375782, "rgb": [0, 0, 0]}, {"index": 0.9850954230704273, "rgb": [255, 255, 0]}, {"index": 0.9852178686032764, "rgb": [0, 0, 0]}, {"index": 0.985817429488262, "rgb": [0, 0, 0]}, {"index": 0.9858976524235771, "rgb": [255, 255, 0]}, {"index": 0.9859778753588921, "rgb": [0, 0, 0]}, {"index": 0.9890136801216012, "rgb": [0, 0, 0]}, {"index": 0.9893599054213815, "rgb": [255, 255, 0]}, {"index": 0.9897061307211619, "rgb": [0, 0, 0]}, {"index": 0.9931599391994597, "rgb": [0, 0, 0]}, {"index": 0.9935821651748016, "rgb": [255, 255, 0]}, {"index": 0.9940043911501435, "rgb": [0, 0, 0]}, {"index": 0.9950261780104712, "rgb": [0, 0, 0]}, {"index": 0.9951866238811011, "rgb": [255, 255, 0]}, {"index": 0.995347069751731, "rgb": [0, 0, 0]}, {"index": 0.997808647187975, "rgb": [0, 0, 0]}, {"index": 0.9980999831109609, "rgb": [255, 255, 0]}, {"index": 0.9983913190339468, "rgb": [0, 0, 0]}, {"index": 0.9998099983110962, "rgb": [0, 0, 0]}, {"index": 1.0, "rgb": [255, 255, 0]}, {"index": 1.0001900016889038, "rgb": [0, 0, 0]}, {"index": 1, "rgb": [0, 0, 0]}],
	
	"disgust": [{"rgb": [0, 0, 0], "index": 0}, {"rgb": [0, 0, 0], "index": 0.01254011146765749}, {"rgb": [0, 255, 0], "index": 0.013933457186286101}, {"rgb": [0, 0, 0], "index": 0.015326802904914711}, {"rgb": [0, 0, 0], "index": 0.01666948150650228}, {"rgb": [0, 255, 0], "index": 0.016973484208748522}, {"rgb": [0, 0, 0], "index": 0.017277486910994764}, {"rgb": [0, 0, 0], "index": 0.018645499071102856}, {"rgb": [0, 255, 0], "index": 0.018831278500253335}, {"rgb": [0, 0, 0], "index": 0.019017057929403815}, {"rgb": [0, 0, 0], "index": 0.03163739233237629}, {"rgb": [0, 255, 0], "index": 0.03306029386927884}, {"rgb": [0, 0, 0], "index": 0.03448319540618139}, {"rgb": [0, 0, 0], "index": 0.03541631481168722}, {"rgb": [0, 255, 0], "index": 0.035678094916399256}, {"rgb": [0, 0, 0], "index": 0.03593987502111129}, {"rgb": [0, 0, 0], "index": 0.0361720993075494}, {"rgb": [0, 255, 0], "index": 0.03622698868434386}, {"rgb": [0, 0, 0], "index": 0.03628187806113832}, {"rgb": [0, 0, 0], "index": 0.04059702752913359}, {"rgb": [0, 255, 0], "index": 0.041082587400776895}, {"rgb": [0, 0, 0], "index": 0.0415681472724202}, {"rgb": [0, 0, 0], "index": 0.04579462928559365}, {"rgb": [0, 255, 0], "index": 0.04631818949501773}, {"rgb": [0, 0, 0], "index": 0.04684174970444181}, {"rgb": [0, 0, 0], "index": 0.04814220570849519}, {"rgb": [0, 255, 0], "index": 0.04834487417665935}, {"rgb": [0, 0, 0], "index": 0.04854754264482351}, {"rgb": [0, 0, 0], "index": 0.04864887687890559}, {"rgb": [0, 255, 0], "index": 0.04868265495693295}, {"rgb": [0, 0, 0], "index": 0.04871643303496031}, {"rgb": [0, 0, 0], "index": 0.053774700219557506}, {"rgb": [0, 255, 0], "index": 0.05434048302651579}, {"rgb": [0, 0, 0], "index": 0.05490626583347408}, {"rgb": [0, 0, 0], "index": 0.057760513426786016}, {"rgb": [0, 255, 0], "index": 0.05814051680459382}, {"rgb": [0, 0, 0], "index": 0.05852052018240162}, {"rgb": [0, 0, 0], "index": 0.058406519169059284}, {"rgb": [0, 255, 0], "index": 0.05843607498733322}, {"rgb": [0, 0, 0], "index": 0.058465630805607155}, {"rgb": [0, 0, 0], "index": 0.06269211281878061}, {"rgb": [0, 255, 0], "index": 0.06316500591116365}, {"rgb": [0, 0, 0], "index": 0.0636378990035467}, {"rgb": [0, 0, 0], "index": 0.06574902888025672}, {"rgb": [0, 255, 0], "index": 0.06603614254348927}, {"rgb": [0, 0, 0], "index": 0.06632325620672183}, {"rgb": [0, 0, 0], "index": 0.06892416821482858}, {"rgb": [0, 255, 0], "index": 0.0692450599560885}, {"rgb": [0, 0, 0], "index": 0.06956595169734842}, {"rgb": [0, 0, 0], "index": 0.06943506164499241}, {"rgb": [0, 255, 0], "index": 0.0694561729437595}, {"rgb": [0, 0, 0], "index": 0.06947728424252658}, {"rgb": [0, 0, 0], "index": 0.07169819287282554}, {"rgb": [0, 255, 0], "index": 0.07194730619827731}, {"rgb": [0, 0, 0], "index": 0.07219641952372909}, {"rgb": [0, 0, 0], "index": 0.0723653099138659}, {"rgb": [0, 255, 0], "index": 0.07241175477115352}, {"rgb": [0, 0, 0], "index": 0.07245819962844115}, {"rgb": [0, 0, 0], "index": 0.07305776051342679}, {"rgb": [0, 255, 0], "index": 0.07312953892923493}, {"rgb": [0, 0, 0], "index": 0.07320131734504308}, {"rgb": [0, 0, 0], "index": 0.07635956764060126}, {"rgb": [0, 255, 0], "index": 0.07671845971964195}, {"rgb": [0, 0, 0], "index": 0.07707735179868264}, {"rgb": [0, 0, 0], "index": 0.08021449079547374}, {"rgb": [0, 255, 0], "index": 0.08060293869278838}, {"rgb": [0, 0, 0], "index": 0.08099138659010302}, {"rgb": [0, 0, 0], "index": 0.08254095591960818}, {"rgb": [0, 255, 0], "index": 0.08275629116703259}, {"rgb": [0, 0, 0], "index": 0.082971626414457}, {"rgb": [0, 0, 0], "index": 0.0829462928559365}, {"rgb": [0, 255, 0], "index": 0.08296740415470359}, {"rgb": [0, 0, 0], "index": 0.08298851545347069}, {"rgb": [0, 0, 0], "index": 0.08361340989697687}, {"rgb": [0, 255, 0], "index": 0.083685188312785}, {"rgb": [0, 0, 0], "index": 0.08375696672859313}, {"rgb": [0, 0, 0], "index": 0.08421719304171592}, {"rgb": [0, 255, 0], "index": 0.0842763046782638}, {"rgb": [0, 0, 0], "index": 0.08433541631481169}, {"rgb": [0, 0, 0], "index": 0.08477030906941395}, {"rgb": [0, 255, 0], "index": 0.08482519844620841}, {"rgb": [0, 0, 0], "index": 0.08488008782300287}, {"rgb": [0, 0, 0], "index": 0.09132325620672184}, {"rgb": [0, 255, 0], "index": 0.09204526262455666}, {"rgb": [0, 0, 0], "index": 0.09276726904239148}, {"rgb": [0, 0, 0], "index": 0.1031413612565445}, {"rgb": [0, 255, 0], "index": 0.10437426110454315}, {"rgb": [0, 0, 0], "index": 0.1056071609525418}, {"rgb": [0, 0, 0], "index": 0.10566627258908969}, {"rgb": [0, 255, 0], "index": 0.10580982942070596}, {"rgb": [0, 0, 0], "index": 0.10595338625232224}, {"rgb": [0, 0, 0], "index": 0.10603783144739065}, {"rgb": [0, 255, 0], "index": 0.10606316500591116}, {"rgb": [0, 0, 0], "index": 0.10608849856443167}, {"rgb": [0, 0, 0], "index": 0.11058520520182402}, {"rgb": [0, 255, 0], "index": 0.111087654112481}, {"rgb": [0, 0, 0], "index": 0.11159010302313799}, {"rgb": [0, 0, 0], "index": 0.11177166019253505}, {"rgb": [0, 255, 0], "index": 0.11184766086809661}, {"rgb": [0, 0, 0], "index": 0.11192366154365817}, {"rgb": [0, 0, 0], "index": 0.11230366492146596}, {"rgb": [0, 255, 0], "index": 0.112354332038507}, {"rgb": [0, 0, 0], "index": 0.11240499915554805}, {"rgb": [0, 0, 0], "index": 0.11360834318527277}, {"rgb": [0, 255, 0], "index": 0.11374767775713562}, {"rgb": [0, 0, 0], "index": 0.11388701232899848}, {"rgb": [0, 0, 0], "index": 0.11397567978382031}, {"rgb": [0, 255, 0], "index": 0.11400101334234082}, {"rgb": [0, 0, 0], "index": 0.11402634690086133}, {"rgb": [0, 0, 0], "index": 0.11525502448910657}, {"rgb": [0, 255, 0], "index": 0.11539435906096943}, {"rgb": [0, 0, 0], "index": 0.11553369363283228}, {"rgb": [0, 0, 0], "index": 0.11695237290998142}, {"rgb": [0, 255, 0], "index": 0.11712548555987164}, {"rgb": [0, 0, 0], "index": 0.11729859820976185}, {"rgb": [0, 0, 0], "index": 0.11750548893767945}, {"rgb": [0, 255, 0], "index": 0.11754771153521365}, {"rgb": [0, 0, 0], "index": 0.11758993413274785}, {"rgb": [0, 0, 0], "index": 0.11849771997973316}, {"rgb": [0, 255, 0], "index": 0.11860327647356865}, {"rgb": [0, 0, 0], "index": 0.11870883296740414}, {"rgb": [0, 0, 0], "index": 0.12145330180712718}, {"rgb": [0, 255, 0], "index": 0.12176997128863368}, {"rgb": [0, 0, 0], "index": 0.12208664077014017}, {"rgb": [0, 0, 0], "index": 0.12287198108427631}, {"rgb": [0, 255, 0], "index": 0.12299442661712548}, {"rgb": [0, 0, 0], "index": 0.12311687214997465}, {"rgb": [0, 0, 0], "index": 0.12611045431514947}, {"rgb": [0, 255, 0], "index": 0.1264566796149299}, {"rgb": [0, 0, 0], "index": 0.12680290491471033}, {"rgb": [0, 0, 0], "index": 0.12653268029049147}, {"rgb": [0, 255, 0], "index": 0.12654112480999832}, {"rgb": [0, 0, 0], "index": 0.12654956932950517}, {"rgb": [0, 0, 0], "index": 0.12699712886336767}, {"rgb": [0, 255, 0], "index": 0.12704779598040872}, {"rgb": [0, 0, 0], "index": 0.12709846309744977}, {"rgb": [0, 0, 0], "index": 0.1273137983448742}, {"rgb": [0, 255, 0], "index": 0.12734335416314813}, {"rgb": [0, 0, 0], "index": 0.12737290998142206}, {"rgb": [0, 0, 0], "index": 0.12867336598547544}, {"rgb": [0, 255, 0], "index": 0.12882114507684514}, {"rgb": [0, 0, 0], "index": 0.12896892416821484}, {"rgb": [0, 0, 0], "index": 0.14212126330011823}, {"rgb": [0, 255, 0], "index": 0.14359905421381525}, {"rgb": [0, 0, 0], "index": 0.14507684512751226}, {"rgb": [0, 0, 0], "index": 0.15123712210775206}, {"rgb": [0, 255, 0], "index": 0.1520857963181895}, {"rgb": [0, 0, 0], "index": 0.15293447052862694}, {"rgb": [0, 0, 0], "index": 0.15337780780273605}, {"rgb": [0, 255, 0], "index": 0.15352136463435231}, {"rgb": [0, 0, 0], "index": 0.15366492146596858}, {"rgb": [0, 0, 0], "index": 0.15412937003884478}, {"rgb": [0, 255, 0], "index": 0.1541969261948995}, {"rgb": [0, 0, 0], "index": 0.15426448235095422}, {"rgb": [0, 0, 0], "index": 0.16400101334234082}, {"rgb": [0, 255, 0], "index": 0.16509035635872318}, {"rgb": [0, 0, 0], "index": 0.16617969937510554}, {"rgb": [0, 0, 0], "index": 0.16824438439452793}, {"rgb": [0, 255, 0], "index": 0.1685948319540618}, {"rgb": [0, 0, 0], "index": 0.16894527951359567}, {"rgb": [0, 0, 0], "index": 0.17019084614085458}, {"rgb": [0, 255, 0], "index": 0.17036818105049822}, {"rgb": [0, 0, 0], "index": 0.17054551596014186}, {"rgb": [0, 0, 0], "index": 0.17356020942408376}, {"rgb": [0, 255, 0], "index": 0.17391487924337104}, {"rgb": [0, 0, 0], "index": 0.17426954906265832}, {"rgb": [0, 0, 0], "index": 0.17410488093227494}, {"rgb": [0, 255, 0], "index": 0.17412599223104205}, {"rgb": [0, 0, 0], "index": 0.17414710352980917}, {"rgb": [0, 0, 0], "index": 0.17952204019591286}, {"rgb": [0, 255, 0], "index": 0.1801216010808985}, {"rgb": [0, 0, 0], "index": 0.18072116196588414}, {"rgb": [0, 0, 0], "index": 0.18042560378314473}, {"rgb": [0, 255, 0], "index": 0.1804593818611721}, {"rgb": [0, 0, 0], "index": 0.18049315993919948}, {"rgb": [0, 0, 0], "index": 0.18057338287451444}, {"rgb": [0, 255, 0], "index": 0.1805860496537747}, {"rgb": [0, 0, 0], "index": 0.18059871643303496}, {"rgb": [0, 0, 0], "index": 0.18073805100489782}, {"rgb": [0, 255, 0], "index": 0.1807549400439115}, {"rgb": [0, 0, 0], "index": 0.18077182908292516}, {"rgb": [0, 0, 0], "index": 0.18090694139503463}, {"rgb": [0, 255, 0], "index": 0.1809238304340483}, {"rgb": [0, 0, 0], "index": 0.18094071947306198}, {"rgb": [0, 0, 0], "index": 0.181151832460733}, {"rgb": [0, 255, 0], "index": 0.18117716601925352}, {"rgb": [0, 0, 0], "index": 0.18120249957777404}, {"rgb": [0, 0, 0], "index": 0.18140516804593818}, {"rgb": [0, 255, 0], "index": 0.1814305016044587}, {"rgb": [0, 0, 0], "index": 0.18145583516297922}, {"rgb": [0, 0, 0], "index": 0.18257051173788214}, {"rgb": [0, 255, 0], "index": 0.18269717953048473}, {"rgb": [0, 0, 0], "index": 0.18282384732308732}, {"rgb": [0, 0, 0], "index": 0.1827351798682655}, {"rgb": [0, 255, 0], "index": 0.18273940212801892}, {"rgb": [0, 0, 0], "index": 0.18274362438777234}, {"rgb": [0, 0, 0], "index": 0.18384141192366157}, {"rgb": [0, 255, 0], "index": 0.18396385745651073}, {"rgb": [0, 0, 0], "index": 0.18408630298935988}, {"rgb": [0, 0, 0], "index": 0.1840018577942915}, {"rgb": [0, 255, 0], "index": 0.18400608005404492}, {"rgb": [0, 0, 0], "index": 0.18401030231379834}, {"rgb": [0, 0, 0], "index": 0.18556409390305692}, {"rgb": [0, 255, 0], "index": 0.18573720655294715}, {"rgb": [0, 0, 0], "index": 0.18591031920283738}, {"rgb": [0, 0, 0], "index": 0.19185526093565278}, {"rgb": [0, 255, 0], "index": 0.1925350447559534}, {"rgb": [0, 0, 0], "index": 0.19321482857625402}, {"rgb": [0, 0, 0], "index": 0.19356105387603448}, {"rgb": [0, 255, 0], "index": 0.1936750548893768}, {"rgb": [0, 0, 0], "index": 0.19378905590271914}, {"rgb": [0, 0, 0], "index": 0.19561307211619658}, {"rgb": [0, 255, 0], "index": 0.195828407363621}, {"rgb": [0, 0, 0], "index": 0.19604374261104543}, {"rgb": [0, 0, 0], "index": 0.1960564093903057}, {"rgb": [0, 255, 0], "index": 0.19608174294882622}, {"rgb": [0, 0, 0], "index": 0.19610707650734674}, {"rgb": [0, 0, 0], "index": 0.19619574396216855}, {"rgb": [0, 255, 0], "index": 0.1962084107414288}, {"rgb": [0, 0, 0], "index": 0.19622107752068907}, {"rgb": [0, 0, 0], "index": 0.19693041715926363}, {"rgb": [0, 255, 0], "index": 0.1970106400945786}, {"rgb": [0, 0, 0], "index": 0.1970908630298936}, {"rgb": [0, 0, 0], "index": 0.20396470190846142}, {"rgb": [0, 255, 0], "index": 0.20473737544333728}, {"rgb": [0, 0, 0], "index": 0.20551004897821315}, {"rgb": [0, 0, 0], "index": 0.20599138659010302}, {"rgb": [0, 255, 0], "index": 0.20613072116196587}, {"rgb": [0, 0, 0], "index": 0.20627005573382873}, {"rgb": [0, 0, 0], "index": 0.20677672690423915}, {"rgb": [0, 255, 0], "index": 0.20684850532004728}, {"rgb": [0, 0, 0], "index": 0.20692028373585541}, {"rgb": [0, 0, 0], "index": 0.21038253673365986}, {"rgb": [0, 255, 0], "index": 0.21077520689072793}, {"rgb": [0, 0, 0], "index": 0.211167877047796}, {"rgb": [0, 0, 0], "index": 0.21339723019760176}, {"rgb": [0, 255, 0], "index": 0.21368856612058773}, {"rgb": [0, 0, 0], "index": 0.2139799020435737}, {"rgb": [0, 0, 0], "index": 0.2165005911163655}, {"rgb": [0, 255, 0], "index": 0.21681303833811857}, {"rgb": [0, 0, 0], "index": 0.21712548555987166}, {"rgb": [0, 0, 0], "index": 0.21715504137814562}, {"rgb": [0, 255, 0], "index": 0.21719304171592638}, {"rgb": [0, 0, 0], "index": 0.21723104205370714}, {"rgb": [0, 0, 0], "index": 0.21913105894274615}, {"rgb": [0, 255, 0], "index": 0.21934639419017057}, {"rgb": [0, 0, 0], "index": 0.219561729437595}, {"rgb": [0, 0, 0], "index": 0.22018240162134775}, {"rgb": [0, 255, 0], "index": 0.220275291335923}, {"rgb": [0, 0, 0], "index": 0.22036818105049824}, {"rgb": [0, 0, 0], "index": 0.22099729775375782}, {"rgb": [0, 255, 0], "index": 0.2210775206890728}, {"rgb": [0, 0, 0], "index": 0.22115774362438778}, {"rgb": [0, 0, 0], "index": 0.22134352305353827}, {"rgb": [0, 255, 0], "index": 0.2213730788718122}, {"rgb": [0, 0, 0], "index": 0.22140263469008614}, {"rgb": [0, 0, 0], "index": 0.22144907954737375}, {"rgb": [0, 255, 0], "index": 0.2214575240668806}, {"rgb": [0, 0, 0], "index": 0.22146596858638745}, {"rgb": [0, 0, 0], "index": 0.2228255362269887}, {"rgb": [0, 255, 0], "index": 0.2229775375781118}, {"rgb": [0, 0, 0], "index": 0.22312953892923493}, {"rgb": [0, 0, 0], "index": 0.22499155548049318}, {"rgb": [0, 255, 0], "index": 0.22521533524742443}, {"rgb": [0, 0, 0], "index": 0.22543911501435568}, {"rgb": [0, 0, 0], "index": 0.2253293362607668}, {"rgb": [0, 255, 0], "index": 0.22534200304002702}, {"rgb": [0, 0, 0], "index": 0.22535466981928726}, {"rgb": [0, 0, 0], "index": 0.22538000337780778}, {"rgb": [0, 255, 0], "index": 0.22538422563756122}, {"rgb": [0, 0, 0], "index": 0.22538844789731466}, {"rgb": [0, 0, 0], "index": 0.2258402296909306}, {"rgb": [0, 255, 0], "index": 0.22589089680797161}, {"rgb": [0, 0, 0], "index": 0.22594156392501263}, {"rgb": [0, 0, 0], "index": 0.226004897821314}, {"rgb": [0, 255, 0], "index": 0.22601756460057423}, {"rgb": [0, 0, 0], "index": 0.22603023137983447}, {"rgb": [0, 0, 0], "index": 0.22723357540955919}, {"rgb": [0, 255, 0], "index": 0.22736868772166863}, {"rgb": [0, 0, 0], "index": 0.22750380003377807}, {"rgb": [0, 0, 0], "index": 0.2290027022462422}, {"rgb": [0, 255, 0], "index": 0.22918425941563925}, {"rgb": [0, 0, 0], "index": 0.2293658165850363}, {"rgb": [0, 0, 0], "index": 0.22929826042898158}, {"rgb": [0, 255, 0], "index": 0.22931092720824184}, {"rgb": [0, 0, 0], "index": 0.2293235939875021}, {"rgb": [0, 0, 0], "index": 0.234478973146428}, {"rgb": [0, 255, 0], "index": 0.2350532004728931}, {"rgb": [0, 0, 0], "index": 0.23562742779935822}, {"rgb": [0, 0, 0], "index": 0.2364212126330012}, {"rgb": [0, 255, 0], "index": 0.23657321398412431}, {"rgb": [0, 0, 0], "index": 0.23672521533524743}, {"rgb": [0, 0, 0], "index": 0.24307127174463775}, {"rgb": [0, 255, 0], "index": 0.24379327816247257}, {"rgb": [0, 0, 0], "index": 0.24451528458030738}, {"rgb": [0, 0, 0], "index": 0.2509373416652593}, {"rgb": [0, 255, 0], "index": 0.2517311264989022}, {"rgb": [0, 0, 0], "index": 0.2525249113325452}, {"rgb": [0, 0, 0], "index": 0.25393514609018747}, {"rgb": [0, 255, 0], "index": 0.25418003715588583}, {"rgb": [0, 0, 0], "index": 0.2544249282215842}, {"rgb": [0, 0, 0], "index": 0.2542940381692282}, {"rgb": [0, 255, 0], "index": 0.25430670494848845}, {"rgb": [0, 0, 0], "index": 0.2543193717277487}, {"rgb": [0, 0, 0], "index": 0.25445870629961154}, {"rgb": [0, 255, 0], "index": 0.25447559533862524}, {"rgb": [0, 0, 0], "index": 0.25449248437763894}, {"rgb": [0, 0, 0], "index": 0.25660361425434897}, {"rgb": [0, 255, 0], "index": 0.25684006080054045}, {"rgb": [0, 0, 0], "index": 0.25707650734673193}, {"rgb": [0, 0, 0], "index": 0.2569540618138828}, {"rgb": [0, 255, 0], "index": 0.25696672859314307}, {"rgb": [0, 0, 0], "index": 0.25697939537240333}, {"rgb": [0, 0, 0], "index": 0.2588287451444013}, {"rgb": [0, 255, 0], "index": 0.25903563587231887}, {"rgb": [0, 0, 0], "index": 0.25924252660023644}, {"rgb": [0, 0, 0], "index": 0.2600996453301807}, {"rgb": [0, 255, 0], "index": 0.26021786860327645}, {"rgb": [0, 0, 0], "index": 0.2603360918763722}, {"rgb": [0, 0, 0], "index": 0.2606738726566458}, {"rgb": [0, 255, 0], "index": 0.26072453977368687}, {"rgb": [0, 0, 0], "index": 0.2607752068907279}, {"rgb": [0, 0, 0], "index": 0.2609145414625908}, {"rgb": [0, 255, 0], "index": 0.2609356527613579}, {"rgb": [0, 0, 0], "index": 0.26095676406012497}, {"rgb": [0, 0, 0], "index": 0.26196166188143893}, {"rgb": [0, 255, 0], "index": 0.2620756628947813}, {"rgb": [0, 0, 0], "index": 0.26218966390812365}, {"rgb": [0, 0, 0], "index": 0.26534369194392843}, {"rgb": [0, 255, 0], "index": 0.26570680628272253}, {"rgb": [0, 0, 0], "index": 0.26606992062151663}, {"rgb": [0, 0, 0], "index": 0.2760428981590948}, {"rgb": [0, 255, 0], "index": 0.277191352812025}, {"rgb": [0, 0, 0], "index": 0.27833980746495524}, {"rgb": [0, 0, 0], "index": 0.2780273602432022}, {"rgb": [0, 255, 0], "index": 0.2781202499577774}, {"rgb": [0, 0, 0], "index": 0.2782131396723526}, {"rgb": [0, 0, 0], "index": 0.280780273602432}, {"rgb": [0, 255, 0], "index": 0.2810758317851714}, {"rgb": [0, 0, 0], "index": 0.28137138996791083}, {"rgb": [0, 0, 0], "index": 0.28175983786522546}, {"rgb": [0, 255, 0], "index": 0.28183583854078703}, {"rgb": [0, 0, 0], "index": 0.2819118392163486}, {"rgb": [0, 0, 0], "index": 0.2854838709677419}, {"rgb": [0, 255, 0], "index": 0.28588920790407024}, {"rgb": [0, 0, 0], "index": 0.28629454484039857}, {"rgb": [0, 0, 0], "index": 0.2932232730957609}, {"rgb": [0, 255, 0], "index": 0.29403816922817094}, {"rgb": [0, 0, 0], "index": 0.294853065360581}, {"rgb": [0, 0, 0], "index": 0.2978382030062489}, {"rgb": [0, 255, 0], "index": 0.29826042898159094}, {"rgb": [0, 0, 0], "index": 0.29868265495693297}, {"rgb": [0, 0, 0], "index": 0.2994764397905759}, {"rgb": [0, 255, 0], "index": 0.29961155210268536}, {"rgb": [0, 0, 0], "index": 0.2997466644147948}, {"rgb": [0, 0, 0], "index": 0.30116956595169736}, {"rgb": [0, 255, 0], "index": 0.3013426786015876}, {"rgb": [0, 0, 0], "index": 0.3015157912514778}, {"rgb": [0, 0, 0], "index": 0.3037747002195575}, {"rgb": [0, 255, 0], "index": 0.3040449248437764}, {"rgb": [0, 0, 0], "index": 0.30431514946799526}, {"rgb": [0, 0, 0], "index": 0.30795895963519676}, {"rgb": [0, 255, 0], "index": 0.308393852389799}, {"rgb": [0, 0, 0], "index": 0.30882874514440123}, {"rgb": [0, 0, 0], "index": 0.30922985982097617}, {"rgb": [0, 255, 0], "index": 0.30932274953555144}, {"rgb": [0, 0, 0], "index": 0.3094156392501267}, {"rgb": [0, 0, 0], "index": 0.3098167539267016}, {"rgb": [0, 255, 0], "index": 0.30987164330349604}, {"rgb": [0, 0, 0], "index": 0.30992653268029047}, {"rgb": [0, 0, 0], "index": 0.310403648032427}, {"rgb": [0, 255, 0], "index": 0.31046275966897485}, {"rgb": [0, 0, 0], "index": 0.3105218713055227}, {"rgb": [0, 0, 0], "index": 0.31304678263806784}, {"rgb": [0, 255, 0], "index": 0.31333389630130043}, {"rgb": [0, 0, 0], "index": 0.313621009964533}, {"rgb": [0, 0, 0], "index": 0.3137899003546698}, {"rgb": [0, 255, 0], "index": 0.31384056747171085}, {"rgb": [0, 0, 0], "index": 0.3138912345887519}, {"rgb": [0, 0, 0], "index": 0.31577858469853065}, {"rgb": [0, 255, 0], "index": 0.31599391994595505}, {"rgb": [0, 0, 0], "index": 0.31620925519337945}, {"rgb": [0, 0, 0], "index": 0.3161459212970782}, {"rgb": [0, 255, 0], "index": 0.3161628103360919}, {"rgb": [0, 0, 0], "index": 0.3161796993751056}, {"rgb": [0, 0, 0], "index": 0.31867083262962337}, {"rgb": [0, 255, 0], "index": 0.3189495017733491}, {"rgb": [0, 0, 0], "index": 0.3192281709170748}, {"rgb": [0, 0, 0], "index": 0.32122952204019595}, {"rgb": [0, 255, 0], "index": 0.32148285762540113}, {"rgb": [0, 0, 0], "index": 0.3217361932106063}, {"rgb": [0, 0, 0], "index": 0.3328449586218545}, {"rgb": [0, 255, 0], "index": 0.334107414288127}, {"rgb": [0, 0, 0], "index": 0.33536986995439955}, {"rgb": [0, 0, 0], "index": 0.33513342340820806}, {"rgb": [0, 255, 0], "index": 0.3352474244215504}, {"rgb": [0, 0, 0], "index": 0.3353614254348928}, {"rgb": [0, 0, 0], "index": 0.34455750717784156}, {"rgb": [0, 255, 0], "index": 0.3455919608174295}, {"rgb": [0, 0, 0], "index": 0.3466264144570174}, {"rgb": [0, 0, 0], "index": 0.34570596183077185}, {"rgb": [0, 255, 0], "index": 0.3457186286100321}, {"rgb": [0, 0, 0], "index": 0.34573129538929237}, {"rgb": [0, 0, 0], "index": 0.3516466813038338}, {"rgb": [0, 255, 0], "index": 0.3523053538253673}, {"rgb": [0, 0, 0], "index": 0.3529640263469008}, {"rgb": [0, 0, 0], "index": 0.35283735855429826}, {"rgb": [0, 255, 0], "index": 0.35289647019084613}, {"rgb": [0, 0, 0], "index": 0.352955581827394}, {"rgb": [0, 0, 0], "index": 0.35399847998648876}, {"rgb": [0, 255, 0], "index": 0.35412092551933794}, {"rgb": [0, 0, 0], "index": 0.3542433710521871}, {"rgb": [0, 0, 0], "index": 0.3564769464617463}, {"rgb": [0, 255, 0], "index": 0.3567387265664584}, {"rgb": [0, 0, 0], "index": 0.35700050667117045}, {"rgb": [0, 0, 0], "index": 0.3571187299442662}, {"rgb": [0, 255, 0], "index": 0.35716095254180036}, {"rgb": [0, 0, 0], "index": 0.35720317513933453}, {"rgb": [0, 0, 0], "index": 0.3574649552440466}, {"rgb": [0, 255, 0], "index": 0.357498733322074}, {"rgb": [0, 0, 0], "index": 0.3575325114001014}, {"rgb": [0, 0, 0], "index": 0.3580307380510049}, {"rgb": [0, 255, 0], "index": 0.35808984968755275}, {"rgb": [0, 0, 0], "index": 0.3581489613241006}, {"rgb": [0, 0, 0], "index": 0.35839385238979904}, {"rgb": [0, 255, 0], "index": 0.3584276304678264}, {"rgb": [0, 0, 0], "index": 0.35846140854585373}, {"rgb": [0, 0, 0], "index": 0.3593396385745651}, {"rgb": [0, 255, 0], "index": 0.3594409728086472}, {"rgb": [0, 0, 0], "index": 0.35954230704272927}, {"rgb": [0, 0, 0], "index": 0.3596309744975511}, {"rgb": [0, 255, 0], "index": 0.3596520857963182}, {"rgb": [0, 0, 0], "index": 0.3596731970950853}, {"rgb": [0, 0, 0], "index": 0.3598040871474413}, {"rgb": [0, 255, 0], "index": 0.359820976186455}, {"rgb": [0, 0, 0], "index": 0.3598378652254687}, {"rgb": [0, 0, 0], "index": 0.3624049991555481}, {"rgb": [0, 255, 0], "index": 0.3626921128187806}, {"rgb": [0, 0, 0], "index": 0.36297922648201314}, {"rgb": [0, 0, 0], "index": 0.36763215673028204}, {"rgb": [0, 255, 0], "index": 0.36818105049822664}, {"rgb": [0, 0, 0], "index": 0.36872994426617123}, {"rgb": [0, 0, 0], "index": 0.3795051511568992}, {"rgb": [0, 255, 0], "index": 0.38076338456341835}, {"rgb": [0, 0, 0], "index": 0.3820216179699375}, {"rgb": [0, 0, 0], "index": 0.38441141699037323}, {"rgb": [0, 255, 0], "index": 0.38481675392670156}, {"rgb": [0, 0, 0], "index": 0.3852220908630299}, {"rgb": [0, 0, 0], "index": 0.387514777909137}, {"rgb": [0, 255, 0], "index": 0.3878145583516298}, {"rgb": [0, 0, 0], "index": 0.3881143387941226}, {"rgb": [0, 0, 0], "index": 0.39473061982773183}, {"rgb": [0, 255, 0], "index": 0.39549907110285426}, {"rgb": [0, 0, 0], "index": 0.3962675223779767}, {"rgb": [0, 0, 0], "index": 0.3994891065698362}, {"rgb": [0, 255, 0], "index": 0.3999324438439453}, {"rgb": [0, 0, 0], "index": 0.40037578111805433}, {"rgb": [0, 0, 0], "index": 0.40221246411079203}, {"rgb": [0, 255, 0], "index": 0.4024657996959973}, {"rgb": [0, 0, 0], "index": 0.4027191352812025}, {"rgb": [0, 0, 0], "index": 0.407367843269718}, {"rgb": [0, 255, 0], "index": 0.40791251477790913}, {"rgb": [0, 0, 0], "index": 0.4084571862861003}, {"rgb": [0, 0, 0], "index": 0.41433457186286105}, {"rgb": [0, 255, 0], "index": 0.415048133761189}, {"rgb": [0, 0, 0], "index": 0.4157616956595169}, {"rgb": [0, 0, 0], "index": 0.41527613578787365}, {"rgb": [0, 255, 0], "index": 0.41530146934639417}, {"rgb": [0, 0, 0], "index": 0.4153268029049147}, {"rgb": [0, 0, 0], "index": 0.41742948826211784}, {"rgb": [0, 255, 0], "index": 0.4176659348083094}, {"rgb": [0, 0, 0], "index": 0.4179023813545009}, {"rgb": [0, 0, 0], "index": 0.4178559364972133}, {"rgb": [0, 255, 0], "index": 0.4178770477959804}, {"rgb": [0, 0, 0], "index": 0.4178981590947475}, {"rgb": [0, 0, 0], "index": 0.4237290998142206}, {"rgb": [0, 255, 0], "index": 0.42437932781624726}, {"rgb": [0, 0, 0], "index": 0.42502955581827395}, {"rgb": [0, 0, 0], "index": 0.4265453470697518}, {"rgb": [0, 255, 0], "index": 0.4267860158756967}, {"rgb": [0, 0, 0], "index": 0.4270266846816416}, {"rgb": [0, 0, 0], "index": 0.4336640770140179}, {"rgb": [0, 255, 0], "index": 0.4344283060293869}, {"rgb": [0, 0, 0], "index": 0.43519253504475597}, {"rgb": [0, 0, 0], "index": 0.43537831447390646}, {"rgb": [0, 255, 0], "index": 0.43548387096774194}, {"rgb": [0, 0, 0], "index": 0.4355894274615774}, {"rgb": [0, 0, 0], "index": 0.43612987671001524}, {"rgb": [0, 255, 0], "index": 0.4362016551258233}, {"rgb": [0, 0, 0], "index": 0.4362734335416314}, {"rgb": [0, 0, 0], "index": 0.43699966221921976}, {"rgb": [0, 255, 0], "index": 0.43708832967404154}, {"rgb": [0, 0, 0], "index": 0.4371769971288633}, {"rgb": [0, 0, 0], "index": 0.43910234757642297}, {"rgb": [0, 255, 0], "index": 0.4393261273433542}, {"rgb": [0, 0, 0], "index": 0.4395499071102854}, {"rgb": [0, 0, 0], "index": 0.44069413950346226}, {"rgb": [0, 255, 0], "index": 0.4408461408545854}, {"rgb": [0, 0, 0], "index": 0.44099814220570854}, {"rgb": [0, 0, 0], "index": 0.44286015875696677}, {"rgb": [0, 255, 0], "index": 0.443083938523898}, {"rgb": [0, 0, 0], "index": 0.4433077182908292}, {"rgb": [0, 0, 0], "index": 0.44456595169734847}, {"rgb": [0, 255, 0], "index": 0.4447306198277318}, {"rgb": [0, 0, 0], "index": 0.44489528795811517}, {"rgb": [0, 0, 0], "index": 0.4453006248944435}, {"rgb": [0, 255, 0], "index": 0.4453639587907448}, {"rgb": [0, 0, 0], "index": 0.4454272926870461}, {"rgb": [0, 0, 0], "index": 0.4555860496537747}, {"rgb": [0, 255, 0], "index": 0.45672183752744466}, {"rgb": [0, 0, 0], "index": 0.45785762540111463}, {"rgb": [0, 0, 0], "index": 0.45873585542982603}, {"rgb": [0, 255, 0], "index": 0.4589596351967573}, {"rgb": [0, 0, 0], "index": 0.4591834149636886}, {"rgb": [0, 0, 0], "index": 0.46268366829927376}, {"rgb": [0, 255, 0], "index": 0.4630974497551089}, {"rgb": [0, 0, 0], "index": 0.46351123121094406}, {"rgb": [0, 0, 0], "index": 0.4666694815065023}, {"rgb": [0, 255, 0], "index": 0.4670663739233238}, {"rgb": [0, 0, 0], "index": 0.4674632663401453}, {"rgb": [0, 0, 0], "index": 0.47694646174632666}, {"rgb": [0, 255, 0], "index": 0.47804424928221584}, {"rgb": [0, 0, 0], "index": 0.479142036818105}, {"rgb": [0, 0, 0], "index": 0.4804002702246242}, {"rgb": [0, 255, 0], "index": 0.4806620503293363}, {"rgb": [0, 0, 0], "index": 0.48092383043404835}, {"rgb": [0, 0, 0], "index": 0.4811180543827056}, {"rgb": [0, 255, 0], "index": 0.48116872149974665}, {"rgb": [0, 0, 0], "index": 0.4812193886167877}, {"rgb": [0, 0, 0], "index": 0.4830687383887857}, {"rgb": [0, 255, 0], "index": 0.4832798513764567}, {"rgb": [0, 0, 0], "index": 0.48349096436412764}, {"rgb": [0, 0, 0], "index": 0.4843058604965378}, {"rgb": [0, 255, 0], "index": 0.4844198615098801}, {"rgb": [0, 0, 0], "index": 0.4845338625232224}, {"rgb": [0, 0, 0], "index": 0.49779598040871476}, {"rgb": [0, 255, 0], "index": 0.4992822158419186}, {"rgb": [0, 0, 0], "index": 0.5007684512751225}, {"rgb": [0, 0, 0], "index": 0.509238304340483}, {"rgb": [0, 255, 0], "index": 0.5103445363958791}, {"rgb": [0, 0, 0], "index": 0.5114507684512751}, {"rgb": [0, 0, 0], "index": 0.5123585542982605}, {"rgb": [0, 255, 0], "index": 0.5125823340651917}, {"rgb": [0, 0, 0], "index": 0.5128061138321229}, {"rgb": [0, 0, 0], "index": 0.5140643472386421}, {"rgb": [0, 255, 0], "index": 0.5142290153690255}, {"rgb": [0, 0, 0], "index": 0.514393683499409}, {"rgb": [0, 0, 0], "index": 0.5185990542138154}, {"rgb": [0, 255, 0], "index": 0.5190846140854586}, {"rgb": [0, 0, 0], "index": 0.5195701739571018}, {"rgb": [0, 0, 0], "index": 0.5218586387434555}, {"rgb": [0, 255, 0], "index": 0.5221668637054552}, {"rgb": [0, 0, 0], "index": 0.5224750886674548}, {"rgb": [0, 0, 0], "index": 0.5223568653943591}, {"rgb": [0, 255, 0], "index": 0.5223779766931261}, {"rgb": [0, 0, 0], "index": 0.5223990879918932}, {"rgb": [0, 0, 0], "index": 0.5232519844620841}, {"rgb": [0, 255, 0], "index": 0.5233490964364128}, {"rgb": [0, 0, 0], "index": 0.5234462084107415}, {"rgb": [0, 0, 0], "index": 0.5255151156899172}, {"rgb": [0, 255, 0], "index": 0.5257557844958621}, {"rgb": [0, 0, 0], "index": 0.5259964533018071}, {"rgb": [0, 0, 0], "index": 0.5265537915892585}, {"rgb": [0, 255, 0], "index": 0.5266424590440804}, {"rgb": [0, 0, 0], "index": 0.5267311264989022}, {"rgb": [0, 0, 0], "index": 0.528618476608681}, {"rgb": [0, 255, 0], "index": 0.5288380341158588}, {"rgb": [0, 0, 0], "index": 0.5290575916230367}, {"rgb": [0, 0, 0], "index": 0.5368181050498226}, {"rgb": [0, 255, 0], "index": 0.5377047795980409}, {"rgb": [0, 0, 0], "index": 0.5385914541462591}, {"rgb": [0, 0, 0], "index": 0.5386167877047796}, {"rgb": [0, 255, 0], "index": 0.5387181219388617}, {"rgb": [0, 0, 0], "index": 0.5388194561729438}, {"rgb": [0, 0, 0], "index": 0.5404661374767776}, {"rgb": [0, 255, 0], "index": 0.5406603614254349}, {"rgb": [0, 0, 0], "index": 0.5408545853740923}, {"rgb": [0, 0, 0], "index": 0.5415723695321736}, {"rgb": [0, 255, 0], "index": 0.5416737037662557}, {"rgb": [0, 0, 0], "index": 0.5417750380003378}, {"rgb": [0, 0, 0], "index": 0.5496917750380004}, {"rgb": [0, 255, 0], "index": 0.550582671845972}, {"rgb": [0, 0, 0], "index": 0.5514735686539436}, {"rgb": [0, 0, 0], "index": 0.5546487079885155}, {"rgb": [0, 255, 0], "index": 0.5551004897821314}, {"rgb": [0, 0, 0], "index": 0.5555522715757474}, {"rgb": [0, 0, 0], "index": 0.5562785002533356}, {"rgb": [0, 255, 0], "index": 0.5564093903056916}, {"rgb": [0, 0, 0], "index": 0.5565402803580476}, {"rgb": [0, 0, 0], "index": 0.5577014017902382}, {"rgb": [0, 255, 0], "index": 0.5578449586218545}, {"rgb": [0, 0, 0], "index": 0.5579885154534707}, {"rgb": [0, 0, 0], "index": 0.5584529640263469}, {"rgb": [0, 255, 0], "index": 0.5585205201824016}, {"rgb": [0, 0, 0], "index": 0.5585880763384563}, {"rgb": [0, 0, 0], "index": 0.5591285255868942}, {"rgb": [0, 255, 0], "index": 0.5591960817429489}, {"rgb": [0, 0, 0], "index": 0.5592636378990036}, {"rgb": [0, 0, 0], "index": 0.5607160952541801}, {"rgb": [0, 255, 0], "index": 0.5608849856443169}, {"rgb": [0, 0, 0], "index": 0.5610538760344537}, {"rgb": [0, 0, 0], "index": 0.562062996115521}, {"rgb": [0, 255, 0], "index": 0.562193886167877}, {"rgb": [0, 0, 0], "index": 0.562324776220233}, {"rgb": [0, 0, 0], "index": 0.5624218881945617}, {"rgb": [0, 255, 0], "index": 0.5624472217530823}, {"rgb": [0, 0, 0], "index": 0.5624725553116028}, {"rgb": [0, 0, 0], "index": 0.5742273264651241}, {"rgb": [0, 255, 0], "index": 0.5755362269886843}, {"rgb": [0, 0, 0], "index": 0.5768451275122446}, {"rgb": [0, 0, 0], "index": 0.5757642290153691}, {"rgb": [0, 255, 0], "index": 0.5757895625738896}, {"rgb": [0, 0, 0], "index": 0.5758148961324101}, {"rgb": [0, 0, 0], "index": 0.5785255868941058}, {"rgb": [0, 255, 0], "index": 0.578829589596352}, {"rgb": [0, 0, 0], "index": 0.5791335922985982}, {"rgb": [0, 0, 0], "index": 0.5799695997297755}, {"rgb": [0, 255, 0], "index": 0.580096267522378}, {"rgb": [0, 0, 0], "index": 0.5802229353149805}, {"rgb": [0, 0, 0], "index": 0.5805902719135281}, {"rgb": [0, 255, 0], "index": 0.5806451612903226}, {"rgb": [0, 0, 0], "index": 0.5807000506671172}, {"rgb": [0, 0, 0], "index": 0.5847871981084277}, {"rgb": [0, 255, 0], "index": 0.5852474244215504}, {"rgb": [0, 0, 0], "index": 0.5857076507346731}, {"rgb": [0, 0, 0], "index": 0.5855134267860158}, {"rgb": [0, 255, 0], "index": 0.5855429826042898}, {"rgb": [0, 0, 0], "index": 0.5855725384225638}, {"rgb": [0, 0, 0], "index": 0.5871769971288634}, {"rgb": [0, 255, 0], "index": 0.5873585542982604}, {"rgb": [0, 0, 0], "index": 0.5875401114676575}, {"rgb": [0, 0, 0], "index": 0.5930966053031583}, {"rgb": [0, 255, 0], "index": 0.5937341665259247}, {"rgb": [0, 0, 0], "index": 0.5943717277486911}, {"rgb": [0, 0, 0], "index": 0.5940761695659517}, {"rgb": [0, 255, 0], "index": 0.5941141699037324}, {"rgb": [0, 0, 0], "index": 0.5941521702415132}, {"rgb": [0, 0, 0], "index": 0.5971541969261949}, {"rgb": [0, 255, 0], "index": 0.5974919777064684}, {"rgb": [0, 0, 0], "index": 0.597829758486742}, {"rgb": [0, 0, 0], "index": 0.5979099814220571}, {"rgb": [0, 255, 0], "index": 0.5979564262793448}, {"rgb": [0, 0, 0], "index": 0.5980028711366324}, {"rgb": [0, 0, 0], "index": 0.605860496537747}, {"rgb": [0, 255, 0], "index": 0.6067387265664583}, {"rgb": [0, 0, 0], "index": 0.6076169565951697}, {"rgb": [0, 0, 0], "index": 0.6069287282553623}, {"rgb": [0, 255, 0], "index": 0.6069498395541294}, {"rgb": [0, 0, 0], "index": 0.6069709508528965}, {"rgb": [0, 0, 0], "index": 0.6242019929066036}, {"rgb": [0, 255, 0], "index": 0.6261188988346563}, {"rgb": [0, 0, 0], "index": 0.628035804762709}, {"rgb": [0, 0, 0], "index": 0.6321609525418004}, {"rgb": [0, 255, 0], "index": 0.6328322918425942}, {"rgb": [0, 0, 0], "index": 0.6335036311433879}, {"rgb": [0, 0, 0], "index": 0.6354163148116873}, {"rgb": [0, 255, 0], "index": 0.6357034284749198}, {"rgb": [0, 0, 0], "index": 0.6359905421381523}, {"rgb": [0, 0, 0], "index": 0.6428474919777064}, {"rgb": [0, 255, 0], "index": 0.6436412768113494}, {"rgb": [0, 0, 0], "index": 0.6444350616449924}, {"rgb": [0, 0, 0], "index": 0.6484293193717278}, {"rgb": [0, 255, 0], "index": 0.6489613241006587}, {"rgb": [0, 0, 0], "index": 0.6494933288295895}, {"rgb": [0, 0, 0], "index": 0.6499873332207398}, {"rgb": [0, 255, 0], "index": 0.6501013342340821}, {"rgb": [0, 0, 0], "index": 0.6502153352474245}, {"rgb": [0, 0, 0], "index": 0.6511273433541631}, {"rgb": [0, 255, 0], "index": 0.6512413443675055}, {"rgb": [0, 0, 0], "index": 0.6513553453808478}, {"rgb": [0, 0, 0], "index": 0.6546993751055565}, {"rgb": [0, 255, 0], "index": 0.6550836007431177}, {"rgb": [0, 0, 0], "index": 0.6554678263806788}, {"rgb": [0, 0, 0], "index": 0.6600996453301806}, {"rgb": [0, 255, 0], "index": 0.6606569836176321}, {"rgb": [0, 0, 0], "index": 0.6612143219050837}, {"rgb": [0, 0, 0], "index": 0.6660530315825031}, {"rgb": [0, 255, 0], "index": 0.6666525924674886}, {"rgb": [0, 0, 0], "index": 0.6672521533524742}, {"rgb": [0, 0, 0], "index": 0.6691606147610201}, {"rgb": [0, 255, 0], "index": 0.6694392839047458}, {"rgb": [0, 0, 0], "index": 0.6697179530484716}, {"rgb": [0, 0, 0], "index": 0.6706552947137309}, {"rgb": [0, 255, 0], "index": 0.6707904070258403}, {"rgb": [0, 0, 0], "index": 0.6709255193379496}, {"rgb": [0, 0, 0], "index": 0.670828407363621}, {"rgb": [0, 255, 0], "index": 0.6708326296233744}, {"rgb": [0, 0, 0], "index": 0.6708368518831278}, {"rgb": [0, 0, 0], "index": 0.671440635027867}, {"rgb": [0, 255, 0], "index": 0.6715081911839217}, {"rgb": [0, 0, 0], "index": 0.6715757473399764}, {"rgb": [0, 0, 0], "index": 0.6715461915217025}, {"rgb": [0, 255, 0], "index": 0.6715504137814559}, {"rgb": [0, 0, 0], "index": 0.6715546360412092}, {"rgb": [0, 0, 0], "index": 0.6727664245904408}, {"rgb": [0, 255, 0], "index": 0.6729015369025503}, {"rgb": [0, 0, 0], "index": 0.6730366492146598}, {"rgb": [0, 0, 0], "index": 0.6771575747339977}, {"rgb": [0, 255, 0], "index": 0.6776304678263807}, {"rgb": [0, 0, 0], "index": 0.6781033609187637}, {"rgb": [0, 0, 0], "index": 0.6794164837020774}, {"rgb": [0, 255, 0], "index": 0.6796149299104881}, {"rgb": [0, 0, 0], "index": 0.6798133761188988}, {"rgb": [0, 0, 0], "index": 0.6844789731464279}, {"rgb": [0, 255, 0], "index": 0.6850194223948657}, {"rgb": [0, 0, 0], "index": 0.6855598716433035}, {"rgb": [0, 0, 0], "index": 0.6922014862354332}, {"rgb": [0, 255, 0], "index": 0.6929994933288296}, {"rgb": [0, 0, 0], "index": 0.693797500422226}, {"rgb": [0, 0, 0], "index": 0.7064516129032258}, {"rgb": [0, 255, 0], "index": 0.7079462928559365}, {"rgb": [0, 0, 0], "index": 0.7094409728086472}, {"rgb": [0, 0, 0], "index": 0.714254348927546}, {"rgb": [0, 255, 0], "index": 0.7149552440466137}, {"rgb": [0, 0, 0], "index": 0.7156561391656814}, {"rgb": [0, 0, 0], "index": 0.7264693463941901}, {"rgb": [0, 255, 0], "index": 0.7277486910994765}, {"rgb": [0, 0, 0], "index": 0.7290280358047628}, {"rgb": [0, 0, 0], "index": 0.7287366998817768}, {"rgb": [0, 255, 0], "index": 0.7288464786353657}, {"rgb": [0, 0, 0], "index": 0.7289562573889545}, {"rgb": [0, 0, 0], "index": 0.7321905083600743}, {"rgb": [0, 255, 0], "index": 0.7325620672183752}, {"rgb": [0, 0, 0], "index": 0.7329336260766762}, {"rgb": [0, 0, 0], "index": 0.7326760682317176}, {"rgb": [0, 255, 0], "index": 0.7326887350109779}, {"rgb": [0, 0, 0], "index": 0.7327014017902381}, {"rgb": [0, 0, 0], "index": 0.732840736362101}, {"rgb": [0, 255, 0], "index": 0.7328576254011147}, {"rgb": [0, 0, 0], "index": 0.7328745144401283}, {"rgb": [0, 0, 0], "index": 0.7335796318189495}, {"rgb": [0, 255, 0], "index": 0.7336598547542644}, {"rgb": [0, 0, 0], "index": 0.7337400776895794}, {"rgb": [0, 0, 0], "index": 0.7421339300793786}, {"rgb": [0, 255, 0], "index": 0.7430754940043911}, {"rgb": [0, 0, 0], "index": 0.7440170579294036}, {"rgb": [0, 0, 0], "index": 0.7433034960310759}, {"rgb": [0, 255, 0], "index": 0.7433288295895963}, {"rgb": [0, 0, 0], "index": 0.7433541631481168}, {"rgb": [0, 0, 0], "index": 0.7445828407363622}, {"rgb": [0, 255, 0], "index": 0.7447221753082249}, {"rgb": [0, 0, 0], "index": 0.7448615098800877}, {"rgb": [0, 0, 0], "index": 0.7457101840905251}, {"rgb": [0, 255, 0], "index": 0.7458199628441141}, {"rgb": [0, 0, 0], "index": 0.7459297415977031}, {"rgb": [0, 0, 0], "index": 0.7469599729775376}, {"rgb": [0, 255, 0], "index": 0.7470866407701402}, {"rgb": [0, 0, 0], "index": 0.7472133085627428}, {"rgb": [0, 0, 0], "index": 0.7472006417834826}, {"rgb": [0, 255, 0], "index": 0.7472133085627428}, {"rgb": [0, 0, 0], "index": 0.7472259753420031}, {"rgb": [0, 0, 0], "index": 0.7524573551764905}, {"rgb": [0, 255, 0], "index": 0.7530400270224624}, {"rgb": [0, 0, 0], "index": 0.7536226988684344}, {"rgb": [0, 0, 0], "index": 0.7551300456004053}, {"rgb": [0, 255, 0], "index": 0.7553622698868434}, {"rgb": [0, 0, 0], "index": 0.7555944941732815}, {"rgb": [0, 0, 0], "index": 0.7573002871136632}, {"rgb": [0, 255, 0], "index": 0.7575156223610876}, {"rgb": [0, 0, 0], "index": 0.7577309576085121}, {"rgb": [0, 0, 0], "index": 0.7593396385745652}, {"rgb": [0, 255, 0], "index": 0.7595423070427293}, {"rgb": [0, 0, 0], "index": 0.7597449755108934}, {"rgb": [0, 0, 0], "index": 0.7595803073805101}, {"rgb": [0, 255, 0], "index": 0.7595845296402635}, {"rgb": [0, 0, 0], "index": 0.7595887519000168}, {"rgb": [0, 0, 0], "index": 0.7628905590271914}, {"rgb": [0, 255, 0], "index": 0.7632578956257389}, {"rgb": [0, 0, 0], "index": 0.7636252322242864}, {"rgb": [0, 0, 0], "index": 0.7693379496706637}, {"rgb": [0, 255, 0], "index": 0.770013511231211}, {"rgb": [0, 0, 0], "index": 0.7706890727917582}, {"rgb": [0, 0, 0], "index": 0.7741175477115353}, {"rgb": [0, 255, 0], "index": 0.7745735517649046}, {"rgb": [0, 0, 0], "index": 0.7750295558182739}, {"rgb": [0, 0, 0], "index": 0.7751435568316163}, {"rgb": [0, 255, 0], "index": 0.7752068907279176}, {"rgb": [0, 0, 0], "index": 0.7752702246242189}, {"rgb": [0, 0, 0], "index": 0.7787789224793109}, {"rgb": [0, 255, 0], "index": 0.7791758148961324}, {"rgb": [0, 0, 0], "index": 0.7795727073129539}, {"rgb": [0, 0, 0], "index": 0.7793658165850363}, {"rgb": [0, 255, 0], "index": 0.7793869278838034}, {"rgb": [0, 0, 0], "index": 0.7794080391825704}, {"rgb": [0, 0, 0], "index": 0.779804931599392}, {"rgb": [0, 255, 0], "index": 0.7798513764566796}, {"rgb": [0, 0, 0], "index": 0.7798978213139671}, {"rgb": [0, 0, 0], "index": 0.7800033778078028}, {"rgb": [0, 255, 0], "index": 0.7800202668468165}, {"rgb": [0, 0, 0], "index": 0.7800371558858301}, {"rgb": [0, 0, 0], "index": 0.7820722850869786}, {"rgb": [0, 255, 0], "index": 0.7823002871136633}, {"rgb": [0, 0, 0], "index": 0.782528289140348}, {"rgb": [0, 0, 0], "index": 0.7846943083938523}, {"rgb": [0, 255, 0], "index": 0.7849603107583178}, {"rgb": [0, 0, 0], "index": 0.7852263131227833}, {"rgb": [0, 0, 0], "index": 0.7874683330518494}, {"rgb": [0, 255, 0], "index": 0.787747002195575}, {"rgb": [0, 0, 0], "index": 0.7880256713393007}, {"rgb": [0, 0, 0], "index": 0.7897990204357372}, {"rgb": [0, 255, 0], "index": 0.7900270224624218}, {"rgb": [0, 0, 0], "index": 0.7902550244891065}, {"rgb": [0, 0, 0], "index": 0.790863029893599}, {"rgb": [0, 255, 0], "index": 0.7909559196081742}, {"rgb": [0, 0, 0], "index": 0.7910488093227495}, {"rgb": [0, 0, 0], "index": 0.797377976693126}, {"rgb": [0, 255, 0], "index": 0.7980915385914541}, {"rgb": [0, 0, 0], "index": 0.7988051004897821}, {"rgb": [0, 0, 0], "index": 0.8055396047964871}, {"rgb": [0, 255, 0], "index": 0.8063671677081574}, {"rgb": [0, 0, 0], "index": 0.8071947306198277}, {"rgb": [0, 0, 0], "index": 0.8070891741259922}, {"rgb": [0, 255, 0], "index": 0.8071693970613072}, {"rgb": [0, 0, 0], "index": 0.8072496199966221}, {"rgb": [0, 0, 0], "index": 0.8089554129370039}, {"rgb": [0, 255, 0], "index": 0.8091538591454146}, {"rgb": [0, 0, 0], "index": 0.8093523053538253}, {"rgb": [0, 0, 0], "index": 0.8099138659010303}, {"rgb": [0, 255, 0], "index": 0.8099983110960987}, {"rgb": [0, 0, 0], "index": 0.810082756291167}, {"rgb": [0, 0, 0], "index": 0.8110243202161797}, {"rgb": [0, 255, 0], "index": 0.811138321229522}, {"rgb": [0, 0, 0], "index": 0.8112523222428644}, {"rgb": [0, 0, 0], "index": 0.8114423239317683}, {"rgb": [0, 255, 0], "index": 0.8114761020097957}, {"rgb": [0, 0, 0], "index": 0.8115098800878231}, {"rgb": [0, 0, 0], "index": 0.8121601080898498}, {"rgb": [0, 255, 0], "index": 0.8122361087654113}, {"rgb": [0, 0, 0], "index": 0.8123121094409728}, {"rgb": [0, 0, 0], "index": 0.8123121094409729}, {"rgb": [0, 255, 0], "index": 0.8123205539604796}, {"rgb": [0, 0, 0], "index": 0.8123289984799864}, {"rgb": [0, 0, 0], "index": 0.8205666272589089}, {"rgb": [0, 255, 0], "index": 0.8214828576254011}, {"rgb": [0, 0, 0], "index": 0.8223990879918932}, {"rgb": [0, 0, 0], "index": 0.8215208579631819}, {"rgb": [0, 255, 0], "index": 0.8215250802229354}, {"rgb": [0, 0, 0], "index": 0.8215293024826889}, {"rgb": [0, 0, 0], "index": 0.8268831278500254}, {"rgb": [0, 255, 0], "index": 0.8274784664752576}, {"rgb": [0, 0, 0], "index": 0.8280738051004898}, {"rgb": [0, 0, 0], "index": 0.8283904745819962}, {"rgb": [0, 255, 0], "index": 0.8284918088160783}, {"rgb": [0, 0, 0], "index": 0.8285931430501604}, {"rgb": [0, 0, 0], "index": 0.8291378145583517}, {"rgb": [0, 255, 0], "index": 0.8292095929741597}, {"rgb": [0, 0, 0], "index": 0.8292813713899678}, {"rgb": [0, 0, 0], "index": 0.8305016044587064}, {"rgb": [0, 255, 0], "index": 0.8306451612903226}, {"rgb": [0, 0, 0], "index": 0.8307887181219389}, {"rgb": [0, 0, 0], "index": 0.8310631650059113}, {"rgb": [0, 255, 0], "index": 0.8311096098631988}, {"rgb": [0, 0, 0], "index": 0.8311560547204864}, {"rgb": [0, 0, 0], "index": 0.8317556156054721}, {"rgb": [0, 255, 0], "index": 0.8318273940212801}, {"rgb": [0, 0, 0], "index": 0.8318991724370882}, {"rgb": [0, 0, 0], "index": 0.8330814051680461}, {"rgb": [0, 255, 0], "index": 0.8332207397399088}, {"rgb": [0, 0, 0], "index": 0.8333600743117716}, {"rgb": [0, 0, 0], "index": 0.8336767437932782}, {"rgb": [0, 255, 0], "index": 0.8337274109103192}, {"rgb": [0, 0, 0], "index": 0.8337780780273603}, {"rgb": [0, 0, 0], "index": 0.8353994257726736}, {"rgb": [0, 255, 0], "index": 0.835585205201824}, {"rgb": [0, 0, 0], "index": 0.8357709846309744}, {"rgb": [0, 0, 0], "index": 0.8385872318865056}, {"rgb": [0, 255, 0], "index": 0.8389207904070258}, {"rgb": [0, 0, 0], "index": 0.839254348927546}, {"rgb": [0, 0, 0], "index": 0.8451528458030739}, {"rgb": [0, 255, 0], "index": 0.8458452964026347}, {"rgb": [0, 0, 0], "index": 0.8465377470021955}, {"rgb": [0, 0, 0], "index": 0.846643303496031}, {"rgb": [0, 255, 0], "index": 0.8467319709508528}, {"rgb": [0, 0, 0], "index": 0.8468206384056747}, {"rgb": [0, 0, 0], "index": 0.8480999831109609}, {"rgb": [0, 255, 0], "index": 0.848251984462084}, {"rgb": [0, 0, 0], "index": 0.8484039858132072}, {"rgb": [0, 0, 0], "index": 0.8507220064178349}, {"rgb": [0, 255, 0], "index": 0.8509964533018072}, {"rgb": [0, 0, 0], "index": 0.8512709001857794}, {"rgb": [0, 0, 0], "index": 0.8525164668130385}, {"rgb": [0, 255, 0], "index": 0.8526853572031752}, {"rgb": [0, 0, 0], "index": 0.8528542475933119}, {"rgb": [0, 0, 0], "index": 0.8532933626076676}, {"rgb": [0, 255, 0], "index": 0.8533609187637223}, {"rgb": [0, 0, 0], "index": 0.853428474919777}, {"rgb": [0, 0, 0], "index": 0.853930923830434}, {"rgb": [0, 255, 0], "index": 0.8539942577267353}, {"rgb": [0, 0, 0], "index": 0.8540575916230366}, {"rgb": [0, 0, 0], "index": 0.855780273602432}, {"rgb": [0, 255, 0], "index": 0.8559787198108427}, {"rgb": [0, 0, 0], "index": 0.8561771660192534}, {"rgb": [0, 0, 0], "index": 0.8615267691268367}, {"rgb": [0, 255, 0], "index": 0.862143219050836}, {"rgb": [0, 0, 0], "index": 0.8627596689748354}, {"rgb": [0, 0, 0], "index": 0.8624092214153015}, {"rgb": [0, 255, 0], "index": 0.8624387772335754}, {"rgb": [0, 0, 0], "index": 0.8624683330518493}, {"rgb": [0, 0, 0], "index": 0.8679868265495693}, {"rgb": [0, 255, 0], "index": 0.8686032764735686}, {"rgb": [0, 0, 0], "index": 0.869219726397568}, {"rgb": [0, 0, 0], "index": 0.8727833136294545}, {"rgb": [0, 255, 0], "index": 0.8732477622023307}, {"rgb": [0, 0, 0], "index": 0.8737122107752069}, {"rgb": [0, 0, 0], "index": 0.8738937679446039}, {"rgb": [0, 255, 0], "index": 0.8739655463604121}, {"rgb": [0, 0, 0], "index": 0.8740373247762203}, {"rgb": [0, 0, 0], "index": 0.8748015537915893}, {"rgb": [0, 255, 0], "index": 0.8748944435061645}, {"rgb": [0, 0, 0], "index": 0.8749873332207397}, {"rgb": [0, 0, 0], "index": 0.8754264482350955}, {"rgb": [0, 255, 0], "index": 0.8754855598716433}, {"rgb": [0, 0, 0], "index": 0.8755446715081912}, {"rgb": [0, 0, 0], "index": 0.8877216686370546}, {"rgb": [0, 255, 0], "index": 0.8890812362776558}, {"rgb": [0, 0, 0], "index": 0.890440803918257}, {"rgb": [0, 0, 0], "index": 0.8922352643134606}, {"rgb": [0, 255, 0], "index": 0.8925857118729944}, {"rgb": [0, 0, 0], "index": 0.8929361594325282}, {"rgb": [0, 0, 0], "index": 0.8967657490288803}, {"rgb": [0, 255, 0], "index": 0.8972301976017565}, {"rgb": [0, 0, 0], "index": 0.8976946461746327}, {"rgb": [0, 0, 0], "index": 0.9046022631312278}, {"rgb": [0, 255, 0], "index": 0.9054213815233914}, {"rgb": [0, 0, 0], "index": 0.9062404999155549}, {"rgb": [0, 0, 0], "index": 0.9097154196926195}, {"rgb": [0, 255, 0], "index": 0.910192535044756}, {"rgb": [0, 0, 0], "index": 0.9106696503968924}, {"rgb": [0, 0, 0], "index": 0.9165385914541462}, {"rgb": [0, 255, 0], "index": 0.9172437088329674}, {"rgb": [0, 0, 0], "index": 0.9179488262117885}, {"rgb": [0, 0, 0], "index": 0.9173957101840906}, {"rgb": [0, 255, 0], "index": 0.9174125992231043}, {"rgb": [0, 0, 0], "index": 0.9174294882621179}, {"rgb": [0, 0, 0], "index": 0.9225426448235096}, {"rgb": [0, 255, 0], "index": 0.9231126498902212}, {"rgb": [0, 0, 0], "index": 0.9236826549569329}, {"rgb": [0, 0, 0], "index": 0.9246706637392331}, {"rgb": [0, 255, 0], "index": 0.9248437763891234}, {"rgb": [0, 0, 0], "index": 0.9250168890390137}, {"rgb": [0, 0, 0], "index": 0.9257177841580815}, {"rgb": [0, 255, 0], "index": 0.9258148961324101}, {"rgb": [0, 0, 0], "index": 0.9259120081067387}, {"rgb": [0, 0, 0], "index": 0.9330349603107584}, {"rgb": [0, 255, 0], "index": 0.9338371896639082}, {"rgb": [0, 0, 0], "index": 0.9346394190170579}, {"rgb": [0, 0, 0], "index": 0.9371052187130553}, {"rgb": [0, 255, 0], "index": 0.9374683330518494}, {"rgb": [0, 0, 0], "index": 0.9378314473906435}, {"rgb": [0, 0, 0], "index": 0.9378483364296571}, {"rgb": [0, 255, 0], "index": 0.9378905590271913}, {"rgb": [0, 0, 0], "index": 0.9379327816247255}, {"rgb": [0, 0, 0], "index": 0.9433626076676237}, {"rgb": [0, 255, 0], "index": 0.9439706130721162}, {"rgb": [0, 0, 0], "index": 0.9445786184766086}, {"rgb": [0, 0, 0], "index": 0.9482266509035635}, {"rgb": [0, 255, 0], "index": 0.9486995439959466}, {"rgb": [0, 0, 0], "index": 0.9491724370883297}, {"rgb": [0, 0, 0], "index": 0.9505615605472049}, {"rgb": [0, 255, 0], "index": 0.9507684512751224}, {"rgb": [0, 0, 0], "index": 0.95097534200304}, {"rgb": [0, 0, 0], "index": 0.9541504813376119}, {"rgb": [0, 255, 0], "index": 0.9545262624556663}, {"rgb": [0, 0, 0], "index": 0.9549020435737207}, {"rgb": [0, 0, 0], "index": 0.956806282722513}, {"rgb": [0, 255, 0], "index": 0.9570596183077182}, {"rgb": [0, 0, 0], "index": 0.9573129538929235}, {"rgb": [0, 0, 0], "index": 0.9597196419523729}, {"rgb": [0, 255, 0], "index": 0.9600152001351123}, {"rgb": [0, 0, 0], "index": 0.9603107583178517}, {"rgb": [0, 0, 0], "index": 0.9815993919945956}, {"rgb": [0, 255, 0], "index": 0.9839976355345381}, {"rgb": [0, 0, 0], "index": 0.9863958790744807}, {"rgb": [0, 0, 0], "index": 0.987113663232562}, {"rgb": [0, 255, 0], "index": 0.9874598885323425}, {"rgb": [0, 0, 0], "index": 0.9878061138321229}, {"rgb": [0, 0, 0], "index": 1}],
	
	"sadness": [{"index": 0, "rgb": [0, 0, 0]}, {"index": 0.010450092889714576, "rgb": [0, 0, 0]}, {"index": 0.011611214321905084, "rgb": [0, 0, 255]}, {"index": 0.012772335754095593, "rgb": [0, 0, 0]}, {"index": 0.02361932106063165, "rgb": [0, 0, 0]}, {"index": 0.02495355514271238, "rgb": [0, 0, 255]}, {"index": 0.026287789224793107, "rgb": [0, 0, 0]}, {"index": 0.028107583178517144, "rgb": [0, 0, 0]}, {"index": 0.028458030738051004, "rgb": [0, 0, 255]}, {"index": 0.028808478297584865, "rgb": [0, 0, 0]}, {"index": 0.03043404830265158, "rgb": [0, 0, 0]}, {"index": 0.03065360580982942, "rgb": [0, 0, 255]}, {"index": 0.03087316331700726, "rgb": [0, 0, 0]}, {"index": 0.03072960648539098, "rgb": [0, 0, 0]}, {"index": 0.03073805100489782, "rgb": [0, 0, 255]}, {"index": 0.03074649552440466, "rgb": [0, 0, 0]}, {"index": 0.032182063840567474, "rgb": [0, 0, 0]}, {"index": 0.03234250971119743, "rgb": [0, 0, 255]}, {"index": 0.03250295558182739, "rgb": [0, 0, 0]}, {"index": 0.032760513426786014, "rgb": [0, 0, 0]}, {"index": 0.03280695828407364, "rgb": [0, 0, 255]}, {"index": 0.03285340314136126, "rgb": [0, 0, 0]}, {"index": 0.0336429657152508, "rgb": [0, 0, 0]}, {"index": 0.033735855429826045, "rgb": [0, 0, 255]}, {"index": 0.03382874514440129, "rgb": [0, 0, 0]}, {"index": 0.03502786691437257, "rgb": [0, 0, 0]}, {"index": 0.035171423745988854, "rgb": [0, 0, 255]}, {"index": 0.03531498057760514, "rgb": [0, 0, 0]}, {"index": 0.03532342509711198, "rgb": [0, 0, 0]}, {"index": 0.03534031413612566, "rgb": [0, 0, 255]}, {"index": 0.03535720317513934, "rgb": [0, 0, 0]}, {"index": 0.0356443168383719, "rgb": [0, 0, 0]}, {"index": 0.035678094916399256, "rgb": [0, 0, 255]}, {"index": 0.03571187299442661, "rgb": [0, 0, 0]}, {"index": 0.03947812869447729, "rgb": [0, 0, 0]}, {"index": 0.03990035466981929, "rgb": [0, 0, 255]}, {"index": 0.04032258064516129, "rgb": [0, 0, 0]}, {"index": 0.040014355683161626, "rgb": [0, 0, 0]}, {"index": 0.04002702246242189, "rgb": [0, 0, 255]}, {"index": 0.04003968924168215, "rgb": [0, 0, 0]}, {"index": 0.04010302313798345, "rgb": [0, 0, 0]}, {"index": 0.04011146765749029, "rgb": [0, 0, 255]}, {"index": 0.040119912176997126, "rgb": [0, 0, 0]}, {"index": 0.04166948150650228, "rgb": [0, 0, 0]}, {"index": 0.0418425941563925, "rgb": [0, 0, 255]}, {"index": 0.04201570680628272, "rgb": [0, 0, 0]}, {"index": 0.04290660361425435, "rgb": [0, 0, 0]}, {"index": 0.04302482688735011, "rgb": [0, 0, 255]}, {"index": 0.043143050160445874, "rgb": [0, 0, 0]}, {"index": 0.04621685526093565, "rgb": [0, 0, 0]}, {"index": 0.046571525080222935, "rgb": [0, 0, 255]}, {"index": 0.04692619489951022, "rgb": [0, 0, 0]}, {"index": 0.04778753588920791, "rgb": [0, 0, 0]}, {"index": 0.04792264820131734, "rgb": [0, 0, 255]}, {"index": 0.04805776051342678, "rgb": [0, 0, 0]}, {"index": 0.048036649214659694, "rgb": [0, 0, 0]}, {"index": 0.04804931599391995, "rgb": [0, 0, 255]}, {"index": 0.048061982773180204, "rgb": [0, 0, 0]}, {"index": 0.06142543489275461, "rgb": [0, 0, 0]}, {"index": 0.06291167032595846, "rgb": [0, 0, 255]}, {"index": 0.06439790575916231, "rgb": [0, 0, 0]}, {"index": 0.06313967235264313, "rgb": [0, 0, 0]}, {"index": 0.06316500591116365, "rgb": [0, 0, 255]}, {"index": 0.06319033946968418, "rgb": [0, 0, 0]}, {"index": 0.06574902888025672, "rgb": [0, 0, 0]}, {"index": 0.06603614254348927, "rgb": [0, 0, 255]}, {"index": 0.06632325620672183, "rgb": [0, 0, 0]}, {"index": 0.06911416990373248, "rgb": [0, 0, 0]}, {"index": 0.0694561729437595, "rgb": [0, 0, 255]}, {"index": 0.06979817598378651, "rgb": [0, 0, 0]}, {"index": 0.07086218544164838, "rgb": [0, 0, 0]}, {"index": 0.0710184090525249, "rgb": [0, 0, 255]}, {"index": 0.07117463266340143, "rgb": [0, 0, 0]}, {"index": 0.07227242019929067, "rgb": [0, 0, 0]}, {"index": 0.07241175477115352, "rgb": [0, 0, 255]}, {"index": 0.07255108934301638, "rgb": [0, 0, 0]}, {"index": 0.0732097618645499, "rgb": [0, 0, 0]}, {"index": 0.07329842931937172, "rgb": [0, 0, 255]}, {"index": 0.07338709677419354, "rgb": [0, 0, 0]}, {"index": 0.0733744299949333, "rgb": [0, 0, 0]}, {"index": 0.07338287451444013, "rgb": [0, 0, 255]}, {"index": 0.07339131903394697, "rgb": [0, 0, 0]}, {"index": 0.07581489613241008, "rgb": [0, 0, 0]}, {"index": 0.07608512075662895, "rgb": [0, 0, 255]}, {"index": 0.07635534538084782, "rgb": [0, 0, 0]}, {"index": 0.07665512582334065, "rgb": [0, 0, 0]}, {"index": 0.07671845971964195, "rgb": [0, 0, 255]}, {"index": 0.07678179361594324, "rgb": [0, 0, 0]}, {"index": 0.08215250802229354, "rgb": [0, 0, 0]}, {"index": 0.08275629116703259, "rgb": [0, 0, 255]}, {"index": 0.08336007431177164, "rgb": [0, 0, 0]}, {"index": 0.0829462928559365, "rgb": [0, 0, 0]}, {"index": 0.08296740415470359, "rgb": [0, 0, 255]}, {"index": 0.08298851545347069, "rgb": [0, 0, 0]}, {"index": 0.08361340989697687, "rgb": [0, 0, 0]}, {"index": 0.083685188312785, "rgb": [0, 0, 255]}, {"index": 0.08375696672859313, "rgb": [0, 0, 0]}, {"index": 0.08471119743286606, "rgb": [0, 0, 0]}, {"index": 0.08482519844620841, "rgb": [0, 0, 255]}, {"index": 0.08493919945955075, "rgb": [0, 0, 0]}, {"index": 0.08763722344198616, "rgb": [0, 0, 0]}, {"index": 0.08794967066373924, "rgb": [0, 0, 255]}, {"index": 0.08826211788549232, "rgb": [0, 0, 0]}, {"index": 0.08829167370376625, "rgb": [0, 0, 0]}, {"index": 0.08832967404154704, "rgb": [0, 0, 255]}, {"index": 0.08836767437932783, "rgb": [0, 0, 0]}, {"index": 0.08886167877047797, "rgb": [0, 0, 0]}, {"index": 0.08892079040702584, "rgb": [0, 0, 255]}, {"index": 0.08897990204357371, "rgb": [0, 0, 0]}, {"index": 0.09173281540280359, "rgb": [0, 0, 0]}, {"index": 0.09204526262455666, "rgb": [0, 0, 255]}, {"index": 0.09235770984630973, "rgb": [0, 0, 0]}, {"index": 0.09360327647356864, "rgb": [0, 0, 0]}, {"index": 0.09377638912345887, "rgb": [0, 0, 255]}, {"index": 0.0939495017733491, "rgb": [0, 0, 0]}, {"index": 0.10171845971964195, "rgb": [0, 0, 0]}, {"index": 0.10260091200810674, "rgb": [0, 0, 255]}, {"index": 0.10348336429657153, "rgb": [0, 0, 0]}, {"index": 0.1034369194392839, "rgb": [0, 0, 0]}, {"index": 0.10352980915385915, "rgb": [0, 0, 255]}, {"index": 0.10362269886843439, "rgb": [0, 0, 0]}, {"index": 0.10368181050498228, "rgb": [0, 0, 0]}, {"index": 0.10369869954399595, "rgb": [0, 0, 255]}, {"index": 0.10371558858300962, "rgb": [0, 0, 0]}, {"index": 0.10385070089511907, "rgb": [0, 0, 0]}, {"index": 0.10386758993413275, "rgb": [0, 0, 255]}, {"index": 0.10388447897314644, "rgb": [0, 0, 0]}, {"index": 0.10470359736530992, "rgb": [0, 0, 0]}, {"index": 0.10479648707988515, "rgb": [0, 0, 255]}, {"index": 0.10488937679446038, "rgb": [0, 0, 0]}, {"index": 0.10536649214659685, "rgb": [0, 0, 0]}, {"index": 0.10542982604289816, "rgb": [0, 0, 255]}, {"index": 0.10549315993919947, "rgb": [0, 0, 0]}, {"index": 0.10592383043404831, "rgb": [0, 0, 0]}, {"index": 0.10597871981084277, "rgb": [0, 0, 255]}, {"index": 0.10603360918763723, "rgb": [0, 0, 0]}, {"index": 0.10605472048640432, "rgb": [0, 0, 0]}, {"index": 0.10606316500591116, "rgb": [0, 0, 255]}, {"index": 0.106071609525418, "rgb": [0, 0, 0]}, {"index": 0.10686117209930755, "rgb": [0, 0, 0]}, {"index": 0.10694983955412937, "rgb": [0, 0, 255]}, {"index": 0.10703850700895119, "rgb": [0, 0, 0]}, {"index": 0.10812785002533357, "rgb": [0, 0, 0]}, {"index": 0.10825874007768958, "rgb": [0, 0, 255]}, {"index": 0.1083896301300456, "rgb": [0, 0, 0]}, {"index": 0.10939875021111298, "rgb": [0, 0, 0]}, {"index": 0.10952541800371558, "rgb": [0, 0, 255]}, {"index": 0.10965208579631819, "rgb": [0, 0, 0]}, {"index": 0.11093143050160446, "rgb": [0, 0, 0]}, {"index": 0.111087654112481, "rgb": [0, 0, 255]}, {"index": 0.11124387772335755, "rgb": [0, 0, 0]}, {"index": 0.11177166019253505, "rgb": [0, 0, 0]}, {"index": 0.11184766086809661, "rgb": [0, 0, 255]}, {"index": 0.11192366154365817, "rgb": [0, 0, 0]}, {"index": 0.11313967235264313, "rgb": [0, 0, 0]}, {"index": 0.11328322918425941, "rgb": [0, 0, 255]}, {"index": 0.11342678601587569, "rgb": [0, 0, 0]}, {"index": 0.11370123289984801, "rgb": [0, 0, 0]}, {"index": 0.11374767775713562, "rgb": [0, 0, 255]}, {"index": 0.11379412261442323, "rgb": [0, 0, 0]}, {"index": 0.11481168721499746, "rgb": [0, 0, 0]}, {"index": 0.11492991048809323, "rgb": [0, 0, 255]}, {"index": 0.115048133761189, "rgb": [0, 0, 0]}, {"index": 0.11534791420368182, "rgb": [0, 0, 0]}, {"index": 0.11539435906096943, "rgb": [0, 0, 255]}, {"index": 0.11544080391825703, "rgb": [0, 0, 0]}, {"index": 0.11695237290998142, "rgb": [0, 0, 0]}, {"index": 0.11712548555987164, "rgb": [0, 0, 255]}, {"index": 0.11729859820976185, "rgb": [0, 0, 0]}, {"index": 0.11750548893767945, "rgb": [0, 0, 0]}, {"index": 0.11754771153521365, "rgb": [0, 0, 255]}, {"index": 0.11758993413274785, "rgb": [0, 0, 0]}, {"index": 0.12066373923323764, "rgb": [0, 0, 0]}, {"index": 0.12100996453301807, "rgb": [0, 0, 255]}, {"index": 0.1213561898327985, "rgb": [0, 0, 0]}, {"index": 0.12169397061307213, "rgb": [0, 0, 0]}, {"index": 0.12176997128863368, "rgb": [0, 0, 255]}, {"index": 0.12184597196419522, "rgb": [0, 0, 0]}, {"index": 0.12287198108427631, "rgb": [0, 0, 0]}, {"index": 0.12299442661712548, "rgb": [0, 0, 255]}, {"index": 0.12311687214997465, "rgb": [0, 0, 0]}, {"index": 0.12314642796824861, "rgb": [0, 0, 0]}, {"index": 0.12316331700726228, "rgb": [0, 0, 255]}, {"index": 0.12318020604627596, "rgb": [0, 0, 0]}, {"index": 0.12380932274953554, "rgb": [0, 0, 0]}, {"index": 0.12388110116534369, "rgb": [0, 0, 255]}, {"index": 0.12395287958115184, "rgb": [0, 0, 0]}, {"index": 0.12619912176997128, "rgb": [0, 0, 0]}, {"index": 0.1264566796149299, "rgb": [0, 0, 255]}, {"index": 0.12671423745988852, "rgb": [0, 0, 0]}, {"index": 0.12698868434386085, "rgb": [0, 0, 0]}, {"index": 0.12704779598040872, "rgb": [0, 0, 255]}, {"index": 0.1271069076169566, "rgb": [0, 0, 0]}, {"index": 0.1273137983448742, "rgb": [0, 0, 0]}, {"index": 0.12734335416314813, "rgb": [0, 0, 255]}, {"index": 0.12737290998142206, "rgb": [0, 0, 0]}, {"index": 0.12867336598547544, "rgb": [0, 0, 0]}, {"index": 0.12882114507684514, "rgb": [0, 0, 255]}, {"index": 0.12896892416821484, "rgb": [0, 0, 0]}, {"index": 0.14029724708664076, "rgb": [0, 0, 0]}, {"index": 0.14157236953217361, "rgb": [0, 0, 255]}, {"index": 0.14284749197770646, "rgb": [0, 0, 0]}, {"index": 0.14339638574565108, "rgb": [0, 0, 0]}, {"index": 0.14359905421381525, "rgb": [0, 0, 255]}, {"index": 0.1438017226819794, "rgb": [0, 0, 0]}, {"index": 0.1488431008275629, "rgb": [0, 0, 0]}, {"index": 0.14942577267353488, "rgb": [0, 0, 255]}, {"index": 0.15000844451950684, "rgb": [0, 0, 0]}, {"index": 0.15033778078027363, "rgb": [0, 0, 0]}, {"index": 0.1504391150143557, "rgb": [0, 0, 255]}, {"index": 0.15054044924843776, "rgb": [0, 0, 0]}, {"index": 0.15192112818780612, "rgb": [0, 0, 0]}, {"index": 0.1520857963181895, "rgb": [0, 0, 255]}, {"index": 0.15225046444857288, "rgb": [0, 0, 0]}, {"index": 0.15238979902043576, "rgb": [0, 0, 0]}, {"index": 0.1524235770984631, "rgb": [0, 0, 255]}, {"index": 0.15245735517649045, "rgb": [0, 0, 0]}, {"index": 0.1528035804762709, "rgb": [0, 0, 0]}, {"index": 0.1528458030738051, "rgb": [0, 0, 255]}, {"index": 0.1528880256713393, "rgb": [0, 0, 0]}, {"index": 0.15303580476270898, "rgb": [0, 0, 0]}, {"index": 0.1530569160614761, "rgb": [0, 0, 255]}, {"index": 0.1530780273602432, "rgb": [0, 0, 0]}, {"index": 0.1534749197770647, "rgb": [0, 0, 0]}, {"index": 0.15352136463435231, "rgb": [0, 0, 255]}, {"index": 0.15356780949163992, "rgb": [0, 0, 0]}, {"index": 0.1639334571862861, "rgb": [0, 0, 0]}, {"index": 0.16509035635872318, "rgb": [0, 0, 255]}, {"index": 0.16624725553116027, "rgb": [0, 0, 0]}, {"index": 0.17322242864381016, "rgb": [0, 0, 0]}, {"index": 0.17412599223104205, "rgb": [0, 0, 255]}, {"index": 0.17502955581827395, "rgb": [0, 0, 0]}, {"index": 0.17994004391150142, "rgb": [0, 0, 0]}, {"index": 0.1805860496537747, "rgb": [0, 0, 255]}, {"index": 0.18123205539604798, "rgb": [0, 0, 0]}, {"index": 0.18089005235602096, "rgb": [0, 0, 0]}, {"index": 0.1809238304340483, "rgb": [0, 0, 255]}, {"index": 0.18095760851207565, "rgb": [0, 0, 0]}, {"index": 0.18502786691437256, "rgb": [0, 0, 0]}, {"index": 0.18548387096774194, "rgb": [0, 0, 255]}, {"index": 0.1859398750211113, "rgb": [0, 0, 0]}, {"index": 0.18742188819456174, "rgb": [0, 0, 0]}, {"index": 0.18763722344198616, "rgb": [0, 0, 255]}, {"index": 0.1878525586894106, "rgb": [0, 0, 0]}, {"index": 0.18972724201992908, "rgb": [0, 0, 0]}, {"index": 0.18995946630636718, "rgb": [0, 0, 255]}, {"index": 0.19019169059280527, "rgb": [0, 0, 0]}, {"index": 0.19014946799527108, "rgb": [0, 0, 0]}, {"index": 0.19017057929403816, "rgb": [0, 0, 255]}, {"index": 0.19019169059280525, "rgb": [0, 0, 0]}, {"index": 0.19332460732984294, "rgb": [0, 0, 0]}, {"index": 0.1936750548893768, "rgb": [0, 0, 255]}, {"index": 0.19402550244891067, "rgb": [0, 0, 0]}, {"index": 0.19584107414288127, "rgb": [0, 0, 0]}, {"index": 0.19608174294882622, "rgb": [0, 0, 255]}, {"index": 0.19632241175477116, "rgb": [0, 0, 0]}, {"index": 0.19619574396216855, "rgb": [0, 0, 0]}, {"index": 0.1962084107414288, "rgb": [0, 0, 255]}, {"index": 0.19622107752068907, "rgb": [0, 0, 0]}, {"index": 0.2018704610707651, "rgb": [0, 0, 0]}, {"index": 0.20249957777402466, "rgb": [0, 0, 255]}, {"index": 0.20312869447728424, "rgb": [0, 0, 0]}, {"index": 0.20265157912514778, "rgb": [0, 0, 0]}, {"index": 0.20266846816416145, "rgb": [0, 0, 255]}, {"index": 0.20268535720317513, "rgb": [0, 0, 0]}, {"index": 0.20441648370207732, "rgb": [0, 0, 0]}, {"index": 0.20461070765073466, "rgb": [0, 0, 255]}, {"index": 0.204804931599392, "rgb": [0, 0, 0]}, {"index": 0.20472470866407702, "rgb": [0, 0, 0]}, {"index": 0.20473737544333728, "rgb": [0, 0, 255]}, {"index": 0.20475004222259754, "rgb": [0, 0, 0]}, {"index": 0.2066373923323763, "rgb": [0, 0, 0]}, {"index": 0.20684850532004728, "rgb": [0, 0, 255]}, {"index": 0.20705961830771827, "rgb": [0, 0, 0]}, {"index": 0.2081405168045938, "rgb": [0, 0, 0]}, {"index": 0.2082840736362101, "rgb": [0, 0, 255]}, {"index": 0.2084276304678264, "rgb": [0, 0, 0]}, {"index": 0.2107920959297416, "rgb": [0, 0, 0]}, {"index": 0.2110707650734673, "rgb": [0, 0, 255]}, {"index": 0.21134943421719302, "rgb": [0, 0, 0]}, {"index": 0.21160276980239823, "rgb": [0, 0, 0]}, {"index": 0.21166188143894613, "rgb": [0, 0, 255]}, {"index": 0.21172099307549402, "rgb": [0, 0, 0]}, {"index": 0.21245988853234252, "rgb": [0, 0, 0]}, {"index": 0.21254855598716432, "rgb": [0, 0, 255]}, {"index": 0.21263722344198613, "rgb": [0, 0, 0]}, {"index": 0.21372656645836852, "rgb": [0, 0, 0]}, {"index": 0.21385745651072455, "rgb": [0, 0, 255]}, {"index": 0.21398834656308058, "rgb": [0, 0, 0]}, {"index": 0.21419945955075156, "rgb": [0, 0, 0]}, {"index": 0.21423745988853235, "rgb": [0, 0, 255]}, {"index": 0.21427546022631314, "rgb": [0, 0, 0]}, {"index": 0.21796149299104883, "rgb": [0, 0, 0]}, {"index": 0.21837527444688398, "rgb": [0, 0, 255]}, {"index": 0.21878905590271913, "rgb": [0, 0, 0]}, {"index": 0.21856527613578786, "rgb": [0, 0, 0]}, {"index": 0.21858638743455497, "rgb": [0, 0, 255]}, {"index": 0.21860749873332208, "rgb": [0, 0, 0]}, {"index": 0.22117041040364804, "rgb": [0, 0, 0]}, {"index": 0.2214575240668806, "rgb": [0, 0, 255]}, {"index": 0.22174463773011316, "rgb": [0, 0, 0]}, {"index": 0.22179952710690762, "rgb": [0, 0, 0]}, {"index": 0.2218375274446884, "rgb": [0, 0, 255]}, {"index": 0.2218755277824692, "rgb": [0, 0, 0]}, {"index": 0.223813545009289, "rgb": [0, 0, 0]}, {"index": 0.22403310251646683, "rgb": [0, 0, 255]}, {"index": 0.22425266002364466, "rgb": [0, 0, 0]}, {"index": 0.2250971119743287, "rgb": [0, 0, 0]}, {"index": 0.22521533524742443, "rgb": [0, 0, 255]}, {"index": 0.22533355852052017, "rgb": [0, 0, 0]}, {"index": 0.2253293362607668, "rgb": [0, 0, 0]}, {"index": 0.22534200304002702, "rgb": [0, 0, 255]}, {"index": 0.22535466981928726, "rgb": [0, 0, 0]}, {"index": 0.22583600743117715, "rgb": [0, 0, 0]}, {"index": 0.22589089680797161, "rgb": [0, 0, 255]}, {"index": 0.22594578618476607, "rgb": [0, 0, 0]}, {"index": 0.226004897821314, "rgb": [0, 0, 0]}, {"index": 0.22601756460057423, "rgb": [0, 0, 255]}, {"index": 0.22603023137983447, "rgb": [0, 0, 0]}, {"index": 0.22723357540955919, "rgb": [0, 0, 0]}, {"index": 0.22736868772166863, "rgb": [0, 0, 255]}, {"index": 0.22750380003377807, "rgb": [0, 0, 0]}, {"index": 0.2290027022462422, "rgb": [0, 0, 0]}, {"index": 0.22918425941563925, "rgb": [0, 0, 255]}, {"index": 0.2293658165850363, "rgb": [0, 0, 0]}, {"index": 0.22929826042898158, "rgb": [0, 0, 0]}, {"index": 0.22931092720824184, "rgb": [0, 0, 255]}, {"index": 0.2293235939875021, "rgb": [0, 0, 0]}, {"index": 0.22988093227495357, "rgb": [0, 0, 0]}, {"index": 0.22994426617125485, "rgb": [0, 0, 255]}, {"index": 0.23000760006755613, "rgb": [0, 0, 0]}, {"index": 0.23454230704272927, "rgb": [0, 0, 0]}, {"index": 0.2350532004728931, "rgb": [0, 0, 255]}, {"index": 0.23556409390305694, "rgb": [0, 0, 0]}, {"index": 0.2374092214153015, "rgb": [0, 0, 0]}, {"index": 0.23767100152001353, "rgb": [0, 0, 255]}, {"index": 0.23793278162472556, "rgb": [0, 0, 0]}, {"index": 0.23987502111129877, "rgb": [0, 0, 0]}, {"index": 0.24011991217699713, "rgb": [0, 0, 255]}, {"index": 0.2403648032426955, "rgb": [0, 0, 0]}, {"index": 0.2409559196081743, "rgb": [0, 0, 0]}, {"index": 0.24104880932274952, "rgb": [0, 0, 255]}, {"index": 0.24114169903732474, "rgb": [0, 0, 0]}, {"index": 0.24351883127850027, "rgb": [0, 0, 0]}, {"index": 0.24379327816247257, "rgb": [0, 0, 255]}, {"index": 0.24406772504644486, "rgb": [0, 0, 0]}, {"index": 0.24899932443843947, "rgb": [0, 0, 0]}, {"index": 0.249577774024658, "rgb": [0, 0, 255]}, {"index": 0.2501562236108765, "rgb": [0, 0, 0]}, {"index": 0.24984377638912347, "rgb": [0, 0, 0]}, {"index": 0.2498733322073974, "rgb": [0, 0, 255]}, {"index": 0.24990288802567134, "rgb": [0, 0, 0]}, {"index": 0.2529513595676406, "rgb": [0, 0, 0]}, {"index": 0.2532933626076676, "rgb": [0, 0, 255]}, {"index": 0.2536353656476946, "rgb": [0, 0, 0]}, {"index": 0.25420537071440635, "rgb": [0, 0, 0]}, {"index": 0.25430670494848845, "rgb": [0, 0, 255]}, {"index": 0.25440803918257054, "rgb": [0, 0, 0]}, {"index": 0.25445870629961154, "rgb": [0, 0, 0]}, {"index": 0.25447559533862524, "rgb": [0, 0, 255]}, {"index": 0.25449248437763894, "rgb": [0, 0, 0]}, {"index": 0.25660361425434897, "rgb": [0, 0, 0]}, {"index": 0.25684006080054045, "rgb": [0, 0, 255]}, {"index": 0.25707650734673193, "rgb": [0, 0, 0]}, {"index": 0.2569540618138828, "rgb": [0, 0, 0]}, {"index": 0.25696672859314307, "rgb": [0, 0, 255]}, {"index": 0.25697939537240333, "rgb": [0, 0, 0]}, {"index": 0.2603487586556325, "rgb": [0, 0, 0]}, {"index": 0.26072453977368687, "rgb": [0, 0, 255]}, {"index": 0.26110032089174123, "rgb": [0, 0, 0]}, {"index": 0.2609145414625908, "rgb": [0, 0, 0]}, {"index": 0.2609356527613579, "rgb": [0, 0, 255]}, {"index": 0.26095676406012497, "rgb": [0, 0, 0]}, {"index": 0.26439368349940884, "rgb": [0, 0, 0]}, {"index": 0.2647779091369701, "rgb": [0, 0, 255]}, {"index": 0.2651621347745313, "rgb": [0, 0, 0]}, {"index": 0.26561391656814726, "rgb": [0, 0, 0]}, {"index": 0.26570680628272253, "rgb": [0, 0, 255]}, {"index": 0.2657996959972978, "rgb": [0, 0, 0]}, {"index": 0.2700388447897315, "rgb": [0, 0, 0]}, {"index": 0.27052018240162135, "rgb": [0, 0, 255]}, {"index": 0.2710015200135112, "rgb": [0, 0, 0]}, {"index": 0.2734842087485222, "rgb": [0, 0, 0]}, {"index": 0.27381354500928895, "rgb": [0, 0, 255]}, {"index": 0.2741428812700557, "rgb": [0, 0, 0]}, {"index": 0.2768535720317514, "rgb": [0, 0, 0]}, {"index": 0.277191352812025, "rgb": [0, 0, 255]}, {"index": 0.2775291335922986, "rgb": [0, 0, 0]}, {"index": 0.2780273602432022, "rgb": [0, 0, 0]}, {"index": 0.2781202499577774, "rgb": [0, 0, 255]}, {"index": 0.2782131396723526, "rgb": [0, 0, 0]}, {"index": 0.2832502955581827, "rgb": [0, 0, 0]}, {"index": 0.28382030062489444, "rgb": [0, 0, 255]}, {"index": 0.28439030569160617, "rgb": [0, 0, 0]}, {"index": 0.2847323087316332, "rgb": [0, 0, 0]}, {"index": 0.28483364296571523, "rgb": [0, 0, 255]}, {"index": 0.28493497719979727, "rgb": [0, 0, 0]}, {"index": 0.28513764566796146, "rgb": [0, 0, 0]}, {"index": 0.28517142374598886, "rgb": [0, 0, 255]}, {"index": 0.28520520182401626, "rgb": [0, 0, 0]}, {"index": 0.2858174294882621, "rgb": [0, 0, 0]}, {"index": 0.28588920790407024, "rgb": [0, 0, 255]}, {"index": 0.2859609863198784, "rgb": [0, 0, 0]}, {"index": 0.286459212970782, "rgb": [0, 0, 0]}, {"index": 0.2865225468670833, "rgb": [0, 0, 255]}, {"index": 0.2865858807633846, "rgb": [0, 0, 0]}, {"index": 0.29051258233406524, "rgb": [0, 0, 0]}, {"index": 0.2909559196081743, "rgb": [0, 0, 255]}, {"index": 0.29139925688228335, "rgb": [0, 0, 0]}, {"index": 0.2912599223104205, "rgb": [0, 0, 0]}, {"index": 0.2912937003884479, "rgb": [0, 0, 255]}, {"index": 0.2913274784664752, "rgb": [0, 0, 0]}, {"index": 0.29201570680628275, "rgb": [0, 0, 0]}, {"index": 0.2920959297415977, "rgb": [0, 0, 255]}, {"index": 0.29217615267691266, "rgb": [0, 0, 0]}, {"index": 0.2932359398750211, "rgb": [0, 0, 0]}, {"index": 0.29336260766762373, "rgb": [0, 0, 255]}, {"index": 0.29348927546022635, "rgb": [0, 0, 0]}, {"index": 0.29397061307211625, "rgb": [0, 0, 0]}, {"index": 0.29403816922817094, "rgb": [0, 0, 255]}, {"index": 0.29410572538422564, "rgb": [0, 0, 0]}, {"index": 0.2978382030062489, "rgb": [0, 0, 0]}, {"index": 0.29826042898159094, "rgb": [0, 0, 255]}, {"index": 0.29868265495693297, "rgb": [0, 0, 0]}, {"index": 0.29902043573720655, "rgb": [0, 0, 0]}, {"index": 0.29910488093227494, "rgb": [0, 0, 255]}, {"index": 0.29918932612734334, "rgb": [0, 0, 0]}, {"index": 0.29975088667454824, "rgb": [0, 0, 0]}, {"index": 0.2998226650903564, "rgb": [0, 0, 255]}, {"index": 0.2998944435061645, "rgb": [0, 0, 0]}, {"index": 0.30039267015706805, "rgb": [0, 0, 0]}, {"index": 0.30045600405336936, "rgb": [0, 0, 255]}, {"index": 0.3005193379496707, "rgb": [0, 0, 0]}, {"index": 0.303116027698024, "rgb": [0, 0, 0]}, {"index": 0.3034115858807634, "rgb": [0, 0, 255]}, {"index": 0.3037071440635028, "rgb": [0, 0, 0]}, {"index": 0.30363958790744805, "rgb": [0, 0, 0]}, {"index": 0.3036649214659686, "rgb": [0, 0, 255]}, {"index": 0.3036902550244891, "rgb": [0, 0, 0]}, {"index": 0.3042729268704611, "rgb": [0, 0, 0]}, {"index": 0.3043404830265158, "rgb": [0, 0, 255]}, {"index": 0.3044080391825705, "rgb": [0, 0, 0]}, {"index": 0.30920452626245565, "rgb": [0, 0, 0]}, {"index": 0.3097449755108934, "rgb": [0, 0, 255]}, {"index": 0.3102854247593312, "rgb": [0, 0, 0]}, {"index": 0.3134310082756291, "rgb": [0, 0, 0]}, {"index": 0.31384056747171085, "rgb": [0, 0, 255]}, {"index": 0.3142501266677926, "rgb": [0, 0, 0]}, {"index": 0.31577858469853065, "rgb": [0, 0, 0]}, {"index": 0.31599391994595505, "rgb": [0, 0, 255]}, {"index": 0.31620925519337945, "rgb": [0, 0, 0]}, {"index": 0.3161459212970782, "rgb": [0, 0, 0]}, {"index": 0.3161628103360919, "rgb": [0, 0, 255]}, {"index": 0.3161796993751056, "rgb": [0, 0, 0]}, {"index": 0.3173028204695153, "rgb": [0, 0, 0]}, {"index": 0.31742948826211786, "rgb": [0, 0, 255]}, {"index": 0.31755615605472043, "rgb": [0, 0, 0]}, {"index": 0.3184554973821989, "rgb": [0, 0, 0]}, {"index": 0.3185694983955413, "rgb": [0, 0, 255]}, {"index": 0.31868349940888363, "rgb": [0, 0, 0]}, {"index": 0.3189115014355683, "rgb": [0, 0, 0]}, {"index": 0.3189495017733491, "rgb": [0, 0, 255]}, {"index": 0.31898750211112986, "rgb": [0, 0, 0]}, {"index": 0.32495355514271235, "rgb": [0, 0, 0]}, {"index": 0.32562067218375274, "rgb": [0, 0, 255]}, {"index": 0.3262877892247931, "rgb": [0, 0, 0]}, {"index": 0.3256966728593143, "rgb": [0, 0, 0]}, {"index": 0.32570511737882113, "rgb": [0, 0, 255]}, {"index": 0.32571356189832795, "rgb": [0, 0, 0]}, {"index": 0.3336471879750042, "rgb": [0, 0, 0]}, {"index": 0.334529640263469, "rgb": [0, 0, 255]}, {"index": 0.33541209255193377, "rgb": [0, 0, 0]}, {"index": 0.3366956595169735, "rgb": [0, 0, 0]}, {"index": 0.3369363283229184, "rgb": [0, 0, 255]}, {"index": 0.33717699712886334, "rgb": [0, 0, 0]}, {"index": 0.3429783820300625, "rgb": [0, 0, 0]}, {"index": 0.34364972133085625, "rgb": [0, 0, 255]}, {"index": 0.34432106063165, "rgb": [0, 0, 0]}, {"index": 0.34551173788211453, "rgb": [0, 0, 0]}, {"index": 0.3457186286100321, "rgb": [0, 0, 255]}, {"index": 0.3459255193379497, "rgb": [0, 0, 0]}, {"index": 0.3484926532680291, "rgb": [0, 0, 0]}, {"index": 0.3488008782300287, "rgb": [0, 0, 255]}, {"index": 0.3491091031920283, "rgb": [0, 0, 0]}, {"index": 0.35358892079040705, "rgb": [0, 0, 0]}, {"index": 0.35412092551933794, "rgb": [0, 0, 255]}, {"index": 0.3546529302482688, "rgb": [0, 0, 0]}, {"index": 0.35769295727073125, "rgb": [0, 0, 0]}, {"index": 0.35808984968755275, "rgb": [0, 0, 255]}, {"index": 0.35848674210437426, "rgb": [0, 0, 0]}, {"index": 0.35930586049653773, "rgb": [0, 0, 0]}, {"index": 0.3594409728086472, "rgb": [0, 0, 255]}, {"index": 0.3595760851207566, "rgb": [0, 0, 0]}, {"index": 0.3596309744975511, "rgb": [0, 0, 0]}, {"index": 0.3596520857963182, "rgb": [0, 0, 255]}, {"index": 0.3596731970950853, "rgb": [0, 0, 0]}, {"index": 0.3598040871474413, "rgb": [0, 0, 0]}, {"index": 0.359820976186455, "rgb": [0, 0, 255]}, {"index": 0.3598378652254687, "rgb": [0, 0, 0]}, {"index": 0.3624049991555481, "rgb": [0, 0, 0]}, {"index": 0.3626921128187806, "rgb": [0, 0, 255]}, {"index": 0.36297922648201314, "rgb": [0, 0, 0]}, {"index": 0.370406181388279, "rgb": [0, 0, 0]}, {"index": 0.3712633001182233, "rgb": [0, 0, 255]}, {"index": 0.37212041884816754, "rgb": [0, 0, 0]}, {"index": 0.37213730788718125, "rgb": [0, 0, 0]}, {"index": 0.3722344198615099, "rgb": [0, 0, 255]}, {"index": 0.37233153183583856, "rgb": [0, 0, 0]}, {"index": 0.372918425941564, "rgb": [0, 0, 0]}, {"index": 0.3729944266171255, "rgb": [0, 0, 255]}, {"index": 0.373070427292687, "rgb": [0, 0, 0]}, {"index": 0.3739064347238642, "rgb": [0, 0, 0]}, {"index": 0.3740077689579463, "rgb": [0, 0, 255]}, {"index": 0.3741091031920284, "rgb": [0, 0, 0]}, {"index": 0.3747297753757811, "rgb": [0, 0, 0]}, {"index": 0.37480999831109607, "rgb": [0, 0, 255]}, {"index": 0.374890221246411, "rgb": [0, 0, 0]}, {"index": 0.37576000675561555, "rgb": [0, 0, 0]}, {"index": 0.3758655632494511, "rgb": [0, 0, 255]}, {"index": 0.3759711197432866, "rgb": [0, 0, 0]}, {"index": 0.37829758486742104, "rgb": [0, 0, 0]}, {"index": 0.37856780949163993, "rgb": [0, 0, 255]}, {"index": 0.3788380341158588, "rgb": [0, 0, 0]}, {"index": 0.3790998142205709, "rgb": [0, 0, 0]}, {"index": 0.37915892585711874, "rgb": [0, 0, 255]}, {"index": 0.3792180374936666, "rgb": [0, 0, 0]}, {"index": 0.3807549400439115, "rgb": [0, 0, 0]}, {"index": 0.38093227495355514, "rgb": [0, 0, 255]}, {"index": 0.38110960986319875, "rgb": [0, 0, 0]}, {"index": 0.3814262793447053, "rgb": [0, 0, 0]}, {"index": 0.38148116872149973, "rgb": [0, 0, 255]}, {"index": 0.38153605809829416, "rgb": [0, 0, 0]}, {"index": 0.3873712210775207, "rgb": [0, 0, 0]}, {"index": 0.38802567133930077, "rgb": [0, 0, 255]}, {"index": 0.38868012160108084, "rgb": [0, 0, 0]}, {"index": 0.3946757304509374, "rgb": [0, 0, 0]}, {"index": 0.39541462590778587, "rgb": [0, 0, 255]}, {"index": 0.39615352136463433, "rgb": [0, 0, 0]}, {"index": 0.39549062658334744, "rgb": [0, 0, 0]}, {"index": 0.39549907110285426, "rgb": [0, 0, 255]}, {"index": 0.3955075156223611, "rgb": [0, 0, 0]}, {"index": 0.39591707481844285, "rgb": [0, 0, 0]}, {"index": 0.39596351967573046, "rgb": [0, 0, 255]}, {"index": 0.39600996453301807, "rgb": [0, 0, 0]}, {"index": 0.3969515284580307, "rgb": [0, 0, 0]}, {"index": 0.39706130721161964, "rgb": [0, 0, 255]}, {"index": 0.39717108596520856, "rgb": [0, 0, 0]}, {"index": 0.41347745313291673, "rgb": [0, 0, 0]}, {"index": 0.41530146934639417, "rgb": [0, 0, 255]}, {"index": 0.4171254855598716, "rgb": [0, 0, 0]}, {"index": 0.42347154196926196, "rgb": [0, 0, 0]}, {"index": 0.42437932781624726, "rgb": [0, 0, 255]}, {"index": 0.4252871136632326, "rgb": [0, 0, 0]}, {"index": 0.42844536395879074, "rgb": [0, 0, 0]}, {"index": 0.42889714575240667, "rgb": [0, 0, 255]}, {"index": 0.4293489275460226, "rgb": [0, 0, 0]}, {"index": 0.43053116027698024, "rgb": [0, 0, 0]}, {"index": 0.4307127174463773, "rgb": [0, 0, 255]}, {"index": 0.43089427461577434, "rgb": [0, 0, 0]}, {"index": 0.4319667285931431, "rgb": [0, 0, 0]}, {"index": 0.43210606316500594, "rgb": [0, 0, 255]}, {"index": 0.43224539773686876, "rgb": [0, 0, 0]}, {"index": 0.43545009288971454, "rgb": [0, 0, 0]}, {"index": 0.4358216517480155, "rgb": [0, 0, 255]}, {"index": 0.4361932106063165, "rgb": [0, 0, 0]}, {"index": 0.436961661881439, "rgb": [0, 0, 0]}, {"index": 0.43708832967404154, "rgb": [0, 0, 255]}, {"index": 0.4372149974666441, "rgb": [0, 0, 0]}, {"index": 0.43891234588751904, "rgb": [0, 0, 0]}, {"index": 0.4391150143556832, "rgb": [0, 0, 255]}, {"index": 0.4393176828238473, "rgb": [0, 0, 0]}, {"index": 0.4407870292180375, "rgb": [0, 0, 0]}, {"index": 0.44097280864718796, "rgb": [0, 0, 255]}, {"index": 0.44115858807633845, "rgb": [0, 0, 0]}, {"index": 0.44173281540280357, "rgb": [0, 0, 0]}, {"index": 0.44181726059787196, "rgb": [0, 0, 255]}, {"index": 0.44190170579294036, "rgb": [0, 0, 0]}, {"index": 0.44223526431346055, "rgb": [0, 0, 0]}, {"index": 0.44228170917074816, "rgb": [0, 0, 255]}, {"index": 0.44232815402803577, "rgb": [0, 0, 0]}, {"index": 0.4427757135618984, "rgb": [0, 0, 0]}, {"index": 0.4428306029386928, "rgb": [0, 0, 255]}, {"index": 0.44288549231548724, "rgb": [0, 0, 0]}, {"index": 0.4430586049653775, "rgb": [0, 0, 0]}, {"index": 0.443083938523898, "rgb": [0, 0, 255]}, {"index": 0.44310927208241846, "rgb": [0, 0, 0]}, {"index": 0.44456595169734847, "rgb": [0, 0, 0]}, {"index": 0.4447306198277318, "rgb": [0, 0, 255]}, {"index": 0.44489528795811517, "rgb": [0, 0, 0]}, {"index": 0.4453006248944435, "rgb": [0, 0, 0]}, {"index": 0.4453639587907448, "rgb": [0, 0, 255]}, {"index": 0.4454272926870461, "rgb": [0, 0, 0]}, {"index": 0.446541969261949, "rgb": [0, 0, 0]}, {"index": 0.446672859314305, "rgb": [0, 0, 255]}, {"index": 0.446803749366661, "rgb": [0, 0, 0]}, {"index": 0.4586809660530316, "rgb": [0, 0, 0]}, {"index": 0.4600152001351123, "rgb": [0, 0, 255]}, {"index": 0.46134943421719304, "rgb": [0, 0, 0]}, {"index": 0.4610792095929741, "rgb": [0, 0, 0]}, {"index": 0.4611974328660699, "rgb": [0, 0, 255]}, {"index": 0.4613156561391657, "rgb": [0, 0, 0]}, {"index": 0.46290744806620504, "rgb": [0, 0, 0]}, {"index": 0.4630974497551089, "rgb": [0, 0, 255]}, {"index": 0.4632874514440128, "rgb": [0, 0, 0]}, {"index": 0.4662134774531329, "rgb": [0, 0, 0]}, {"index": 0.46655970275291336, "rgb": [0, 0, 255]}, {"index": 0.4669059280526938, "rgb": [0, 0, 0]}, {"index": 0.46682570511737886, "rgb": [0, 0, 0]}, {"index": 0.46685526093565277, "rgb": [0, 0, 255]}, {"index": 0.4668848167539267, "rgb": [0, 0, 0]}, {"index": 0.46696926194899513, "rgb": [0, 0, 0]}, {"index": 0.46698192872825534, "rgb": [0, 0, 255]}, {"index": 0.46699459550751554, "rgb": [0, 0, 0]}, {"index": 0.46705792940381696, "rgb": [0, 0, 0]}, {"index": 0.4670663739233238, "rgb": [0, 0, 255]}, {"index": 0.4670748184428306, "rgb": [0, 0, 0]}, {"index": 0.4675223779766931, "rgb": [0, 0, 0]}, {"index": 0.46757304509373415, "rgb": [0, 0, 255]}, {"index": 0.4676237122107752, "rgb": [0, 0, 0]}, {"index": 0.46833305184934976, "rgb": [0, 0, 0]}, {"index": 0.46841749704441815, "rgb": [0, 0, 255]}, {"index": 0.46850194223948655, "rgb": [0, 0, 0]}, {"index": 0.4726735348758656, "rgb": [0, 0, 0]}, {"index": 0.47314642796824863, "rgb": [0, 0, 255]}, {"index": 0.47361932106063165, "rgb": [0, 0, 0]}, {"index": 0.47478044249282214, "rgb": [0, 0, 0]}, {"index": 0.4749619996622192, "rgb": [0, 0, 255]}, {"index": 0.47514355683161624, "rgb": [0, 0, 0]}, {"index": 0.4777360243202162, "rgb": [0, 0, 0]}, {"index": 0.47804424928221584, "rgb": [0, 0, 255]}, {"index": 0.47835247424421545, "rgb": [0, 0, 0]}, {"index": 0.4792602600912008, "rgb": [0, 0, 0]}, {"index": 0.47939537240331026, "rgb": [0, 0, 255]}, {"index": 0.4795304847154197, "rgb": [0, 0, 0]}, {"index": 0.480991386590103, "rgb": [0, 0, 0]}, {"index": 0.48116872149974665, "rgb": [0, 0, 255]}, {"index": 0.4813460564093903, "rgb": [0, 0, 0]}, {"index": 0.4825367336598548, "rgb": [0, 0, 0]}, {"index": 0.48268873501097787, "rgb": [0, 0, 255]}, {"index": 0.48284073636210095, "rgb": [0, 0, 0]}, {"index": 0.48458875190001693, "rgb": [0, 0, 0]}, {"index": 0.4847998648876879, "rgb": [0, 0, 255]}, {"index": 0.48501097787535885, "rgb": [0, 0, 0]}, {"index": 0.48624387772335753, "rgb": [0, 0, 0]}, {"index": 0.4864043235939875, "rgb": [0, 0, 255]}, {"index": 0.48656476946461746, "rgb": [0, 0, 0]}, {"index": 0.49092636378990034, "rgb": [0, 0, 0]}, {"index": 0.4914288127005573, "rgb": [0, 0, 255]}, {"index": 0.4919312616112143, "rgb": [0, 0, 0]}, {"index": 0.4922648201317345, "rgb": [0, 0, 0]}, {"index": 0.4923577098463097, "rgb": [0, 0, 255]}, {"index": 0.49245059956088494, "rgb": [0, 0, 0]}, {"index": 0.4953217361932106, "rgb": [0, 0, 0]}, {"index": 0.4956510724539774, "rgb": [0, 0, 255]}, {"index": 0.49598040871474414, "rgb": [0, 0, 0]}, {"index": 0.5012751224455329, "rgb": [0, 0, 0]}, {"index": 0.5019000168890391, "rgb": [0, 0, 255]}, {"index": 0.5025249113325453, "rgb": [0, 0, 0]}, {"index": 0.5023940212801892, "rgb": [0, 0, 0]}, {"index": 0.5024489106569836, "rgb": [0, 0, 255]}, {"index": 0.502503800033778, "rgb": [0, 0, 0]}, {"index": 0.5095169734842088, "rgb": [0, 0, 0]}, {"index": 0.5103023137983449, "rgb": [0, 0, 255]}, {"index": 0.511087654112481, "rgb": [0, 0, 0]}, {"index": 0.5115183246073299, "rgb": [0, 0, 0]}, {"index": 0.5116534369194393, "rgb": [0, 0, 255]}, {"index": 0.5117885492315487, "rgb": [0, 0, 0]}, {"index": 0.5122994426617126, "rgb": [0, 0, 0]}, {"index": 0.5123712210775206, "rgb": [0, 0, 255]}, {"index": 0.5124429994933287, "rgb": [0, 0, 0]}, {"index": 0.5134732308731633, "rgb": [0, 0, 0]}, {"index": 0.5135956764060124, "rgb": [0, 0, 255]}, {"index": 0.5137181219388616, "rgb": [0, 0, 0]}, {"index": 0.5141656814727242, "rgb": [0, 0, 0]}, {"index": 0.5142290153690255, "rgb": [0, 0, 255]}, {"index": 0.5142923492653269, "rgb": [0, 0, 0]}, {"index": 0.5193590609694309, "rgb": [0, 0, 0]}, {"index": 0.5199290660361425, "rgb": [0, 0, 255]}, {"index": 0.5204990711028542, "rgb": [0, 0, 0]}, {"index": 0.5215250802229353, "rgb": [0, 0, 0]}, {"index": 0.521702415132579, "rgb": [0, 0, 255]}, {"index": 0.5218797500422226, "rgb": [0, 0, 0]}, {"index": 0.5221204188481676, "rgb": [0, 0, 0]}, {"index": 0.5221668637054552, "rgb": [0, 0, 255]}, {"index": 0.5222133085627427, "rgb": [0, 0, 0]}, {"index": 0.5223568653943591, "rgb": [0, 0, 0]}, {"index": 0.5223779766931261, "rgb": [0, 0, 255]}, {"index": 0.5223990879918932, "rgb": [0, 0, 0]}, {"index": 0.5232519844620841, "rgb": [0, 0, 0]}, {"index": 0.5233490964364128, "rgb": [0, 0, 255]}, {"index": 0.5234462084107415, "rgb": [0, 0, 0]}, {"index": 0.5255151156899172, "rgb": [0, 0, 0]}, {"index": 0.5257557844958621, "rgb": [0, 0, 255]}, {"index": 0.5259964533018071, "rgb": [0, 0, 0]}, {"index": 0.5311898327985137, "rgb": [0, 0, 0]}, {"index": 0.5317936159432528, "rgb": [0, 0, 255]}, {"index": 0.5323973990879919, "rgb": [0, 0, 0]}, {"index": 0.5320216179699375, "rgb": [0, 0, 0]}, {"index": 0.532046951528458, "rgb": [0, 0, 255]}, {"index": 0.5320722850869786, "rgb": [0, 0, 0]}, {"index": 0.53846900861341, "rgb": [0, 0, 0]}, {"index": 0.5391825705117379, "rgb": [0, 0, 255]}, {"index": 0.5398961324100658, "rgb": [0, 0, 0]}, {"index": 0.5404365816585036, "rgb": [0, 0, 0]}, {"index": 0.5405759162303665, "rgb": [0, 0, 255]}, {"index": 0.5407152508022294, "rgb": [0, 0, 0]}, {"index": 0.5415639250126668, "rgb": [0, 0, 0]}, {"index": 0.5416737037662557, "rgb": [0, 0, 255]}, {"index": 0.5417834825198445, "rgb": [0, 0, 0]}, {"index": 0.541787704779598, "rgb": [0, 0, 0]}, {"index": 0.5418003715588583, "rgb": [0, 0, 255]}, {"index": 0.5418130383381186, "rgb": [0, 0, 0]}, {"index": 0.5440803918257052, "rgb": [0, 0, 0]}, {"index": 0.5443337274109104, "rgb": [0, 0, 255]}, {"index": 0.5445870629961155, "rgb": [0, 0, 0]}, {"index": 0.5446377301131565, "rgb": [0, 0, 0]}, {"index": 0.5446715081911839, "rgb": [0, 0, 255]}, {"index": 0.5447052862692113, "rgb": [0, 0, 0]}, {"index": 0.5448615098800877, "rgb": [0, 0, 0]}, {"index": 0.5448826211788549, "rgb": [0, 0, 255]}, {"index": 0.544903732477622, "rgb": [0, 0, 0]}, {"index": 0.5453766255700051, "rgb": [0, 0, 0]}, {"index": 0.5454315149467995, "rgb": [0, 0, 255]}, {"index": 0.545486404323594, "rgb": [0, 0, 0]}, {"index": 0.5464195237290999, "rgb": [0, 0, 0]}, {"index": 0.5465293024826887, "rgb": [0, 0, 255]}, {"index": 0.5466390812362776, "rgb": [0, 0, 0]}, {"index": 0.5542433710521871, "rgb": [0, 0, 0]}, {"index": 0.5551004897821314, "rgb": [0, 0, 255]}, {"index": 0.5559576085120758, "rgb": [0, 0, 0]}, {"index": 0.5575705117378821, "rgb": [0, 0, 0]}, {"index": 0.5578449586218545, "rgb": [0, 0, 255]}, {"index": 0.5581194055058268, "rgb": [0, 0, 0]}, {"index": 0.5584529640263469, "rgb": [0, 0, 0]}, {"index": 0.5585205201824016, "rgb": [0, 0, 255]}, {"index": 0.5585880763384563, "rgb": [0, 0, 0]}, {"index": 0.5618265495693295, "rgb": [0, 0, 0]}, {"index": 0.562193886167877, "rgb": [0, 0, 255]}, {"index": 0.5625612227664245, "rgb": [0, 0, 0]}, {"index": 0.5639799020435736, "rgb": [0, 0, 0]}, {"index": 0.5641783482519844, "rgb": [0, 0, 255]}, {"index": 0.5643767944603952, "rgb": [0, 0, 0]}, {"index": 0.5649763553453808, "rgb": [0, 0, 0]}, {"index": 0.5650650228002027, "rgb": [0, 0, 255]}, {"index": 0.5651536902550245, "rgb": [0, 0, 0]}, {"index": 0.567611045431515, "rgb": [0, 0, 0]}, {"index": 0.5678939368349941, "rgb": [0, 0, 255]}, {"index": 0.5681768282384733, "rgb": [0, 0, 0]}, {"index": 0.5684259415639251, "rgb": [0, 0, 0]}, {"index": 0.5684850532004729, "rgb": [0, 0, 255]}, {"index": 0.5685441648370207, "rgb": [0, 0, 0]}, {"index": 0.5750591116365479, "rgb": [0, 0, 0]}, {"index": 0.5757895625738896, "rgb": [0, 0, 255]}, {"index": 0.5765200135112313, "rgb": [0, 0, 0]}, {"index": 0.5794375950008445, "rgb": [0, 0, 0]}, {"index": 0.5798429319371727, "rgb": [0, 0, 255]}, {"index": 0.580248268873501, "rgb": [0, 0, 0]}, {"index": 0.5811349434217193, "rgb": [0, 0, 0]}, {"index": 0.5812785002533356, "rgb": [0, 0, 255]}, {"index": 0.5814220570849519, "rgb": [0, 0, 0]}, {"index": 0.5827985137645668, "rgb": [0, 0, 0]}, {"index": 0.5829674041547036, "rgb": [0, 0, 255]}, {"index": 0.5831362945448404, "rgb": [0, 0, 0]}, {"index": 0.5840694139503463, "rgb": [0, 0, 0]}, {"index": 0.5841918594831954, "rgb": [0, 0, 255]}, {"index": 0.5843143050160445, "rgb": [0, 0, 0]}, {"index": 0.5844198615098801, "rgb": [0, 0, 0]}, {"index": 0.5844451950684006, "rgb": [0, 0, 255]}, {"index": 0.5844705286269212, "rgb": [0, 0, 0]}, {"index": 0.5861552102685357, "rgb": [0, 0, 0]}, {"index": 0.5863452119574396, "rgb": [0, 0, 255]}, {"index": 0.5865352136463435, "rgb": [0, 0, 0]}, {"index": 0.5870672183752744, "rgb": [0, 0, 0]}, {"index": 0.5871474413105894, "rgb": [0, 0, 255]}, {"index": 0.5872276642459043, "rgb": [0, 0, 0]}, {"index": 0.5894274615774362, "rgb": [0, 0, 0]}, {"index": 0.5896807971626414, "rgb": [0, 0, 255]}, {"index": 0.5899341327478467, "rgb": [0, 0, 0]}, {"index": 0.5927208241851039, "rgb": [0, 0, 0]}, {"index": 0.5930586049653774, "rgb": [0, 0, 255]}, {"index": 0.593396385745651, "rgb": [0, 0, 0]}, {"index": 0.5931726059787198, "rgb": [0, 0, 0]}, {"index": 0.59318527275798, "rgb": [0, 0, 255]}, {"index": 0.5931979395372403, "rgb": [0, 0, 0]}, {"index": 0.5970613072116197, "rgb": [0, 0, 0]}, {"index": 0.5974919777064684, "rgb": [0, 0, 255]}, {"index": 0.5979226482013172, "rgb": [0, 0, 0]}, {"index": 0.5979099814220571, "rgb": [0, 0, 0]}, {"index": 0.5979564262793448, "rgb": [0, 0, 255]}, {"index": 0.5980028711366324, "rgb": [0, 0, 0]}, {"index": 0.5982604289815909, "rgb": [0, 0, 0]}, {"index": 0.5982942070596183, "rgb": [0, 0, 255]}, {"index": 0.5983279851376457, "rgb": [0, 0, 0]}, {"index": 0.6025882452288465, "rgb": [0, 0, 0]}, {"index": 0.6030653605809829, "rgb": [0, 0, 255]}, {"index": 0.6035424759331194, "rgb": [0, 0, 0]}, {"index": 0.603939368349941, "rgb": [0, 0, 0]}, {"index": 0.6040364803242696, "rgb": [0, 0, 255]}, {"index": 0.6041335922985982, "rgb": [0, 0, 0]}, {"index": 0.6064685019422394, "rgb": [0, 0, 0]}, {"index": 0.6067387265664583, "rgb": [0, 0, 255]}, {"index": 0.6070089511906772, "rgb": [0, 0, 0]}, {"index": 0.6069287282553623, "rgb": [0, 0, 0]}, {"index": 0.6069498395541294, "rgb": [0, 0, 255]}, {"index": 0.6069709508528965, "rgb": [0, 0, 0]}, {"index": 0.6071018409052525, "rgb": [0, 0, 0]}, {"index": 0.6071187299442662, "rgb": [0, 0, 255]}, {"index": 0.6071356189832798, "rgb": [0, 0, 0]}, {"index": 0.6075747339976355, "rgb": [0, 0, 0]}, {"index": 0.6076254011146766, "rgb": [0, 0, 255]}, {"index": 0.6076760682317176, "rgb": [0, 0, 0]}, {"index": 0.6103614254348927, "rgb": [0, 0, 0]}, {"index": 0.610665428137139, "rgb": [0, 0, 255]}, {"index": 0.6109694308393853, "rgb": [0, 0, 0]}, {"index": 0.6140094578618478, "rgb": [0, 0, 0]}, {"index": 0.6143810167201487, "rgb": [0, 0, 255]}, {"index": 0.6147525755784495, "rgb": [0, 0, 0]}, {"index": 0.6150650228002028, "rgb": [0, 0, 0]}, {"index": 0.6151410234757643, "rgb": [0, 0, 255]}, {"index": 0.6152170241513257, "rgb": [0, 0, 0]}, {"index": 0.6174210437426111, "rgb": [0, 0, 0]}, {"index": 0.6176743793278162, "rgb": [0, 0, 255]}, {"index": 0.6179277149130213, "rgb": [0, 0, 0]}, {"index": 0.6180163823678433, "rgb": [0, 0, 0]}, {"index": 0.6180543827056241, "rgb": [0, 0, 255]}, {"index": 0.6180923830434049, "rgb": [0, 0, 0]}, {"index": 0.6313545009288971, "rgb": [0, 0, 0]}, {"index": 0.6328322918425942, "rgb": [0, 0, 255]}, {"index": 0.6343100827562912, "rgb": [0, 0, 0]}, {"index": 0.6354163148116873, "rgb": [0, 0, 0]}, {"index": 0.6357034284749198, "rgb": [0, 0, 255]}, {"index": 0.6359905421381523, "rgb": [0, 0, 0]}, {"index": 0.6361594325282891, "rgb": [0, 0, 0]}, {"index": 0.6362100996453302, "rgb": [0, 0, 255]}, {"index": 0.6362607667623712, "rgb": [0, 0, 0]}, {"index": 0.6368941057253842, "rgb": [0, 0, 0]}, {"index": 0.6369701064009458, "rgb": [0, 0, 255]}, {"index": 0.6370461070765073, "rgb": [0, 0, 0]}, {"index": 0.6465081911839217, "rgb": [0, 0, 0]}, {"index": 0.6475679783820301, "rgb": [0, 0, 255]}, {"index": 0.6486277655801385, "rgb": [0, 0, 0]}, {"index": 0.6558140516804594, "rgb": [0, 0, 0]}, {"index": 0.6567302820469515, "rgb": [0, 0, 255]}, {"index": 0.6576465124134436, "rgb": [0, 0, 0]}, {"index": 0.6650903563587232, "rgb": [0, 0, 0]}, {"index": 0.6660192535044756, "rgb": [0, 0, 255]}, {"index": 0.6669481506502279, "rgb": [0, 0, 0]}, {"index": 0.6665512582334064, "rgb": [0, 0, 0]}, {"index": 0.6666103698699544, "rgb": [0, 0, 255]}, {"index": 0.6666694815065023, "rgb": [0, 0, 0]}, {"index": 0.6666483702077353, "rgb": [0, 0, 0]}, {"index": 0.6666525924674886, "rgb": [0, 0, 255]}, {"index": 0.666656814727242, "rgb": [0, 0, 0]}, {"index": 0.6717446377301132, "rgb": [0, 0, 0]}, {"index": 0.6723104205370715, "rgb": [0, 0, 255]}, {"index": 0.6728762033440298, "rgb": [0, 0, 0]}, {"index": 0.6899805776051342, "rgb": [0, 0, 0]}, {"index": 0.6919439283904746, "rgb": [0, 0, 255]}, {"index": 0.693907279175815, "rgb": [0, 0, 0]}, {"index": 0.6936159432528289, "rgb": [0, 0, 0]}, {"index": 0.6938017226819794, "rgb": [0, 0, 255]}, {"index": 0.6939875021111298, "rgb": [0, 0, 0]}, {"index": 0.6971457524066881, "rgb": [0, 0, 0]}, {"index": 0.6975173112649891, "rgb": [0, 0, 255]}, {"index": 0.69788887012329, "rgb": [0, 0, 0]}, {"index": 0.6977453132916737, "rgb": [0, 0, 0]}, {"index": 0.6977706468501942, "rgb": [0, 0, 255]}, {"index": 0.6977959804087147, "rgb": [0, 0, 0]}, {"index": 0.6979986488768789, "rgb": [0, 0, 0]}, {"index": 0.6980239824353994, "rgb": [0, 0, 255]}, {"index": 0.69804931599392, "rgb": [0, 0, 0]}, {"index": 0.7046360412092552, "rgb": [0, 0, 0]}, {"index": 0.7053707144063502, "rgb": [0, 0, 255]}, {"index": 0.7061053876034453, "rgb": [0, 0, 0]}, {"index": 0.7076887350109778, "rgb": [0, 0, 0]}, {"index": 0.7079462928559365, "rgb": [0, 0, 255]}, {"index": 0.7082038507008951, "rgb": [0, 0, 0]}, {"index": 0.7107203175139335, "rgb": [0, 0, 0]}, {"index": 0.7110285424759332, "rgb": [0, 0, 255]}, {"index": 0.7113367674379328, "rgb": [0, 0, 0]}, {"index": 0.7111805438270563, "rgb": [0, 0, 0]}, {"index": 0.71119743286607, "rgb": [0, 0, 255]}, {"index": 0.7112143219050836, "rgb": [0, 0, 0]}, {"index": 0.712907448066205, "rgb": [0, 0, 0]}, {"index": 0.7130974497551089, "rgb": [0, 0, 255]}, {"index": 0.7132874514440128, "rgb": [0, 0, 0]}, {"index": 0.7185314980577605, "rgb": [0, 0, 0]}, {"index": 0.7191352812024996, "rgb": [0, 0, 255]}, {"index": 0.7197390643472387, "rgb": [0, 0, 0]}, {"index": 0.7203892923492654, "rgb": [0, 0, 0]}, {"index": 0.7205286269211282, "rgb": [0, 0, 255]}, {"index": 0.720667961492991, "rgb": [0, 0, 0]}, {"index": 0.7353487586556325, "rgb": [0, 0, 0]}, {"index": 0.7369954399594663, "rgb": [0, 0, 255]}, {"index": 0.7386421212633, "rgb": [0, 0, 0]}, {"index": 0.7424674885998986, "rgb": [0, 0, 0]}, {"index": 0.7430754940043911, "rgb": [0, 0, 255]}, {"index": 0.7436834994088836, "rgb": [0, 0, 0]}, {"index": 0.7433034960310759, "rgb": [0, 0, 0]}, {"index": 0.7433288295895963, "rgb": [0, 0, 255]}, {"index": 0.7433541631481168, "rgb": [0, 0, 0]}, {"index": 0.7445828407363622, "rgb": [0, 0, 0]}, {"index": 0.7447221753082249, "rgb": [0, 0, 255]}, {"index": 0.7448615098800877, "rgb": [0, 0, 0]}, {"index": 0.7456721837527445, "rgb": [0, 0, 0]}, {"index": 0.74577774024658, "rgb": [0, 0, 255]}, {"index": 0.7458832967404154, "rgb": [0, 0, 0]}, {"index": 0.7458157405843607, "rgb": [0, 0, 0]}, {"index": 0.7458199628441141, "rgb": [0, 0, 255]}, {"index": 0.7458241851038675, "rgb": [0, 0, 0]}, {"index": 0.7469599729775376, "rgb": [0, 0, 0]}, {"index": 0.7470866407701402, "rgb": [0, 0, 255]}, {"index": 0.7472133085627428, "rgb": [0, 0, 0]}, {"index": 0.7472006417834826, "rgb": [0, 0, 0]}, {"index": 0.7472133085627428, "rgb": [0, 0, 255]}, {"index": 0.7472259753420031, "rgb": [0, 0, 0]}, {"index": 0.7498733322073974, "rgb": [0, 0, 0]}, {"index": 0.7501688903901368, "rgb": [0, 0, 255]}, {"index": 0.7504644485728762, "rgb": [0, 0, 0]}, {"index": 0.7527529133592299, "rgb": [0, 0, 0]}, {"index": 0.7530400270224624, "rgb": [0, 0, 255]}, {"index": 0.753327140685695, "rgb": [0, 0, 0]}, {"index": 0.7545220401959128, "rgb": [0, 0, 0]}, {"index": 0.7546867083262963, "rgb": [0, 0, 255]}, {"index": 0.7548513764566797, "rgb": [0, 0, 0]}, {"index": 0.7552947137307887, "rgb": [0, 0, 0]}, {"index": 0.7553622698868434, "rgb": [0, 0, 255]}, {"index": 0.7554298260428981, "rgb": [0, 0, 0]}, {"index": 0.7573002871136632, "rgb": [0, 0, 0]}, {"index": 0.7575156223610876, "rgb": [0, 0, 255]}, {"index": 0.7577309576085121, "rgb": [0, 0, 0]}, {"index": 0.7593776389123459, "rgb": [0, 0, 0]}, {"index": 0.7595845296402635, "rgb": [0, 0, 255]}, {"index": 0.759791420368181, "rgb": [0, 0, 0]}, {"index": 0.7628145583516298, "rgb": [0, 0, 0]}, {"index": 0.7631734504306705, "rgb": [0, 0, 255]}, {"index": 0.7635323425097112, "rgb": [0, 0, 0]}, {"index": 0.7632494511062321, "rgb": [0, 0, 0]}, {"index": 0.7632578956257389, "rgb": [0, 0, 255]}, {"index": 0.7632663401452456, "rgb": [0, 0, 0]}, {"index": 0.7639799020435738, "rgb": [0, 0, 0]}, {"index": 0.7640601249788888, "rgb": [0, 0, 255]}, {"index": 0.7641403479142037, "rgb": [0, 0, 0]}, {"index": 0.7644021280189158, "rgb": [0, 0, 0]}, {"index": 0.7644401283566965, "rgb": [0, 0, 255]}, {"index": 0.7644781286944772, "rgb": [0, 0, 0]}, {"index": 0.7696841749704442, "rgb": [0, 0, 0]}, {"index": 0.7702668468164161, "rgb": [0, 0, 255]}, {"index": 0.770849518662388, "rgb": [0, 0, 0]}, {"index": 0.7741428812700558, "rgb": [0, 0, 0]}, {"index": 0.7745735517649046, "rgb": [0, 0, 255]}, {"index": 0.7750042222597534, "rgb": [0, 0, 0]}, {"index": 0.7751435568316163, "rgb": [0, 0, 0]}, {"index": 0.7752068907279176, "rgb": [0, 0, 255]}, {"index": 0.7752702246242189, "rgb": [0, 0, 0]}, {"index": 0.7779429150481337, "rgb": [0, 0, 0]}, {"index": 0.77824691775038, "rgb": [0, 0, 255]}, {"index": 0.7785509204526263, "rgb": [0, 0, 0]}, {"index": 0.7789689241682148, "rgb": [0, 0, 0]}, {"index": 0.7790491471035298, "rgb": [0, 0, 255]}, {"index": 0.7791293700388447, "rgb": [0, 0, 0]}, {"index": 0.7791631481168722, "rgb": [0, 0, 0]}, {"index": 0.7791758148961324, "rgb": [0, 0, 255]}, {"index": 0.7791884816753927, "rgb": [0, 0, 0]}, {"index": 0.7793658165850363, "rgb": [0, 0, 0]}, {"index": 0.7793869278838034, "rgb": [0, 0, 255]}, {"index": 0.7794080391825704, "rgb": [0, 0, 0]}, {"index": 0.779804931599392, "rgb": [0, 0, 0]}, {"index": 0.7798513764566796, "rgb": [0, 0, 255]}, {"index": 0.7798978213139671, "rgb": [0, 0, 0]}, {"index": 0.7821313967235264, "rgb": [0, 0, 0]}, {"index": 0.7823847323087316, "rgb": [0, 0, 255]}, {"index": 0.7826380678939369, "rgb": [0, 0, 0]}, {"index": 0.7847027529133592, "rgb": [0, 0, 0]}, {"index": 0.7849603107583178, "rgb": [0, 0, 255]}, {"index": 0.7852178686032765, "rgb": [0, 0, 0]}, {"index": 0.7863663232562067, "rgb": [0, 0, 0]}, {"index": 0.7865225468670832, "rgb": [0, 0, 255]}, {"index": 0.7866787704779598, "rgb": [0, 0, 0]}, {"index": 0.789676574902888, "rgb": [0, 0, 0]}, {"index": 0.7900270224624218, "rgb": [0, 0, 255]}, {"index": 0.7903774700219557, "rgb": [0, 0, 0]}, {"index": 0.790863029893599, "rgb": [0, 0, 0]}, {"index": 0.7909559196081742, "rgb": [0, 0, 255]}, {"index": 0.7910488093227495, "rgb": [0, 0, 0]}, {"index": 0.7930459381861172, "rgb": [0, 0, 0]}, {"index": 0.7932781624725553, "rgb": [0, 0, 255]}, {"index": 0.7935103867589934, "rgb": [0, 0, 0]}, {"index": 0.7935821651748016, "rgb": [0, 0, 0]}, {"index": 0.7936159432528289, "rgb": [0, 0, 255]}, {"index": 0.7936497213308562, "rgb": [0, 0, 0]}, {"index": 0.7941099476439791, "rgb": [0, 0, 0]}, {"index": 0.7941648370207736, "rgb": [0, 0, 255]}, {"index": 0.794219726397568, "rgb": [0, 0, 0]}, {"index": 0.7954568485053201, "rgb": [0, 0, 0]}, {"index": 0.7956004053369363, "rgb": [0, 0, 255]}, {"index": 0.7957439621685526, "rgb": [0, 0, 0]}, {"index": 0.8060124978888701, "rgb": [0, 0, 0]}, {"index": 0.8071693970613072, "rgb": [0, 0, 255]}, {"index": 0.8083262962337443, "rgb": [0, 0, 0]}, {"index": 0.8077774024657998, "rgb": [0, 0, 0]}, {"index": 0.8078449586218545, "rgb": [0, 0, 255]}, {"index": 0.8079125147779092, "rgb": [0, 0, 0]}, {"index": 0.8108089849687552, "rgb": [0, 0, 0]}, {"index": 0.811138321229522, "rgb": [0, 0, 255]}, {"index": 0.8114676574902888, "rgb": [0, 0, 0]}, {"index": 0.8117463266340146, "rgb": [0, 0, 0]}, {"index": 0.8118138827900693, "rgb": [0, 0, 255]}, {"index": 0.811881438946124, "rgb": [0, 0, 0]}, {"index": 0.8138279006924506, "rgb": [0, 0, 0]}, {"index": 0.8140516804593818, "rgb": [0, 0, 255]}, {"index": 0.814275460226313, "rgb": [0, 0, 0]}, {"index": 0.8169397061307213, "rgb": [0, 0, 0]}, {"index": 0.8172605978719811, "rgb": [0, 0, 255]}, {"index": 0.817581489613241, "rgb": [0, 0, 0]}, {"index": 0.8323087316331702, "rgb": [0, 0, 0]}, {"index": 0.8339807464955244, "rgb": [0, 0, 255]}, {"index": 0.8356527613578787, "rgb": [0, 0, 0]}, {"index": 0.8393387941226145, "rgb": [0, 0, 0]}, {"index": 0.8399341327478467, "rgb": [0, 0, 255]}, {"index": 0.8405294713730789, "rgb": [0, 0, 0]}, {"index": 0.8400861340989698, "rgb": [0, 0, 0]}, {"index": 0.8401030231379835, "rgb": [0, 0, 255]}, {"index": 0.8401199121769971, "rgb": [0, 0, 0]}, {"index": 0.8452710690761697, "rgb": [0, 0, 0]}, {"index": 0.8458452964026347, "rgb": [0, 0, 255]}, {"index": 0.8464195237290998, "rgb": [0, 0, 0]}, {"index": 0.8461492991048809, "rgb": [0, 0, 0]}, {"index": 0.8461830771829083, "rgb": [0, 0, 255]}, {"index": 0.8462168552609357, "rgb": [0, 0, 0]}, {"index": 0.8480450937341665, "rgb": [0, 0, 0]}, {"index": 0.848251984462084, "rgb": [0, 0, 255]}, {"index": 0.8484588751900016, "rgb": [0, 0, 0]}, {"index": 0.8483659854754264, "rgb": [0, 0, 0]}, {"index": 0.8483786522546867, "rgb": [0, 0, 255]}, {"index": 0.8483913190339469, "rgb": [0, 0, 0]}, {"index": 0.8503166694815065, "rgb": [0, 0, 0]}, {"index": 0.850532004728931, "rgb": [0, 0, 255]}, {"index": 0.8507473399763554, "rgb": [0, 0, 0]}, {"index": 0.8506840060800541, "rgb": [0, 0, 0]}, {"index": 0.8507008951190678, "rgb": [0, 0, 255]}, {"index": 0.8507177841580814, "rgb": [0, 0, 0]}, {"index": 0.8509668974835333, "rgb": [0, 0, 0]}, {"index": 0.8509964533018072, "rgb": [0, 0, 255]}, {"index": 0.8510260091200811, "rgb": [0, 0, 0]}, {"index": 0.8525164668130385, "rgb": [0, 0, 0]}, {"index": 0.8526853572031752, "rgb": [0, 0, 255]}, {"index": 0.8528542475933119, "rgb": [0, 0, 0]}, {"index": 0.8527993582165176, "rgb": [0, 0, 0]}, {"index": 0.8528120249957778, "rgb": [0, 0, 255]}, {"index": 0.852824691775038, "rgb": [0, 0, 0]}, {"index": 0.8538760344536396, "rgb": [0, 0, 0]}, {"index": 0.8539942577267353, "rgb": [0, 0, 255]}, {"index": 0.8541124809998311, "rgb": [0, 0, 0]}, {"index": 0.8541082587400777, "rgb": [0, 0, 0]}, {"index": 0.8541209255193379, "rgb": [0, 0, 255]}, {"index": 0.8541335922985982, "rgb": [0, 0, 0]}, {"index": 0.8589089680797163, "rgb": [0, 0, 0]}, {"index": 0.8594409728086472, "rgb": [0, 0, 255]}, {"index": 0.8599729775375781, "rgb": [0, 0, 0]}, {"index": 0.8646850194223948, "rgb": [0, 0, 0]}, {"index": 0.8652676912683668, "rgb": [0, 0, 255]}, {"index": 0.8658503631143387, "rgb": [0, 0, 0]}, {"index": 0.8682697179530484, "rgb": [0, 0, 0]}, {"index": 0.8686032764735686, "rgb": [0, 0, 255]}, {"index": 0.8689368349940888, "rgb": [0, 0, 0]}, {"index": 0.8727833136294545, "rgb": [0, 0, 0]}, {"index": 0.8732477622023307, "rgb": [0, 0, 255]}, {"index": 0.8737122107752069, "rgb": [0, 0, 0]}, {"index": 0.8734757642290154, "rgb": [0, 0, 0]}, {"index": 0.8735010977875359, "rgb": [0, 0, 255]}, {"index": 0.8735264313460565, "rgb": [0, 0, 0]}, {"index": 0.8747551089343016, "rgb": [0, 0, 0]}, {"index": 0.8748944435061645, "rgb": [0, 0, 255]}, {"index": 0.8750337780780274, "rgb": [0, 0, 0]}, {"index": 0.8754264482350955, "rgb": [0, 0, 0]}, {"index": 0.8754855598716433, "rgb": [0, 0, 255]}, {"index": 0.8755446715081912, "rgb": [0, 0, 0]}, {"index": 0.8810336091876373, "rgb": [0, 0, 0]}, {"index": 0.8816500591116365, "rgb": [0, 0, 255]}, {"index": 0.8822665090356357, "rgb": [0, 0, 0]}, {"index": 0.8823340651916907, "rgb": [0, 0, 0]}, {"index": 0.8824100658672521, "rgb": [0, 0, 255]}, {"index": 0.8824860665428136, "rgb": [0, 0, 0]}, {"index": 0.8828660699206216, "rgb": [0, 0, 0]}, {"index": 0.8829167370376626, "rgb": [0, 0, 255]}, {"index": 0.8829674041547037, "rgb": [0, 0, 0]}, {"index": 0.8843227495355515, "rgb": [0, 0, 0]}, {"index": 0.884478973146428, "rgb": [0, 0, 255]}, {"index": 0.8846351967573045, "rgb": [0, 0, 0]}, {"index": 0.8848209761864549, "rgb": [0, 0, 0]}, {"index": 0.8848589765242357, "rgb": [0, 0, 255]}, {"index": 0.8848969768620165, "rgb": [0, 0, 0]}, {"index": 0.8859609863198783, "rgb": [0, 0, 0]}, {"index": 0.8860834318527275, "rgb": [0, 0, 255]}, {"index": 0.8862058773855768, "rgb": [0, 0, 0]}, {"index": 0.8881734504306705, "rgb": [0, 0, 0]}, {"index": 0.8884056747171086, "rgb": [0, 0, 255]}, {"index": 0.8886378990035467, "rgb": [0, 0, 0]}, {"index": 0.8888996791082587, "rgb": [0, 0, 0]}, {"index": 0.8889545684850532, "rgb": [0, 0, 255]}, {"index": 0.8890094578618476, "rgb": [0, 0, 0]}, {"index": 0.8890685694983955, "rgb": [0, 0, 0]}, {"index": 0.8890812362776558, "rgb": [0, 0, 255]}, {"index": 0.889093903056916, "rgb": [0, 0, 0]}, {"index": 0.8896512413443675, "rgb": [0, 0, 0]}, {"index": 0.8897145752406688, "rgb": [0, 0, 255]}, {"index": 0.8897779091369701, "rgb": [0, 0, 0]}, {"index": 0.8964786353656478, "rgb": [0, 0, 0]}, {"index": 0.8972301976017565, "rgb": [0, 0, 255]}, {"index": 0.8979817598378652, "rgb": [0, 0, 0]}, {"index": 0.9000422225975342, "rgb": [0, 0, 0]}, {"index": 0.9003546698192872, "rgb": [0, 0, 255]}, {"index": 0.9006671170410403, "rgb": [0, 0, 0]}, {"index": 0.902824691775038, "rgb": [0, 0, 0]}, {"index": 0.9030991386590103, "rgb": [0, 0, 255]}, {"index": 0.9033735855429825, "rgb": [0, 0, 0]}, {"index": 0.9051891572369533, "rgb": [0, 0, 0]}, {"index": 0.9054213815233914, "rgb": [0, 0, 255]}, {"index": 0.9056536058098295, "rgb": [0, 0, 0]}, {"index": 0.9097154196926195, "rgb": [0, 0, 0]}, {"index": 0.910192535044756, "rgb": [0, 0, 255]}, {"index": 0.9106696503968924, "rgb": [0, 0, 0]}, {"index": 0.9164625907785847, "rgb": [0, 0, 0]}, {"index": 0.917159263637899, "rgb": [0, 0, 255]}, {"index": 0.9178559364972133, "rgb": [0, 0, 0]}, {"index": 0.9172352643134605, "rgb": [0, 0, 0]}, {"index": 0.9172437088329674, "rgb": [0, 0, 255]}, {"index": 0.9172521533524742, "rgb": [0, 0, 0]}, {"index": 0.9193717277486911, "rgb": [0, 0, 0]}, {"index": 0.9196081742948826, "rgb": [0, 0, 255]}, {"index": 0.9198446208410741, "rgb": [0, 0, 0]}, {"index": 0.9212041884816754, "rgb": [0, 0, 0]}, {"index": 0.9213815233913191, "rgb": [0, 0, 255]}, {"index": 0.9215588583009627, "rgb": [0, 0, 0]}, {"index": 0.9224455328491808, "rgb": [0, 0, 0]}, {"index": 0.9225637561222766, "rgb": [0, 0, 255]}, {"index": 0.9226819793953723, "rgb": [0, 0, 0]}, {"index": 0.9230577605134268, "rgb": [0, 0, 0]}, {"index": 0.9231126498902212, "rgb": [0, 0, 255]}, {"index": 0.9231675392670157, "rgb": [0, 0, 0]}, {"index": 0.9246706637392331, "rgb": [0, 0, 0]}, {"index": 0.9248437763891234, "rgb": [0, 0, 255]}, {"index": 0.9250168890390137, "rgb": [0, 0, 0]}, {"index": 0.9257177841580815, "rgb": [0, 0, 0]}, {"index": 0.9258148961324101, "rgb": [0, 0, 255]}, {"index": 0.9259120081067387, "rgb": [0, 0, 0]}, {"index": 0.9290069245059955, "rgb": [0, 0, 0]}, {"index": 0.9293615943252829, "rgb": [0, 0, 255]}, {"index": 0.9297162641445702, "rgb": [0, 0, 0]}, {"index": 0.9311096098631988, "rgb": [0, 0, 0]}, {"index": 0.9313038338118561, "rgb": [0, 0, 255]}, {"index": 0.9314980577605134, "rgb": [0, 0, 0]}, {"index": 0.9341538591454147, "rgb": [0, 0, 0]}, {"index": 0.9344705286269211, "rgb": [0, 0, 255]}, {"index": 0.9347871981084276, "rgb": [0, 0, 0]}, {"index": 0.9371685526093565, "rgb": [0, 0, 0]}, {"index": 0.9374683330518494, "rgb": [0, 0, 255]}, {"index": 0.9377681134943423, "rgb": [0, 0, 0]}, {"index": 0.9378483364296571, "rgb": [0, 0, 0]}, {"index": 0.9378905590271913, "rgb": [0, 0, 255]}, {"index": 0.9379327816247255, "rgb": [0, 0, 0]}, {"index": 0.9433626076676237, "rgb": [0, 0, 0]}, {"index": 0.9439706130721162, "rgb": [0, 0, 255]}, {"index": 0.9445786184766086, "rgb": [0, 0, 0]}, {"index": 0.9482266509035635, "rgb": [0, 0, 0]}, {"index": 0.9486995439959466, "rgb": [0, 0, 255]}, {"index": 0.9491724370883297, "rgb": [0, 0, 0]}, {"index": 0.9528795811518325, "rgb": [0, 0, 0]}, {"index": 0.9533440297247087, "rgb": [0, 0, 255]}, {"index": 0.9538084782975849, "rgb": [0, 0, 0]}, {"index": 0.9591200810673872, "rgb": [0, 0, 0]}, {"index": 0.9597618645499071, "rgb": [0, 0, 255]}, {"index": 0.960403648032427, "rgb": [0, 0, 0]}, {"index": 0.9599898665765918, "rgb": [0, 0, 0]}, {"index": 0.9600152001351123, "rgb": [0, 0, 255]}, {"index": 0.9600405336936328, "rgb": [0, 0, 0]}, {"index": 0.961117209930755, "rgb": [0, 0, 0]}, {"index": 0.9612396554636041, "rgb": [0, 0, 255]}, {"index": 0.9613621009964533, "rgb": [0, 0, 0]}, {"index": 0.9631396723526431, "rgb": [0, 0, 0]}, {"index": 0.9633507853403142, "rgb": [0, 0, 255]}, {"index": 0.9635618983279852, "rgb": [0, 0, 0]}, {"index": 0.9647187975004223, "rgb": [0, 0, 0]}, {"index": 0.9648707988515454, "rgb": [0, 0, 255]}, {"index": 0.9650228002026684, "rgb": [0, 0, 0]}, {"index": 0.9682528289140349, "rgb": [0, 0, 0]}, {"index": 0.9686286100320892, "rgb": [0, 0, 255]}, {"index": 0.9690043911501436, "rgb": [0, 0, 0]}, {"index": 0.9707946292855937, "rgb": [0, 0, 0]}, {"index": 0.9710352980915385, "rgb": [0, 0, 255]}, {"index": 0.9712759668974834, "rgb": [0, 0, 0]}, {"index": 0.9726313122783313, "rgb": [0, 0, 0]}, {"index": 0.972808647187975, "rgb": [0, 0, 255]}, {"index": 0.9729859820976187, "rgb": [0, 0, 0]}, {"index": 0.9730746495524405, "rgb": [0, 0, 0]}, {"index": 0.9731042053707144, "rgb": [0, 0, 255]}, {"index": 0.9731337611889883, "rgb": [0, 0, 0]}, {"index": 0.9755362269886845, "rgb": [0, 0, 0]}, {"index": 0.9758064516129032, "rgb": [0, 0, 255]}, {"index": 0.976076676237122, "rgb": [0, 0, 0]}, {"index": 0.9766424590440805, "rgb": [0, 0, 0]}, {"index": 0.9767353487586556, "rgb": [0, 0, 255]}, {"index": 0.9768282384732307, "rgb": [0, 0, 0]}, {"index": 0.9795473737544333, "rgb": [0, 0, 0]}, {"index": 0.9798598209761864, "rgb": [0, 0, 255]}, {"index": 0.9801722681979395, "rgb": [0, 0, 0]}, {"index": 0.9805058267184598, "rgb": [0, 0, 0]}, {"index": 0.9805776051342678, "rgb": [0, 0, 255]}, {"index": 0.9806493835500759, "rgb": [0, 0, 0]}, {"index": 0.9806916061476103, "rgb": [0, 0, 0]}, {"index": 0.9807042729268705, "rgb": [0, 0, 255]}, {"index": 0.9807169397061306, "rgb": [0, 0, 0]}, {"index": 0.9834402972470866, "rgb": [0, 0, 0]}, {"index": 0.9837442999493329, "rgb": [0, 0, 255]}, {"index": 0.9840483026515792, "rgb": [0, 0, 0]}, {"index": 0.9884563418341497, "rgb": [0, 0, 0]}, {"index": 0.9889799020435737, "rgb": [0, 0, 255]}, {"index": 0.9895034622529977, "rgb": [0, 0, 0]}, {"index": 1, "rgb": [0, 0, 0]}],
	
	"fear": [{"rgb": [0, 0, 0], "index": 0}, {"rgb": [0, 0, 0], "index": 0.010032089174125992}, {"rgb": [148, 0, 211], "index": 0.01114676574902888}, {"rgb": [0, 0, 0], "index": 0.012261442323931768}, {"rgb": [0, 0, 0], "index": 0.01224877554467151}, {"rgb": [148, 0, 211], "index": 0.01237122107752069}, {"rgb": [0, 0, 0], "index": 0.01249366661036987}, {"rgb": [0, 0, 0], "index": 0.014271237966559705}, {"rgb": [148, 0, 211], "index": 0.014482350954230705}, {"rgb": [0, 0, 0], "index": 0.014693463941901705}, {"rgb": [0, 0, 0], "index": 0.015242357709846308}, {"rgb": [148, 0, 211], "index": 0.01532680290491471}, {"rgb": [0, 0, 0], "index": 0.015411248099983111}, {"rgb": [0, 0, 0], "index": 0.017910825874007767}, {"rgb": [148, 0, 211], "index": 0.018197939537240332}, {"rgb": [0, 0, 0], "index": 0.018485053200472897}, {"rgb": [0, 0, 0], "index": 0.0217319709508529}, {"rgb": [148, 0, 211], "index": 0.02212464110792096}, {"rgb": [0, 0, 0], "index": 0.022517311264989022}, {"rgb": [0, 0, 0], "index": 0.025392670157068063}, {"rgb": [148, 0, 211], "index": 0.025755784495862185}, {"rgb": [0, 0, 0], "index": 0.026118898834656307}, {"rgb": [0, 0, 0], "index": 0.027807802736024317}, {"rgb": [148, 0, 211], "index": 0.028035804762709}, {"rgb": [0, 0, 0], "index": 0.028263806789393685}, {"rgb": [0, 0, 0], "index": 0.031379834487417664}, {"rgb": [148, 0, 211], "index": 0.03175139334571863}, {"rgb": [0, 0, 0], "index": 0.032122952204019596}, {"rgb": [0, 0, 0], "index": 0.03182739402128019}, {"rgb": [148, 0, 211], "index": 0.03183583854078703}, {"rgb": [0, 0, 0], "index": 0.031844283060293875}, {"rgb": [0, 0, 0], "index": 0.0336218544164837}, {"rgb": [148, 0, 211], "index": 0.033820300624894446}, {"rgb": [0, 0, 0], "index": 0.03401874683330519}, {"rgb": [0, 0, 0], "index": 0.03549231548724878}, {"rgb": [148, 0, 211], "index": 0.035678094916399256}, {"rgb": [0, 0, 0], "index": 0.03586387434554973}, {"rgb": [0, 0, 0], "index": 0.043316162810336095}, {"rgb": [148, 0, 211], "index": 0.04416483702077352}, {"rgb": [0, 0, 0], "index": 0.045013511231210945}, {"rgb": [0, 0, 0], "index": 0.0443928390474582}, {"rgb": [148, 0, 211], "index": 0.04441817260597872}, {"rgb": [0, 0, 0], "index": 0.044443506164499234}, {"rgb": [0, 0, 0], "index": 0.044494173281540275}, {"rgb": [148, 0, 211], "index": 0.04450261780104712}, {"rgb": [0, 0, 0], "index": 0.04451106232055396}, {"rgb": [0, 0, 0], "index": 0.04636463435230535}, {"rgb": [148, 0, 211], "index": 0.046571525080222935}, {"rgb": [0, 0, 0], "index": 0.04677841580814052}, {"rgb": [0, 0, 0], "index": 0.046761526769126836}, {"rgb": [148, 0, 211], "index": 0.046782638067893935}, {"rgb": [0, 0, 0], "index": 0.046803749366661034}, {"rgb": [0, 0, 0], "index": 0.04792264820131735}, {"rgb": [148, 0, 211], "index": 0.04804931599391995}, {"rgb": [0, 0, 0], "index": 0.04817598378652255}, {"rgb": [0, 0, 0], "index": 0.05135534538084783}, {"rgb": [148, 0, 211], "index": 0.05172268197939537}, {"rgb": [0, 0, 0], "index": 0.05209001857794291}, {"rgb": [0, 0, 0], "index": 0.05183668299273772}, {"rgb": [148, 0, 211], "index": 0.051849349771997975}, {"rgb": [0, 0, 0], "index": 0.05186201655125823}, {"rgb": [0, 0, 0], "index": 0.05196335078534031}, {"rgb": [148, 0, 211], "index": 0.051976017564600574}, {"rgb": [0, 0, 0], "index": 0.051988684343860836}, {"rgb": [0, 0, 0], "index": 0.0530780273602432}, {"rgb": [148, 0, 211], "index": 0.05320047289309238}, {"rgb": [0, 0, 0], "index": 0.053322918425941564}, {"rgb": [0, 0, 0], "index": 0.05475848674210437}, {"rgb": [148, 0, 211], "index": 0.054931599391994594}, {"rgb": [0, 0, 0], "index": 0.055104712041884815}, {"rgb": [0, 0, 0], "index": 0.05591960817429489}, {"rgb": [148, 0, 211], "index": 0.056029386927883805}, {"rgb": [0, 0, 0], "index": 0.05613916568147272}, {"rgb": [0, 0, 0], "index": 0.05633338963013004}, {"rgb": [148, 0, 211], "index": 0.056367167708157404}, {"rgb": [0, 0, 0], "index": 0.056400945786184764}, {"rgb": [0, 0, 0], "index": 0.05648116872149975}, {"rgb": [148, 0, 211], "index": 0.05649383550076001}, {"rgb": [0, 0, 0], "index": 0.05650650228002027}, {"rgb": [0, 0, 0], "index": 0.05691183921634859}, {"rgb": [148, 0, 211], "index": 0.05695828407363621}, {"rgb": [0, 0, 0], "index": 0.057004728930923836}, {"rgb": [0, 0, 0], "index": 0.057566289478128696}, {"rgb": [148, 0, 211], "index": 0.05763384563418342}, {"rgb": [0, 0, 0], "index": 0.05770140179023814}, {"rgb": [0, 0, 0], "index": 0.05774784664752576}, {"rgb": [148, 0, 211], "index": 0.057760513426786016}, {"rgb": [0, 0, 0], "index": 0.05777318020604627}, {"rgb": [0, 0, 0], "index": 0.060990542138152345}, {"rgb": [148, 0, 211], "index": 0.06134943421719304}, {"rgb": [0, 0, 0], "index": 0.06170832629623374}, {"rgb": [0, 0, 0], "index": 0.06275544671508192}, {"rgb": [148, 0, 211], "index": 0.06291167032595846}, {"rgb": [0, 0, 0], "index": 0.063067893936835}, {"rgb": [0, 0, 0], "index": 0.06313967235264313}, {"rgb": [148, 0, 211], "index": 0.06316500591116365}, {"rgb": [0, 0, 0], "index": 0.06319033946968418}, {"rgb": [0, 0, 0], "index": 0.06434301638236785}, {"rgb": [148, 0, 211], "index": 0.06447390643472387}, {"rgb": [0, 0, 0], "index": 0.06460479648707988}, {"rgb": [0, 0, 0], "index": 0.06576591791927039}, {"rgb": [148, 0, 211], "index": 0.06590947475088667}, {"rgb": [0, 0, 0], "index": 0.06605303158250295}, {"rgb": [0, 0, 0], "index": 0.06602347576422901}, {"rgb": [148, 0, 211], "index": 0.06603614254348927}, {"rgb": [0, 0, 0], "index": 0.06604880932274954}, {"rgb": [0, 0, 0], "index": 0.06706215166357034}, {"rgb": [148, 0, 211], "index": 0.06717615267691268}, {"rgb": [0, 0, 0], "index": 0.06729015369025503}, {"rgb": [0, 0, 0], "index": 0.06801216010808986}, {"rgb": [148, 0, 211], "index": 0.06810504982266509}, {"rgb": [0, 0, 0], "index": 0.06819793953724032}, {"rgb": [0, 0, 0], "index": 0.06920705961830773}, {"rgb": [148, 0, 211], "index": 0.0693295051511569}, {"rgb": [0, 0, 0], "index": 0.06945195068400609}, {"rgb": [0, 0, 0], "index": 0.06944350616449925}, {"rgb": [148, 0, 211], "index": 0.0694561729437595}, {"rgb": [0, 0, 0], "index": 0.06946883972301975}, {"rgb": [0, 0, 0], "index": 0.07097618645499072}, {"rgb": [148, 0, 211], "index": 0.07114507684512751}, {"rgb": [0, 0, 0], "index": 0.0713139672352643}, {"rgb": [0, 0, 0], "index": 0.07179108258740077}, {"rgb": [148, 0, 211], "index": 0.07186286100320892}, {"rgb": [0, 0, 0], "index": 0.07193463941901707}, {"rgb": [0, 0, 0], "index": 0.07201486235433205}, {"rgb": [148, 0, 211], "index": 0.07203175139334572}, {"rgb": [0, 0, 0], "index": 0.0720486404323594}, {"rgb": [0, 0, 0], "index": 0.07237375443337275}, {"rgb": [148, 0, 211], "index": 0.07241175477115352}, {"rgb": [0, 0, 0], "index": 0.0724497551089343}, {"rgb": [0, 0, 0], "index": 0.0732097618645499}, {"rgb": [148, 0, 211], "index": 0.07329842931937172}, {"rgb": [0, 0, 0], "index": 0.07338709677419354}, {"rgb": [0, 0, 0], "index": 0.07580645161290323}, {"rgb": [148, 0, 211], "index": 0.07608512075662895}, {"rgb": [0, 0, 0], "index": 0.07636378990035467}, {"rgb": [0, 0, 0], "index": 0.07665512582334065}, {"rgb": [148, 0, 211], "index": 0.07671845971964195}, {"rgb": [0, 0, 0], "index": 0.07678179361594324}, {"rgb": [0, 0, 0], "index": 0.07728846478635366}, {"rgb": [148, 0, 211], "index": 0.07735179868265496}, {"rgb": [0, 0, 0], "index": 0.07741513257895626}, {"rgb": [0, 0, 0], "index": 0.08221584191859484}, {"rgb": [148, 0, 211], "index": 0.08275629116703259}, {"rgb": [0, 0, 0], "index": 0.08329674041547035}, {"rgb": [0, 0, 0], "index": 0.0829462928559365}, {"rgb": [148, 0, 211], "index": 0.08296740415470359}, {"rgb": [0, 0, 0], "index": 0.08298851545347069}, {"rgb": [0, 0, 0], "index": 0.08414541462590779}, {"rgb": [148, 0, 211], "index": 0.0842763046782638}, {"rgb": [0, 0, 0], "index": 0.08440719473061982}, {"rgb": [0, 0, 0], "index": 0.08477030906941395}, {"rgb": [148, 0, 211], "index": 0.08482519844620841}, {"rgb": [0, 0, 0], "index": 0.08488008782300287}, {"rgb": [0, 0, 0], "index": 0.08953724033102517}, {"rgb": [148, 0, 211], "index": 0.09006080054044925}, {"rgb": [0, 0, 0], "index": 0.09058436074987333}, {"rgb": [0, 0, 0], "index": 0.0905548049315994}, {"rgb": [148, 0, 211], "index": 0.09060969430839386}, {"rgb": [0, 0, 0], "index": 0.09066458368518832}, {"rgb": [0, 0, 0], "index": 0.09159770309069414}, {"rgb": [148, 0, 211], "index": 0.09170748184428305}, {"rgb": [0, 0, 0], "index": 0.09181726059787197}, {"rgb": [0, 0, 0], "index": 0.0920114845465293}, {"rgb": [148, 0, 211], "index": 0.09204526262455666}, {"rgb": [0, 0, 0], "index": 0.09207904070258402}, {"rgb": [0, 0, 0], "index": 0.10154534706975174}, {"rgb": [148, 0, 211], "index": 0.10260091200810674}, {"rgb": [0, 0, 0], "index": 0.10365647694646174}, {"rgb": [0, 0, 0], "index": 0.1034369194392839}, {"rgb": [148, 0, 211], "index": 0.10352980915385915}, {"rgb": [0, 0, 0], "index": 0.10362269886843439}, {"rgb": [0, 0, 0], "index": 0.10368181050498228}, {"rgb": [148, 0, 211], "index": 0.10369869954399595}, {"rgb": [0, 0, 0], "index": 0.10371558858300962}, {"rgb": [0, 0, 0], "index": 0.10385070089511907}, {"rgb": [148, 0, 211], "index": 0.10386758993413275}, {"rgb": [0, 0, 0], "index": 0.10388447897314644}, {"rgb": [0, 0, 0], "index": 0.10470359736530992}, {"rgb": [148, 0, 211], "index": 0.10479648707988515}, {"rgb": [0, 0, 0], "index": 0.10488937679446038}, {"rgb": [0, 0, 0], "index": 0.10536649214659685}, {"rgb": [148, 0, 211], "index": 0.10542982604289816}, {"rgb": [0, 0, 0], "index": 0.10549315993919947}, {"rgb": [0, 0, 0], "index": 0.10592383043404831}, {"rgb": [148, 0, 211], "index": 0.10597871981084277}, {"rgb": [0, 0, 0], "index": 0.10603360918763723}, {"rgb": [0, 0, 0], "index": 0.10605472048640432}, {"rgb": [148, 0, 211], "index": 0.10606316500591116}, {"rgb": [0, 0, 0], "index": 0.106071609525418}, {"rgb": [0, 0, 0], "index": 0.10610116534369193}, {"rgb": [148, 0, 211], "index": 0.10610538760344536}, {"rgb": [0, 0, 0], "index": 0.10610960986319878}, {"rgb": [0, 0, 0], "index": 0.10918341496368857}, {"rgb": [148, 0, 211], "index": 0.10952541800371558}, {"rgb": [0, 0, 0], "index": 0.1098674210437426}, {"rgb": [0, 0, 0], "index": 0.11290744806620504}, {"rgb": [148, 0, 211], "index": 0.11328322918425941}, {"rgb": [0, 0, 0], "index": 0.11365901030231379}, {"rgb": [0, 0, 0], "index": 0.11370123289984801}, {"rgb": [148, 0, 211], "index": 0.11374767775713562}, {"rgb": [0, 0, 0], "index": 0.11379412261442323}, {"rgb": [0, 0, 0], "index": 0.11481168721499746}, {"rgb": [148, 0, 211], "index": 0.11492991048809323}, {"rgb": [0, 0, 0], "index": 0.115048133761189}, {"rgb": [0, 0, 0], "index": 0.11534791420368182}, {"rgb": [148, 0, 211], "index": 0.11539435906096943}, {"rgb": [0, 0, 0], "index": 0.11544080391825703}, {"rgb": [0, 0, 0], "index": 0.11710437426110455}, {"rgb": [148, 0, 211], "index": 0.11729437595000844}, {"rgb": [0, 0, 0], "index": 0.11748437763891233}, {"rgb": [0, 0, 0], "index": 0.12132241175477117}, {"rgb": [148, 0, 211], "index": 0.12176997128863368}, {"rgb": [0, 0, 0], "index": 0.12221753082249619}, {"rgb": [0, 0, 0], "index": 0.12287198108427631}, {"rgb": [148, 0, 211], "index": 0.12299442661712548}, {"rgb": [0, 0, 0], "index": 0.12311687214997465}, {"rgb": [0, 0, 0], "index": 0.12314642796824861}, {"rgb": [148, 0, 211], "index": 0.12316331700726228}, {"rgb": [0, 0, 0], "index": 0.12318020604627596}, {"rgb": [0, 0, 0], "index": 0.12612734335416315}, {"rgb": [148, 0, 211], "index": 0.1264566796149299}, {"rgb": [0, 0, 0], "index": 0.12678601587569666}, {"rgb": [0, 0, 0], "index": 0.12653268029049147}, {"rgb": [148, 0, 211], "index": 0.12654112480999832}, {"rgb": [0, 0, 0], "index": 0.12654956932950517}, {"rgb": [0, 0, 0], "index": 0.12699712886336767}, {"rgb": [148, 0, 211], "index": 0.12704779598040872}, {"rgb": [0, 0, 0], "index": 0.12709846309744977}, {"rgb": [0, 0, 0], "index": 0.1273137983448742}, {"rgb": [148, 0, 211], "index": 0.12734335416314813}, {"rgb": [0, 0, 0], "index": 0.12737290998142206}, {"rgb": [0, 0, 0], "index": 0.12745735517649046}, {"rgb": [148, 0, 211], "index": 0.12747002195575072}, {"rgb": [0, 0, 0], "index": 0.12748268873501098}, {"rgb": [0, 0, 0], "index": 0.12777402465799698}, {"rgb": [148, 0, 211], "index": 0.12780780273602432}, {"rgb": [0, 0, 0], "index": 0.12784158081405167}, {"rgb": [0, 0, 0], "index": 0.12871981084276307}, {"rgb": [148, 0, 211], "index": 0.12882114507684514}, {"rgb": [0, 0, 0], "index": 0.1289224793109272}, {"rgb": [0, 0, 0], "index": 0.1358512075662895}, {"rgb": [148, 0, 211], "index": 0.13663232562067218}, {"rgb": [0, 0, 0], "index": 0.13741344367505487}, {"rgb": [0, 0, 0], "index": 0.1383043404830265}, {"rgb": [148, 0, 211], "index": 0.138490119912177}, {"rgb": [0, 0, 0], "index": 0.13867589934132749}, {"rgb": [0, 0, 0], "index": 0.1393261273433542}, {"rgb": [148, 0, 211], "index": 0.13941901705792942}, {"rgb": [0, 0, 0], "index": 0.13951190677250463}, {"rgb": [0, 0, 0], "index": 0.13968501942239486}, {"rgb": [148, 0, 211], "index": 0.1397145752406688}, {"rgb": [0, 0, 0], "index": 0.13974413105894273}, {"rgb": [0, 0, 0], "index": 0.14119658841411925}, {"rgb": [148, 0, 211], "index": 0.14136125654450263}, {"rgb": [0, 0, 0], "index": 0.141525924674886}, {"rgb": [0, 0, 0], "index": 0.143375274446884}, {"rgb": [148, 0, 211], "index": 0.14359905421381525}, {"rgb": [0, 0, 0], "index": 0.1438228339807465}, {"rgb": [0, 0, 0], "index": 0.1488431008275629}, {"rgb": [148, 0, 211], "index": 0.14942577267353488}, {"rgb": [0, 0, 0], "index": 0.15000844451950684}, {"rgb": [0, 0, 0], "index": 0.15033778078027363}, {"rgb": [148, 0, 211], "index": 0.1504391150143557}, {"rgb": [0, 0, 0], "index": 0.15054044924843776}, {"rgb": [0, 0, 0], "index": 0.15192112818780612}, {"rgb": [148, 0, 211], "index": 0.1520857963181895}, {"rgb": [0, 0, 0], "index": 0.15225046444857288}, {"rgb": [0, 0, 0], "index": 0.15238979902043576}, {"rgb": [148, 0, 211], "index": 0.1524235770984631}, {"rgb": [0, 0, 0], "index": 0.15245735517649045}, {"rgb": [0, 0, 0], "index": 0.1528035804762709}, {"rgb": [148, 0, 211], "index": 0.1528458030738051}, {"rgb": [0, 0, 0], "index": 0.1528880256713393}, {"rgb": [0, 0, 0], "index": 0.15303580476270898}, {"rgb": [148, 0, 211], "index": 0.1530569160614761}, {"rgb": [0, 0, 0], "index": 0.1530780273602432}, {"rgb": [0, 0, 0], "index": 0.1534749197770647}, {"rgb": [148, 0, 211], "index": 0.15352136463435231}, {"rgb": [0, 0, 0], "index": 0.15356780949163992}, {"rgb": [0, 0, 0], "index": 0.15435737206552946}, {"rgb": [148, 0, 211], "index": 0.1544502617801047}, {"rgb": [0, 0, 0], "index": 0.15454315149467995}, {"rgb": [0, 0, 0], "index": 0.15954230704272926}, {"rgb": [148, 0, 211], "index": 0.16010808984968755}, {"rgb": [0, 0, 0], "index": 0.16067387265664584}, {"rgb": [0, 0, 0], "index": 0.16318611720993076}, {"rgb": [148, 0, 211], "index": 0.16352812024995778}, {"rgb": [0, 0, 0], "index": 0.1638701232899848}, {"rgb": [0, 0, 0], "index": 0.16493413274784666}, {"rgb": [148, 0, 211], "index": 0.16509035635872318}, {"rgb": [0, 0, 0], "index": 0.1652465799695997}, {"rgb": [0, 0, 0], "index": 0.17303242695490628}, {"rgb": [148, 0, 211], "index": 0.17391487924337104}, {"rgb": [0, 0, 0], "index": 0.1747973315318358}, {"rgb": [0, 0, 0], "index": 0.17410488093227494}, {"rgb": [148, 0, 211], "index": 0.17412599223104205}, {"rgb": [0, 0, 0], "index": 0.17414710352980917}, {"rgb": [0, 0, 0], "index": 0.17807802736024322}, {"rgb": [148, 0, 211], "index": 0.1785171423745989}, {"rgb": [0, 0, 0], "index": 0.17895625738895457}, {"rgb": [0, 0, 0], "index": 0.1803791589258571}, {"rgb": [148, 0, 211], "index": 0.1805860496537747}, {"rgb": [0, 0, 0], "index": 0.1807929403816923}, {"rgb": [0, 0, 0], "index": 0.18089005235602096}, {"rgb": [148, 0, 211], "index": 0.1809238304340483}, {"rgb": [0, 0, 0], "index": 0.18095760851207565}, {"rgb": [0, 0, 0], "index": 0.1819118392163486}, {"rgb": [148, 0, 211], "index": 0.18202161796993752}, {"rgb": [0, 0, 0], "index": 0.18213139672352643}, {"rgb": [0, 0, 0], "index": 0.19250971119743288}, {"rgb": [148, 0, 211], "index": 0.1936750548893768}, {"rgb": [0, 0, 0], "index": 0.19484039858132074}, {"rgb": [0, 0, 0], "index": 0.1959550751562236}, {"rgb": [148, 0, 211], "index": 0.1962084107414288}, {"rgb": [0, 0, 0], "index": 0.19646174632663402}, {"rgb": [0, 0, 0], "index": 0.2018704610707651}, {"rgb": [148, 0, 211], "index": 0.20249957777402466}, {"rgb": [0, 0, 0], "index": 0.20312869447728424}, {"rgb": [0, 0, 0], "index": 0.20462759668974836}, {"rgb": [148, 0, 211], "index": 0.20486404323593987}, {"rgb": [0, 0, 0], "index": 0.20510048978213138}, {"rgb": [0, 0, 0], "index": 0.20516804593818613}, {"rgb": [148, 0, 211], "index": 0.20520182401621348}, {"rgb": [0, 0, 0], "index": 0.20523560209424083}, {"rgb": [0, 0, 0], "index": 0.20603783144739063}, {"rgb": [148, 0, 211], "index": 0.20613072116196587}, {"rgb": [0, 0, 0], "index": 0.20622361087654112}, {"rgb": [0, 0, 0], "index": 0.21190677250464449}, {"rgb": [148, 0, 211], "index": 0.21254855598716432}, {"rgb": [0, 0, 0], "index": 0.21319033946968416}, {"rgb": [0, 0, 0], "index": 0.21372656645836852}, {"rgb": [148, 0, 211], "index": 0.21385745651072455}, {"rgb": [0, 0, 0], "index": 0.21398834656308058}, {"rgb": [0, 0, 0], "index": 0.21419945955075156}, {"rgb": [148, 0, 211], "index": 0.21423745988853235}, {"rgb": [0, 0, 0], "index": 0.21427546022631314}, {"rgb": [0, 0, 0], "index": 0.21575747339976356}, {"rgb": [148, 0, 211], "index": 0.21592636378990035}, {"rgb": [0, 0, 0], "index": 0.21609525418003714}, {"rgb": [0, 0, 0], "index": 0.21672437088329674}, {"rgb": [148, 0, 211], "index": 0.21681303833811857}, {"rgb": [0, 0, 0], "index": 0.2169017057929404}, {"rgb": [0, 0, 0], "index": 0.21715504137814562}, {"rgb": [148, 0, 211], "index": 0.21719304171592638}, {"rgb": [0, 0, 0], "index": 0.21723104205370714}, {"rgb": [0, 0, 0], "index": 0.21821905083600746}, {"rgb": [148, 0, 211], "index": 0.21833305184934979}, {"rgb": [0, 0, 0], "index": 0.21844705286269211}, {"rgb": [0, 0, 0], "index": 0.21856105387603444}, {"rgb": [148, 0, 211], "index": 0.21858638743455497}, {"rgb": [0, 0, 0], "index": 0.2186117209930755}, {"rgb": [0, 0, 0], "index": 0.22117041040364804}, {"rgb": [148, 0, 211], "index": 0.2214575240668806}, {"rgb": [0, 0, 0], "index": 0.22174463773011316}, {"rgb": [0, 0, 0], "index": 0.22214153014693466}, {"rgb": [148, 0, 211], "index": 0.2222175308224962}, {"rgb": [0, 0, 0], "index": 0.22229353149805775}, {"rgb": [0, 0, 0], "index": 0.22290153690255027}, {"rgb": [148, 0, 211], "index": 0.2229775375781118}, {"rgb": [0, 0, 0], "index": 0.22305353825367336}, {"rgb": [0, 0, 0], "index": 0.2251055564938355}, {"rgb": [148, 0, 211], "index": 0.22534200304002702}, {"rgb": [0, 0, 0], "index": 0.22557844958621853}, {"rgb": [0, 0, 0], "index": 0.2259500084445195}, {"rgb": [148, 0, 211], "index": 0.22601756460057423}, {"rgb": [0, 0, 0], "index": 0.22608512075662895}, {"rgb": [0, 0, 0], "index": 0.22723357540955919}, {"rgb": [148, 0, 211], "index": 0.22736868772166863}, {"rgb": [0, 0, 0], "index": 0.22750380003377807}, {"rgb": [0, 0, 0], "index": 0.2291167032595845}, {"rgb": [148, 0, 211], "index": 0.22931092720824184}, {"rgb": [0, 0, 0], "index": 0.22950515115689918}, {"rgb": [0, 0, 0], "index": 0.2304129370038845}, {"rgb": [148, 0, 211], "index": 0.23053538253673367}, {"rgb": [0, 0, 0], "index": 0.23065782806958285}, {"rgb": [0, 0, 0], "index": 0.2391614592129708}, {"rgb": [148, 0, 211], "index": 0.24011991217699713}, {"rgb": [0, 0, 0], "index": 0.24107836514102346}, {"rgb": [0, 0, 0], "index": 0.2409559196081743}, {"rgb": [148, 0, 211], "index": 0.24104880932274952}, {"rgb": [0, 0, 0], "index": 0.24114169903732474}, {"rgb": [0, 0, 0], "index": 0.24351883127850027}, {"rgb": [148, 0, 211], "index": 0.24379327816247257}, {"rgb": [0, 0, 0], "index": 0.24406772504644486}, {"rgb": [0, 0, 0], "index": 0.2531413612565445}, {"rgb": [148, 0, 211], "index": 0.25418003715588583}, {"rgb": [0, 0, 0], "index": 0.25521871305522714}, {"rgb": [0, 0, 0], "index": 0.2542940381692282}, {"rgb": [148, 0, 211], "index": 0.25430670494848845}, {"rgb": [0, 0, 0], "index": 0.2543193717277487}, {"rgb": [0, 0, 0], "index": 0.25445870629961154}, {"rgb": [148, 0, 211], "index": 0.25447559533862524}, {"rgb": [0, 0, 0], "index": 0.25449248437763894}, {"rgb": [0, 0, 0], "index": 0.25660361425434897}, {"rgb": [148, 0, 211], "index": 0.25684006080054045}, {"rgb": [0, 0, 0], "index": 0.25707650734673193}, {"rgb": [0, 0, 0], "index": 0.2569540618138828}, {"rgb": [148, 0, 211], "index": 0.25696672859314307}, {"rgb": [0, 0, 0], "index": 0.25697939537240333}, {"rgb": [0, 0, 0], "index": 0.25749873332207396}, {"rgb": [148, 0, 211], "index": 0.25755784495862183}, {"rgb": [0, 0, 0], "index": 0.2576169565951697}, {"rgb": [0, 0, 0], "index": 0.2587358554298261}, {"rgb": [148, 0, 211], "index": 0.2588667454821821}, {"rgb": [0, 0, 0], "index": 0.2589976355345381}, {"rgb": [0, 0, 0], "index": 0.2605387603445364}, {"rgb": [148, 0, 211], "index": 0.26072453977368687}, {"rgb": [0, 0, 0], "index": 0.26091031920283736}, {"rgb": [0, 0, 0], "index": 0.2609145414625908}, {"rgb": [148, 0, 211], "index": 0.2609356527613579}, {"rgb": [0, 0, 0], "index": 0.26095676406012497}, {"rgb": [0, 0, 0], "index": 0.2663697010640094}, {"rgb": [148, 0, 211], "index": 0.2669734842087485}, {"rgb": [0, 0, 0], "index": 0.2675772673534876}, {"rgb": [0, 0, 0], "index": 0.27255953386252324}, {"rgb": [148, 0, 211], "index": 0.27318020604627596}, {"rgb": [0, 0, 0], "index": 0.2738008782300287}, {"rgb": [0, 0, 0], "index": 0.2737502111129877}, {"rgb": [148, 0, 211], "index": 0.27381354500928895}, {"rgb": [0, 0, 0], "index": 0.2738768789055902}, {"rgb": [0, 0, 0], "index": 0.2768535720317514}, {"rgb": [148, 0, 211], "index": 0.277191352812025}, {"rgb": [0, 0, 0], "index": 0.2775291335922986}, {"rgb": [0, 0, 0], "index": 0.2780273602432022}, {"rgb": [148, 0, 211], "index": 0.2781202499577774}, {"rgb": [0, 0, 0], "index": 0.2782131396723526}, {"rgb": [0, 0, 0], "index": 0.2791082587400777}, {"rgb": [148, 0, 211], "index": 0.27921803749366664}, {"rgb": [0, 0, 0], "index": 0.27932781624725556}, {"rgb": [0, 0, 0], "index": 0.2794080391825705}, {"rgb": [148, 0, 211], "index": 0.2794291504813376}, {"rgb": [0, 0, 0], "index": 0.2794502617801047}, {"rgb": [0, 0, 0], "index": 0.2823931768282385}, {"rgb": [148, 0, 211], "index": 0.28272251308900526}, {"rgb": [0, 0, 0], "index": 0.283051849349772}, {"rgb": [0, 0, 0], "index": 0.2837105218713055}, {"rgb": [148, 0, 211], "index": 0.28382030062489444}, {"rgb": [0, 0, 0], "index": 0.28393007937848336}, {"rgb": [0, 0, 0], "index": 0.28458030738051004}, {"rgb": [148, 0, 211], "index": 0.28466475257557844}, {"rgb": [0, 0, 0], "index": 0.28474919777064683}, {"rgb": [0, 0, 0], "index": 0.2848167539267016}, {"rgb": [148, 0, 211], "index": 0.28483364296571523}, {"rgb": [0, 0, 0], "index": 0.2848505320047289}, {"rgb": [0, 0, 0], "index": 0.28513764566796146}, {"rgb": [148, 0, 211], "index": 0.28517142374598886}, {"rgb": [0, 0, 0], "index": 0.28520520182401626}, {"rgb": [0, 0, 0], "index": 0.2853614254348928}, {"rgb": [148, 0, 211], "index": 0.2853825367336599}, {"rgb": [0, 0, 0], "index": 0.28540364803242696}, {"rgb": [0, 0, 0], "index": 0.2858385407870292}, {"rgb": [148, 0, 211], "index": 0.28588920790407024}, {"rgb": [0, 0, 0], "index": 0.2859398750211113}, {"rgb": [0, 0, 0], "index": 0.2871052187130552}, {"rgb": [148, 0, 211], "index": 0.28724033102516466}, {"rgb": [0, 0, 0], "index": 0.2873754433372741}, {"rgb": [0, 0, 0], "index": 0.29275038000337783}, {"rgb": [148, 0, 211], "index": 0.29336260766762373}, {"rgb": [0, 0, 0], "index": 0.29397483533186963}, {"rgb": [0, 0, 0], "index": 0.29397061307211625}, {"rgb": [148, 0, 211], "index": 0.29403816922817094}, {"rgb": [0, 0, 0], "index": 0.29410572538422564}, {"rgb": [0, 0, 0], "index": 0.2978382030062489}, {"rgb": [148, 0, 211], "index": 0.29826042898159094}, {"rgb": [0, 0, 0], "index": 0.29868265495693297}, {"rgb": [0, 0, 0], "index": 0.29966644147947985}, {"rgb": [148, 0, 211], "index": 0.2998226650903564}, {"rgb": [0, 0, 0], "index": 0.2999788887012329}, {"rgb": [0, 0, 0], "index": 0.30388870123289985}, {"rgb": [148, 0, 211], "index": 0.3043404830265158}, {"rgb": [0, 0, 0], "index": 0.3047922648201317}, {"rgb": [0, 0, 0], "index": 0.30920452626245565}, {"rgb": [148, 0, 211], "index": 0.3097449755108934}, {"rgb": [0, 0, 0], "index": 0.3102854247593312}, {"rgb": [0, 0, 0], "index": 0.3098589765242358}, {"rgb": [148, 0, 211], "index": 0.30987164330349604}, {"rgb": [0, 0, 0], "index": 0.3098843100827563}, {"rgb": [0, 0, 0], "index": 0.3100236446546191}, {"rgb": [148, 0, 211], "index": 0.3100405336936328}, {"rgb": [0, 0, 0], "index": 0.3100574227326465}, {"rgb": [0, 0, 0], "index": 0.31346056409390305}, {"rgb": [148, 0, 211], "index": 0.31384056747171085}, {"rgb": [0, 0, 0], "index": 0.31422057084951865}, {"rgb": [0, 0, 0], "index": 0.3154745819962844}, {"rgb": [148, 0, 211], "index": 0.31565613916568147}, {"rgb": [0, 0, 0], "index": 0.3158376963350785}, {"rgb": [0, 0, 0], "index": 0.3159601418679277}, {"rgb": [148, 0, 211], "index": 0.31599391994595505}, {"rgb": [0, 0, 0], "index": 0.3160276980239824}, {"rgb": [0, 0, 0], "index": 0.3161459212970782}, {"rgb": [148, 0, 211], "index": 0.3161628103360919}, {"rgb": [0, 0, 0], "index": 0.3161796993751056}, {"rgb": [0, 0, 0], "index": 0.3164288127005574}, {"rgb": [148, 0, 211], "index": 0.3164583685188313}, {"rgb": [0, 0, 0], "index": 0.3164879243371052}, {"rgb": [0, 0, 0], "index": 0.3187003884478973}, {"rgb": [148, 0, 211], "index": 0.3189495017733491}, {"rgb": [0, 0, 0], "index": 0.3191986150988009}, {"rgb": [0, 0, 0], "index": 0.3191015031244722}, {"rgb": [148, 0, 211], "index": 0.3191183921634859}, {"rgb": [0, 0, 0], "index": 0.3191352812024996}, {"rgb": [0, 0, 0], "index": 0.3290364803242696}, {"rgb": [148, 0, 211], "index": 0.3301384901199122}, {"rgb": [0, 0, 0], "index": 0.3312404999155548}, {"rgb": [0, 0, 0], "index": 0.34404661374767775}, {"rgb": [148, 0, 211], "index": 0.3455919608174295}, {"rgb": [0, 0, 0], "index": 0.3471373078871812}, {"rgb": [0, 0, 0], "index": 0.34570596183077185}, {"rgb": [148, 0, 211], "index": 0.3457186286100321}, {"rgb": [0, 0, 0], "index": 0.34573129538929237}, {"rgb": [0, 0, 0], "index": 0.3484926532680291}, {"rgb": [148, 0, 211], "index": 0.3488008782300287}, {"rgb": [0, 0, 0], "index": 0.3491091031920283}, {"rgb": [0, 0, 0], "index": 0.35111889883465636}, {"rgb": [148, 0, 211], "index": 0.3513764566796149}, {"rgb": [0, 0, 0], "index": 0.3516340145245735}, {"rgb": [0, 0, 0], "index": 0.35156645836851885}, {"rgb": [148, 0, 211], "index": 0.35158756966728594}, {"rgb": [0, 0, 0], "index": 0.351608680966053}, {"rgb": [0, 0, 0], "index": 0.35386758993413275}, {"rgb": [148, 0, 211], "index": 0.35412092551933794}, {"rgb": [0, 0, 0], "index": 0.3543742611045431}, {"rgb": [0, 0, 0], "index": 0.3546529302482689}, {"rgb": [148, 0, 211], "index": 0.35471204188481675}, {"rgb": [0, 0, 0], "index": 0.3547711535213646}, {"rgb": [0, 0, 0], "index": 0.3557760513426786}, {"rgb": [148, 0, 211], "index": 0.3558942746157744}, {"rgb": [0, 0, 0], "index": 0.3560124978888702}, {"rgb": [0, 0, 0], "index": 0.3578702921803749}, {"rgb": [148, 0, 211], "index": 0.35808984968755275}, {"rgb": [0, 0, 0], "index": 0.3583094071947306}, {"rgb": [0, 0, 0], "index": 0.35930586049653773}, {"rgb": [148, 0, 211], "index": 0.3594409728086472}, {"rgb": [0, 0, 0], "index": 0.3595760851207566}, {"rgb": [0, 0, 0], "index": 0.3596309744975511}, {"rgb": [148, 0, 211], "index": 0.3596520857963182}, {"rgb": [0, 0, 0], "index": 0.3596731970950853}, {"rgb": [0, 0, 0], "index": 0.3598040871474413}, {"rgb": [148, 0, 211], "index": 0.359820976186455}, {"rgb": [0, 0, 0], "index": 0.3598378652254687}, {"rgb": [0, 0, 0], "index": 0.3624049991555481}, {"rgb": [148, 0, 211], "index": 0.3626921128187806}, {"rgb": [0, 0, 0], "index": 0.36297922648201314}, {"rgb": [0, 0, 0], "index": 0.369722175308225}, {"rgb": [148, 0, 211], "index": 0.3705032933626077}, {"rgb": [0, 0, 0], "index": 0.37128441141699037}, {"rgb": [0, 0, 0], "index": 0.37118729944266177}, {"rgb": [148, 0, 211], "index": 0.3712633001182233}, {"rgb": [0, 0, 0], "index": 0.3713393007937848}, {"rgb": [0, 0, 0], "index": 0.3717193041715926}, {"rgb": [148, 0, 211], "index": 0.37176997128863365}, {"rgb": [0, 0, 0], "index": 0.3718206384056747}, {"rgb": [0, 0, 0], "index": 0.38457608512075664}, {"rgb": [148, 0, 211], "index": 0.3859989866576592}, {"rgb": [0, 0, 0], "index": 0.38742188819456175}, {"rgb": [0, 0, 0], "index": 0.3867589934132748}, {"rgb": [148, 0, 211], "index": 0.3868434386083432}, {"rgb": [0, 0, 0], "index": 0.3869278838034116}, {"rgb": [0, 0, 0], "index": 0.3879834487417666}, {"rgb": [148, 0, 211], "index": 0.3881101165343692}, {"rgb": [0, 0, 0], "index": 0.38823678432697184}, {"rgb": [0, 0, 0], "index": 0.39244215504137814}, {"rgb": [148, 0, 211], "index": 0.39292349265326804}, {"rgb": [0, 0, 0], "index": 0.39340483026515793}, {"rgb": [0, 0, 0], "index": 0.3951655125823341}, {"rgb": [148, 0, 211], "index": 0.39541462590778587}, {"rgb": [0, 0, 0], "index": 0.3956637392332376}, {"rgb": [0, 0, 0], "index": 0.39549062658334744}, {"rgb": [148, 0, 211], "index": 0.39549907110285426}, {"rgb": [0, 0, 0], "index": 0.3955075156223611}, {"rgb": [0, 0, 0], "index": 0.3994891065698362}, {"rgb": [148, 0, 211], "index": 0.3999324438439453}, {"rgb": [0, 0, 0], "index": 0.40037578111805433}, {"rgb": [0, 0, 0], "index": 0.40221246411079203}, {"rgb": [148, 0, 211], "index": 0.4024657996959973}, {"rgb": [0, 0, 0], "index": 0.4027191352812025}, {"rgb": [0, 0, 0], "index": 0.4136758993413275}, {"rgb": [148, 0, 211], "index": 0.41492146596858637}, {"rgb": [0, 0, 0], "index": 0.41616703259584525}, {"rgb": [0, 0, 0], "index": 0.4150354669819287}, {"rgb": [148, 0, 211], "index": 0.415048133761189}, {"rgb": [0, 0, 0], "index": 0.41506080054044925}, {"rgb": [0, 0, 0], "index": 0.41527613578787365}, {"rgb": [148, 0, 211], "index": 0.41530146934639417}, {"rgb": [0, 0, 0], "index": 0.4153268029049147}, {"rgb": [0, 0, 0], "index": 0.4162514777909137}, {"rgb": [148, 0, 211], "index": 0.4163570342847492}, {"rgb": [0, 0, 0], "index": 0.41646259077858466}, {"rgb": [0, 0, 0], "index": 0.41806704948488427}, {"rgb": [148, 0, 211], "index": 0.4182570511737882}, {"rgb": [0, 0, 0], "index": 0.4184470528626921}, {"rgb": [0, 0, 0], "index": 0.42376710015200136}, {"rgb": [148, 0, 211], "index": 0.42437932781624726}, {"rgb": [0, 0, 0], "index": 0.42499155548049317}, {"rgb": [0, 0, 0], "index": 0.42513933457186287}, {"rgb": [148, 0, 211], "index": 0.42522377976693126}, {"rgb": [0, 0, 0], "index": 0.42530822496199966}, {"rgb": [0, 0, 0], "index": 0.42571778415808137}, {"rgb": [148, 0, 211], "index": 0.42577267353487586}, {"rgb": [0, 0, 0], "index": 0.42582756291167034}, {"rgb": [0, 0, 0], "index": 0.4298007093396386}, {"rgb": [148, 0, 211], "index": 0.4302482688735011}, {"rgb": [0, 0, 0], "index": 0.4306958284073636}, {"rgb": [0, 0, 0], "index": 0.43302229353149807}, {"rgb": [148, 0, 211], "index": 0.43333051849349774}, {"rgb": [0, 0, 0], "index": 0.4336387434554974}, {"rgb": [0, 0, 0], "index": 0.4347365309913866}, {"rgb": [148, 0, 211], "index": 0.4348927546022631}, {"rgb": [0, 0, 0], "index": 0.43504897821313965}, {"rgb": [0, 0, 0], "index": 0.43572876203344024}, {"rgb": [148, 0, 211], "index": 0.4358216517480155}, {"rgb": [0, 0, 0], "index": 0.4359145414625908}, {"rgb": [0, 0, 0], "index": 0.436961661881439}, {"rgb": [148, 0, 211], "index": 0.43708832967404154}, {"rgb": [0, 0, 0], "index": 0.4372149974666441}, {"rgb": [0, 0, 0], "index": 0.4405843607498733}, {"rgb": [148, 0, 211], "index": 0.44097280864718796}, {"rgb": [0, 0, 0], "index": 0.44136125654450264}, {"rgb": [0, 0, 0], "index": 0.44215081911839216}, {"rgb": [148, 0, 211], "index": 0.44228170917074816}, {"rgb": [0, 0, 0], "index": 0.44241259922310416}, {"rgb": [0, 0, 0], "index": 0.44300371558858304}, {"rgb": [148, 0, 211], "index": 0.443083938523898}, {"rgb": [0, 0, 0], "index": 0.44316416145921295}, {"rgb": [0, 0, 0], "index": 0.44429994933288297}, {"rgb": [148, 0, 211], "index": 0.4444350616449924}, {"rgb": [0, 0, 0], "index": 0.44457017395710186}, {"rgb": [0, 0, 0], "index": 0.44527106907616953}, {"rgb": [148, 0, 211], "index": 0.4453639587907448}, {"rgb": [0, 0, 0], "index": 0.4454568485053201}, {"rgb": [0, 0, 0], "index": 0.45205201824016217}, {"rgb": [148, 0, 211], "index": 0.45279513595676407}, {"rgb": [0, 0, 0], "index": 0.453538253673366}, {"rgb": [0, 0, 0], "index": 0.4540871474413106}, {"rgb": [148, 0, 211], "index": 0.4542307042729269}, {"rgb": [0, 0, 0], "index": 0.45437426110454315}, {"rgb": [0, 0, 0], "index": 0.4555607160952542}, {"rgb": [148, 0, 211], "index": 0.4557084951866239}, {"rgb": [0, 0, 0], "index": 0.4558562742779935}, {"rgb": [0, 0, 0], "index": 0.4563545009288972}, {"rgb": [148, 0, 211], "index": 0.4564262793447053}, {"rgb": [0, 0, 0], "index": 0.45649805776051344}, {"rgb": [0, 0, 0], "index": 0.45840229690930584}, {"rgb": [148, 0, 211], "index": 0.4586218544164837}, {"rgb": [0, 0, 0], "index": 0.4588414119236615}, {"rgb": [0, 0, 0], "index": 0.4598758655632495}, {"rgb": [148, 0, 211], "index": 0.4600152001351123}, {"rgb": [0, 0, 0], "index": 0.46015453470697515}, {"rgb": [0, 0, 0], "index": 0.46123121094409736}, {"rgb": [148, 0, 211], "index": 0.46136632325620675}, {"rgb": [0, 0, 0], "index": 0.46150143556831613}, {"rgb": [0, 0, 0], "index": 0.46292433710521874}, {"rgb": [148, 0, 211], "index": 0.4630974497551089}, {"rgb": [0, 0, 0], "index": 0.4632705624049991}, {"rgb": [0, 0, 0], "index": 0.46575747339976353}, {"rgb": [148, 0, 211], "index": 0.46605303158250294}, {"rgb": [0, 0, 0], "index": 0.46634858976524235}, {"rgb": [0, 0, 0], "index": 0.46624303327140687}, {"rgb": [148, 0, 211], "index": 0.46626414457017396}, {"rgb": [0, 0, 0], "index": 0.46628525586894104}, {"rgb": [0, 0, 0], "index": 0.4669101503124472}, {"rgb": [148, 0, 211], "index": 0.46698192872825534}, {"rgb": [0, 0, 0], "index": 0.46705370714406347}, {"rgb": [0, 0, 0], "index": 0.46705792940381696}, {"rgb": [148, 0, 211], "index": 0.4670663739233238}, {"rgb": [0, 0, 0], "index": 0.4670748184428306}, {"rgb": [0, 0, 0], "index": 0.4687383887856781}, {"rgb": [148, 0, 211], "index": 0.4689241682148286}, {"rgb": [0, 0, 0], "index": 0.46910994764397906}, {"rgb": [0, 0, 0], "index": 0.47055818273940214}, {"rgb": [148, 0, 211], "index": 0.4707397399087992}, {"rgb": [0, 0, 0], "index": 0.47092129707819624}, {"rgb": [0, 0, 0], "index": 0.4773137983448742}, {"rgb": [148, 0, 211], "index": 0.47804424928221584}, {"rgb": [0, 0, 0], "index": 0.4787747002195575}, {"rgb": [0, 0, 0], "index": 0.48085627427799355}, {"rgb": [148, 0, 211], "index": 0.48116872149974665}, {"rgb": [0, 0, 0], "index": 0.48148116872149976}, {"rgb": [0, 0, 0], "index": 0.48895879074480664}, {"rgb": [148, 0, 211], "index": 0.4898243539942577}, {"rgb": [0, 0, 0], "index": 0.4906899172437088}, {"rgb": [0, 0, 0], "index": 0.49035635872318867}, {"rgb": [148, 0, 211], "index": 0.49041547035973654}, {"rgb": [0, 0, 0], "index": 0.4904745819962844}, {"rgb": [0, 0, 0], "index": 0.49216348589765246}, {"rgb": [148, 0, 211], "index": 0.4923577098463097}, {"rgb": [0, 0, 0], "index": 0.492551933794967}, {"rgb": [0, 0, 0], "index": 0.4953217361932106}, {"rgb": [148, 0, 211], "index": 0.4956510724539774}, {"rgb": [0, 0, 0], "index": 0.49598040871474414}, {"rgb": [0, 0, 0], "index": 0.4989191015031245}, {"rgb": [148, 0, 211], "index": 0.4992822158419186}, {"rgb": [0, 0, 0], "index": 0.4996453301807127}, {"rgb": [0, 0, 0], "index": 0.5005362269886844}, {"rgb": [148, 0, 211], "index": 0.5006755615605472}, {"rgb": [0, 0, 0], "index": 0.5008148961324099}, {"rgb": [0, 0, 0], "index": 0.5022715757473399}, {"rgb": [148, 0, 211], "index": 0.5024489106569836}, {"rgb": [0, 0, 0], "index": 0.5026262455666273}, {"rgb": [0, 0, 0], "index": 0.5029049147103529}, {"rgb": [148, 0, 211], "index": 0.502955581827394}, {"rgb": [0, 0, 0], "index": 0.503006248944435}, {"rgb": [0, 0, 0], "index": 0.506945617294376}, {"rgb": [148, 0, 211], "index": 0.5073889545684851}, {"rgb": [0, 0, 0], "index": 0.5078322918425942}, {"rgb": [0, 0, 0], "index": 0.5081489613241006}, {"rgb": [148, 0, 211], "index": 0.508233406519169}, {"rgb": [0, 0, 0], "index": 0.5083178517142375}, {"rgb": [0, 0, 0], "index": 0.5116154365816585}, {"rgb": [148, 0, 211], "index": 0.5119912176997129}, {"rgb": [0, 0, 0], "index": 0.5123669988177673}, {"rgb": [0, 0, 0], "index": 0.5140052356020943}, {"rgb": [148, 0, 211], "index": 0.5142290153690255}, {"rgb": [0, 0, 0], "index": 0.5144527951359568}, {"rgb": [0, 0, 0], "index": 0.5198910656983617}, {"rgb": [148, 0, 211], "index": 0.5205201824016213}, {"rgb": [0, 0, 0], "index": 0.521149299104881}, {"rgb": [0, 0, 0], "index": 0.5215841918594832}, {"rgb": [148, 0, 211], "index": 0.521702415132579}, {"rgb": [0, 0, 0], "index": 0.5218206384056747}, {"rgb": [0, 0, 0], "index": 0.5221204188481676}, {"rgb": [148, 0, 211], "index": 0.5221668637054552}, {"rgb": [0, 0, 0], "index": 0.5222133085627427}, {"rgb": [0, 0, 0], "index": 0.5223568653943591}, {"rgb": [148, 0, 211], "index": 0.5223779766931261}, {"rgb": [0, 0, 0], "index": 0.5223990879918932}, {"rgb": [0, 0, 0], "index": 0.5232519844620841}, {"rgb": [148, 0, 211], "index": 0.5233490964364128}, {"rgb": [0, 0, 0], "index": 0.5234462084107415}, {"rgb": [0, 0, 0], "index": 0.5255151156899172}, {"rgb": [148, 0, 211], "index": 0.5257557844958621}, {"rgb": [0, 0, 0], "index": 0.5259964533018071}, {"rgb": [0, 0, 0], "index": 0.5314558351629792}, {"rgb": [148, 0, 211], "index": 0.5320891741259922}, {"rgb": [0, 0, 0], "index": 0.5327225130890052}, {"rgb": [0, 0, 0], "index": 0.5325831785171424}, {"rgb": [148, 0, 211], "index": 0.5326380678939369}, {"rgb": [0, 0, 0], "index": 0.5326929572707313}, {"rgb": [0, 0, 0], "index": 0.538832122952204}, {"rgb": [148, 0, 211], "index": 0.5395203512920115}, {"rgb": [0, 0, 0], "index": 0.540208579631819}, {"rgb": [0, 0, 0], "index": 0.5405463604120926}, {"rgb": [148, 0, 211], "index": 0.5406603614254349}, {"rgb": [0, 0, 0], "index": 0.5407743624387773}, {"rgb": [0, 0, 0], "index": 0.5415723695321736}, {"rgb": [148, 0, 211], "index": 0.5416737037662557}, {"rgb": [0, 0, 0], "index": 0.5417750380003378}, {"rgb": [0, 0, 0], "index": 0.544067725046445}, {"rgb": [148, 0, 211], "index": 0.5443337274109104}, {"rgb": [0, 0, 0], "index": 0.5445997297753757}, {"rgb": [0, 0, 0], "index": 0.5446377301131565}, {"rgb": [148, 0, 211], "index": 0.5446715081911839}, {"rgb": [0, 0, 0], "index": 0.5447052862692113}, {"rgb": [0, 0, 0], "index": 0.5463435230535383}, {"rgb": [148, 0, 211], "index": 0.5465293024826887}, {"rgb": [0, 0, 0], "index": 0.5467150819118392}, {"rgb": [0, 0, 0], "index": 0.5567133930079379}, {"rgb": [148, 0, 211], "index": 0.5578449586218545}, {"rgb": [0, 0, 0], "index": 0.558976524235771}, {"rgb": [0, 0, 0], "index": 0.5584529640263469}, {"rgb": [148, 0, 211], "index": 0.5585205201824016}, {"rgb": [0, 0, 0], "index": 0.5585880763384563}, {"rgb": [0, 0, 0], "index": 0.5604585374092215}, {"rgb": [148, 0, 211], "index": 0.5606738726566458}, {"rgb": [0, 0, 0], "index": 0.5608892079040702}, {"rgb": [0, 0, 0], "index": 0.562041884816754}, {"rgb": [148, 0, 211], "index": 0.562193886167877}, {"rgb": [0, 0, 0], "index": 0.562345887519}, {"rgb": [0, 0, 0], "index": 0.5622318865056578}, {"rgb": [148, 0, 211], "index": 0.5622361087654113}, {"rgb": [0, 0, 0], "index": 0.5622403310251648}, {"rgb": [0, 0, 0], "index": 0.5646301300456005}, {"rgb": [148, 0, 211], "index": 0.5648961324100659}, {"rgb": [0, 0, 0], "index": 0.5651621347745313}, {"rgb": [0, 0, 0], "index": 0.5656561391656815}, {"rgb": [148, 0, 211], "index": 0.5657405843607499}, {"rgb": [0, 0, 0], "index": 0.5658250295558184}, {"rgb": [0, 0, 0], "index": 0.5668425941563926}, {"rgb": [148, 0, 211], "index": 0.5669650396892417}, {"rgb": [0, 0, 0], "index": 0.5670874852220908}, {"rgb": [0, 0, 0], "index": 0.5678010471204189}, {"rgb": [148, 0, 211], "index": 0.5678939368349941}, {"rgb": [0, 0, 0], "index": 0.5679868265495693}, {"rgb": [0, 0, 0], "index": 0.571199966221922}, {"rgb": [148, 0, 211], "index": 0.5715673028204695}, {"rgb": [0, 0, 0], "index": 0.571934639419017}, {"rgb": [0, 0, 0], "index": 0.5753673365985476}, {"rgb": [148, 0, 211], "index": 0.5757895625738896}, {"rgb": [0, 0, 0], "index": 0.5762117885492316}, {"rgb": [0, 0, 0], "index": 0.5804256037831448}, {"rgb": [148, 0, 211], "index": 0.580940719473062}, {"rgb": [0, 0, 0], "index": 0.5814558351629793}, {"rgb": [0, 0, 0], "index": 0.5838667454821821}, {"rgb": [148, 0, 211], "index": 0.5841918594831954}, {"rgb": [0, 0, 0], "index": 0.5845169734842087}, {"rgb": [0, 0, 0], "index": 0.5858638743455498}, {"rgb": [148, 0, 211], "index": 0.5860496537747002}, {"rgb": [0, 0, 0], "index": 0.5862354332038506}, {"rgb": [0, 0, 0], "index": 0.5867336598547543}, {"rgb": [148, 0, 211], "index": 0.5868096605303158}, {"rgb": [0, 0, 0], "index": 0.5868856612058773}, {"rgb": [0, 0, 0], "index": 0.592661712548556}, {"rgb": [148, 0, 211], "index": 0.5933119405505827}, {"rgb": [0, 0, 0], "index": 0.5939621685526093}, {"rgb": [0, 0, 0], "index": 0.5941479479817598}, {"rgb": [148, 0, 211], "index": 0.5942408376963351}, {"rgb": [0, 0, 0], "index": 0.5943337274109103}, {"rgb": [0, 0, 0], "index": 0.5970528626921129}, {"rgb": [148, 0, 211], "index": 0.5973653099138659}, {"rgb": [0, 0, 0], "index": 0.597677757135619}, {"rgb": [0, 0, 0], "index": 0.5982013173450431}, {"rgb": [148, 0, 211], "index": 0.5982942070596183}, {"rgb": [0, 0, 0], "index": 0.5983870967741935}, {"rgb": [0, 0, 0], "index": 0.5988262117885493}, {"rgb": [148, 0, 211], "index": 0.5988853234250971}, {"rgb": [0, 0, 0], "index": 0.598944435061645}, {"rgb": [0, 0, 0], "index": 0.6021533524742443}, {"rgb": [148, 0, 211], "index": 0.6025164668130384}, {"rgb": [0, 0, 0], "index": 0.6028795811518325}, {"rgb": [0, 0, 0], "index": 0.6054804931599391}, {"rgb": [148, 0, 211], "index": 0.6058098294207059}, {"rgb": [0, 0, 0], "index": 0.6061391656814727}, {"rgb": [0, 0, 0], "index": 0.6066458368518831}, {"rgb": [148, 0, 211], "index": 0.6067387265664583}, {"rgb": [0, 0, 0], "index": 0.6068316162810335}, {"rgb": [0, 0, 0], "index": 0.6070807296064854}, {"rgb": [148, 0, 211], "index": 0.6071187299442662}, {"rgb": [0, 0, 0], "index": 0.607156730282047}, {"rgb": [0, 0, 0], "index": 0.6072707312953893}, {"rgb": [148, 0, 211], "index": 0.607287620334403}, {"rgb": [0, 0, 0], "index": 0.6073045093734166}, {"rgb": [0, 0, 0], "index": 0.6084656308056071}, {"rgb": [148, 0, 211], "index": 0.6085965208579632}, {"rgb": [0, 0, 0], "index": 0.6087274109103193}, {"rgb": [0, 0, 0], "index": 0.6127385576760683}, {"rgb": [148, 0, 211], "index": 0.613198783989191}, {"rgb": [0, 0, 0], "index": 0.6136590103023137}, {"rgb": [0, 0, 0], "index": 0.6143767944603952}, {"rgb": [148, 0, 211], "index": 0.6145076845127512}, {"rgb": [0, 0, 0], "index": 0.6146385745651072}, {"rgb": [0, 0, 0], "index": 0.6309998311096099}, {"rgb": [148, 0, 211], "index": 0.6328322918425942}, {"rgb": [0, 0, 0], "index": 0.6346647525755784}, {"rgb": [0, 0, 0], "index": 0.6354163148116873}, {"rgb": [148, 0, 211], "index": 0.6357034284749198}, {"rgb": [0, 0, 0], "index": 0.6359905421381523}, {"rgb": [0, 0, 0], "index": 0.6361594325282891}, {"rgb": [148, 0, 211], "index": 0.6362100996453302}, {"rgb": [0, 0, 0], "index": 0.6362607667623712}, {"rgb": [0, 0, 0], "index": 0.6437341665259246}, {"rgb": [148, 0, 211], "index": 0.6445701739571018}, {"rgb": [0, 0, 0], "index": 0.645406181388279}, {"rgb": [0, 0, 0], "index": 0.6470401959128526}, {"rgb": [148, 0, 211], "index": 0.6473146427968248}, {"rgb": [0, 0, 0], "index": 0.6475890896807971}, {"rgb": [0, 0, 0], "index": 0.6512286775882452}, {"rgb": [148, 0, 211], "index": 0.6516635703428475}, {"rgb": [0, 0, 0], "index": 0.6520984630974498}, {"rgb": [0, 0, 0], "index": 0.6599096436412768}, {"rgb": [148, 0, 211], "index": 0.6608258740077689}, {"rgb": [0, 0, 0], "index": 0.6617421043742611}, {"rgb": [0, 0, 0], "index": 0.6622318865056579}, {"rgb": [148, 0, 211], "index": 0.6623881101165344}, {"rgb": [0, 0, 0], "index": 0.662544333727411}, {"rgb": [0, 0, 0], "index": 0.6662261442323932}, {"rgb": [148, 0, 211], "index": 0.6666525924674886}, {"rgb": [0, 0, 0], "index": 0.6670790407025841}, {"rgb": [0, 0, 0], "index": 0.6717446377301132}, {"rgb": [148, 0, 211], "index": 0.6723104205370715}, {"rgb": [0, 0, 0], "index": 0.6728762033440298}, {"rgb": [0, 0, 0], "index": 0.6786564769464617}, {"rgb": [148, 0, 211], "index": 0.6793615943252829}, {"rgb": [0, 0, 0], "index": 0.680066711704104}, {"rgb": [0, 0, 0], "index": 0.6843016382367844}, {"rgb": [148, 0, 211], "index": 0.6848505320047289}, {"rgb": [0, 0, 0], "index": 0.6853994257726734}, {"rgb": [0, 0, 0], "index": 0.6912345887519}, {"rgb": [148, 0, 211], "index": 0.6919439283904746}, {"rgb": [0, 0, 0], "index": 0.6926532680290491}, {"rgb": [0, 0, 0], "index": 0.6921339300793785}, {"rgb": [148, 0, 211], "index": 0.6921550413781455}, {"rgb": [0, 0, 0], "index": 0.6921761526769126}, {"rgb": [0, 0, 0], "index": 0.6937510555649383}, {"rgb": [148, 0, 211], "index": 0.693928390474582}, {"rgb": [0, 0, 0], "index": 0.6941057253842257}, {"rgb": [0, 0, 0], "index": 0.6964364127681134}, {"rgb": [148, 0, 211], "index": 0.6967150819118392}, {"rgb": [0, 0, 0], "index": 0.6969937510555649}, {"rgb": [0, 0, 0], "index": 0.6976650903563587}, {"rgb": [148, 0, 211], "index": 0.6977706468501942}, {"rgb": [0, 0, 0], "index": 0.6978762033440297}, {"rgb": [0, 0, 0], "index": 0.7046107076507346}, {"rgb": [148, 0, 211], "index": 0.7053707144063502}, {"rgb": [0, 0, 0], "index": 0.7061307211619658}, {"rgb": [0, 0, 0], "index": 0.7076887350109778}, {"rgb": [148, 0, 211], "index": 0.7079462928559365}, {"rgb": [0, 0, 0], "index": 0.7082038507008951}, {"rgb": [0, 0, 0], "index": 0.7107203175139335}, {"rgb": [148, 0, 211], "index": 0.7110285424759332}, {"rgb": [0, 0, 0], "index": 0.7113367674379328}, {"rgb": [0, 0, 0], "index": 0.7131565613916568}, {"rgb": [148, 0, 211], "index": 0.7133930079378483}, {"rgb": [0, 0, 0], "index": 0.7136294544840398}, {"rgb": [0, 0, 0], "index": 0.7168130383381185}, {"rgb": [148, 0, 211], "index": 0.7171930417159263}, {"rgb": [0, 0, 0], "index": 0.7175730450937342}, {"rgb": [0, 0, 0], "index": 0.7189410572538423}, {"rgb": [148, 0, 211], "index": 0.7191352812024996}, {"rgb": [0, 0, 0], "index": 0.7193295051511569}, {"rgb": [0, 0, 0], "index": 0.7194012835669651}, {"rgb": [148, 0, 211], "index": 0.719430839385239}, {"rgb": [0, 0, 0], "index": 0.7194603952035129}, {"rgb": [0, 0, 0], "index": 0.7228128694477285}, {"rgb": [148, 0, 211], "index": 0.7231886505657829}, {"rgb": [0, 0, 0], "index": 0.7235644316838372}, {"rgb": [0, 0, 0], "index": 0.7234546529302484}, {"rgb": [148, 0, 211], "index": 0.7234842087485223}, {"rgb": [0, 0, 0], "index": 0.7235137645667962}, {"rgb": [0, 0, 0], "index": 0.7239402128018917}, {"rgb": [148, 0, 211], "index": 0.7239908799189326}, {"rgb": [0, 0, 0], "index": 0.7240415470359736}, {"rgb": [0, 0, 0], "index": 0.7248268873501098}, {"rgb": [148, 0, 211], "index": 0.724919777064685}, {"rgb": [0, 0, 0], "index": 0.7250126667792602}, {"rgb": [0, 0, 0], "index": 0.725109778753589}, {"rgb": [148, 0, 211], "index": 0.725130890052356}, {"rgb": [0, 0, 0], "index": 0.725152001351123}, {"rgb": [0, 0, 0], "index": 0.7253208917412599}, {"rgb": [148, 0, 211], "index": 0.725342003040027}, {"rgb": [0, 0, 0], "index": 0.7253631143387942}, {"rgb": [0, 0, 0], "index": 0.725532004728931}, {"rgb": [148, 0, 211], "index": 0.725553116027698}, {"rgb": [0, 0, 0], "index": 0.725574227326465}, {"rgb": [0, 0, 0], "index": 0.7256671170410405}, {"rgb": [148, 0, 211], "index": 0.7256797838203006}, {"rgb": [0, 0, 0], "index": 0.7256924505995608}, {"rgb": [0, 0, 0], "index": 0.7258317851714238}, {"rgb": [148, 0, 211], "index": 0.7258486742104374}, {"rgb": [0, 0, 0], "index": 0.7258655632494511}, {"rgb": [0, 0, 0], "index": 0.7275586894105726}, {"rgb": [148, 0, 211], "index": 0.7277486910994765}, {"rgb": [0, 0, 0], "index": 0.7279386927883804}, {"rgb": [0, 0, 0], "index": 0.7288127005573383}, {"rgb": [148, 0, 211], "index": 0.728930923830434}, {"rgb": [0, 0, 0], "index": 0.7290491471035297}, {"rgb": [0, 0, 0], "index": 0.7361889883465631}, {"rgb": [148, 0, 211], "index": 0.7369954399594663}, {"rgb": [0, 0, 0], "index": 0.7378018915723694}, {"rgb": [0, 0, 0], "index": 0.7426954906265834}, {"rgb": [148, 0, 211], "index": 0.7433288295895963}, {"rgb": [0, 0, 0], "index": 0.7439621685526093}, {"rgb": [0, 0, 0], "index": 0.7445828407363622}, {"rgb": [148, 0, 211], "index": 0.7447221753082249}, {"rgb": [0, 0, 0], "index": 0.7448615098800877}, {"rgb": [0, 0, 0], "index": 0.7456721837527445}, {"rgb": [148, 0, 211], "index": 0.74577774024658}, {"rgb": [0, 0, 0], "index": 0.7458832967404154}, {"rgb": [0, 0, 0], "index": 0.7458157405843607}, {"rgb": [148, 0, 211], "index": 0.7458199628441141}, {"rgb": [0, 0, 0], "index": 0.7458241851038675}, {"rgb": [0, 0, 0], "index": 0.7469599729775376}, {"rgb": [148, 0, 211], "index": 0.7470866407701402}, {"rgb": [0, 0, 0], "index": 0.7472133085627428}, {"rgb": [0, 0, 0], "index": 0.7472006417834826}, {"rgb": [148, 0, 211], "index": 0.7472133085627428}, {"rgb": [0, 0, 0], "index": 0.7472259753420031}, {"rgb": [0, 0, 0], "index": 0.752191352812025}, {"rgb": [148, 0, 211], "index": 0.752744468839723}, {"rgb": [0, 0, 0], "index": 0.753297584867421}, {"rgb": [0, 0, 0], "index": 0.7530104712041885}, {"rgb": [148, 0, 211], "index": 0.7530400270224624}, {"rgb": [0, 0, 0], "index": 0.7530695828407363}, {"rgb": [0, 0, 0], "index": 0.7551300456004053}, {"rgb": [148, 0, 211], "index": 0.7553622698868434}, {"rgb": [0, 0, 0], "index": 0.7555944941732815}, {"rgb": [0, 0, 0], "index": 0.7573002871136632}, {"rgb": [148, 0, 211], "index": 0.7575156223610876}, {"rgb": [0, 0, 0], "index": 0.7577309576085121}, {"rgb": [0, 0, 0], "index": 0.7593776389123459}, {"rgb": [148, 0, 211], "index": 0.7595845296402635}, {"rgb": [0, 0, 0], "index": 0.759791420368181}, {"rgb": [0, 0, 0], "index": 0.7627385576760682}, {"rgb": [148, 0, 211], "index": 0.7630890052356021}, {"rgb": [0, 0, 0], "index": 0.7634394527951359}, {"rgb": [0, 0, 0], "index": 0.7631650059111637}, {"rgb": [148, 0, 211], "index": 0.7631734504306705}, {"rgb": [0, 0, 0], "index": 0.7631818949501774}, {"rgb": [0, 0, 0], "index": 0.7632494511062321}, {"rgb": [148, 0, 211], "index": 0.7632578956257389}, {"rgb": [0, 0, 0], "index": 0.7632663401452456}, {"rgb": [0, 0, 0], "index": 0.7639799020435738}, {"rgb": [148, 0, 211], "index": 0.7640601249788888}, {"rgb": [0, 0, 0], "index": 0.7641403479142037}, {"rgb": [0, 0, 0], "index": 0.7644021280189158}, {"rgb": [148, 0, 211], "index": 0.7644401283566965}, {"rgb": [0, 0, 0], "index": 0.7644781286944772}, {"rgb": [0, 0, 0], "index": 0.7646301300456004}, {"rgb": [148, 0, 211], "index": 0.7646512413443675}, {"rgb": [0, 0, 0], "index": 0.7646723526431345}, {"rgb": [0, 0, 0], "index": 0.7768873501097787}, {"rgb": [148, 0, 211], "index": 0.77824691775038}, {"rgb": [0, 0, 0], "index": 0.7796064853909813}, {"rgb": [0, 0, 0], "index": 0.7792729268704611}, {"rgb": [148, 0, 211], "index": 0.7793869278838034}, {"rgb": [0, 0, 0], "index": 0.7795009288971456}, {"rgb": [0, 0, 0], "index": 0.7820089511906774}, {"rgb": [148, 0, 211], "index": 0.7823002871136633}, {"rgb": [0, 0, 0], "index": 0.7825916230366492}, {"rgb": [0, 0, 0], "index": 0.7823762877892247}, {"rgb": [148, 0, 211], "index": 0.7823847323087316}, {"rgb": [0, 0, 0], "index": 0.7823931768282385}, {"rgb": [0, 0, 0], "index": 0.7832967404154704}, {"rgb": [148, 0, 211], "index": 0.7833980746495525}, {"rgb": [0, 0, 0], "index": 0.7834994088836346}, {"rgb": [0, 0, 0], "index": 0.7848040871474413}, {"rgb": [148, 0, 211], "index": 0.7849603107583178}, {"rgb": [0, 0, 0], "index": 0.7851165343691944}, {"rgb": [0, 0, 0], "index": 0.7856063165005912}, {"rgb": [148, 0, 211], "index": 0.7856780949163993}, {"rgb": [0, 0, 0], "index": 0.7857498733322074}, {"rgb": [0, 0, 0], "index": 0.7864381016720148}, {"rgb": [148, 0, 211], "index": 0.7865225468670832}, {"rgb": [0, 0, 0], "index": 0.7866069920621517}, {"rgb": [0, 0, 0], "index": 0.7905125823340652}, {"rgb": [148, 0, 211], "index": 0.7909559196081742}, {"rgb": [0, 0, 0], "index": 0.7913992568822833}, {"rgb": [0, 0, 0], "index": 0.7916019253504475}, {"rgb": [148, 0, 211], "index": 0.7916737037662557}, {"rgb": [0, 0, 0], "index": 0.7917454821820639}, {"rgb": [0, 0, 0], "index": 0.7931177166019254}, {"rgb": [148, 0, 211], "index": 0.7932781624725553}, {"rgb": [0, 0, 0], "index": 0.7934386083431852}, {"rgb": [0, 0, 0], "index": 0.7935821651748016}, {"rgb": [148, 0, 211], "index": 0.7936159432528289}, {"rgb": [0, 0, 0], "index": 0.7936497213308562}, {"rgb": [0, 0, 0], "index": 0.8018620165512582}, {"rgb": [148, 0, 211], "index": 0.8027782469177503}, {"rgb": [0, 0, 0], "index": 0.8036944772842425}, {"rgb": [0, 0, 0], "index": 0.8037282553622699}, {"rgb": [148, 0, 211], "index": 0.8038338118561054}, {"rgb": [0, 0, 0], "index": 0.8039393683499408}, {"rgb": [0, 0, 0], "index": 0.8057718290829251}, {"rgb": [148, 0, 211], "index": 0.8059871643303496}, {"rgb": [0, 0, 0], "index": 0.806202499577774}, {"rgb": [0, 0, 0], "index": 0.80697517311265}, {"rgb": [148, 0, 211], "index": 0.8070849518662389}, {"rgb": [0, 0, 0], "index": 0.8071947306198277}, {"rgb": [0, 0, 0], "index": 0.8071609525418004}, {"rgb": [148, 0, 211], "index": 0.8071693970613072}, {"rgb": [0, 0, 0], "index": 0.807177841580814}, {"rgb": [0, 0, 0], "index": 0.8077774024657998}, {"rgb": [148, 0, 211], "index": 0.8078449586218545}, {"rgb": [0, 0, 0], "index": 0.8079125147779092}, {"rgb": [0, 0, 0], "index": 0.8108089849687552}, {"rgb": [148, 0, 211], "index": 0.811138321229522}, {"rgb": [0, 0, 0], "index": 0.8114676574902888}, {"rgb": [0, 0, 0], "index": 0.8117463266340146}, {"rgb": [148, 0, 211], "index": 0.8118138827900693}, {"rgb": [0, 0, 0], "index": 0.811881438946124}, {"rgb": [0, 0, 0], "index": 0.8212379665597028}, {"rgb": [148, 0, 211], "index": 0.822285086978551}, {"rgb": [0, 0, 0], "index": 0.8233322073973991}, {"rgb": [0, 0, 0], "index": 0.8248691099476441}, {"rgb": [148, 0, 211], "index": 0.8251562236108766}, {"rgb": [0, 0, 0], "index": 0.8254433372741091}, {"rgb": [0, 0, 0], "index": 0.8338583009626752}, {"rgb": [148, 0, 211], "index": 0.8348251984462084}, {"rgb": [0, 0, 0], "index": 0.8357920959297416}, {"rgb": [0, 0, 0], "index": 0.8357752068907279}, {"rgb": [148, 0, 211], "index": 0.8358807633845634}, {"rgb": [0, 0, 0], "index": 0.8359863198783989}, {"rgb": [0, 0, 0], "index": 0.8395287958115184}, {"rgb": [148, 0, 211], "index": 0.8399341327478467}, {"rgb": [0, 0, 0], "index": 0.840339469684175}, {"rgb": [0, 0, 0], "index": 0.8447601756460058}, {"rgb": [148, 0, 211], "index": 0.8452964026346901}, {"rgb": [0, 0, 0], "index": 0.8458326296233744}, {"rgb": [0, 0, 0], "index": 0.8460944097280865}, {"rgb": [148, 0, 211], "index": 0.8461830771829083}, {"rgb": [0, 0, 0], "index": 0.8462717446377301}, {"rgb": [0, 0, 0], "index": 0.8474750886674548}, {"rgb": [148, 0, 211], "index": 0.8476186454990711}, {"rgb": [0, 0, 0], "index": 0.8477622023306873}, {"rgb": [0, 0, 0], "index": 0.8483026515791251}, {"rgb": [148, 0, 211], "index": 0.8483786522546867}, {"rgb": [0, 0, 0], "index": 0.8484546529302482}, {"rgb": [0, 0, 0], "index": 0.8504686708326297}, {"rgb": [148, 0, 211], "index": 0.8507008951190678}, {"rgb": [0, 0, 0], "index": 0.8509331194055059}, {"rgb": [0, 0, 0], "index": 0.85081489613241}, {"rgb": [148, 0, 211], "index": 0.8508275629116703}, {"rgb": [0, 0, 0], "index": 0.8508402296909305}, {"rgb": [0, 0, 0], "index": 0.8509795642627935}, {"rgb": [148, 0, 211], "index": 0.8509964533018072}, {"rgb": [0, 0, 0], "index": 0.8510133423408208}, {"rgb": [0, 0, 0], "index": 0.8520224624218882}, {"rgb": [148, 0, 211], "index": 0.8521364634352305}, {"rgb": [0, 0, 0], "index": 0.8522504644485729}, {"rgb": [0, 0, 0], "index": 0.8527444688397231}, {"rgb": [148, 0, 211], "index": 0.8528120249957778}, {"rgb": [0, 0, 0], "index": 0.8528795811518325}, {"rgb": [0, 0, 0], "index": 0.8537240331025165}, {"rgb": [148, 0, 211], "index": 0.8538253673365985}, {"rgb": [0, 0, 0], "index": 0.8539267015706805}, {"rgb": [0, 0, 0], "index": 0.8540913697010639}, {"rgb": [148, 0, 211], "index": 0.8541209255193379}, {"rgb": [0, 0, 0], "index": 0.854150481337612}, {"rgb": [0, 0, 0], "index": 0.8557929403816923}, {"rgb": [148, 0, 211], "index": 0.8559787198108427}, {"rgb": [0, 0, 0], "index": 0.8561644992399932}, {"rgb": [0, 0, 0], "index": 0.8590947475088667}, {"rgb": [148, 0, 211], "index": 0.8594409728086472}, {"rgb": [0, 0, 0], "index": 0.8597871981084276}, {"rgb": [0, 0, 0], "index": 0.8646850194223948}, {"rgb": [148, 0, 211], "index": 0.8652676912683668}, {"rgb": [0, 0, 0], "index": 0.8658503631143387}, {"rgb": [0, 0, 0], "index": 0.8744637730113157}, {"rgb": [148, 0, 211], "index": 0.8754855598716433}, {"rgb": [0, 0, 0], "index": 0.876507346731971}, {"rgb": [0, 0, 0], "index": 0.8821736193210608}, {"rgb": [148, 0, 211], "index": 0.8829167370376626}, {"rgb": [0, 0, 0], "index": 0.8836598547542645}, {"rgb": [0, 0, 0], "index": 0.885766762371221}, {"rgb": [148, 0, 211], "index": 0.8860834318527275}, {"rgb": [0, 0, 0], "index": 0.8864001013342341}, {"rgb": [0, 0, 0], "index": 0.8874894443506165}, {"rgb": [148, 0, 211], "index": 0.887645667961493}, {"rgb": [0, 0, 0], "index": 0.8878018915723696}, {"rgb": [0, 0, 0], "index": 0.8889376794460395}, {"rgb": [148, 0, 211], "index": 0.8890812362776558}, {"rgb": [0, 0, 0], "index": 0.889224793109272}, {"rgb": [0, 0, 0], "index": 0.8892712379665597}, {"rgb": [148, 0, 211], "index": 0.8892923492653269}, {"rgb": [0, 0, 0], "index": 0.889313460564094}, {"rgb": [0, 0, 0], "index": 0.8914583685188313}, {"rgb": [148, 0, 211], "index": 0.8916990373247762}, {"rgb": [0, 0, 0], "index": 0.891939706130721}, {"rgb": [0, 0, 0], "index": 0.8918890390136802}, {"rgb": [148, 0, 211], "index": 0.8919101503124472}, {"rgb": [0, 0, 0], "index": 0.8919312616112143}, {"rgb": [0, 0, 0], "index": 0.8919861509880087}, {"rgb": [148, 0, 211], "index": 0.8919945955075156}, {"rgb": [0, 0, 0], "index": 0.8920030400270225}, {"rgb": [0, 0, 0], "index": 0.9019886843438608}, {"rgb": [148, 0, 211], "index": 0.9030991386590103}, {"rgb": [0, 0, 0], "index": 0.9042095929741597}, {"rgb": [0, 0, 0], "index": 0.9034791420368181}, {"rgb": [148, 0, 211], "index": 0.9035213646343523}, {"rgb": [0, 0, 0], "index": 0.9035635872318865}, {"rgb": [0, 0, 0], "index": 0.9052313798344874}, {"rgb": [148, 0, 211], "index": 0.9054213815233914}, {"rgb": [0, 0, 0], "index": 0.9056113832122953}, {"rgb": [0, 0, 0], "index": 0.9071693970613072}, {"rgb": [148, 0, 211], "index": 0.9073636210099645}, {"rgb": [0, 0, 0], "index": 0.9075578449586218}, {"rgb": [0, 0, 0], "index": 0.9099096436412768}, {"rgb": [148, 0, 211], "index": 0.910192535044756}, {"rgb": [0, 0, 0], "index": 0.9104754264482351}, {"rgb": [0, 0, 0], "index": 0.9114845465293026}, {"rgb": [148, 0, 211], "index": 0.9116281033609188}, {"rgb": [0, 0, 0], "index": 0.9117716601925351}, {"rgb": [0, 0, 0], "index": 0.9134521195743962}, {"rgb": [148, 0, 211], "index": 0.9136547880425604}, {"rgb": [0, 0, 0], "index": 0.9138574565107246}, {"rgb": [0, 0, 0], "index": 0.9141487924337105}, {"rgb": [148, 0, 211], "index": 0.9142036818105049}, {"rgb": [0, 0, 0], "index": 0.9142585711872994}, {"rgb": [0, 0, 0], "index": 0.9169397061307211}, {"rgb": [148, 0, 211], "index": 0.9172437088329674}, {"rgb": [0, 0, 0], "index": 0.9175477115352136}, {"rgb": [0, 0, 0], "index": 0.9225257557844959}, {"rgb": [148, 0, 211], "index": 0.9231126498902212}, {"rgb": [0, 0, 0], "index": 0.9236995439959466}, {"rgb": [0, 0, 0], "index": 0.9255446715081912}, {"rgb": [148, 0, 211], "index": 0.9258148961324101}, {"rgb": [0, 0, 0], "index": 0.926085120756629}, {"rgb": [0, 0, 0], "index": 0.9342889714575241}, {"rgb": [148, 0, 211], "index": 0.9352305353825368}, {"rgb": [0, 0, 0], "index": 0.9361720993075494}, {"rgb": [0, 0, 0], "index": 0.9372445532849181}, {"rgb": [148, 0, 211], "index": 0.9374683330518494}, {"rgb": [0, 0, 0], "index": 0.9376921128187807}, {"rgb": [0, 0, 0], "index": 0.9378483364296571}, {"rgb": [148, 0, 211], "index": 0.9378905590271913}, {"rgb": [0, 0, 0], "index": 0.9379327816247255}, {"rgb": [0, 0, 0], "index": 0.9433626076676237}, {"rgb": [148, 0, 211], "index": 0.9439706130721162}, {"rgb": [0, 0, 0], "index": 0.9445786184766086}, {"rgb": [0, 0, 0], "index": 0.9449966221921973}, {"rgb": [148, 0, 211], "index": 0.9451106232055396}, {"rgb": [0, 0, 0], "index": 0.945224624218882}, {"rgb": [0, 0, 0], "index": 0.9483406519169059}, {"rgb": [148, 0, 211], "index": 0.9486995439959466}, {"rgb": [0, 0, 0], "index": 0.9490584360749873}, {"rgb": [0, 0, 0], "index": 0.9528035804762709}, {"rgb": [148, 0, 211], "index": 0.9532595845296402}, {"rgb": [0, 0, 0], "index": 0.9537155885830095}, {"rgb": [0, 0, 0], "index": 0.9533355852052018}, {"rgb": [148, 0, 211], "index": 0.9533440297247087}, {"rgb": [0, 0, 0], "index": 0.9533524742442155}, {"rgb": [0, 0, 0], "index": 0.9589300793784834}, {"rgb": [148, 0, 211], "index": 0.9595507515622361}, {"rgb": [0, 0, 0], "index": 0.9601714237459889}, {"rgb": [0, 0, 0], "index": 0.9597407532511399}, {"rgb": [148, 0, 211], "index": 0.9597618645499071}, {"rgb": [0, 0, 0], "index": 0.9597829758486742}, {"rgb": [0, 0, 0], "index": 0.9610918763722345}, {"rgb": [148, 0, 211], "index": 0.9612396554636041}, {"rgb": [0, 0, 0], "index": 0.9613874345549738}, {"rgb": [0, 0, 0], "index": 0.9615816585036311}, {"rgb": [148, 0, 211], "index": 0.9616196588414119}, {"rgb": [0, 0, 0], "index": 0.9616576591791927}, {"rgb": [0, 0, 0], "index": 0.9623416652592468}, {"rgb": [148, 0, 211], "index": 0.9624218881945618}, {"rgb": [0, 0, 0], "index": 0.9625021111298767}, {"rgb": [0, 0, 0], "index": 0.9632578956257389}, {"rgb": [148, 0, 211], "index": 0.9633507853403142}, {"rgb": [0, 0, 0], "index": 0.9634436750548894}, {"rgb": [0, 0, 0], "index": 0.9644907954737376}, {"rgb": [148, 0, 211], "index": 0.9646174632663401}, {"rgb": [0, 0, 0], "index": 0.9647441310589426}, {"rgb": [0, 0, 0], "index": 0.9646934639419018}, {"rgb": [148, 0, 211], "index": 0.9647019084614086}, {"rgb": [0, 0, 0], "index": 0.9647103529809153}, {"rgb": [0, 0, 0], "index": 0.9675899341327479}, {"rgb": [148, 0, 211], "index": 0.9679108258740078}, {"rgb": [0, 0, 0], "index": 0.9682317176152677}, {"rgb": [0, 0, 0], "index": 0.968746833305185}, {"rgb": [148, 0, 211], "index": 0.9688397230197602}, {"rgb": [0, 0, 0], "index": 0.9689326127343354}, {"rgb": [0, 0, 0], "index": 0.9708157405843607}, {"rgb": [148, 0, 211], "index": 0.9710352980915385}, {"rgb": [0, 0, 0], "index": 0.9712548555987164}, {"rgb": [0, 0, 0], "index": 0.9716813038338118}, {"rgb": [148, 0, 211], "index": 0.97175308224962}, {"rgb": [0, 0, 0], "index": 0.9718248606654282}, {"rgb": [0, 0, 0], "index": 0.9790491471035297}, {"rgb": [148, 0, 211], "index": 0.9798598209761864}, {"rgb": [0, 0, 0], "index": 0.980670494848843}, {"rgb": [0, 0, 0], "index": 0.9806198277318021}, {"rgb": [148, 0, 211], "index": 0.9807042729268705}, {"rgb": [0, 0, 0], "index": 0.9807887181219388}, {"rgb": [0, 0, 0], "index": 0.981122276642459}, {"rgb": [148, 0, 211], "index": 0.9811687214997467}, {"rgb": [0, 0, 0], "index": 0.9812151663570343}, {"rgb": [0, 0, 0], "index": 0.9821187299442662}, {"rgb": [148, 0, 211], "index": 0.9822242864381017}, {"rgb": [0, 0, 0], "index": 0.9823298429319371}, {"rgb": [0, 0, 0], "index": 0.9835922985982097}, {"rgb": [148, 0, 211], "index": 0.9837442999493329}, {"rgb": [0, 0, 0], "index": 0.983896301300456}, {"rgb": [0, 0, 0], "index": 0.9848083094071948}, {"rgb": [148, 0, 211], "index": 0.9849265326802905}, {"rgb": [0, 0, 0], "index": 0.9850447559533863}, {"rgb": [0, 0, 0], "index": 0.9852685357203175}, {"rgb": [148, 0, 211], "index": 0.9853065360580983}, {"rgb": [0, 0, 0], "index": 0.985344536395879}, {"rgb": [0, 0, 0], "index": 0.9861045431514947}, {"rgb": [148, 0, 211], "index": 0.9861932106063165}, {"rgb": [0, 0, 0], "index": 0.9862818780611383}, {"rgb": [0, 0, 0], "index": 0.9889292349265327}, {"rgb": [148, 0, 211], "index": 0.9892332376287789}, {"rgb": [0, 0, 0], "index": 0.9895372403310251}, {"rgb": [0, 0, 0], "index": 0.9909812531666948}, {"rgb": [148, 0, 211], "index": 0.9911754771153521}, {"rgb": [0, 0, 0], "index": 0.9913697010640095}, {"rgb": [0, 0, 0], "index": 0.9921254855598717}, {"rgb": [148, 0, 211], "index": 0.9922310420537072}, {"rgb": [0, 0, 0], "index": 0.9923365985475426}, {"rgb": [0, 0, 0], "index": 0.9982350954230704}, {"rgb": [148, 0, 211], "index": 0.9989022124641108}, {"rgb": [0, 0, 0], "index": 0.9995693295051512}, {"rgb": [0, 0, 0], "index": 1}]
	
};
},{}],7:[function(require,module,exports){
/*
 * Ben Postlethwaite
 * January 2013
 * License MIT
 */
'use strict';

var at = require('arraytools');
var clone = require('clone');
var colorScale = require('./colorScales');

module.exports = createColormap;

function createColormap (spec) {
    /*
     * Default Options
     */
    var indicies, rgba, fromrgba, torgba,
        nsteps, cmap, colormap, format,
        nshades, colors, alpha, index, i,
        r = [],
        g = [],
        b = [],
        a = [];

    if ( !at.isPlainObject(spec) ) spec = {};

    nshades = spec.nshades || 72;
    format = spec.format || 'hex';

    colormap = spec.colormap;
    if (!colormap) colormap = 'jet';

    if (typeof colormap === 'string') {
        colormap = colormap.toLowerCase();

        if (!colorScale[colormap]) {
            throw Error(colormap + ' not a supported colorscale');
        }

        cmap = clone(colorScale[colormap]);

    } else if (Array.isArray(colormap)) {
        cmap = clone(colormap);

    } else {
        throw Error('unsupported colormap option', colormap);
    }

    if (cmap.length > nshades) {
        throw new Error(
            colormap+' map requires nshades to be at least size '+cmap.length
        );
    }

    if (!Array.isArray(spec.alpha)) {

        if (typeof spec.alpha === 'number') {
            alpha = [spec.alpha, spec.alpha];

        } else {
            alpha = [1, 1];
        }

    } else if (spec.alpha.length !== 2) {
        alpha = [1, 1];

    } else {
        alpha = clone(spec.alpha);
    }

    /*
     * map index points from 0->1 to 0 -> n-1
     */
    indicies = cmap.map(function(c) {
        return Math.round(c.index * nshades);
    });

    /*
     * Add alpha channel to the map
     */
    if (alpha[0] < 0) alpha[0] = 0;
    if (alpha[1] < 0) alpha[0] = 0;
    if (alpha[0] > 1) alpha[0] = 1;
    if (alpha[1] > 1) alpha[0] = 1;

    for (i = 0; i < indicies.length; ++i) {
        index = cmap[i].index;
        rgba = cmap[i].rgb;

        // if user supplies their own map use it
        if (rgba.length === 4 && rgba[3] >= 0 && rgba[3] <= 1) continue;
        rgba[3] = alpha[0] + (alpha[1] - alpha[0])*index;
    }

    /*
     * map increasing linear values between indicies to
     * linear steps in colorvalues
     */
    for (i = 0; i < indicies.length-1; ++i) {
        nsteps = indicies[i+1] - indicies[i];
        fromrgba = cmap[i].rgb;
        torgba = cmap[i+1].rgb;
        r = r.concat(at.linspace(fromrgba[0], torgba[0], nsteps ) );
        g = g.concat(at.linspace(fromrgba[1], torgba[1], nsteps ) );
        b = b.concat(at.linspace(fromrgba[2], torgba[2], nsteps ) );
        a = a.concat(at.linspace(fromrgba[3], torgba[3], nsteps ) );
    }

    r = r.map( Math.round );
    g = g.map( Math.round );
    b = b.map( Math.round );

    colors = at.zip(r, g, b, a);

    if (format === 'hex') colors = colors.map( rgb2hex );
    if (format === 'rgbaString') colors = colors.map( rgbaStr );

    return colors;
};


function rgb2hex (rgba) {
    var dig, hex = '#';
    for (var i = 0; i < 3; ++i) {
        dig = rgba[i];
        dig = dig.toString(16);
        hex += ('00' + dig).substr( dig.length );
    }
    return hex;
}

function rgbaStr (rgba) {
    return 'rgba(' + rgba.join(',') + ')';
}

},{"./colorScales":6,"arraytools":8,"clone":9}],8:[function(require,module,exports){
'use strict';

var arraytools  = function () {

  var that = {};

  var RGB_REGEX =  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,.*)?\)$/;
  var RGB_GROUP_REGEX = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(.*)?\)$/;

  function isPlainObject (v) {
    return !Array.isArray(v) && v !== null && typeof v === 'object';
  }

  function linspace (start, end, num) {
    var inc = (end - start) / Math.max(num - 1, 1);
    var a = [];
    for( var ii = 0; ii < num; ii++)
      a.push(start + ii*inc);
    return a;
  }

  function zip () {
      var arrays = [].slice.call(arguments);
      var lengths = arrays.map(function (a) {return a.length;});
      var len = Math.min.apply(null, lengths);
      var zipped = [];
      for (var i = 0; i < len; i++) {
          zipped[i] = [];
          for (var j = 0; j < arrays.length; ++j) {
              zipped[i][j] = arrays[j][i];
          }
      }
      return zipped;
  }

  function zip3 (a, b, c) {
      var len = Math.min.apply(null, [a.length, b.length, c.length]);
      var result = [];
      for (var n = 0; n < len; n++) {
          result.push([a[n], b[n], c[n]]);
      }
      return result;
  }

  function sum (A) {
    var acc = 0;
    accumulate(A, acc);
    function accumulate(x) {
      for (var i = 0; i < x.length; i++) {
        if (Array.isArray(x[i]))
          accumulate(x[i], acc);
        else
          acc += x[i];
      }
    }
    return acc;
  }

  function copy2D (arr) {
    var carr = [];
    for (var i = 0; i < arr.length; ++i) {
      carr[i] = [];
      for (var j = 0; j < arr[i].length; ++j) {
        carr[i][j] = arr[i][j];
      }
    }

    return carr;
  }


  function copy1D (arr) {
    var carr = [];
    for (var i = 0; i < arr.length; ++i) {
      carr[i] = arr[i];
    }

    return carr;
  }


  function isEqual(arr1, arr2) {
    if(arr1.length !== arr2.length)
      return false;
    for(var i = arr1.length; i--;) {
      if(arr1[i] !== arr2[i])
        return false;
    }

    return true;
  }


  function str2RgbArray(str, twoFiftySix) {
    // convert hex or rbg strings to 0->1 or 0->255 rgb array
    var rgb,
        match;

    if (typeof str !== 'string') return str;

    rgb = [];
    // hex notation
    if (str[0] === '#') {
      str = str.substr(1) // remove hash
      if (str.length === 3) str += str // fff -> ffffff
      match = parseInt(str, 16);
      rgb[0] = ((match >> 16) & 255);
      rgb[1] = ((match >> 8) & 255);
      rgb[2] = (match & 255);
    }

    // rgb(34, 34, 127) or rgba(34, 34, 127, 0.1) notation
    else if (RGB_REGEX.test(str)) {
      match = str.match(RGB_GROUP_REGEX);
      rgb[0] = parseInt(match[1]);
      rgb[1] = parseInt(match[2]);
      rgb[2] = parseInt(match[3]);
    }

    if (!twoFiftySix) {
      for (var j=0; j<3; ++j) rgb[j] = rgb[j]/255
    }


    return rgb;
  }


  function str2RgbaArray(str, twoFiftySix) {
    // convert hex or rbg strings to 0->1 or 0->255 rgb array
    var rgb,
        match;

    if (typeof str !== 'string') return str;

    rgb = [];
    // hex notation
    if (str[0] === '#') {
      str = str.substr(1) // remove hash
      if (str.length === 3) str += str // fff -> ffffff
      match = parseInt(str, 16);
      rgb[0] = ((match >> 16) & 255);
      rgb[1] = ((match >> 8) & 255);
      rgb[2] = (match & 255);
    }

    // rgb(34, 34, 127) or rgba(34, 34, 127, 0.1) notation
    else if (RGB_REGEX.test(str)) {
      match = str.match(RGB_GROUP_REGEX);
      rgb[0] = parseInt(match[1]);
      rgb[1] = parseInt(match[2]);
      rgb[2] = parseInt(match[3]);
      if (match[4]) rgb[3] = parseFloat(match[4]);
      else rgb[3] = 1.0;
    }



    if (!twoFiftySix) {
      for (var j=0; j<3; ++j) rgb[j] = rgb[j]/255
    }


    return rgb;
  }





  that.isPlainObject = isPlainObject;
  that.linspace = linspace;
  that.zip3 = zip3;
  that.sum = sum;
  that.zip = zip;
  that.isEqual = isEqual;
  that.copy2D = copy2D;
  that.copy1D = copy1D;
  that.str2RgbArray = str2RgbArray;
  that.str2RgbaArray = str2RgbaArray;

  return that

}


module.exports = arraytools();

},{}],9:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)
},{"buffer":1}]},{},[5]);
