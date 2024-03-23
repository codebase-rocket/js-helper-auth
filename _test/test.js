// Info: Test Cases
'use strict';

// Shared Dependencies
var Lib = {};

// Set Configrations
const nodb_config = { // Config AWS DynamoDB
  'KEY': 'todo',
  'SECRET': 'todo',
  'REGION': 'ap-south-1'
};

// Set Configrations
// Hash Salt
const hash_salt_for_actor_type1 = 'random_string_A';
const hash_salt_for_actor_type2 = 'random_string_A';

// Actor Types
const actor_type1 = 'admin';
const actor_type2 = 'user';

// Test JSON DB
const local_db = {
  'todo.todo.todo': { // Token Key: todo, Token Secret: todo
    'pc'      : 0,            // Web App
    'toc'     : null,         // Time of Creation
    'toe'     : null,         // Time of Expiry
    'tola'    : null,         // Time of Last Accessed
    'stid'    : null,         // Site-ID
    'aid'     : '0000000000', // Actor-ID
  }
};

// Configure Auth Module (Local DB)
const auth_config = {
  ACTOR: {
    [actor_type1]: {
      DB_TYPE          : 'json',          // Database source type json
      DB_SOURCE        : local_db,        // Database
      HASH_SALT        : hash_salt_for_actor_type1,      // Salt used for hashing token-secret
      SESSION_LIMIT    : 15,              // Maximum number of active sessions (AWS DynamoDB has limit of 1MB of records that can be fetched in a single query. Keeping it lean within reasonable access limit)
      TTL              : 31536000,        // Session Time to Live - Session record expiry in seconds. 60 * 60 * 24 * 365
      TOLA_INTERVAL    : null,            // Session Time of Last Access Update interval frequency - not applicable for local db
      COOKIE_PREFIX    : 'ta_',           // Session Cookie key prefix (Token Admin -> TA)
    },
    [actor_type2]: {
      DB_TYPE          : 'dynamodb',      // Database source type [JSON | DynamoDB]
      DB_SOURCE        : 'test_session_actor',  // Database tablename (default: session)
      HASH_SALT        : hash_salt_for_actor_type2,      // Salt used for hashing token-secret
      SESSION_LIMIT    : 2,              // Maximum number of active sessions (AWS DynamoDB has limit of 1MB of records that can be fetched in a single query. Keeping it lean within reasonable access limit)
      TTL              : 31536000,        // Session Time to Live - Session record expiry in seconds. 60 * 60 * 24 * 365
      TOLA_INTERVAL    : 3600,            // Session Time of Last Access Update interval frequency - Update last access timestamp only after every 1 hour (In Seconds)
      COOKIE_PREFIX    : 'tu_',           // Session Cookie key prefix (Token User -> TU)
    }
  }
};

// Dependencies
Lib.Utils = require('js-helper-utils');
Lib.Debug = require('js-helper-debug')(Lib);
Lib.Crypto = require('js-helper-crypto-nodejs')(Lib);
Lib.Instance = require('js-helper-instance')(Lib);
Lib.HttpHandler = require('js-helper-http-handler')(Lib);
Lib.NoDB = require('js-helper-aws-dynamodb')(Lib, nodb_config);
const [ Auth, AuthInput, AuthData ] = require('js-helper-auth')(Lib, auth_config);


////////////////////////////SIMILUTATIONS//////////////////////////////////////


// function to simulate http-gateway callback
var fake_httpGatewayCallback = function(error, return_response){

  if(error){
    Lib.Debug.logErrorForResearch(error);
  }

  Lib.Debug.log('return_response', return_response);

};


function test_output(err, response){ // Err, Result are from previous function

  if(err){ // If error
    Lib.Debug.log('HTTP Error Code:', err.code );
    Lib.Debug.log('HTTP Error Msg:', err.message );
  }
  else{
    Lib.Debug.log('response:', response );
  }

};

///////////////////////////////////////////////////////////////////////////////


/////////////////////////////STAGE SETUP///////////////////////////////////////

// Load Dummy event Data
const event_bearer_token = require('./dummy_data/event-bearer-auth.json');
const event_http_header = require('./dummy_data/event-header-auth.json');
const event_cookie = require('./dummy_data/event-cookie-auth.json');


// Test Token
const token_key = 'todo';
const token_secret = 'todo';

// Partition ID
const partition_id = 'abc';

// Actor Details
const actor_id = '0000000000';

// Platform
const platform_code = 0;

// Client-Info
var client_info = {
  'screen_width'  : 720,
  'screen_height' : 1600,
  'client'        : 'chrome',
  'client_version': '84.92.2.1',
  'is_browser'    : true,
  'os'            : 'ios',
  'os_version'    : '15.1.12',
  'ip_address'    : '198.0.0.1'
};




// Initialize 'instance'
var instance = Lib.Instance.initialize();

///////////////////////////////////////////////////////////////////////////////


/////////////////////////////////TESTS/////////////////////////////////////////

/*

// Verify a session in Local JSON (Bearer Auth)
Lib.HttpHandler.initHttpRequestData(instance, event_bearer_token, null, fake_httpGatewayCallback, 'aws');
Auth.verify(
  instance,
  test_output,
  partition_id,
  actor_type1
);


// Verify a session in Local JSON (HTTP Cookie Auth)
Lib.HttpHandler.initHttpRequestData(instance, event_cookie, null, fake_httpGatewayCallback, 'aws');
Auth.verify(
  instance,
  test_output,
  partition_id,
  actor_type1
);


// Verify a session in DynamoDB (HTTP Header Auth)
Lib.HttpHandler.initHttpRequestData(instance, event_http_header, null, fake_httpGatewayCallback, 'aws');
Auth.verify(
  instance,
  test_output,
  partition_id,
  actor_type2
);

// Platform Text to Code
Lib.Debug.log(
  'createPlatformCode()',
  AuthData.createPlatformCode('webapp')
);

*/


// Add session in DynamoDB
/*Auth.start(
  instance,
  test_output,
  partition_id,
  actor_type2,
  actor_id,
  platform_code,
  null,
  client_info
);*/


// Remove session in DynamoDB
/*Auth.remove(
  instance,
  test_output,
  partition_id,
  actor_type2,
  '0000000000.todo.todo'
);*/


// Remove all session in DynamoDB
/*Auth.removeAll(
  instance,
  test_output,
  partition_id,
  actor_type2,
  '0000000000'
);*/


// Get all session in DynamoDB
/*Auth.getSessions(
  instance,
  test_output,
  partition_id,
  actor_type2,
  '0000000000'
);*/

///////////////////////////////////////////////////////////////////////////////
