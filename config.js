// Info: Configuration file
'use strict';


// Export configration as key-value Map
module.exports = {

  // Default Session Actor. More Actors can be added at the time of module initialization
  ACTOR :  {
    'user' : {
      DB_TYPE         : 'dynamodb',       // Database source type [json | dynamodb]
      DB_SOURCE       : 'session_table',  // Database tablename (defaul: session)
      HASH_SALT       : '12345abc',       // Salt used for hashing token-secret
      SESSION_LIMIT   : 15,               // Maximum number of active sessions (AWS DynamoDB has limit of 1MB of records that can be fetched in a single query. Keeping it lean within reasonable access limit)
      TTL             : 31536000,         // Session Time to Live - Session record expiry in seconds. 60 * 60 * 24 * 365
      TOLA_INTERVAL   : 3600,             // Session Time of Last Access Update interval frequency - Update last access timestamp only after every 1 hour (In Seconds)
      COOKIE_PREFIX   : 'tu_',            // Session Cookie key prefix (Token User -> TU)
    }
  },


  // Constraints on Auth ID
  AUTH_ID_SANATIZE_REGX   : /[^0-9A-Za-z- ]/gi,    // Regular expression for valid Characters. Alphabets, digits, hyphen. Case Sensitive

  // Constraints on Token
  TOKEN_KEY_LENGTH        : 20,
  TOKEN_SECRET_LENGTH     : 40,

  // Constraints on Token Key and Secret
  RANDOMIZER_CHARSET      : '01234567890123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', // Digits, Uppercase Alphabets, Lowercase Alphabets


  // Authorization Header
  AUTH_HEADER_NAME        : 'token', // HTTP Header name which will contain authentication string
  BEARER_HEADER_NAME      : 'authorization', // HTTP Header name which will contain Bearer based authentication string


  // Platform Codes
  APP_PLATFORMS: {
    'webapp'      : 0,
    'ios'         : 1,
    'android'     : 2
  },


  // Error Codes
  UNKNOWN_DATA_SOURCE : {
    CODE: 'UNKNOWN_DATA_SOURCE',
    MESSAGE: 'INTERNAL: Session datasource type is unknown'
  },
  DATABASE_WRITE_FAILED : {
    CODE: 'DATABASE_WRITE_FAILED',
    MESSAGE: 'Faied to write into session database'
  },

}
