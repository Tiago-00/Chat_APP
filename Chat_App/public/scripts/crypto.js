"use strict";

// Create the encryption object for asymmetric RSA algorithm.
var rsa = new JSEncrypt();

var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz*&-%/!?*+=()";

// create a key for symmetric encryption
// pass in the desired length of your key
function generateKey(keyLength) {
    var randomstring = '';

    for (var i = 0; i < keyLength; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum, rnum + 1);
    }
   // console.log("A string:" + randomstring);
    return randomstring;
    
}

// create the pair public and private key for asymmetric encryption
var generateKeyPair = function () {
    var crypt = new JSEncrypt({ default_key_size: 1024 });
    crypt.getKey();

    return {
        privateKey: crypt.getPrivateKey(),
        publicKey: crypt.getPublicKey()    
    }
};

// hasing text by sha-512 algorithm
String.prototype.getHash = function () {
    return CryptoJS.SHA512(this).toString();
}

// symmetric 3DES encryption
String.prototype.symEncrypt = function (pass) {
    return CryptoJS.AES.encrypt(this, pass).toString();
}

// symmetric 3DES decryption
String.prototype.symDecrypt = function (pass) {
    var bytes = CryptoJS.AES.decrypt(this, pass);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// asymmetric RSA encryption
String.prototype.asymEncrypt = function (publicKey) {
    rsa.setPublicKey(publicKey);
   // console.log("Public Key:" + publicKey);
    return rsa.encrypt(this);
}

// asymmetric RSA decryption
String.prototype.asymDecrypt = function (privateKey) {
    rsa.setPrivateKey(privateKey);
    //console.log("Private Key:" + privateKey);
    return rsa.decrypt(this);
}

function getCipherKeys() {
    var keys = localStorage.cipherKeys; // read keys json 
    if (keys == null) {
        keys = generateKeyPair();

        // store keys as json in localStorage
        localStorage.cipherKeys = JSON.stringify(keys);
        return keys;
    }

    return JSON.parse(keys);
}