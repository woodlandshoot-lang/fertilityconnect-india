// src/utils/encryption.js
// AES-256-CBC encryption for lead private data
// Patient phone/email/name encrypted before saving to DB
// Decrypted only after hospital pays to unlock

const CryptoJS = require('crypto-js');
const env      = require('../config/env');

// Encrypt a string
const encrypt = (plainText) => {
  if (!plainText) return null;
  const encrypted = CryptoJS.AES.encrypt(
    plainText,
    env.encryption.key
  ).toString();
  return encrypted;
};

// Decrypt a string
const decrypt = (cipherText) => {
  if (!cipherText) return null;
  try {
    const bytes     = CryptoJS.AES.decrypt(cipherText, env.encryption.key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
};

// Encrypt all private fields of a lead at once
const encryptLeadPrivate = ({ name, phone, email, notes_private }) => ({
  name_encrypted:   encrypt(name),
  phone_encrypted:  encrypt(phone),
  email_encrypted:  encrypt(email),
  notes_private:    encrypt(notes_private),
});

// Decrypt all private fields of a lead
const decryptLeadPrivate = ({ name_encrypted, phone_encrypted, email_encrypted, notes_private }) => ({
  name:          decrypt(name_encrypted),
  phone:         decrypt(phone_encrypted),
  email:         decrypt(email_encrypted),
  notes_private: decrypt(notes_private),
});

module.exports = { encrypt, decrypt, encryptLeadPrivate, decryptLeadPrivate };
