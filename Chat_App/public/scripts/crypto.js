"use strict";

//cria um objeto de criptografia RSA assimétrica
var rsaEncry = new JSEncrypt();

var characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz*&-%/!?*+=()";

<<<<<<< HEAD
// gerar uma chave simétrica
// pass in the desired length of your key
=======
// create a key for symmetric encryption
>>>>>>> main
function generateKey(keyLength) {
    var randomstring = '';

    for (var i = 0; i < keyLength; i++) {
        var rnum = Math.floor(Math.random() * characters.length);
        randomstring += characters.substring(rnum, rnum + 1);
    }
   // console.log("A string:" + randomstring);
    return randomstring;
    
}

// criar um par de chaves públicas e privadas para criptografia assimétrica
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

// symmetric AES encryption
String.prototype.symEncrypt = function (pass) {
    return CryptoJS.AES.encrypt(this, pass).toString();
}

// symmetric AES decryption
String.prototype.symDecrypt = function (pass) {
    var bytes = CryptoJS.AES.decrypt(this, pass);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// asymmetric RSA encryption
String.prototype.asymEncrypt = function (publicKey) {
    rsaEncry.setPublicKey(publicKey);
   // console.log("Public Key:" + publicKey);
    return rsa.encrypt(this);
}

// asymmetric RSA decryption
String.prototype.asymDecrypt = function (privateKey) {
    rsaEncry.setPrivateKey(privateKey);
    //console.log("Private Key:" + privateKey);
    return rsa.decrypt(this);
}

function getCipherKeys() {
    var keys = localStorage.cipherKeys; 
    if (keys == null) {
        keys = generateKeyPair();

        // store keys as json in localStorage
        localStorage.cipherKeys = JSON.stringify(keys);
        return keys;
    }

    return JSON.parse(keys);
}